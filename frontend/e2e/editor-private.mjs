// 글쓰기 툴바(문단 스타일·글자 크기·정렬·글자색)와 비공개 글 = 서로 이웃 공개
// 사용: 개발 서버를 띄운 상태에서 BASE_URL=http://localhost:3230 node e2e/editor-private.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const run = `${Date.now() % 1_000_000}`;
const newMember = async (prefix) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = collectErrors(page);
  await loginDev(page, `${prefix}${run}`);
  const { rows } = await db.query("SELECT b.owner_id AS uid, b.slug FROM blogs b WHERE b.slug = $1", [`${prefix}${run}`]);
  return { page, errors, ...rows[0] };
};

const author = await newMember("ea");
const friend = await newMember("eb");
const stranger = await newMember("ec");

// ===== 툴바로 글 쓰기 =====
const page = author.page;
await page.goto(`${BASE}/write`);
const editor = page.locator(".ProseMirror");
await editor.waitFor();
await page.getByPlaceholder("제목").fill("툴바 시험");
await editor.click();
await page.getByLabel("문단 스타일").selectOption({ label: "제목" });
await page.keyboard.type("오늘의 제목");
await page.keyboard.press("Enter");
await page.getByLabel("문단 스타일").selectOption({ label: "부제목" });
await page.keyboard.type("작은 부제목");
await page.keyboard.press("Enter");
check("부제목 다음 줄은 본문", (await page.getByLabel("문단 스타일").inputValue()) === "p");
await page.getByTitle("가운데 정렬").click();
await page.getByLabel("글자 크기").selectOption("24");
await page.keyboard.type("가운데 큰 글씨");
await page.keyboard.press("Enter");
await page.getByTitle("오른쪽 정렬").click();
await page.getByLabel("글자 크기").selectOption("16");
await page.getByRole("button", { name: "글자색", exact: true }).click();
await page.getByRole("menuitem", { name: "글자색 #b83a29" }).click();
await page.keyboard.type("오른쪽 빨간 글씨");
await page.keyboard.press("Enter");
await page.getByTitle("왼쪽 정렬").click();
await page.getByRole("button", { name: "글자 배경색" }).click();
await page.getByRole("menuitem", { name: "글자 배경색 #fff3bf" }).click();
await page.keyboard.type("노란 배경 글씨는 서로 이웃만 봐요.");
await page.getByRole("radio", { name: /서로 이웃만/ }).click();
await page.screenshot({ path: `${outDir}/editor-toolbar.png` });
await page.locator("[data-rich-editor]").screenshot({ path: `${outDir}/editor-toolbar-close.png` });
await page.getByRole("button", { name: "발행하기" }).click();
await page.waitForURL(/\/blog\/|\/@/);
const postUrl = page.url().split("?")[0];
const { rows: [post] } = await db.query("SELECT id, content_html, visibility FROM posts WHERE blog_id = (SELECT id FROM blogs WHERE slug = $1) ORDER BY id DESC LIMIT 1", [author.slug]);
const html = post.content_html;
check("제목은 h2, 부제목은 h3로 저장", html.includes("<h2>오늘의 제목</h2>") && html.includes("<h3>작은 부제목</h3>"), html.slice(0, 80));
check("가운데 정렬·글자 크기 저장", /<p style="text-align:center"><span style="font-size:24px">가운데 큰 글씨<\/span><\/p>/.test(html));
// 브라우저가 색을 rgb()로 바꿔 넘긴다
check("오른쪽 정렬·글자색 저장", /<p style="text-align:right"><span style="color:rgb\(184, 58, 41\)">오른쪽 빨간 글씨<\/span><\/p>/.test(html));
check("배경색 저장", html.includes("background-color:rgb(255, 243, 191)"));
check("비공개로 저장", post.visibility === "private");
await page.screenshot({ path: `${outDir}/post-view.png`, fullPage: true });
const centerAlign = await page.locator("article p", { hasText: "가운데 큰 글씨" }).evaluate((el) => getComputedStyle(el).textAlign);
check("글 화면에서 가운데 정렬", centerAlign === "center");

// ===== 비공개 글은 서로 이웃만 =====
const sees = async (m) => {
  const res = await m.page.goto(postUrl);
  return res.status() === 200 && (await m.page.getByText("가운데 큰 글씨").isVisible());
};
const listed = async (m) => {
  await m.page.goto(`${BASE}/@${author.slug}`);
  return m.page.getByText("툴바 시험").isVisible();
};
check("이웃 아닌 사람은 못 봄", !(await sees(stranger)));
await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [friend.uid, author.uid]);
check("한쪽만 이웃이면 못 봄", !(await sees(friend)));
check("한쪽 이웃은 블로그 목록에도 안 보임", !(await listed(friend)));
await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [author.uid, friend.uid]);
check("서로 이웃은 봄", await sees(friend));
await friend.page.screenshot({ path: `${outDir}/mutual-sees.png`, fullPage: true });
check("서로 이웃은 블로그 목록에도 보임", await listed(friend));
check("주인은 봄", await sees(author));
check("이웃 아닌 사람은 여전히 못 봄", !(await sees(stranger)));

// 볼 수 없는 글은 일부러 404 화면이라 그 응답 오류는 뺀다
for (const m of [author, friend, stranger]) {
  const errors = m.errors.filter((e) => !e.includes("status of 404"));
  check(`화면 오류 없음 (${m.slug})`, errors.length === 0, errors.join(" | "));
}
console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
