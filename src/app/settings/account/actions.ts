"use server";

import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireUser } from "@/server/dal";
import { deleteMember } from "@/server/withdraw";

export type WithdrawState = { error?: string };

/**
 * 회원 탈퇴 (AUTH-06). 재확인: 아이디 회원은 비밀번호를 다시 입력하고, 소셜 회원은 화면의 확인 창만 (spec 001 FR-031).
 * 유예 기간 없이 바로 지운다. 끝나면 로그인 상태를 끝내고 첫 화면으로 간다.
 */
export async function withdraw(_prev: WithdrawState, formData: FormData): Promise<WithdrawState> {
  const viewer = await requireUser(); // 온보딩 전 회원도 탈퇴할 수 있다 (지울 블로그가 없을 뿐)

  const [credential] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, viewer.userId), eq(accounts.providerId, "credential")));
  if (credential?.password) {
    const password = String(formData.get("password") ?? "");
    if (!password) return { error: "비밀번호를 적어 주세요" };
    if (!(await verifyPassword({ hash: credential.password, password }))) return { error: "비밀번호가 맞지 않아요" };
  }

  await deleteMember(viewer.userId);

  // 세션 행은 회원과 함께 지워졌다. 브라우저의 로그인 쿠키도 지운다
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // 세션이 이미 없으면 실패할 수 있다 → 아래에서 쿠키를 직접 지운다
  }
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.includes("better-auth.")) jar.delete(c.name);

  revalidatePath("/", "layout");
  redirect("/?withdrawn=1");
}
