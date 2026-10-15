// 주소·요청의 숫자 값이 이상해도 500 오류가 나지 않는다 (#21: BLOG-02, POST-03, POST-05, 블로그 홈 화면)
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog.mjs 를 한 번 돌린 뒤 (tester1 블로그·글 필요) node e2e/params.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, args) => (await db.query(q, args)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const HUGE = 99999999999; // integer 범위(2,147,483,647) 밖

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
await loginDev(page, "tester1");
const post = await one(
  "SELECT p.id FROM posts p JOIN blogs b ON b.id = p.blog_id WHERE b.slug = 'tester1' AND p.visibility = 'public' ORDER BY p.id DESC LIMIT 1",
);

// ── 주소: 500 대신 404 또는 기본값 ──
const status = async (path) => (await page.request.get(`${BASE}${path}`)).status();
for (const [path, want] of [
  ["/@tester1/2147483648", 404],
  ["/@tester1/1e3", 404],
  ["/write/2147483648", 404],
  ["/@tester1?category=1.5", 200],
  ["/@tester1?category=Infinity", 200],
  ["/@tester1?category=99999999999", 200],
  ["/@tester1?page=99999999999999999999", 200],
  ["/feed?page=99999999999999999999", 200],
  ["/feed?page=1e300", 200],
  ["/feed/following?page=99999999999999999999", 200],
  [`/tags/${encodeURIComponent("git")}?page=99999999999999999999`, 200],
  ["/wallet?page=99999999999999999999", 200],
]) {
  const got = await status(path);
  check(`주소 ${path} → ${want}`, got === want, `HTTP ${got}`);
}

// ── 폼으로 보내는 숫자: 화면의 값을 범위 밖으로 바꿔 보낸다 ──
await page.goto(`${BASE}/write`);
await page.locator(".ProseMirror").waitFor();
await page.getByPlaceholder("제목").fill("범위 밖 카테고리");
await page.locator(".ProseMirror").click();
await page.keyboard.type("본문");
await page.getByLabel("카테고리").evaluate((s, v) => {
  s.add(new Option("조작", String(v)));
  s.value = String(v);
}, HUGE);
await page.getByRole("button", { name: "발행하기" }).click();
const writeError = await page.getByText("잘못된 요청이에요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
check("글 저장: 범위 밖 카테고리 ID → '잘못된 요청이에요'", writeError && page.url().endsWith("/write"));

// ── 서버 API로 보내는 숫자: 범위 밖·숫자가 아닌 값이면 500이 아니라 400(잘못된 요청) ──
await page.goto(`${BASE}/@tester1/${post.id}`);
const api = (method, path, body) =>
  page.evaluate(
    async ({ method, path, body }) =>
      (await fetch(`/api/v1${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).status,
    { method, path, body },
  );
const commentsBefore = (await one("SELECT count(*)::int AS n FROM comments")).n;
check("댓글: 범위 밖 글 ID → 400, 저장 안 됨", (await api("POST", `/blog/posts/${HUGE}/comments`, { content: "범위 밖 글에 댓글" })) === 400 && (await one("SELECT count(*)::int AS n FROM comments")).n === commentsBefore);
check("답글: 범위 밖 원댓글 ID → 400", (await api("POST", `/blog/posts/${post.id}/comments`, { content: "x", parentId: HUGE })) === 400);
check("공감: 범위 밖 글 ID → 400", (await api("POST", `/blog/posts/${HUGE}/like`)) === 400);
check("공감: 숫자가 아닌 글 ID → 400", (await api("POST", "/blog/posts/abc/like")) === 400);
check("댓글 수정: 범위 밖 댓글 ID → 400", (await api("PUT", `/blog/comments/${HUGE}`, { content: "x" })) === 400);
check("댓글 삭제: 범위 밖 댓글 ID → 400", (await api("DELETE", `/blog/comments/${HUGE}`)) === 400);
check("조회수: 범위 밖 글 ID → 400", (await api("POST", `/blog/posts/${HUGE}/view`)) === 400);
check("방문 수: 범위 밖 블로그 ID → 400", (await api("POST", `/blog/blogs/${HUGE}/visit`)) === 400);
const cat = await one("SELECT c.id FROM categories c JOIN blogs b ON b.id = c.blog_id WHERE b.slug = 'tester1' LIMIT 1");
check("카테고리 순서: 범위 밖 ID → 400", (await api("POST", `/my-blog/categories/${HUGE}/move`, { direction: -1 })) === 400);
check("카테고리 순서: 이상한 방향 값 → 400", (await api("POST", `/my-blog/categories/${cat.id}/move`, { direction: "x" })) === 400);
check("카테고리 이름: 범위 밖 ID → 400", (await api("PUT", `/my-blog/categories/${HUGE}`, { name: "새 이름" })) === 400);
check("카테고리 삭제: 범위 밖 ID → 400", (await api("DELETE", `/my-blog/categories/${HUGE}`)) === 400);
await page.screenshot({ path: `${outDir}/70-params.png` });

console.log(results.join("\n"));
const serverErrors = errors.filter((e) => e.includes("500"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌")) || serverErrors.length) process.exit(1);
