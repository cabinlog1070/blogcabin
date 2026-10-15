// 알림함 (GAME-08)과 레벨업 팝업 (GAME-06)
// 알림은 사건이 일어난 동작의 같은 트랜잭션에서 만든다. 자기 행동은 알리지 않는다.
// 서버는 알림의 재료(종류·레벨·회원 이름·글 제목…)만 돌려주고, 보는 사람의 언어로 문장을 만드는 건 화면이 한다
// (frontend/src/lib/notification-text.ts)
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { animalSpecies, blogs, gifts, items, notifications, pointLedger, posts, profiles, userAnimals } from "../db/schema";
import type { Tx } from "../game/points";
import { houseStageForLevel, levelFromExp } from "../game/rules";
import { getUnseenGifts } from "../gifts/views";

export const NOTIFICATION_PAGE_SIZE = 20;
/** 헤더 쪽지에서 바로 보여주는 개수 */
export const NOTIFICATION_PANEL_SIZE = 20;

/**
 * 경험치를 막 기록한 뒤 레벨이 올랐는지 확인하고, 오른 레벨마다 level_up 알림을 남긴다 (GAME-06).
 * gainedExp = 방금 기록한 경험치. 반드시 lockUser를 건 트랜잭션 안에서, 원장 INSERT 뒤에 호출한다.
 * 같은 레벨 알림은 유니크 인덱스로 한 번만 생긴다.
 */
export async function recordLevelUps(tx: Tx, userId: string, gainedExp: number) {
  if (gainedExp <= 0) return;
  const [{ exp }] = await tx
    .select({ exp: sql<number>`COALESCE(SUM(${pointLedger.expDelta}), 0)::int` })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  const before = levelFromExp(exp - gainedExp);
  const after = levelFromExp(exp);
  if (after <= before) return;
  const rows = [];
  for (let level = before + 1; level <= after; level++) rows.push({ userId, kind: "level_up" as const, level });
  await tx.insert(notifications).values(rows).onConflictDoNothing();
}

type SocialKind = "like" | "comment" | "reply";

/** 공감·댓글·답글 알림 (SOC-01~03). 받는 사람과 행동한 사람이 같으면 만들지 않는다 */
export async function notifySocial(
  tx: Tx,
  n: { userId: string; actorId: string; kind: SocialKind; postId: number; refId?: string | number },
) {
  if (n.userId === n.actorId) return;
  await tx.insert(notifications).values({
    userId: n.userId,
    actorId: n.actorId,
    kind: n.kind,
    postId: n.postId,
    refId: n.refId === undefined ? null : String(n.refId),
  });
}

/**
 * 글·댓글 속 @주소 언급 알림. 글이면 refId 없이, 댓글이면 refId = 댓글 ID.
 * 같은 글(같은 댓글)에서 같은 사람을 이미 언급했으면 다시 보내지 않는다 (고쳐 저장할 때 새로 언급한 사람에게만)
 */
export async function notifyMentions(tx: Tx, n: { userIds: string[]; actorId: string; postId: number; refId?: number }) {
  const targets = n.userIds.filter((id) => id !== n.actorId);
  if (!targets.length) return;
  const refId = n.refId === undefined ? null : String(n.refId);
  const already = await tx
    .select({ userId: notifications.userId })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userId, targets),
        eq(notifications.actorId, n.actorId),
        eq(notifications.postId, n.postId),
        eq(notifications.kind, "mention"),
        refId === null ? isNull(notifications.refId) : eq(notifications.refId, refId),
      ),
    );
  const sent = new Set(already.map((r) => r.userId));
  const rows = targets.filter((id) => !sent.has(id)).map((userId) => ({ userId, actorId: n.actorId, kind: "mention" as const, postId: n.postId, refId }));
  if (rows.length) await tx.insert(notifications).values(rows);
}

