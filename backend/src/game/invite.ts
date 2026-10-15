import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { pointLedger, profiles } from "../db/schema";
import { lockUser, type Tx } from "./points";
import { INVITE_REWARD_COINS } from "./rules";

/**
 * 친구 초대 보상 (GAME-09): 초대받아 가입한 친구가 보상 조건(새 글·공개·본문 100자 이상)을 채운 첫 글을 저장할 때
 * 친구와 초대한 사람에게 🪙 50씩(경험치 없음) 한 번 준다. 하루 상한·전체 횟수 제한은 없다.
 * - 한 번만: profiles.invite_rewarded_at을 NULL → 지금으로 바꾸는 UPDATE가 성공한 요청만 지급한다 (동시에 글 여러 개를 저장해도 1번)
 * - 친구가 탈퇴하면 글을 쓸 수 없으니 지급되지 않고, 초대한 사람이 탈퇴했으면(invited_by가 비워짐) 둘 다 받지 않는다
 * 반드시 친구(friendId)를 lockUser로 잠근 트랜잭션 안에서 부른다. 초대한 사람도 여기서 잠근다 (잠금 순서: 친구 → 초대한 사람)
 */
export async function grantInviteReward(tx: Tx, friendId: string): Promise<boolean> {
  const [row] = await tx
    .update(profiles)
    .set({ inviteRewardedAt: new Date() })
    .where(and(eq(profiles.userId, friendId), isNotNull(profiles.invitedBy), isNull(profiles.inviteRewardedAt)))
    .returning({ inviterId: profiles.invitedBy });
  if (!row?.inviterId) return false;
  await lockUser(tx, row.inviterId);
  await tx.insert(pointLedger).values([
    { userId: friendId, reason: "invited", coinDelta: INVITE_REWARD_COINS, refId: row.inviterId },
    { userId: row.inviterId, reason: "invite", coinDelta: INVITE_REWARD_COINS, refId: friendId },
  ]);
  return true;
}
