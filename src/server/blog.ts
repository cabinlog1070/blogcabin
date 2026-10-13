import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { msg } from "@/lib/i18n";
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
  users,
} from "@/db/schema";

const characterItem = alias(items, "character_item");
const backgroundItem = alias(items, "background_item");

export const PAGE_SIZE = 8;

/**
 * 올라간 글: 올라갈 시각(created_at)이 지났다. 예약 글(POST-11)은 그 시각 전까지 주인에게만 보이고,
 * 시각이 되면 따로 바꾸는 일 없이 이 조건으로 목록·광장·검색에 나타난다
 */
export const isPublished = sql<boolean>`${posts.createdAt} <= now()`;

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

/** 서로 이웃: 두 사람이 서로를 이웃으로 추가했다. 비공개 글은 주인과 서로 이웃만 본다 */
export async function isMutualNeighbor(a: string, b: string) {
  if (a === b) return false;
  const rows = await db
    .select({ x: follows.followerId })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, a), eq(follows.followeeId, b)),
        and(eq(follows.followerId, b), eq(follows.followeeId, a)),
      ),
    );
  return rows.length === 2;
}

/** 이 사람이 이 블로그 주인의 비공개 글을 볼 수 있는가 (주인, 서로 이웃, 관리자) */
export async function canSeePrivatePosts(viewerId: string | null, ownerId: string) {
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;
  const [viewer] = await db.select({ role: users.role }).from(users).where(eq(users.id, viewerId));
  return viewer?.role === "admin" || isMutualNeighbor(viewerId, ownerId);
}

/** 이웃 관계와 즐겨찾기 여부. 이웃이 아니면 null (남의 블로그 헤더의 ☆, TOWN-08) */
export async function getFollow(followerId: string, followeeId: string) {
  const [row] = await db
    .select({ favorite: follows.isFavorite })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  return row ?? null;
}

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
export async function getComments(postId: number) {
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
