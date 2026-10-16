// 관리자 화면 읽기 (관리자 API routes/admin.ts의 GET이 쓴다)
import { and, asc, count, desc, eq, gte, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { animalSpecies, attendances, blogs, comments, GIFT_MESSAGE_MAX, items, pointLedger, posts, profiles, users } from "../db/schema";
import { startOfTodayKST } from "../game/points";
import { waitingInquiryCount } from "../inquiries";
import { todayKST } from "../game/rules";

const postBlog = alias(blogs, "post_blog");

/** 검색어를 ILIKE 무늬로 (%, _, 역슬래시는 글자 그대로) */
const likeOf = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** 관리자 첫 화면: 숫자 카드, 최근 가입·글, 지급·선물 대상 주민, 선물로 보낼 아이템·펫 */
export async function adminOverview() {
  const [[stats], recentUsers, recentPosts, residents, giftable, giftPets, waitingInquiries] = await Promise.all([
    db.select({
      users: sql<number>`(SELECT COUNT(*)::int FROM ${users})`,
      residents: sql<number>`(SELECT COUNT(*)::int FROM ${profiles})`,
      posts: sql<number>`(SELECT COUNT(*)::int FROM ${posts})`,
      comments: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.deletedAt} IS NULL)`,
      postsToday: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.createdAt} >= ${startOfTodayKST})`,
      attendToday: sql<number>`(SELECT COUNT(*)::int FROM ${attendances} WHERE ${attendances.date} = ${todayKST()})`,
    }).from(sql`(SELECT 1) AS one`),
    db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
        nickname: profiles.nickname,
        slug: blogs.slug,
        provider: sql<string>`(SELECT string_agg(provider_id, ', ') FROM accounts WHERE accounts.user_id = ${users.id})`,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(blogs, eq(blogs.ownerId, users.id))
      .orderBy(desc(users.createdAt))
      .limit(20),
    db
      .select({ id: posts.id, title: posts.title, visibility: posts.visibility, createdAt: posts.createdAt, slug: blogs.slug, nickname: profiles.nickname })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .where(gte(posts.createdAt, sql`now() - interval '30 days'`))
      .orderBy(desc(posts.createdAt))
      .limit(30),
    // 관리자 지급 대상: 온보딩을 마친 주민 전부와 지금 코인·경험치
    db
      .select({
        userId: profiles.userId,
        nickname: profiles.nickname,
        username: users.username,
        coins: sql<number>`COALESCE(SUM(${pointLedger.coinDelta}), 0)::int`,
        exp: sql<number>`COALESCE(SUM(${pointLedger.expDelta}), 0)::int`,
      })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .leftJoin(pointLedger, eq(pointLedger.userId, profiles.userId))
      .groupBy(profiles.userId, profiles.nickname, users.username)
      .orderBy(profiles.nickname),
    // 선물로 보낼 수 있는 아이템 = 상점에서 파는 아이템 (기본 아이템과 판매를 멈춘 예전 캐릭터는 뺀다, isForSale과 같은 규칙)
    db
      .select({ id: items.id, type: items.type, name: items.name, assetKey: items.assetKey })
      .from(items)
      .where(and(eq(items.isStarter, false), ne(items.type, "character")))
      .orderBy(asc(items.type), asc(items.requiredLevel), asc(items.price), asc(items.id)),
    // 선물로 보낼 수 있는 펫 = 농장의 모든 펫 종류 (그 펫이 태어나는 알로 간다)
    db.select({ id: animalSpecies.id, name: animalSpecies.name, assetKey: animalSpecies.assetKey }).from(animalSpecies).orderBy(asc(animalSpecies.id)),
    // 관리자 문의함에서 답을 기다리는 문의
    waitingInquiryCount(),
  ]);
  return { stats, recentUsers, recentPosts, residents, giftable, giftPets, giftMessageMax: GIFT_MESSAGE_MAX, waitingInquiries };
}

export const ADMIN_CONTENT_PAGE_SIZE = 30;
export type AdminContentTab = "posts" | "comments";

