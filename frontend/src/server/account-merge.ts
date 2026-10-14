import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, profiles, users } from "@/db/schema";
import { lockUser } from "@/server/points";

export class MergeRefused extends Error {}

/**
 * 한 회원 = 아이디 하나 (/account-setup의 [이미 아이디가 있어요]).
 * 소셜로 처음 들어와 생긴 빈 회원(fromId)의 소셜 계정(accounts 행)을 기존 아이디 회원(toId)으로 옮기고 빈 회원은 지운다.
 * - 빈 회원은 프로필도 아이디·비밀번호(credential)도 없어야 한다. 아니면 MergeRefused
 * - 기존 회원에 같은 소셜(예: 카카오)이 이미 붙어 있으면 그 계정은 옮기지 않는다 (빈 회원과 함께 지워진다)
 * 반환: 옮긴 계정과 옮기지 않은 소셜. 연동 보상은 부른 쪽이 트랜잭션이 끝난 뒤 준다
 */
export async function mergeSocialOnlyUser(fromId: string, toId: string) {
  if (fromId === toId) return { moved: [], skipped: [] };
  return db.transaction(async (tx) => {
    // 두 회원을 같은 순서로 잠근다 (서로 반대로 합치려는 요청이 겹쳐도 교착되지 않게)
    for (const id of [fromId, toId].sort()) await lockUser(tx, id);

    const [profile] = await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, fromId));
    const fromAccounts = await tx
      .select({ id: accounts.id, providerId: accounts.providerId, accountId: accounts.accountId })
      .from(accounts)
      .where(eq(accounts.userId, fromId));
    if (profile || fromAccounts.some((a) => a.providerId === "credential")) throw new MergeRefused();

    const taken = new Set(
      (await tx.select({ providerId: accounts.providerId }).from(accounts).where(eq(accounts.userId, toId))).map((r) => r.providerId),
    );
    const moved = fromAccounts.filter((a) => !taken.has(a.providerId));
    const skipped = fromAccounts.filter((a) => taken.has(a.providerId)).map((a) => a.providerId);
    if (moved.length) {
      await tx
        .update(accounts)
        .set({ userId: toId, updatedAt: new Date() })
        .where(and(eq(accounts.userId, fromId), inArray(accounts.id, moved.map((a) => a.id))));
    }
    // 빈 회원과 그 세션·옮기지 않은 소셜 계정을 지운다 (FK cascade)
    await tx.delete(users).where(eq(users.id, fromId));
    return { moved: moved.map(({ providerId, accountId }) => ({ providerId, accountId })), skipped };
  });
}
