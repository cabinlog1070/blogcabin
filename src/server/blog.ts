import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { likePattern, SEARCH_BLOG_LIMIT } from "@/lib/search";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { lookSql } from "@/server/look";
import {
  blogs,
  categories,
  comments,
  follows,
  items,
  postLikes,
  posts,
  postTags,
  profiles,
  tags,
} from "@/db/schema";

const characterItem = alias(items, "character_item");
const backgroundItem = alias(items, "background_item");

export const PAGE_SIZE = 8;

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
      followerCount: sql<number>`(SELECT COUNT(*)::int FROM ${follows} WHERE ${follows.followeeId} = ${blogs.ownerId})`,
      postCount: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public')`,
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
export async function getCategories(blogId: number, includePrivate: boolean) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      position: categories.position,
      postCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${posts}
        WHERE ${posts.categoryId} = "categories"."id"
        ${includePrivate ? sql`` : sql`AND ${posts.visibility} = 'public'`}
      )`,
    })
    .from(categories)
    .where(eq(categories.blogId, blogId))
    .orderBy(asc(categories.position), asc(categories.id));
}

export async function isFollowing(followerId: string, followeeId: string) {
  const [row] = await db
    .select({ x: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  return Boolean(row);
}

// ===== 글 목록 =====
const listColumns = {
  id: posts.id,
  title: posts.title,
  excerpt: sql<string>`left(${posts.contentText}, 160)`,
  visibility: posts.visibility,
  viewCount: posts.viewCount,
  createdAt: posts.createdAt,
  categoryName: categories.name,
  likeCount: sql<number>`(SELECT COUNT(*)::int FROM ${postLikes} WHERE ${postLikes.postId} = ${posts.id})`,
  commentCount: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.deletedAt} IS NULL)`,
};

async function paged<T>(
  where: SQL | undefined,
  page: number,
  extra: (q: ReturnType<typeof baseList>) => Promise<T[]>,
  orderFirst?: SQL,
) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(where);
  const items = await extra(baseList(where, orderFirst));
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** orderFirst: 최신순보다 먼저 정렬할 값 (참이 위로, 💛 이웃 새 글의 즐겨찾기) */
function baseList(where: SQL | undefined, orderFirst?: SQL) {
  return db
    .select({
      ...listColumns,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
    })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .where(where)
    .orderBy(...(orderFirst ? [desc(orderFirst)] : []), desc(posts.createdAt), desc(posts.id));
}

/** 블로그 홈 글 목록. 주인이 보면 비공개 글도 보인다 */
export async function listBlogPosts(opts: { blogId: number; isOwner: boolean; categoryId?: number; page: number }) {
  const where = and(
    eq(posts.blogId, opts.blogId),
    opts.isOwner ? undefined : eq(posts.visibility, "public"),
    opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined,
  );
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE));
}

/** 마을 최신 글 (공개 글만). followerId가 있으면 이웃 글만 */
export async function listFeed(opts: { page: number; followerId?: string; tag?: string }) {
  const where = and(
    eq(posts.visibility, "public"),
    opts.followerId
      ? inArray(blogs.ownerId, db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, opts.followerId)))
      : undefined,
    opts.tag
      ? inArray(
          posts.id,
          db.select({ id: postTags.postId }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(eq(tags.name, opts.tag)),
        )
      : undefined,
  );
  // 💛 이웃 새 글: 즐겨찾기한 이웃의 글을 맨 위에, 그 아래 나머지 이웃의 글 (TOWN-08, 각각 최신순)
  const favoriteFirst = opts.followerId
    ? sql`EXISTS (SELECT 1 FROM ${follows} WHERE ${follows.followerId} = ${opts.followerId} AND ${follows.followeeId} = ${blogs.ownerId} AND ${follows.isFavorite})`
    : null;
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE), favoriteFirst ?? undefined);
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
export async function getComments(postId: number) {
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      content: comments.content,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      authorId: comments.authorId,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
      blogSlug: blogs.slug,
    })
    .from(comments)
    .leftJoin(profiles, eq(profiles.userId, comments.authorId))
    .leftJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .leftJoin(blogs, eq(blogs.ownerId, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id));

  const liveReplyParents = new Set(rows.filter((c) => c.parentId && !c.deletedAt).map((c) => c.parentId));
  type Row = (typeof rows)[number];
  type Visible = Omit<Row, "authorId" | "nickname" | "blogSlug"> & { deleted: false; authorId: string; nickname: string; blogSlug: string };
  return rows.flatMap((c): (Visible | { id: number; parentId: null; deleted: true })[] => {
    if (!c.deletedAt && c.authorId && c.nickname) {
      return [{ ...c, deleted: false as const, authorId: c.authorId, nickname: c.nickname, blogSlug: c.blogSlug ?? "" }];
    }
    // 삭제된 자리: 답글이 남은 원댓글만. 지운 내용·작성자·시각은 화면으로 보내지 않는다
    if (c.parentId || !liveReplyParents.has(c.id)) return [];
    return [{ id: c.id, parentId: null, deleted: true as const }];
  });
}

