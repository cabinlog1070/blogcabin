// 여러 블로그·글 목록 (마을 소식·💛 이웃 새 글·태그·검색, 블로그 홈 글 목록)과 태그 목록.
// 읽기 API(routes/feed.ts·search)와 화면의 블로그 화면(frontend/src/server/blog.ts)이 같이 쓴다
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { blogs, categories, comments, follows, items, postLikes, posts, postTags, profiles, tags, users } from "../db/schema";
import { isPublished } from "./access";
import { lookSql } from "./look";
import { likePattern, SEARCH_BLOG_LIMIT } from "./search";

const msg = <S extends string>(text: S): S => text;
const characterItem = alias(items, "character_item");

export const PAGE_SIZE = 8;

// ===== 글 목록 =====
const listColumns = {
  id: posts.id,
  title: posts.title,
  excerpt: sql<string>`left(${posts.contentText}, 160)`,
  visibility: posts.visibility,
  viewCount: posts.viewCount,
  createdAt: posts.createdAt,
  scheduled: sql<boolean>`${posts.createdAt} > now()`,
  categoryName: categories.name,
  likeCount: sql<number>`(SELECT COUNT(*)::int FROM ${postLikes} WHERE ${postLikes.postId} = ${posts.id})`,
  commentCount: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.deletedAt} IS NULL)`,
};

async function paged<T>(
  where: SQL | undefined,
  page: number,
  extra: (q: ReturnType<typeof baseList>) => Promise<T[]>,
  orderFirst?: SQL[],
  order?: SQL[],
) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(where);
  const items = await extra(baseList(where, orderFirst, order));
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** orderFirst: 최신순보다 먼저 정렬할 값들 (참이 위로, 앞의 값이 먼저. 마을 소식의 관리자 새 글·💛 이웃 새 글의 즐겨찾기). order: 기본(최신순) 대신 쓸 정렬 */
function baseList(where: SQL | undefined, orderFirst: SQL[] = [], order: SQL[] = [desc(posts.createdAt), desc(posts.id)]) {
  return db
    .select({
      ...listColumns,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      nickname: profiles.nickname,
      characterAsset: lookSql(characterItem.assetKey, profiles.userId),
      // 관리자(공지사항 블로그) 글: 여러 블로그 글이 섞인 목록에서 진한 카드로 구분한다
      isNotice: sql<boolean>`EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${blogs.ownerId} AND ${users.role} = 'admin')`,
    })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .where(where)
    .orderBy(...orderFirst.map((o) => desc(o)), ...order);
}

export const POST_SORTS = { latest: msg("최신순"), oldest: msg("오래된순"), popular: msg("인기순") } as const;
export type PostSort = keyof typeof POST_SORTS;

const SORT_ORDER: Record<PostSort, SQL[]> = {
  latest: [desc(posts.createdAt), desc(posts.id)],
  oldest: [asc(posts.createdAt), asc(posts.id)],
  popular: [desc(listColumns.likeCount), desc(posts.viewCount), desc(posts.createdAt), desc(posts.id)], // 좋아요 → 조회수 → 최신
};

/** 블로그 홈 글 목록. 주인이나 서로 이웃이 보면 비공개 글도 보인다. 예약 글은 주인에게만 (includeScheduled) */
export async function listBlogPosts(opts: {
  blogId: number;
  includePrivate: boolean;
  includeScheduled?: boolean;
  categoryId?: number;
  page: number;
  sort?: PostSort;
}) {
  const where = and(
    eq(posts.blogId, opts.blogId),
    opts.includePrivate ? undefined : eq(posts.visibility, "public"),
    opts.includeScheduled ? undefined : isPublished,
    opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined,
  );
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE), undefined, SORT_ORDER[opts.sort ?? "latest"]);
}


/** 마을 소식 목록의 조건과 정렬 (마을 전체·💛 이웃 새 글·태그). 목록과 그 목록 순서의 이전·다음 글이 같이 쓴다 */
export type FeedFilter = { followerId?: string; tag?: string };

function feedQuery(opts: FeedFilter) {
  const where = and(
    eq(posts.visibility, "public"),
    isPublished,
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
  // 관리자(공지사항) 글은 올라간 뒤 글마다 정한 시간(pin_hours) 동안 마을 전체·이웃 새 글 맨 위에 둔다 (태그 목록은 그대로 최신순)
  const adminPinned = opts.tag
    ? null
    : sql`(${posts.pinHours} > 0 AND ${posts.createdAt} > now() - make_interval(hours => ${posts.pinHours}) AND EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${blogs.ownerId} AND ${users.role} = 'admin'))`;
  // 💛 이웃 새 글: 즐겨찾기한 이웃의 글을 맨 위에, 그 아래 나머지 이웃의 글 (TOWN-08, 각각 최신순)
  const favoriteFirst = opts.followerId
    ? sql`EXISTS (SELECT 1 FROM ${follows} WHERE ${follows.followerId} = ${opts.followerId} AND ${follows.followeeId} = ${blogs.ownerId} AND ${follows.isFavorite})`
    : null;
  const orderFirst = [adminPinned, favoriteFirst].filter((o): o is SQL => o !== null);
  return { where, orderFirst };
}

/** 마을 최신 글 (공개 글만). followerId가 있으면 이웃 글만 */
export async function listFeed(opts: { page: number } & FeedFilter) {
  const { where, orderFirst } = feedQuery(opts);
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE), orderFirst);
}

/**
 * 마을 소식에서 연 글의 이전 / 다음 글: 글쓴이와 상관없이 그 목록에 보이는 순서 그대로.
 * 이전 글 = 목록에서 바로 아래 칸, 다음 글 = 바로 위 칸 (블로그 안의 이전·다음 글처럼 아래로 갈수록 이전 글).
 * 지금 글이 그 목록에 없으면 null (비공개 글이거나 이웃이 아니게 된 경우: 블로그 안의 이전·다음 글을 쓴다)
 */
export async function getFeedAdjacentPosts(postId: number, opts: FeedFilter) {
  const { where, orderFirst } = feedQuery(opts);
  const order = sql.join(
    [...orderFirst.map((o) => sql`${o} DESC`), sql`${posts.createdAt} DESC`, sql`${posts.id} DESC`],
    sql`, `,
  );
  // 목록과 같은 표(baseList의 join)에서 순번을 매긴다
  const feed = db.$with("feed").as(
    db
      .select({ id: posts.id, title: posts.title, blogSlug: blogs.slug, rn: sql<number>`(ROW_NUMBER() OVER (ORDER BY ${order}))::int`.as("rn") })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
      .where(where),
  );
  const rows = await db
    .with(feed)
    .select({ id: feed.id, title: feed.title, blogSlug: feed.blogSlug, rn: feed.rn })
    .from(feed)
    .where(sql`${feed.rn} BETWEEN (SELECT rn - 1 FROM feed WHERE id = ${postId}) AND (SELECT rn + 1 FROM feed WHERE id = ${postId})`);
  const current = rows.find((r) => r.id === postId);
  if (!current) return null;
  const pick = (rn: number) => {
    const r = rows.find((x) => x.rn === rn);
    return r ? { id: r.id, title: r.title, blogSlug: r.blogSlug } : null;
  };
  return { prev: pick(current.rn + 1), next: pick(current.rn - 1) };
}

export async function getAllTags(limit = 30) {
  return db
    .select({ name: tags.name, count: sql<number>`COUNT(*)::int` })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, and(eq(posts.id, postTags.postId), eq(posts.visibility, "public"), isPublished))
    .groupBy(tags.id)
    .orderBy(desc(sql`COUNT(*)`), asc(tags.name))
    .limit(limit);
}

// ===== 마을 검색 (BLOG-07, spec 002 FR-042·FR-043) =====
/** 블로그 이름·닉네임·주소에 검색어가 든 블로그 최대 5개. 최근 공개 글 순, 공개 글이 없는 블로그는 맨 뒤 */
export async function searchBlogs(q: string) {
  const pattern = likePattern(q);
  const lastPublicPostAt = sql`(SELECT MAX(${posts.createdAt}) FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public' AND ${isPublished})`;
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
    isPublished,
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
