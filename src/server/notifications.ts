// 알림함 (GAME-08)과 레벨업 팝업 (GAME-06)
// 알림은 사건이 일어난 Server Action의 같은 트랜잭션에서 만든다. 자기 행동은 알리지 않는다.
import "server-only";
import { and, asc, desc, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { blogs, items, notifications, pointLedger, posts, profiles, userAnimals } from "@/db/schema";
import { subject } from "@/lib/farm";
import { houseStageForLevel, levelFromExp } from "@/lib/game";
import type { Tx } from "@/server/points";

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

export type NotificationView = {
  id: number;
  kind: (typeof notifications.kind.enumValues)[number];
  text: string;
  href: string;
  createdAt: Date;
  read: boolean;
};

const clip = (s: string, n = 20) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 화면에 보일 문구와 누르면 갈 곳 (GAME-08 알림 종류 표) */
function present(r: {
  id: number;
  kind: NotificationView["kind"];
  level: number | null;
  actorName: string | null;
  postTitle: string | null;
  blogSlug: string | null;
  postId: number | null;
  petName: string | null;
  createdAt: Date;
  readAt: Date | null;
}): NotificationView {
  const who = r.actorName ?? "알 수 없는 회원";
  const postHref = r.blogSlug && r.postId ? `/@${r.blogSlug}/${r.postId}` : "/notifications";
  const title = `「${clip(r.postTitle ?? "삭제된 글")}」`;
  const base = { id: r.id, kind: r.kind, createdAt: r.createdAt, read: r.readAt !== null };
  switch (r.kind) {
    case "level_up":
      return { ...base, text: r.level === 99 ? "🎉 최고 레벨 Lv.99가 되었어요!" : `🎉 Lv.${r.level}이 되었어요!`, href: "/shop" };
    case "pet_level_up":
      return { ...base, text: `🐣 ${subject(r.petName ?? "내 동물")} Lv.${r.level}이 되었어요!`, href: "/farm" };
    case "like":
      return { ...base, text: `❤️ ${who}님이 ${title}에 공감했어요`, href: postHref };
    case "comment":
      return { ...base, text: `💬 ${who}님이 ${title}에 댓글을 달았어요`, href: `${postHref}#comments` };
    case "reply":
      return { ...base, text: `💬 ${who}님이 내 댓글에 답글을 달았어요`, href: `${postHref}#comments` };
  }
}

/** 내 알림 최신순 (내 것만) */
export async function listNotifications(userId: string, page = 1, size = NOTIFICATION_PAGE_SIZE) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(eq(notifications.userId, userId));
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      level: notifications.level,
      actorName: actorProfile.nickname,
      postTitle: posts.title,
      blogSlug: blogs.slug,
      postId: notifications.postId,
      petName: userAnimals.name,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .leftJoin(actorProfile, eq(actorProfile.userId, notifications.actorId))
    // 동물 레벨업: ref_id = 동물 ID (지금 이름으로 보여준다)
    .leftJoin(userAnimals, and(eq(notifications.kind, "pet_level_up"), sql`${userAnimals.id}::text = ${notifications.refId}`))
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .leftJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(size)
    .offset((page - 1) * size);
  return { rows: rows.map(present), total, page, pageCount: Math.max(1, Math.ceil(total / size)) };
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

/** 헤더에 필요한 알림 상태 한 번에 */
export async function getNotificationState(userId: string) {
  const [unread, popup] = await Promise.all([countUnread(userId), getLevelUpPopup(userId)]);
  return { unread, popup };
}
