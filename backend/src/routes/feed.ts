// 읽기 (마을 소식·💛 이웃 새 글·태그·검색): GET /api/v1/feed…, /api/v1/search
// 화면(frontend)의 서버 쪽 페이지가 그릴 때 부른다 (frontend/src/server/api.ts의 serverApi)
import { Hono } from "hono";
import { getAllTags, listFeed, searchBlogs, searchPosts } from "../blog/lists";
import { parseSearchQuery } from "../blog/search";
import { BAD_REQUEST, memberOrNull, requireViewer, type GuardEnv } from "../http/guard";
import { parseId } from "../lib/ids";

/** ?page=… (없거나 잘못되면 1쪽) */
const pageOf = (raw: string | undefined) => parseId(raw) ?? 1;

export const feedRoutes = new Hono<GuardEnv>()
  /**
   * 마을 소식 (로그인하지 않은 방문자도 본다): ?page=, ?tag=태그 이름이면 그 태그 글만.
   * { list: { items, total, page, pageCount }, tags: 많이 쓴 태그, member: 회원이면 true }
   */
  .get("/", async (c) => {
    const page = pageOf(c.req.query("page"));
    const tag = c.req.query("tag") || undefined;
    const [viewer, list, tags] = await Promise.all([memberOrNull(c), listFeed({ page, tag }), getAllTags()]);
    return c.json({ list, tags, member: Boolean(viewer) });
  })
  /** 💛 이웃 새 글 (TOWN-08): 내가 이웃 추가한 블로그의 글만, 즐겨찾기 이웃 먼저 */
  .get("/following", requireViewer("member"), async (c) => {
    const page = pageOf(c.req.query("page"));
    const [list, tags] = await Promise.all([listFeed({ page, followerId: c.get("viewer").userId }), getAllTags()]);
    return c.json({ list, tags });
  });

export const searchRoutes = new Hono<GuardEnv>()
  /** 마을 검색 (BLOG-07): ?q=검색어(앞뒤 공백 빼고 1~50자)&page=. { blogs: 블로그 최대 5개, posts: 글 목록 } */
  .get("/", requireViewer("member"), async (c) => {
    const query = parseSearchQuery(c.req.query("q"));
    if (query.kind !== "ok") return c.json({ ok: false, error: BAD_REQUEST }, 400);
    const page = pageOf(c.req.query("page"));
    const [blogs, posts] = await Promise.all([searchBlogs(query.q), searchPosts(query.q, page)]);
    return c.json({ blogs, posts });
  });
