// 글 번역 서버 모드 (POST-10, DeepL): 키가 있으면 모든 기기에서 사이트 안에서 번역하고, 번역은 저장해 다시 쓴다.
// 진짜 DeepL 대신 이 스크립트가 띄우는 가짜 DeepL(3999번)을 쓴다. 개발 서버를 이렇게 띄운 상태에서 실행한다:
//   DEEPL_API_KEY=test:fx DEEPL_API_URL=http://localhost:3999 npm run dev
// (키 없이 띄운 서버는 e2e/translate.mjs로 확인한다)
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);

// 가짜 DeepL: 글자 앞에 [DL]을 붙인다. 제목에 QUOTA가 있으면 한도 초과(456), XSS가 있으면 위험한 HTML을 돌려준다
const calls = [];
const deepl = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    calls.push({ auth: req.headers.authorization, ...body });
    const [title, html] = body.text;
    if (title.includes("QUOTA")) return res.writeHead(456).end("Quota exceeded");
    const out = title.includes("XSS")
      ? [`[DL]${title}`, '<p>[DL]本文</p><img src="x" onerror="alert(1)"><script>alert(2)</script>']
      : [`[DL]${title}`, html.replace(/>([^<]+)</g, ">[DL]$1<")];
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ translations: out.map((text) => ({ text })) }));
  });
});
await new Promise((r) => deepl.listen(3999, r));

const post = async (blogId, title, html, text) =>
  (
    await db.query(
      "INSERT INTO posts (blog_id, title, content_html, content_text, visibility) VALUES ($1, $2, $3, $4, 'public') RETURNING id",
      [blogId, title, html, text],
    )
  ).rows[0].id;
const { slug, blogId } = await fakeMember(db, `dl${tag}`);
const jaId = await post(
  blogId,
  "今日のカフェ",
  '<p>こんにちは、<strong>今日</strong>は晴れです。</p><p>おすすめは<a href="https://example.com/cafe">このカフェ</a>です。</p>',
  "こんにちは、今日は晴れです。おすすめはこのカフェです。",
);
const quotaId = await post(blogId, "QUOTA テスト", "<p>こんにちは、今日は晴れです。</p>", "こんにちは、今日は晴れです。");
const xssId = await post(blogId, "XSS テスト", "<p>こんにちは、今日は晴れです。</p>", "こんにちは、今日は晴れです。");
const url = (id) => `${BASE}/@${slug}/${id}`;

const browser = await chromium.launch();
// 휴대폰(브라우저 번역 없음)에서도 사이트 안에서 번역된다
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => delete window.Translator);
const page = await ctx.newPage();
const errors = collectErrors(page);
const translate = async (id) => {
  await page.goto(url(id));
  await page.getByRole("button", { name: "한국어로 번역하기" }).click();
  await page.locator("[data-translate-bar]").getByText(/번역했어요|번역하지 못했어요/).waitFor();
};

await translate(jaId);
const body = page.locator("[data-post-body]");
check("휴대폰에서도 번역 버튼 → 사이트 안에서 번역", (await page.locator("h1").innerText()) === "[DL]今日のカフェ");
check("DeepL에 일본어 → 한국어, HTML 그대로 보낸다", calls[0]?.source_lang === "JA" && calls[0]?.target_lang === "KO" && calls[0]?.tag_handling === "html");
check("서버 키로 부른다 (화면에 키가 없다)", calls[0]?.auth === "DeepL-Auth-Key test:fx" && !(await page.content()).includes("test:fx"));
check("굵게·링크가 번역본에도 남는다", (await body.locator("strong").innerText()) === "[DL]今日" && (await body.locator('a[href="https://example.com/cafe"]').count()) === 1);
await page.screenshot({ path: `${outDir}/translate-deepl-phone.png` });
const saved = await db.query("SELECT title FROM post_translations WHERE post_id = $1 AND target_lang = 'ko'", [jaId]);
check("번역을 저장한다", saved.rows[0]?.title === "[DL]今日のカフェ");

await translate(jaId);
check("같은 글은 저장한 번역을 쓴다 (DeepL을 다시 부르지 않는다)", calls.length === 1 && (await page.locator("h1").innerText()) === "[DL]今日のカフェ");

await db.query("UPDATE posts SET title = '明日のカフェ' WHERE id = $1", [jaId]);
await translate(jaId);
check("글을 고치면 다시 번역한다", calls.length === 2 && (await page.locator("h1").innerText()) === "[DL]明日のカフェ");

await translate(quotaId);
check("한도를 넘으면 안내 + 파파고 링크", (await page.getByText("지금은 번역하지 못했어요").isVisible()) && (await page.getByRole("link", { name: /파파고로 번역하기/ }).isVisible()));

await translate(xssId);
const xssHtml = await body.innerHTML();
check("번역 결과의 위험한 HTML은 정화한다", xssHtml.includes("[DL]本文") && !xssHtml.includes("onerror") && !xssHtml.includes("<script"));

check("화면 오류 없음", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
console.log(results.join("\n"));
await browser.close();
deepl.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
