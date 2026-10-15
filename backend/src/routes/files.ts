// 글 첨부 내려주기 (POST-07, POST-09): GET /api/v1/files/:key
// 사진은 화면에 바로, 파일은 올린 사람이 붙인 원래 이름으로 내려받는다. 화면 주소 /files/:key가 이 API를 그대로 넘겨준다
import { eq, like } from "drizzle-orm";
import { Hono } from "hono";
import { canSeePrivatePosts, isPublished } from "../blog/access";
import { ATTACHMENT_KEY_RE } from "../attachments/rules";
import { ensureDisplayImage } from "../attachments/display";
import { openAttachment, openView } from "../attachments/storage";
import { db } from "../db";
import { attachments, blogs, posts } from "../db/schema";
import { memberOrNull, NOT_FOUND, type GuardEnv } from "../http/guard";

/**
 * 이 첨부를 지금 보는 사람이 열 수 있는가 (POST-07·09, spec 003 FR-059).
 * - 쓰인 글 중 하나라도 공개 글 → 누구나
 * - 비공개 글에만 쓰임 → 그 글의 주인과 주인의 서로 이웃만 (관리자도 안 됨)
 * - 어느 글에도 쓰이지 않음(발행 전, 글에서 빠짐, 글 삭제) → 올린 사람만
 * 글과 첨부를 잇는 표가 없어서 본문(content_html)에 `/files/키`가 들어 있는지로 찾는다 (키는 무작위 32자라 겹치지 않는다)
 */
async function canOpen(key: string, uploaderId: string, me: string | null) {
  const used = await db
    .select({ visibility: posts.visibility, ownerId: blogs.ownerId, published: isPublished })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(like(posts.contentHtml, `%/files/${key}%`));
  // 아직 안 올라간 예약 글(POST-11)은 공개 글이어도 비공개 글처럼 다룬다
  if (used.some((p) => p.visibility === "public" && p.published)) return true;
  if (!me) return false;
  if (used.length) {
    for (const ownerId of new Set(used.map((p) => p.ownerId))) if (await canSeePrivatePosts(me, ownerId)) return true;
    return false;
  }
  return uploaderId === me;
}

export const fileRoutes = new Hono<GuardEnv>().get("/:key", async (c) => {
  const key = c.req.param("key");
  // 있는지도 알리지 않게, 못 여는 파일은 없는 주소와 같은 404
  const missing = () => c.json({ ok: false, error: NOT_FOUND }, 404);
  if (!ATTACHMENT_KEY_RE.test(key)) return missing();
  const [row] = await db.select().from(attachments).where(eq(attachments.key, key));
  if (!row) return missing();
  if (!(await canOpen(key, row.userId, (await memberOrNull(c))?.userId ?? null))) return missing();
  // 사진은 원본 대신 줄여서 다시 압축한 사본을 보낸다 (display.ts). 사본이 없거나 원본이 더 나으면 원본
  const view = row.kind === "image" ? await ensureDisplayImage(key) : null;
  const useView = view && view.format !== "none" ? { format: view.format, size: view.size } : null;
  const mime = useView ? (useView.format === "webp" ? "image/webp" : "image/jpeg") : row.mime;
  const size = useView ? useView.size : row.size;
  // 같은 사진을 다시 열면 내용을 다시 받지 않게 (아래 no-cache라 매번 묻기는 하지만, 바뀌지 않았으면 304로 짧게 끝난다)
  const etag = `"${key}-${useView ? useView.format : "o"}-${size}"`;

  // 한글 이름은 filename*(UTF-8)로, 옛 브라우저용 filename에는 ASCII 밖 글자와 " \ 를 _로 바꿔 넣는다
  const encoded = encodeURIComponent(row.name).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  const ascii = row.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const disposition = `${row.kind === "image" ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
  const common = {
    ETag: etag,
    // 글이 공개 ↔ 비공개로 바뀌면 접근도 바로 바뀌어야 하므로, 브라우저·중간 캐시가 오래 들고 있지 않게 매번 확인한다
    "Cache-Control": "private, no-cache",
  };

  if (c.req.header("if-none-match")?.split(",").some((t) => t.trim() === etag)) {
    return new Response(null, { status: 304, headers: common });
  }

  const body = useView ? openView(key, useView.format) : await openAttachment(key);
  if (!body) return missing();
  return new Response(body, {
    headers: {
      ...common,
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition": disposition,
      // 브라우저가 형식을 추측해 HTML처럼 실행하지 못하게 한다
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
    },
  });
});