/** 같은 블로그 안에서 바로 이전 / 다음 글 */
export async function getAdjacentPosts(blogId: number, post: { id: number; createdAt: Date }, isOwner: boolean) {
  const visible = isOwner ? undefined : eq(posts.visibility, "public");
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

export async function getAllTags(limit = 30) {
  return db
    .select({ name: tags.name, count: sql<number>`COUNT(*)::int` })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, and(eq(posts.id, postTags.postId), eq(posts.visibility, "public")))
    .groupBy(tags.id)
    .orderBy(desc(sql`COUNT(*)`), asc(tags.name))
    .limit(limit);
}

// ===== 내 이웃 목록 (TOWN-08) · 초대 코드 (GAME-09) =====
/** 내가 이웃 추가한 블로그 (내 블로그 홈, 주인에게만). 즐겨찾기 먼저, 그다음 최근 공개 글 순 */
export async function listMyNeighbors(userId: string) {
  const lastPublicPostAt = sql`(SELECT MAX(${posts.createdAt}) FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public')`;
  return db
    .select({
      ownerId: blogs.ownerId,
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
      favorite: follows.isFavorite,
    })
    .from(follows)
    .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
    .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.isFavorite), sql`${lastPublicPostAt} DESC NULLS LAST`, desc(follows.createdAt));
}

export async function getInviteCode(userId: string) {
  const [row] = await db.select({ code: profiles.inviteCode }).from(profiles).where(eq(profiles.userId, userId));
  return row?.code ?? null;
}

// ===== 마을 검색 (BLOG-07, spec 002 FR-042·FR-043) =====
/** 블로그 이름·닉네임·주소에 검색어가 든 블로그 최대 5개. 최근 공개 글 순, 공개 글이 없는 블로그는 맨 뒤 */
export async function searchBlogs(q: string) {
  const pattern = likePattern(q);
  const lastPublicPostAt = sql`(SELECT MAX(${posts.createdAt}) FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public')`;
  return db
    .select({
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .where(or(ilike(blogs.title, pattern), ilike(profiles.nickname, pattern), ilike(blogs.slug, pattern)))
    .orderBy(sql`${lastPublicPostAt} DESC NULLS LAST`, desc(blogs.id))
    .limit(SEARCH_BLOG_LIMIT);
}

/** 제목·본문·태그에 검색어가 든 공개 글 (비공개 글은 내 글이라도 뺀다). 최신순 8개씩 */
export async function searchPosts(q: string, page: number) {
  const pattern = likePattern(q);
  const where = and(
    eq(posts.visibility, "public"),
    or(
      ilike(posts.title, pattern),
      ilike(posts.contentText, pattern),
      inArray(
        posts.id,
        db.select({ id: postTags.postId }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(ilike(tags.name, pattern)),
      ),
    ),
  );
  return paged(where, page, (q) => q.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE));
}
