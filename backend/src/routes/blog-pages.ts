// 블로그 홈·글·글쓰기·블로그 관리 화면 읽기: /api/v1/blog-pages/…
// 방문자도 보는 블로그 홈·글은 로그인 없이 답하고, 비공개 글·예약 글은 볼 수 있는 사람에게만 준다
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { canSkipCurrentPassword } from "../account/password";
import { auth } from "../auth";
import { db } from "../db";
import { accounts, categories, profiles } from "../db/schema";
import { getCarriedShowcase, getDisplayedCard } from "../farm/read";
import { NOT_FOUND, memberOrNull, requireViewer, type GuardEnv } from "../http/guard";
import { parseId } from "../lib/ids";
import { canSeePrivatePosts } from "../blog/access";
import { parseFeedFrom } from "../blog/feed-from";
import { getFeedAdjacentPosts, listBlogPosts, POST_SORTS, type PostSort } from "../blog/lists";
import { getRoomFurniture } from "../blog/look";
import {
  getAdjacentPosts,
  getBlogByOwner,
  getBlogBySlug,
  getCategories,
  getComments,
  getFollow,
  getInviteCode,
  getLikeState,
  getPost,
  getPostTags,
  listMyFollowers,
  listMyNeighbors,
} from "../blog/read";
import { relaxNbsp } from "../blog/sanitize";
import { getBlogVisitStats } from "../blog/visits";

/** 이 블로그를 보는 사람: 주민이면 id, 주인인지, 비공개 글을 볼 수 있는지(주인·서로 이웃·관리자) */
async function blogViewer(viewer: Awaited<ReturnType<typeof memberOrNull>>, ownerId: string) {
  const viewerId = viewer?.userId ?? null;
  return { viewerId, isOwner: viewerId === ownerId, isAdmin: viewer?.isAdmin ?? false, includePrivate: await canSeePrivatePosts(viewerId, ownerId) };
}

/** 블로그 홈 (BLOG-02): 블로그, 카테고리, 글 목록, 미니룸(가구·펫), 전시 카드, 방문자 수, 주인에게만 이웃 목록·초대 코드 */
export async function blogHomePage(viewer: Awaited<ReturnType<typeof memberOrNull>>, slug: string, query: Record<string, string>) {
  const blog = await getBlogBySlug(slug);
  if (!blog) return null;
  const who = await blogViewer(viewer, blog.ownerId);
  const { viewerId, isOwner, includePrivate } = who;
  const page = parseId(query.page) ?? 1;
  const categoryId = parseId(query.category) ?? undefined; // 이상한 값이면 전체 글
  const sort: PostSort = query.sort && query.sort in POST_SORTS ? (query.sort as PostSort) : "latest";
  const [cats, list, follow, furniture, pet, card, visits, neighbors, followers, inviteCode] = await Promise.all([
    getCategories(blog.id, includePrivate, isOwner),
    listBlogPosts({ blogId: blog.id, includePrivate, includeScheduled: isOwner, categoryId, page, sort }), // 예약 글은 주인에게만 (POST-11)
    viewerId && !isOwner ? getFollow(viewerId, blog.ownerId) : null,
    getRoomFurniture(blog.ownerId), // 미니룸 가구 (SHOP-05)
    getCarriedShowcase(blog.ownerId), // 미니룸 펫 (TOWN-09)
    getDisplayedCard(blog.ownerId), // 프로필 전시 카드 (TOWN-09)
    getBlogVisitStats(blog.id), // 방문자 수 (BLOG-06)
    isOwner ? listMyNeighbors(blog.ownerId) : null, // 내 이웃 목록 (TOWN-08, 주인에게만)
    isOwner ? listMyFollowers(blog.ownerId) : null, // 나를 이웃한 사람 (주인에게만)
    isOwner ? getInviteCode(blog.ownerId) : null, // 친구 초대 (GAME-09, 주인에게만)
  ]);
  return { blog, viewerId, isOwner, categoryId: categoryId ?? null, sort, sorts: POST_SORTS, cats, list, follow, furniture, pet, card, visits, neighbors, followers, inviteCode };
}