/** 글·댓글 관리: 탭(글/댓글), 검색어(제목·닉네임·블로그 주소 / 댓글 내용·닉네임), 쪽 */
export async function adminContent(tab: AdminContentTab, q: string, page: number) {
  const like = likeOf(q);
  const PAGE_SIZE = ADMIN_CONTENT_PAGE_SIZE;
  const offset = (page - 1) * PAGE_SIZE;
  const postWhere = q ? or(ilike(posts.title, like), ilike(profiles.nickname, like), ilike(blogs.slug, like)) : undefined;
  const commentWhere = and(isNull(comments.deletedAt), q ? or(ilike(comments.content, like), ilike(profiles.nickname, like)) : undefined);

  const [[postCount], [commentCount], postRows, commentRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .where(postWhere),
    db.select({ n: count() }).from(comments).leftJoin(profiles, eq(profiles.userId, comments.authorId)).where(commentWhere),
    tab === "posts"
      ? db
          .select({
            id: posts.id,
            title: posts.title,
            visibility: posts.visibility,
            createdAt: posts.createdAt,
            slug: blogs.slug,
            authorId: profiles.userId,
            nickname: profiles.nickname,
            commentCount: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.deletedAt} IS NULL)`,
          })
          .from(posts)
          .innerJoin(blogs, eq(blogs.id, posts.blogId))
          .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
          .where(postWhere)
          .orderBy(desc(posts.createdAt), desc(posts.id))
          .limit(PAGE_SIZE)
          .offset(offset)
      : [],
    tab === "comments"
      ? db
          .select({
            id: comments.id,
            content: comments.content,
            createdAt: comments.createdAt,
            authorId: comments.authorId,
            nickname: profiles.nickname,
            postId: posts.id,
            postTitle: posts.title,
            slug: postBlog.slug,
          })
          .from(comments)
          .innerJoin(posts, eq(posts.id, comments.postId))
          .innerJoin(postBlog, eq(postBlog.id, posts.blogId))
          .leftJoin(profiles, eq(profiles.userId, comments.authorId))
          .where(commentWhere)
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(PAGE_SIZE)
          .offset(offset)
      : [],
  ]);

  return { postCount: postCount.n, commentCount: commentCount.n, postRows, commentRows, pageSize: PAGE_SIZE };
}

const MEMBERS_LIMIT = 50;

/** 회원 목록: 검색어(아이디·닉네임·이메일·블로그 주소), 최근 가입 50명 */
export async function adminMembers(q: string) {
  const like = likeOf(q);
  const LIMIT = MEMBERS_LIMIT;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      nickname: profiles.nickname,
      slug: blogs.slug,
      provider: sql<string>`(SELECT string_agg(provider_id, ', ') FROM accounts WHERE accounts.user_id = ${users.id})`,
      postCount: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.blogId} = ${blogs.id})`,
      commentCount: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.authorId} = ${users.id} AND ${comments.deletedAt} IS NULL)`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(blogs, eq(blogs.ownerId, users.id))
    .where(q ? or(ilike(users.username, like), ilike(profiles.nickname, like), ilike(users.email, like), ilike(blogs.slug, like)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(LIMIT);
  return rows;
}

/** 회원 한 명: 정보, 쓴 글, 쓴 댓글. 없으면 null */
export async function adminMember(id: string) {
  const [member] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      nickname: profiles.nickname,
      blogId: blogs.id,
      slug: blogs.slug,
      provider: sql<string>`(SELECT string_agg(provider_id, ', ') FROM accounts WHERE accounts.user_id = ${users.id})`,
      coins: sql<number>`(SELECT COALESCE(SUM(${pointLedger.coinDelta}), 0)::int FROM ${pointLedger} WHERE ${pointLedger.userId} = ${users.id})`,
      exp: sql<number>`(SELECT COALESCE(SUM(${pointLedger.expDelta}), 0)::int FROM ${pointLedger} WHERE ${pointLedger.userId} = ${users.id})`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(blogs, eq(blogs.ownerId, users.id))
    .where(eq(users.id, id));
  if (!member) return null;

  const [memberPosts, memberComments] = await Promise.all([
    member.blogId
      ? db
          .select({ id: posts.id, title: posts.title, visibility: posts.visibility, createdAt: posts.createdAt })
          .from(posts)
          .where(eq(posts.blogId, member.blogId))
          .orderBy(desc(posts.createdAt))
      : [],
    db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        postId: posts.id,
        postTitle: posts.title,
        slug: postBlog.slug,
      })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .innerJoin(postBlog, eq(postBlog.id, posts.blogId))
      .where(and(eq(comments.authorId, member.id), isNull(comments.deletedAt)))
      .orderBy(desc(comments.createdAt)),
  ]);

  return { member, memberPosts, memberComments };
}
