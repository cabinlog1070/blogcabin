// 글 첨부 내려주기 (POST-07, POST-09). 사진은 화면에 바로, 파일은 올린 사람이 붙인 원래 이름으로 내려받는다
import { eq, like } from "drizzle-orm";
import { db } from "@/db";
import { attachments, blogs, posts } from "@/db/schema";
import { ATTACHMENT_KEY_RE } from "@/lib/attachments";
import { getViewer } from "@/server/dal";
import { openAttachment } from "@/server/storage";

const notFound = () => new Response("파일을 찾을 수 없어요", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(_request: Request, ctx: RouteContext<"/files/[key]">) {
  const { key } = await ctx.params;
  if (!ATTACHMENT_KEY_RE.test(key)) return notFound();
  const [row] = await db.select().from(attachments).where(eq(attachments.key, key));
  if (!row) return notFound();
  if (!(await canOpen(key, row.userId))) return notFound(); // 있는지도 알리지 않게 없는 주소와 같은 404
  const body = await openAttachment(key);
  if (!body) return notFound();

  // 한글 이름은 filename*(UTF-8)로, 옛 브라우저용 filename에는 ASCII 밖 글자와 " \ 를 _로 바꿔 넣는다
  const encoded = encodeURIComponent(row.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const ascii = row.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const disposition = `${row.kind === "image" ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;

  return new Response(body, {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.size),
      "Content-Disposition": disposition,
      // 브라우저가 형식을 추측해 HTML처럼 실행하지 못하게 한다
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
      // 글이 공개 ↔ 비공개로 바뀌면 접근도 바로 바뀌어야 하므로, 브라우저·중간 캐시가 오래 들고 있지 않게 매번 확인한다
      "Cache-Control": "private, no-cache",
    },
  });
}

/**
 * 이 첨부를 지금 보는 사람이 열 수 있는가 (POST-07·09, spec 003 FR-059).
 * - 쓰인 글 중 하나라도 공개 글 → 누구나
 * - 비공개 글에만 쓰임 → 그 글의 주인만 (관리자도 안 됨)
 * - 어느 글에도 쓰이지 않음(발행 전, 글에서 빠짐, 글 삭제) → 올린 사람만
 * 글과 첨부를 잇는 표가 없어서 본문(content_html)에 `/files/키`가 들어 있는지로 찾는다 (키는 무작위 32자라 겹치지 않는다)
 */
async function canOpen(key: string, uploaderId: string) {
  const used = await db
    .select({ visibility: posts.visibility, ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(like(posts.contentHtml, `%/files/${key}%`));
  if (used.some((p) => p.visibility === "public")) return true;
  const viewer = await getViewer();
  const me = viewer?.profile ? viewer.userId : null;
  if (!me) return false;
  if (used.length) return used.some((p) => p.ownerId === me);
  return uploaderId === me;
}