/** 글 화면 (POST-03): 글, 태그, 공감, 댓글, 이전·다음 글. 볼 수 없는 글이면 null (없는 글과 같게) */
export async function postPage(viewer: Awaited<ReturnType<typeof memberOrNull>>, slug: string, postId: number, query: Record<string, string>) {
  const blog = await getBlogBySlug(slug);
  if (!blog) return null;
  const post = await getPost(blog.id, postId);
  if (!post) return null;
  const { viewerId, isOwner, isAdmin, includePrivate } = await blogViewer(viewer, blog.ownerId);
  if (post.visibility === "private" && !includePrivate) return null; // 비공개 글은 주인, 서로 이웃, 관리자만
  if (post.scheduled && !isOwner) return null; // 아직 안 올라간 예약 글은 주인만 본다 (POST-11)

  // 마을 소식에서 열었으면 이전·다음 글도 그 목록 순서로. 💛 이웃 새 글은 회원만 볼 수 있는 목록이라 비회원이면 블로그 안
  const source = parseFeedFrom(query);
  const feed = source && ("tag" in source ? { tag: source.tag } : source.tab === "all" ? {} : viewerId ? { followerId: viewerId } : null);
  const [tags, like, comments, feedAdjacent] = await Promise.all([
    getPostTags(post.id),
    getLikeState(post.id, viewerId),
    getComments(post.id),
    feed ? getFeedAdjacentPosts(post.id, feed) : null,
  ]);
  // 지금 글이 그 목록에 없으면(비공개 글 등) 블로그 안의 이전·다음 글
  const adjacent: { prev: { id: number; title: string; blogSlug?: string } | null; next: { id: number; title: string; blogSlug?: string } | null; source: typeof source } =
    feedAdjacent ? { ...feedAdjacent, source } : { ...(await getAdjacentPosts(blog.id, post, includePrivate, isOwner)), source: null };
  // relaxNbsp: nbsp가 남은 예전 글도 줄이 바뀌게 한다
  return { blog, post: { ...post, contentHtml: relaxNbsp(post.contentHtml) }, viewerId, isOwner, canModerate: Boolean(viewerId) && (isOwner || isAdmin), tags, like, comments, adjacent };
}

/** 내 블로그의 카테고리 (글쓰기 화면) */
function myCategories(blogId: number) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.blogId, blogId))
    .orderBy(asc(categories.position), asc(categories.id));
}

export async function writePage(userId: string, postId: number | null) {
  const blog = await getBlogByOwner(userId);
  if (!blog) return null;
  // 글 고치기는 내 블로그의 글만
  const post = postId === null ? null : await getPost(blog.id, postId);
  if (postId !== null && !post) return null;
  const [cats, tags] = await Promise.all([myCategories(blog.id), post ? getPostTags(post.id) : []]);
  return { categories: cats, post, tags };
}

/**
 * 블로그 관리 화면: 블로그 정보, 카테고리(비공개·예약 글 수 포함), 상태 메시지, 아이디 로그인이 있는지(탈퇴할 때 비밀번호 확인, AUTH-06),
 * 비밀번호 바꾸기에서 지금 비밀번호 칸을 비워도 되는지(소셜로 방금 로그인, src/account/password.ts)
 */
export async function blogSettingsPage(userId: string, sessionCreatedAt: Date | null) {
  const blog = await getBlogByOwner(userId);
  if (!blog) return null;
  const [cats, [credential], [profile]] = await Promise.all([
    getCategories(blog.id, true, true),
    db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"))),
    db.select({ statusMessage: profiles.statusMessage }).from(profiles).where(eq(profiles.userId, userId)),
  ]);
  return {
    blog: { slug: blog.slug, title: blog.title, description: blog.description },
    categories: cats,
    statusMessage: profile?.statusMessage ?? null,
    hasPassword: Boolean(credential),
    skipCurrentPassword: sessionCreatedAt ? await canSkipCurrentPassword(userId, sessionCreatedAt) : false,
  };
}

export const blogPageRoutes = new Hono<GuardEnv>()
  .get("/home/:slug", async (c) => {
    const data = await blogHomePage(await memberOrNull(c), c.req.param("slug"), c.req.query());
    return data ? c.json(data) : c.json({ ok: false, error: NOT_FOUND }, 404);
  })
  .get("/post/:slug/:postId", async (c) => {
    const postId = parseId(c.req.param("postId"));
    const data = postId === null ? null : await postPage(await memberOrNull(c), c.req.param("slug"), postId, c.req.query());
    return data ? c.json(data) : c.json({ ok: false, error: NOT_FOUND }, 404);
  })
  .get("/write", requireViewer("member"), async (c) => c.json(await writePage(c.get("viewer").userId, null)))
  .get("/write/:postId", requireViewer("member"), async (c) => {
    const postId = parseId(c.req.param("postId"));
    const data = postId === null ? null : await writePage(c.get("viewer").userId, postId);
    return data ? c.json(data) : c.json({ ok: false, error: NOT_FOUND }, 404);
  })
  .get("/settings", requireViewer("member"), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const data = await blogSettingsPage(c.get("viewer").userId, session ? new Date(session.session.createdAt) : null);
    return data ? c.json(data) : c.json({ ok: false, error: NOT_FOUND }, 404);
  });
