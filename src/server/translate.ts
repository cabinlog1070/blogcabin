import "server-only";
// 글 번역 (POST-10): DeepL API로 제목·본문을 번역하고 post_translations에 저장해 다시 쓴다.
// DEEPL_API_KEY가 없으면 서버 번역은 꺼지고, 화면은 브라우저 번역·파파고 링크로 대신한다.
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { postTranslations } from "@/db/schema";
import type { Locale } from "@/lib/i18n";
import { sanitizePostHtml } from "@/server/sanitize";

export function serverTranslationEnabled() {
  return Boolean(process.env.DEEPL_API_KEY);
}

/** DeepL 주소: 무료 키(끝이 :fx)는 api-free, 유료 키는 api. 시험할 때는 DEEPL_API_URL로 바꾼다 */
function deeplUrl(key: string) {
  const base = process.env.DEEPL_API_URL || (key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
  return `${base.replace(/\/+$/, "")}/v2/translate`;
}

/** DeepL은 한 번에 128KiB까지 받는다. 넉넉히 줄여 둔다 */
const MAX_BYTES = 100_000;

export type TranslateFailure = "off" | "too_long" | "quota" | "error";
export type TranslateResult = { ok: true; title: string; html: string } | { ok: false; reason: TranslateFailure };

type Source = { id: number; title: string; contentHtml: string };

export async function translatePostWithDeepL(post: Source, from: Locale, to: Locale): Promise<TranslateResult> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return { ok: false, reason: "off" };
  const hash = createHash("sha256").update(`${post.title}\n${post.contentHtml}`).digest("hex");

  const [saved] = await db
    .select()
    .from(postTranslations)
    .where(and(eq(postTranslations.postId, post.id), eq(postTranslations.targetLang, to)));
  if (saved && saved.sourceHash === hash) return { ok: true, title: saved.title, html: saved.contentHtml };

  if (Buffer.byteLength(post.title) + Buffer.byteLength(post.contentHtml) > MAX_BYTES) return { ok: false, reason: "too_long" };

  let res: Response;
  try {
    res = await fetch(deeplUrl(key), {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: [post.title, post.contentHtml],
        source_lang: from.toUpperCase(),
        target_lang: to.toUpperCase(),
        tag_handling: "html", // 태그·링크·사진은 그대로 두고 글자만 번역한다
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    console.error("[translate] DeepL 연결 실패", e);
    return { ok: false, reason: "error" };
  }
  // 456: 이번 달 무료 한도를 다 썼다
  if (res.status === 456) return { ok: false, reason: "quota" };
  if (!res.ok) {
    console.error("[translate] DeepL 응답", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return { ok: false, reason: "error" };
  }
  const body = (await res.json().catch(() => null)) as { translations?: { text: string }[] } | null;
  const [title, html] = body?.translations?.map((t) => t.text) ?? [];
  if (typeof title !== "string" || typeof html !== "string") return { ok: false, reason: "error" };

  // 바깥에서 받은 HTML이라 글을 저장할 때와 똑같이 정화한다. 제목은 글자만 (화면에서 글자로 그린다)
  const clean = { title: title.slice(0, 200), html: sanitizePostHtml(html) };
  await db
    .insert(postTranslations)
    .values({ postId: post.id, targetLang: to, sourceHash: hash, title: clean.title, contentHtml: clean.html })
    .onConflictDoUpdate({
      target: [postTranslations.postId, postTranslations.targetLang],
      set: { sourceHash: hash, title: clean.title, contentHtml: clean.html, createdAt: new Date() },
    });
  return { ok: true, ...clean };
}
