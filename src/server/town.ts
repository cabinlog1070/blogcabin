import "server-only";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { lookSql } from "@/server/look";
import { attendances, blogs, follows, items, pointLedger, postLikes, posts, profiles } from "@/db/schema";
import { houseStageForLevel, levelFromExp, todayKST } from "@/lib/game";
import type { TownHouse } from "@/components/town/types";

const characterItem = alias(items, "character_item");
const backgroundItem = alias(items, "background_item");

/** 집 주인의 누적 경험치 (원장 합계) → 레벨 → 집 단계 (TOWN-11) */
const ownerExp = sql<number>`(
  SELECT COALESCE(SUM(${pointLedger.expDelta}), 0)::int FROM ${pointLedger} WHERE ${pointLedger.userId} = ${blogs.ownerId}
)`;
/** 그 블로그의 가장 최근 공개 글 시각 (없으면 NULL).
 *  조인 없는 select(방문자 광장 후보)에서는 drizzle이 ${blogs.id}를 표 이름 없이 "id"로 써서 안쪽 posts.id로 읽히므로 표 이름을 직접 붙인다 */
const lastPublicPostAt = sql<Date | null>`(
  SELECT MAX(${posts.createdAt}) FROM ${posts}
  WHERE ${posts.blogId} = "blogs"."id" AND ${posts.visibility} = 'public'
)`;
const houseColumns = {
  slug: blogs.slug,
  title: blogs.title,
  nickname: profiles.nickname,
  characterAsset: lookSql(characterItem.assetKey, profiles.userId),
  backgroundAsset: backgroundItem.assetKey,
  roofColor: blogs.roofColor,
  exp: ownerExp,
};
function toHouse({ exp, ...h }: { exp: number } & Omit<TownHouse, "stage">): TownHouse {
  return { ...h, stage: houseStageForLevel(levelFromExp(exp)) };
}
function houseQuery<T extends Record<string, AnyPgColumn | SQL>>(extra: T) {
  return db
    .select({ ...houseColumns, ...extra })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(backgroundItem, eq(backgroundItem.id, blogs.backgroundItemId));
}

/** 광장 이웃집 자리 수 (위 5채 + 아래 5채, TOWN-04) */
export const TOWN_NEIGHBOR_LIMIT = 10;
/** 방문자 광장 후보: 인기 블로그 상위 100곳 (TOWN-04) */
export const POPULAR_POOL = 100;

/**
 * 내 이웃 전부 (🏘 이웃집 패널, 내 블로그 홈의 내 이웃 목록).
 * 즐겨찾기 먼저, 그 안에서는 최근 공개 글 순(글 없는 블로그는 뒤), 같으면 이웃 추가한 순.
 */
export async function getNeighbors(userId: string): Promise<TownHouse[]> {
  const rows = await houseQuery({ favorite: follows.isFavorite })
    .innerJoin(follows, and(eq(follows.followeeId, blogs.ownerId), eq(follows.followerId, userId)))
    .orderBy(desc(follows.isFavorite), sql`${lastPublicPostAt} DESC NULLS LAST`, desc(follows.createdAt));
  return rows.map(toHouse);
}

/** 회원 광장의 집: 즐겨찾기한 이웃의 블로그만, 글이 없어도 기본 집 (TOWN-04·08). 순서는 getNeighbors 그대로 */
export function favoriteHouses(neighbors: TownHouse[]) {
  return neighbors.filter((h) => h.favorite).slice(0, TOWN_NEIGHBOR_LIMIT);
}

/**
 * 방문자 광장의 집: 인기 블로그 100곳 중 무작위 10곳 (TOWN-04, spec 007 Clarifications).
 * 인기 = 최근 30일 동안 그 블로그의 공개 글이 받은 공감 수, 같으면 최근에 공개 글을 쓴 순. 공개 글이 있는 블로그만 후보.
 */
export async function getPopularHouses(): Promise<TownHouse[]> {
  const recentLikes = sql<number>`(
    SELECT COUNT(*)::int FROM ${postLikes}
    INNER JOIN ${posts} ON ${posts.id} = ${postLikes.postId}
    WHERE ${posts.blogId} = "blogs"."id" AND ${posts.visibility} = 'public'
      AND ${postLikes.createdAt} >= now() - interval '30 days'
  )`;
  // 상위 100곳의 블로그 ID를 고른 뒤, 그 안에서 무작위로 10곳
  const pool = db
    .select({ id: blogs.id })
    .from(blogs)
    .where(sql`${lastPublicPostAt} IS NOT NULL`)
    .orderBy(sql`${recentLikes} DESC`, sql`${lastPublicPostAt} DESC`, desc(blogs.id))
    .limit(POPULAR_POOL);
  const rows = await houseQuery({})
    .where(inArray(blogs.id, pool))
    .orderBy(sql`random()`)
    .limit(TOWN_NEIGHBOR_LIMIT);
  return rows.map(toHouse);
}

export async function getMyHouse(userId: string): Promise<TownHouse | null> {
  const [row] = await houseQuery({}).where(eq(blogs.ownerId, userId));
  return row ? toHouse(row) : null;
}

export async function hasAttendedToday(userId: string) {
  const [row] = await db
    .select({ userId: attendances.userId })
    .from(attendances)
    .where(and(eq(attendances.userId, userId), eq(attendances.date, todayKST())));
  return Boolean(row);
}
