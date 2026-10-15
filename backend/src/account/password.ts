// 비밀번호 바꾸기·관리자 초기화 (비밀번호를 잊었을 때 대비).
// 가입할 때 이메일을 받지 않아서 재설정 메일을 보낼 수 없다. 그래서
// - 카카오·구글을 연동해 둔 회원은 그 소셜로 로그인한 뒤 FRESH_MINUTES 안에는 지금 비밀번호 없이 새 비밀번호를 정한다
// - 연동하지 않은 회원은 문의하면 관리자가 임시 비밀번호를 만들어 준다 (backend/src/routes/admin.ts)
import { randomInt } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { accounts, loginAttempts, sessions, users } from "../db/schema";
import { FRESH_MINUTES } from "./password-rules";

export { checkNewPassword, FRESH_MINUTES } from "./password-rules";

/** 이 회원에게 아이디·비밀번호 말고 연동된 소셜이 있는지 */
export async function hasSocialAccount(userId: string) {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), ne(accounts.providerId, "credential")))
    .limit(1);
  return Boolean(row);
}

/** 지금 비밀번호 없이 바꿀 수 있는지: 소셜을 연동했고, 이 로그인이 FRESH_MINUTES 안에 시작됐다 */
export async function canSkipCurrentPassword(userId: string, sessionCreatedAt: Date) {
  const fresh = Date.now() - sessionCreatedAt.getTime() < FRESH_MINUTES * 60_000;
  return fresh && (await hasSocialAccount(userId));
}

/**
 * 비밀번호를 바꾼다. keepSessionId가 있으면 그 로그인(지금 쓰는 브라우저)만 남기고 다른 기기는 로그아웃,
 * 없으면 모든 기기가 로그아웃된다. 그 아이디의 로그인 실패 횟수(5번 실패 잠금)도 지운다.
 * 아이디·비밀번호가 없는 회원이면 false
 */
export async function setMemberPassword(userId: string, password: string, keepSessionId?: string) {
  const hash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(accounts)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
      .returning({ id: accounts.id });
    if (!updated.length) return false;
    await tx
      .delete(sessions)
      .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId));
    const [user] = await tx.select({ username: users.username }).from(users).where(eq(users.id, userId));
    if (user?.username) await tx.delete(loginAttempts).where(eq(loginAttempts.loginKey, user.username.toLowerCase()));
    return true;
  });
}

// 헷갈리는 글자(0·o·1·l·i)를 뺀 소문자·숫자
const TEMP_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

/** 관리자가 만들어 주는 임시 비밀번호 (10자) */
export function makeTempPassword() {
  return Array.from({ length: 10 }, () => TEMP_CHARS[randomInt(TEMP_CHARS.length)]).join("");
}
