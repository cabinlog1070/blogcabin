// 마을 주민 등록 (온보딩, AUTH-02): POST /api/v1/onboarding
// 아이디·비밀번호가 있고 아직 주민 등록 전인 회원이 닉네임·블로그·캐릭터·초대 코드(선택)를 정한다.
// 칸마다 틀린 이유는 errors { 칸 이름: 한국어 문장 }으로 돌려주고, 화면이 보는 사람의 언어로 바꿔 칸 아래에 보여 준다.
// 끝나면 화면이 광장(/town?welcome=1)으로 간다
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { grantSocialLinkRewardsFor } from "../auth/social-link-reward";
import { ADMIN_NICKNAME, nicknameError } from "../blog/profile-rules";
import { db } from "../db";
import { blogs, categories, follows, items, profiles, userItems, users } from "../db/schema";
import { giveStarterHair } from "../db/starter-hair";
import { generateInviteCode, INVITE_COOKIE, normalizeInviteCode } from "../game/invite-code";
import { grantReward, lockUser } from "../game/points";
import { readJson, requireViewer, type GuardEnv } from "../http/guard";
import { uniqueViolation } from "../lib/db-errors";

const msg = <S extends string>(text: S): S => text;

/** 새 블로그의 첫 카테고리 (화면 lib/i18n의 DEFAULT_CATEGORY와 같은 이름, 일본어 화면은 "日常"으로 보여 준다) */
const DEFAULT_CATEGORY = msg("일상");

// 화면 주소와 겹치거나 관리자 공지 블로그(notice, npm run admin:create)로 남겨 둔 주소
const RESERVED_SLUGS = new Set(["admin", "api", "town", "feed", "shop", "closet", "write", "settings", "blog", "onboarding", "farm", "notice", "blogcabin"]);

type Field = "nickname" | "blogTitle" | "slug" | "characterId" | "inviteCode";
type Errors = Partial<Record<Field, string>>;
type Resident = { nickname: string; blogTitle: string; slug: string; characterId: number; inviteCode: string };

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** 화면이 보낸 값 확인. 맞으면 값, 틀리면 칸마다 이유 */
function readResident(body: Record<string, unknown>): Resident | { errors: Errors } {
  const errors: Errors = {};
  const nickname = str(body.nickname).trim();
  const nicknameProblem = nicknameError(nickname) ?? (nickname === ADMIN_NICKNAME ? msg("이 닉네임은 쓸 수 없어요") : null);
  if (nicknameProblem) errors.nickname = nicknameProblem;

  const blogTitle = str(body.blogTitle).trim();
  if (!blogTitle) errors.blogTitle = msg("블로그 이름을 적어 주세요");
  else if (blogTitle.length > 12) errors.blogTitle = msg("블로그 이름은 12자까지예요");

  // DB는 20자까지 받지만 화면에서는 12자로 줄였다 (2026-10-08)
  const slug = str(body.slug).trim().toLowerCase();
  if (!/^[a-z0-9_]{3,12}$/.test(slug)) errors.slug = msg("주소는 영문 소문자, 숫자, _ 로 3~12자예요");
  else if (RESERVED_SLUGS.has(slug)) errors.slug = msg("이 주소는 쓸 수 없어요");

  const characterId = Number(str(body.characterId).trim() || 0);
  if (!Number.isSafeInteger(characterId) || characterId <= 0) errors.characterId = msg("캐릭터를 골라 주세요");

  // 초대 코드 (GAME-09): 선택. 대소문자 구분 없이, 형식이 틀리면 없는 코드와 같다
  const inviteCode = normalizeInviteCode(str(body.inviteCode));
  if (inviteCode === null) errors.inviteCode = msg("없는 초대 코드예요");

  if (Object.keys(errors).length || inviteCode === null) return { errors };
  return { nickname, blogTitle, slug, characterId, inviteCode };
}

