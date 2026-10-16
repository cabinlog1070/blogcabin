// 블로그 홈·글·글쓰기 화면이 읽는 것 (읽기 API routes/blog-pages.ts가 쓴다)
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { blogs, categories, commentLikes, comments, follows, items, postLikes, posts, postTags, profiles, tags } from "../db/schema";
import { isPublished } from "./access";
import { lookSql } from "./look";
import { findMentionedBlogs, mentionsIn } from "./mentions";

const characterItem = alias(items, "character_item");
const backgroundItem = alias(items, "background_item");

// ===== 블로그 =====
export async function getBlogBySlug(slug: string) {
  const [row] = await db
    .select({
      id: blogs.id,
      slug: blogs.slug,
      title: blogs.title,
      description: blogs.description,
      ownerId: blogs.ownerId,
      createdAt: blogs.createdAt,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
      backgroundAsset: backgroundItem.assetKey,
      // 미니룸 캐릭터·펫 자리 (SHOP-05, NULL = 기본)
      roomCharX: blogs.roomCharX,
      roomCharY: blogs.roomCharY,
      roomPetX: blogs.roomPetX,
      roomPetY: blogs.roomPetY,
      followerCount: sql<number>`(SELECT COUNT(*)::int FROM ${follows} WHERE ${follows.followeeId} = ${blogs.ownerId})`,
      postCount: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public' AND ${isPublished})`,
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(backgroundItem, eq(backgroundItem.id, blogs.backgroundItemId))
    .where(eq(blogs.slug, slug));
  return row ?? null;
}

export async function getBlogByOwner(ownerId: string) {
  const [row] = await db.select().from(blogs).where(eq(blogs.ownerId, ownerId));
  return row ?? null;
}

// 조인 없는 select에서는 drizzle이 칸 이름 앞에 표 이름을 붙이지 않아서 ${categories.id}가 "id"(안쪽 posts.id)로 읽혔다.
// 그래서 카테고리 글 수가 늘 0이었다. 바깥 표 칸은 표 이름을 직접 붙인다
export async function getCategories(blogId: number, includePrivate: boolean, includeScheduled = false) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      position: categories.position,
      postCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${posts}
        WHERE ${posts.categoryId} = "categories"."id"
        ${includePrivate ? sql`` : sql`AND ${posts.visibility} = 'public'`}
        ${includeScheduled ? sql`` : sql`AND ${isPublished}`}
      )`,
    })
    .from(categories)
    .where(eq(categories.blogId, blogId))
    .orderBy(asc(categories.position), asc(categories.id));
}

/** 이웃 관계와 즐겨찾기 여부. 이웃이 아니면 null (남의 블로그 헤더의 ☆, TOWN-08) */
export async function getFollow(followerId: string, followeeId: string) {
  const [row] = await db
    .select({ favorite: follows.isFavorite })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  return row ?? null;
}

// ===== 글 상세 =====
export async function getPost(blogId: number, postId: number) {
  const [row] = await db
    .select({
      id: posts.id,
      blogId: posts.blogId,
      title: posts.title,
      contentHtml: posts.contentHtml,
      contentText: posts.contentText,
      visibility: posts.visibility,
      viewCount: posts.viewCount,
      pinHours: posts.pinHours,
      scheduled: sql<boolean>`${posts.createdAt} > now()`,
      categoryId: posts.categoryId,
      categoryName: categories.name,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .where(and(eq(posts.id, postId), eq(posts.blogId, blogId)));
  return row ?? null;
}

export async function getPostTags(postId: number) {
  const rows = await db
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId))
    .orderBy(asc(tags.name));
  return rows.map((r) => r.name);
}

export async function getLikeState(postId: number, viewerId: string | null) {
  const [row] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      liked: viewerId ? sql<boolean>`BOOL_OR(${postLikes.userId} = ${viewerId})` : sql<boolean>`false`,
    })
    .from(postLikes)
    .where(eq(postLikes.postId, postId));
  return { count: row.count, liked: Boolean(row.liked) };
}

/**
 * 글의 댓글 (SOC-01·02). 삭제된 댓글은 spec 004 FR-008대로 정리해서 돌려준다:
 * 답글이 남아 있는 원댓글만 작성자·시각·내용 없는 자리로 남기고, 나머지 삭제된 댓글(답글 포함)은 뺀다.
 * 탈퇴한 회원(작성자 없음)의 댓글도 같은 규칙이다 (AUTH-06).
 */
export async function getComments(postId: number, viewerId: string | null = null) {
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      content: comments.content,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      editedAt: comments.editedAt,
      authorId: comments.authorId,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
      blogSlug: blogs.slug,
      // 댓글 하트: 수와 지금 보는 사람이 눌렀는지
      likeCount: sql<number>`(SELECT COUNT(*)::int FROM ${commentLikes} WHERE ${commentLikes.commentId} = ${comments.id})`,
      liked: viewerId
        ? sql<boolean>`EXISTS (SELECT 1 FROM ${commentLikes} WHERE ${commentLikes.commentId} = ${comments.id} AND ${commentLikes.userId} = ${viewerId})`
        : sql<boolean>`false`,
    })
    .from(comments)
    .leftJoin(profiles, eq(profiles.userId, comments.authorId))
    .leftJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .leftJoin(blogs, eq(blogs.ownerId, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id));

  const liveReplyParents = new Set(rows.filter((c) => c.parentId && !c.deletedAt).map((c) => c.parentId));
  // 댓글 속 @주소 가운데 실제로 있는 블로그 (화면이 이것만 링크로 보여 준다)
  const live = rows.filter((c) => !c.deletedAt);
  const known = await findMentionedBlogs([...new Set(live.flatMap((c) => mentionsIn(c.content)))]);
  type Row = (typeof rows)[number];
  type Visible = Omit<Row, "authorId" | "nickname" | "blogSlug"> & {
    deleted: false;
    authorId: string;
    nickname: string;
    blogSlug: string;
    mentions: string[];
  };
  return rows.flatMap((c): (Visible | { id: number; parentId: null; deleted: true })[] => {
    if (!c.deletedAt && c.authorId && c.nickname) {
      const mentions = mentionsIn(c.content).filter((slug) => known.has(slug));
      return [{ ...c, deleted: false as const, authorId: c.authorId, nickname: c.nickname, blogSlug: c.blogSlug ?? "", mentions }];
    }
    // 삭제된 자리: 답글이 남은 원댓글만. 지운 내용·작성자·시각은 화면으로 보내지 않는다
    if (c.parentId || !liveReplyParents.has(c.id)) return [];
    return [{ id: c.id, parentId: null, deleted: true as const }];
  });
}

/** 같은 블로그 안에서 바로 이전 / 다음 글. 예약 글은 주인에게만 (includeScheduled) */
export async function getAdjacentPosts(
  blogId: number,
  post: { id: number; createdAt: Date },
  includePrivate: boolean,
  includeScheduled = false,
) {
  const visible = and(includePrivate ? undefined : eq(posts.visibility, "public"), includeScheduled ? undefined : isPublished);
  // 시각은 DB 값 그대로 비교한다. DB는 마이크로초까지, JS Date는 밀리초까지라 post.createdAt을 넘기면
  // 지금 글이 자기보다 "나중 글"로 잡혀 [다음 글]이 지금 화면을 가리켰다
  const current = sql`(SELECT ${posts.createdAt}, ${posts.id} FROM ${posts} WHERE ${posts.id} = ${post.id})`;
  const older = sql`(${posts.createdAt}, ${posts.id}) < ${current}`;
  const newer = sql`(${posts.createdAt}, ${posts.id}) > ${current}`;
  const [prev] = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(and(eq(posts.blogId, blogId), visible, older))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(1);
  const [next] = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(and(eq(posts.blogId, blogId), visible, newer))
    .orderBy(asc(posts.createdAt), asc(posts.id))
    .limit(1);
  return { prev: prev ?? null, next: next ?? null };
}


// ===== 내 이웃 목록 (TOWN-08) · 초대 코드 (GAME-09) =====
/** 내가 이웃 추가한 블로그 (내 블로그 홈, 주인에게만). 즐겨찾기 먼저, 그다음 최근 공개 글 순. mutual: 그 사람도 나를 이웃 추가했다(서로 이웃) */
export async function listMyNeighbors(userId: string) {
  const lastPublicPostAt = sql`(SELECT MAX(${posts.createdAt}) FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public' AND ${isPublished})`;
  return db
    .select({
      ownerId: blogs.ownerId,
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
      favorite: follows.isFavorite,
      mutual: sql<boolean>`EXISTS (SELECT 1 FROM ${follows} AS back WHERE back.follower_id = ${follows.followeeId} AND back.followee_id = ${userId})`,
    })
    .from(follows)
    .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
    .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.isFavorite), sql`${lastPublicPostAt} DESC NULLS LAST`, desc(follows.createdAt));
}

/** 나를 이웃 추가한 사람 (내 블로그 홈의 "나를 이웃한 사람", 주인에게만). 최근에 추가한 순. mutual: 나도 그 사람을 이웃 추가했다 */
export async function listMyFollowers(userId: string) {
  return db
    .select({
      ownerId: blogs.ownerId,
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
      mutual: sql<boolean>`EXISTS (SELECT 1 FROM ${follows} AS back WHERE back.follower_id = ${userId} AND back.followee_id = ${follows.followerId})`,
    })
    .from(follows)
    .innerJoin(blogs, eq(blogs.ownerId, follows.followerId))
    .innerJoin(profiles, eq(profiles.userId, follows.followerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .where(eq(follows.followeeId, userId))
    .orderBy(desc(follows.createdAt));
}

export async function getInviteCode(userId: string) {
  const [row] = await db.select({ code: profiles.inviteCode }).from(profiles).where(eq(profiles.userId, userId));
  return row?.code ?? null;
}
