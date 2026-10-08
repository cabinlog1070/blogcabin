"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { blogs, categories, items, profiles, userItems } from "@/db/schema";
import { generateInviteCode, INVITE_COOKIE, normalizeInviteCode } from "@/lib/invite";
import { requireUser } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { grantReward, lockUser } from "@/server/points";

const schema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, "닉네임은 2자 이상이에요")
    .max(12, "닉네임은 12자까지예요")
    .refine((n) => n !== "관리자", "이 닉네임은 쓸 수 없어요"), // 관리자 계정의 닉네임 (AUTH-08)
  blogTitle: z.string().trim().min(1, "블로그 이름을 적어 주세요").max(12, "블로그 이름은 12자까지예요"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,12}$/, "주소는 영문 소문자, 숫자, _ 로 3~12자예요"), // DB는 20자까지 받지만 화면에서는 12자로 줄였다 (2026-10-08)
  characterId: z.coerce.number().int().positive("캐릭터를 골라 주세요"),
});
type Field = keyof z.infer<typeof schema> | "inviteCode";

export type OnboardingState = {
  errors?: Partial<Record<Field, string>>;
  message?: string;
  values?: Record<string, string>;
};

// 화면 주소와 겹치거나 관리자 공지 블로그(notice, npm run admin:create)로 남겨 둔 주소
const RESERVED_SLUGS = new Set(["admin", "api", "town", "feed", "shop", "closet", "write", "settings", "blog", "onboarding", "farm", "notice", "blogcabin"]);

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const viewer = await requireUser();
  if (viewer.profile) redirect("/town");

  const raw = Object.fromEntries(
    ["nickname", "blogTitle", "slug", "characterId", "inviteCode"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const parsed = schema.safeParse(raw);
  // 초대 코드 (GAME-09): 선택. 대소문자 구분 없이, 형식이 틀리면 없는 코드와 같다
  const inviteCode = normalizeInviteCode(raw.inviteCode);
  if (!parsed.success || inviteCode === null) {
    const errors: OnboardingState["errors"] = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const key = issue.path[0] as Field;
      errors[key] ??= issue.message;
    }
    if (inviteCode === null) errors.inviteCode = "없는 초대 코드예요";
    return { errors, values: raw };
  }
  const input = parsed.data;
  if (RESERVED_SLUGS.has(input.slug)) {
    return { errors: { slug: "이 주소는 쓸 수 없어요" }, values: raw };
  }

  // 내 초대 코드는 무작위라 아주 드물게 남과 겹칠 수 있다 → 겹치면(UNIQUE 위반) 새 코드로 몇 번 더 시도한다
  for (let attempt = 1; ; attempt++) {
    const result = await createResident(viewer.userId, input, inviteCode, raw);
    if (result !== "RETRY_INVITE_CODE") {
      if (result) return result;
      break;
    }
    if (attempt >= 5) throw new Error("초대 코드를 만들지 못했어요");
  }

  // 초대 링크로 기억해 둔 코드는 다 썼으니 지운다
  (await cookies()).delete(INVITE_COOKIE);
  revalidatePath("/", "layout"); // 헤더에 코인·캐릭터가 바로 보이도록
  redirect("/town?welcome=1");
}

/** 온보딩 한 번에 필요한 것을 모두 한 트랜잭션으로 만든다. 성공하면 undefined */
async function createResident(
  userId: string,
  input: z.infer<typeof schema>,
  inviteCode: string,
  raw: Record<string, string>,
): Promise<OnboardingState | "RETRY_INVITE_CODE" | undefined> {
  try {
    await db.transaction(async (tx) => {
      await lockUser(tx, userId);

      // 나를 초대한 회원: 코드로 찾는다. 없으면 `없는 초대 코드예요`, 자기 자신은 안 된다 (GAME-09, DB CHECK도 막는다)
      let invitedBy: string | null = null;
      if (inviteCode) {
        const [inviter] = await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.inviteCode, inviteCode));
        if (!inviter || inviter.userId === userId) throw new Error("INVALID_INVITE");
        invitedBy = inviter.userId;
      }

      // 고른 캐릭터가 정말 "기본 캐릭터"인지 서버에서 다시 확인
      const [character] = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.id, input.characterId), eq(items.type, "character"), eq(items.isStarter, true)));
      if (!character) throw new Error("INVALID_CHARACTER");

      const [background] = await tx.select({ id: items.id }).from(items).where(eq(items.code, "bg_meadow"));

      // 고른 캐릭터(남자/여자) 하나만 지급하고 장착한다 (GAME-01)
      await tx.insert(userItems).values([
        { userId: userId, itemId: character.id },
        { userId: userId, itemId: background.id },
      ]);
      await tx.insert(profiles).values({
        userId: userId,
        nickname: input.nickname,
        characterItemId: character.id,
        inviteCode: generateInviteCode(),
        invitedBy,
      });
      const [blog] = await tx
        .insert(blogs)
        .values({
          ownerId: userId,
          slug: input.slug,
          title: input.blogTitle,
          backgroundItemId: background.id,
        })
        .returning({ id: blogs.id });
      await tx.insert(categories).values({ blogId: blog.id, name: "일상", position: 0 });
      await grantReward(tx, userId, "signup");
    });
  } catch (err) {
    const constraint = uniqueViolation(err);
    if (constraint?.includes("nickname")) return { errors: { nickname: "이미 있는 닉네임이에요" }, values: raw };
    if (constraint?.includes("slug")) return { errors: { slug: "이미 있는 주소예요" }, values: raw };
    if (constraint?.includes("invite_code")) return "RETRY_INVITE_CODE";
    if (err instanceof Error && err.message === "INVALID_CHARACTER") {
      return { errors: { characterId: "고를 수 없는 캐릭터예요" }, values: raw };
    }
    if (err instanceof Error && err.message === "INVALID_INVITE") {
      return { errors: { inviteCode: "없는 초대 코드예요" }, values: raw };
    }
    throw err;
  }
}
