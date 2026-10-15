// 광장의 집·이웃 주민 (TOWN-04·08·11·12). 광장 읽기 API(routes/town.ts)가 쓴다
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { lookSql } from "../blog/look";
import { stripEmoji } from "../blog/status-message";
import { db } from "../db";
import { animalSpecies, attendances, blogs, follows, items, pointLedger, postLikes, posts, profiles, userAnimals } from "../db/schema";
import { animalStage } from "../farm/rules";
import { houseStageForLevel, levelFromExp, todayKST } from "../game/rules";
import type { TownHouse, TownResident } from "./types";

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
  WHERE ${posts.blogId} = "blogs"."id" AND ${posts.visibility} = 'public' AND ${posts.createdAt} <= now()
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
 * 광장을 돌아다니는 주민 (TOWN-12): 광장에 집이 있는 즐겨찾기 이웃과 같은 사람들 (같은 순서, 최대 10명).
 * 이웃이 데리고 다니는 펫과 상태 메시지를 함께 가져온다
 */
export async function getResidents(userId: string): Promise<TownResident[]> {
  const rows = await db
    .select({
      slug: blogs.slug,
      nickname: profiles.nickname,
      look: lookSql(characterItem.assetKey, profiles.userId),
      statusMessage: profiles.statusMessage,
      petAsset: animalSpecies.assetKey,
      petGrowth: userAnimals.growth,
      petGrowExp: animalSpecies.growExp,
      petAccessory: userAnimals.accessory,
      petColor: userAnimals.color,
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(follows, and(eq(follows.followeeId, blogs.ownerId), eq(follows.followerId, userId), eq(follows.isFavorite, true)))
    .leftJoin(userAnimals, and(eq(userAnimals.userId, blogs.ownerId), eq(userAnimals.carried, true)))
    .leftJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .orderBy(sql`${lastPublicPostAt} DESC NULLS LAST`, desc(follows.createdAt))
    .limit(TOWN_NEIGHBOR_LIMIT);
  return rows.map(({ petAsset, petGrowth, petGrowExp, petAccessory, petColor, statusMessage, ...r }) => ({
    ...r,
    // 이모티콘을 막기 전에 저장된 메시지도 말풍선에서 깨지지 않게 이모티콘을 뺀다
    statusMessage: stripEmoji(statusMessage),
    pet: petAsset && petGrowth !== null && petGrowExp !== null && petAccessory
      ? { assetKey: petAsset, stage: animalStage(petGrowth, petGrowExp), accessory: petAccessory, color: petColor ?? undefined }
      : null,
  }));
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

/** 광장에서 내 캐릭터를 따라오는 펫 (TOWN-09). name이 비었거나 동물 이름 그대로면 화면이 그 화면 언어의 동물 이름으로 바꾼다 */
export async function getCarriedPet(userId: string) {
  const [row] = await db
    .select({
      name: userAnimals.name,
      speciesName: animalSpecies.name,
      assetKey: animalSpecies.assetKey,
      growth: userAnimals.growth,
      growExp: animalSpecies.growExp,
      accessory: userAnimals.accessory,
      color: userAnimals.color,
    })
    .from(userAnimals)
    .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .where(and(eq(userAnimals.userId, userId), eq(userAnimals.carried, true)));
  if (!row) return null;
  const { growth, growExp, ...pet } = row;
  return { ...pet, name: pet.name ?? "", stage: animalStage(growth, growExp) };
}