/** 주민 등록 한 번에 필요한 것을 모두 한 트랜잭션으로 만든다. 성공하면 null, 칸이 틀리면 그 이유 */
async function createResident(userId: string, input: Resident): Promise<Errors | "RETRY_INVITE_CODE" | null> {
  try {
    await db.transaction(async (tx) => {
      await lockUser(tx, userId);

      // 나를 초대한 회원: 코드로 찾는다. 없으면 `없는 초대 코드예요`, 자기 자신은 안 된다 (GAME-09, DB CHECK도 막는다)
      let invitedBy: string | null = null;
      if (input.inviteCode) {
        const [inviter] = await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.inviteCode, input.inviteCode));
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
        { userId, itemId: character.id },
        { userId, itemId: background.id },
      ]);
      await tx.insert(profiles).values({
        userId,
        nickname: input.nickname,
        characterItemId: character.id,
        inviteCode: generateInviteCode(),
        invitedBy,
      });
      // 고른 주민의 머리(짧은 머리·긴 머리)를 헤어 아이템으로 주고 입혀 둔다
      await giveStarterHair(tx, userId);
      const [blog] = await tx
        .insert(blogs)
        .values({ ownerId: userId, slug: input.slug, title: input.blogTitle, backgroundItemId: background.id })
        .returning({ id: blogs.id });
      await tx.insert(categories).values({ blogId: blog.id, name: DEFAULT_CATEGORY, position: 0 });
      // 관리자(공지사항 블로그)는 모든 주민의 기본 이웃이다. 이웃 새 글에서 공지를 볼 수 있고, 원하면 취소할 수 있다
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .innerJoin(blogs, eq(blogs.ownerId, users.id))
        .where(eq(users.role, "admin"));
      if (admins.length) {
        await tx
          .insert(follows)
          .values(admins.map((a) => ({ followerId: userId, followeeId: a.id })))
          .onConflictDoNothing();
      }
      await grantReward(tx, userId, "signup");
    });
  } catch (err) {
    const constraint = uniqueViolation(err);
    if (constraint?.includes("nickname")) return { nickname: msg("이미 있는 닉네임이에요") };
    if (constraint?.includes("slug")) return { slug: msg("이미 있는 주소예요") };
    if (constraint?.includes("invite_code")) return "RETRY_INVITE_CODE";
    if (err instanceof Error && err.message === "INVALID_CHARACTER") return { characterId: msg("고를 수 없는 캐릭터예요") };
    if (err instanceof Error && err.message === "INVALID_INVITE") return { inviteCode: msg("없는 초대 코드예요") };
    throw err;
  }
  return null;
}

const fieldFail = (errors: Errors) => ({ ok: false as const, error: Object.values(errors)[0] ?? "", errors });

export const onboardingRoutes = new Hono<GuardEnv>()
  /** 주민 등록 화면: 고를 수 있는 기본 캐릭터 (남자/여자 주민) */
  .get("/", requireViewer("user"), async (c) =>
    c.json({
      starters: await db
        .select({ id: items.id, name: items.name, description: items.description, assetKey: items.assetKey })
        .from(items)
        .where(and(eq(items.type, "character"), eq(items.isStarter, true)))
        .orderBy(asc(items.id)),
    }),
  )
  .post("/", requireViewer("user"), async (c) => {
  const { userId, hasProfile } = c.get("viewer");
  // 이미 주민이면 광장으로
  if (hasProfile) return c.json({ ok: false, error: msg("이미 주민 등록을 마쳤어요"), redirect: "/town" }, 409);

  const input = readResident(await readJson(c));
  if ("errors" in input) return c.json(fieldFail(input.errors), 400);

  // 내 초대 코드는 무작위라 아주 드물게 남과 겹칠 수 있다 → 겹치면(UNIQUE 위반) 새 코드로 몇 번 더 시도한다
  for (let attempt = 1; ; attempt++) {
    const result = await createResident(userId, input);
    if (result !== "RETRY_INVITE_CODE") {
      if (result) return c.json(fieldFail(result), 400);
      break;
    }
    if (attempt >= 5) throw new Error("초대 코드를 만들지 못했어요");
  }

  // 소셜로 처음 가입한 회원은 주민 등록을 마칠 때 그 소셜 몫 연동 보상(🪙 100)을 받는다 (회원·소셜당 한 번)
  await grantSocialLinkRewardsFor(userId);

  // 초대 링크로 기억해 둔 코드는 다 썼으니 지운다
  deleteCookie(c, INVITE_COOKIE, { path: "/" });
  return c.json({ ok: true });
});
