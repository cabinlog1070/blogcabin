// 글 번역 (POST-10): 화면 언어와 다른 말로 쓴 글에만 번역 줄이 뜬다.
// 브라우저 번역(Translator API)이 있으면 그 자리에서 번역하고, 없으면 파파고 링크를 준다.
// 시험용 Chromium에 있는 Translator는 번역 모델을 내려받지 못하므로, 없는 브라우저·가짜 Translator(앞에 [ko]를 붙인다)로 바꿔 확인한다.
// DEEPL_API_KEY 없이 띄운 개발 서버로 실행한다 (키가 있을 때는 e2e/translate-deepl.mjs)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);

const post = async (blogId, title, html, text) =>
  (
    await db.query(
      "INSERT INTO posts (blog_id, title, content_html, content_text, visibility) VALUES ($1, $2, $3, $4, 'public') RETURNING id",
      [blogId, title, html, text],
    )
  ).rows[0].id;

const { slug } = await fakeMember(db, `tr${tag}`);
const { rows } = await db.query("SELECT id FROM blogs WHERE slug = $1", [slug]);
const blogId = rows[0].id;
const jaId = await post(
  blogId,
  "今日のカフェ",
  '<p>こんにちは、<strong>今日</strong>は晴れです。<br>散歩しました。</p><p>おすすめは<a href="https://example.com/cafe">このカフェ</a>です。</p><ul><li>コーヒー</li><li>ケーキ</li></ul>',
  "こんにちは、今日は晴れです。散歩しました。おすすめはこのカフェです。コーヒーケーキ",
);
const koId = await post(blogId, "오늘의 카페", "<p>안녕하세요, 오늘은 날씨가 맑아요.</p>", "안녕하세요, 오늘은 날씨가 맑아요.");
const url = (id) => `${BASE}/@${slug}/${id}`;
const bar = (page) => page.locator("[data-translate-bar]");

// 가짜 브라우저 번역: 모델 내려받기 진행률을 한 번 보내고, 글 앞에 [ko]를 붙인다
const fakeTranslator = () => {
  window.Translator = {
    availability: async () => "downloadable",
    create: async ({ monitor }) => {
      const target = new EventTarget();
      monitor?.(target);
      const e = new Event("downloadprogress");
      e.loaded = 1;
      target.dispatchEvent(e);
      return { translate: async (s) => `[ko]${s}`, destroy() {} };
    },
  };
};

// 1) 번역 기능이 없는 브라우저(사파리·휴대폰 등): 일본어 글에 파파고 링크
const plainCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await plainCtx.addInitScript(() => delete window.Translator);
const plain = await plainCtx.newPage();
const errors = collectErrors(plain);
await plain.goto(url(jaId));
await bar(plain).waitFor();
check("한국어 화면에서 일본어 글: '일본어로 쓴 글이에요'", (await bar(plain).innerText()).includes("일본어로 쓴 글이에요"));
const papago = plain.getByRole("link", { name: /파파고로 번역하기/ });
const href = (await papago.getAttribute("href")) ?? "";
check("파파고 링크는 일본어 → 한국어, 제목·본문을 넘긴다", href.startsWith("https://papago.naver.com/?sk=ja&tk=ko&st=") && decodeURIComponent(href).includes("今日のカフェ"));
check("파파고는 새 탭으로 연다", (await papago.getAttribute("target")) === "_blank");
await plain.screenshot({ path: `${outDir}/translate-papago.png` });

// 2) 한국어 글은 한국어 화면에서 번역 줄이 없다
await plain.goto(url(koId));
await plain.locator("[data-post-body]").waitFor();
check("한국어 화면에서 한국어 글: 번역 줄 없음", (await bar(plain).count()) === 0);

// 3) 브라우저 번역이 있으면 그 자리에서 번역하고 원문과 오간다
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(fakeTranslator);
const page = await ctx.newPage();
errors.push(...collectErrors(page));
await page.goto(url(jaId));
const button = page.getByRole("button", { name: "한국어로 번역하기" });
await button.waitFor();
await button.click();
await page.getByText("일본어로 쓴 글을 한국어로 번역했어요").waitFor();
const body = page.locator("[data-post-body]");
check("제목이 번역된다", (await page.locator("h1").innerText()) === "[ko]今日のカフェ");
check("문단은 통째로 번역하고 줄바꿈은 살린다", (await body.locator("p").first().innerHTML()) === "[ko]こんにちは、今日は晴れです。<br>[ko]散歩しました。");
check("링크가 있는 문단은 링크를 살린다", (await body.locator('a[href="https://example.com/cafe"]').innerText()) === "[ko]このカフェ");
check("목록도 번역된다", (await body.locator("li").allInnerTexts()).join("|") === "[ko]コーヒー|[ko]ケーキ");
await page.screenshot({ path: `${outDir}/translate-done.png` });
await page.getByRole("button", { name: "원문 보기" }).click();
check("원문 보기: 원래 제목·본문", (await page.locator("h1").innerText()) === "今日のカフェ" && (await body.locator("strong").innerText()) === "今日");
await page.getByRole("button", { name: "번역 보기" }).click();
check("번역 보기: 다시 번역본 (다시 번역하지 않는다)", (await page.locator("h1").innerText()) === "[ko]今日のカフェ");

// 4) 브라우저 번역이 실패하면 안내하고 파파고 링크를 준다
const failCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await failCtx.addInitScript(() => {
  window.Translator = { availability: async () => "available", create: async () => Promise.reject(new Error("no model")) };
});
const failPage = await failCtx.newPage();
await failPage.goto(url(jaId));
await failPage.getByRole("button", { name: "한국어로 번역하기" }).click();
await failPage.getByText("지금은 번역하지 못했어요").waitFor();
check("번역에 실패하면 안내 + 파파고 링크", await failPage.getByRole("link", { name: /파파고로 번역하기/ }).isVisible());
await failCtx.close();

// 5) 일본어 화면에서 한국어 글: 반대로 한국어 → 일본어
const jaCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await jaCtx.addInitScript(() => delete window.Translator);
await jaCtx.addCookies([{ name: "lang", value: "ja", url: BASE }]);
const jaPage = await jaCtx.newPage();
errors.push(...collectErrors(jaPage));
await jaPage.goto(url(koId));
await bar(jaPage).waitFor();
check("일본어 화면에서 한국어 글: 韓国語で書かれた記事です", (await bar(jaPage).innerText()).includes("韓国語で書かれた記事です"));
check("파파고 링크는 한국어 → 일본어", ((await jaPage.getByRole("link", { name: /Papagoで翻訳する/ }).getAttribute("href")) ?? "").includes("sk=ko&tk=ja"));
await jaPage.screenshot({ path: `${outDir}/translate-phone-ja.png` });
await jaPage.goto(url(jaId));
await jaPage.locator("[data-post-body]").waitFor();
check("일본어 화면에서 일본어 글: 번역 줄 없음", (await bar(jaPage).count()) === 0);

check("화면 오류 없음", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