/** 이 사람이 이 글에 공감했다는 알림을 이미 보냈는지 (취소 후 다시 공감할 때 또 보내지 않게) */
export async function hasLikeNotification(tx: Tx, userId: string, actorId: string, postId: number) {
  const [row] = await tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.actorId, actorId),
        eq(notifications.postId, postId),
        eq(notifications.kind, "like"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function countUnread(userId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return n;
}

const actorProfile = alias(profiles, "actor_profile");

export type NotificationKind = (typeof notifications.kind.enumValues)[number];

/** 알림 한 줄의 재료. 화면이 이것으로 문장과 누르면 갈 곳을 만든다 */
export type NotificationRow = {
  id: number;
  kind: NotificationKind;
  level: number | null;
  actorName: string | null;
  postTitle: string | null;
  blogSlug: string | null;
  postId: number | null;
  petName: string | null;
  speciesName: string | null;
  giftMessage: string | null;
  /** 언급(mention)이 댓글에서였다 */
  inComment: boolean;
  createdAt: Date;
  readAt: Date | null;
};

/** 내 알림 최신순 (내 것만) */
export async function listNotificationRows(userId: string, page = 1, size = NOTIFICATION_PAGE_SIZE) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(eq(notifications.userId, userId));
  const rows: NotificationRow[] = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      level: notifications.level,
      actorName: actorProfile.nickname,
      postTitle: posts.title,
      blogSlug: blogs.slug,
      postId: notifications.postId,
      petName: userAnimals.name,
      speciesName: animalSpecies.name,
      giftMessage: gifts.message,
      inComment: sql<boolean>`${notifications.refId} IS NOT NULL`,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .leftJoin(actorProfile, eq(actorProfile.userId, notifications.actorId))
    // 동물 레벨업: ref_id = 동물 ID (지금 이름으로 보여준다)
    .leftJoin(userAnimals, and(eq(notifications.kind, "pet_level_up"), sql`${userAnimals.id}::text = ${notifications.refId}`))
    .leftJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    // 관리자 선물: ref_id = 선물 ID
    .leftJoin(gifts, and(eq(notifications.kind, "gift"), sql`${gifts.id}::text = ${notifications.refId}`))
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .leftJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(size)
    .offset((page - 1) * size);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / size)) };
}

export async function markNotificationRead(userId: string, id: number) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.id, id), isNull(notifications.readAt)));
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/** 레벨업 팝업을 봤음: 안 본 레벨업 알림을 모두 읽음으로 (GAME-06) */
export async function markLevelUpsSeen(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, "level_up"), isNull(notifications.readAt)));
}

export type LevelUpPopup = {
  level: number;
  items: { id: number; name: string; type: string; assetKey: string }[];
  moreItems: number;
  houseStage: number | null; // 집 단계가 바뀌었으면 새 단계
};

/**
 * 아직 안 본 레벨업 알림으로 팝업 내용을 만든다. 가장 높은 레벨 하나만 보여주고,
 * 그 사이 레벨에서 새로 쓸 수 있게 된 아이템(꾸미기·가구·배경, 캐릭터 제외)을 함께 보여준다.
 */
export async function getLevelUpPopup(userId: string): Promise<LevelUpPopup | null> {
  const unseen = await db
    .select({ level: notifications.level })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, "level_up"), isNull(notifications.readAt)));
  const levels = unseen.map((r) => r.level!).filter(Boolean);
  if (!levels.length) return null;
  const top = Math.max(...levels);
  const low = Math.min(...levels);

  const unlocked = await db
    .select({ id: items.id, name: items.name, type: items.type, assetKey: items.assetKey })
    .from(items)
    .where(and(ne(items.type, "character"), gte(items.requiredLevel, low), lte(items.requiredLevel, top)))
    .orderBy(asc(items.requiredLevel), asc(items.price), asc(items.id));

  const stageBefore = houseStageForLevel(low - 1);
  const stageAfter = houseStageForLevel(top);
  return {
    level: top,
    items: unlocked.slice(0, 3),
    moreItems: Math.max(0, unlocked.length - 3),
    houseStage: stageAfter > stageBefore ? stageAfter : null,
  };
}

/** 선물 팝업을 닫음: 그 선물 알림을 읽음으로 */
export async function markGiftSeen(userId: string, notificationId: number) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId), eq(notifications.kind, "gift"), isNull(notifications.readAt)));
}

/** 헤더에 필요한 알림 상태 한 번에 (안 읽은 개수, 레벨업 팝업, 아직 안 본 선물) */
export async function getNotificationState(userId: string) {
  const [unread, popup, gifts] = await Promise.all([countUnread(userId), getLevelUpPopup(userId), getUnseenGifts(userId)]);
  return { unread, popup, gifts };
}
