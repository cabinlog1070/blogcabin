// 블로그 홈 카테고리: [전체 글] ↔ 카테고리를 한 번만 눌러도 글 목록이 바뀐다.
// 예전에는 /@slug 주소 바꿔 보여주기가 쿼리(?category=)를 빠뜨려서 주소만 바뀌고 목록은 그대로였다.
// 미리 받아 두기(prefetch)가 켜진 운영 빌드에서만 생기던 문제라 `npm run build && npx next start`로 띄워서도 돌려 본다.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, fakePost } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);

// 카테고리 둘(일상 2개, 여행 1개) + 분류 없는 글 1개 = 전체 4개
const m = await fakeMember(db, `bc${tag}`);
const cat = async (name, position) =>
  (await db.query("INSERT INTO categories (blog_id, name, position) VALUES ($1, $2, $3) RETURNING id", [m.blogId, name, position])).rows[0].id;
const daily = await cat("일상", 0);
const trip = await cat("여행", 1);
for (const [title, categoryId] of [["일상1", daily], ["일상2", daily], ["여행1", trip], ["분류 없음", null]]) {
  const id = await fakePost(db, m.blogId, { title });
  if (categoryId) await db.query("UPDATE posts SET category_id = $1 WHERE id = $2", [categoryId, id]);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
await page.goto(`${BASE}/@${m.slug}`);
await page.waitForLoadState("networkidle"); // 화면의 링크를 미리 받아 둔 뒤에 누른다
const nav = page.getByRole("navigation", { name: "카테고리" });
const heading = page.locator("section h2").first();
const cards = page.locator("[data-post-view] > *");

for (const [name, count, query] of [
  ["일상", 2, `?category=${daily}`],
  ["여행", 1, `?category=${trip}`],
  ["전체 글", 4, ""],
  ["일상", 2, `?category=${daily}`],
]) {
  await nav.getByRole("link", { name: new RegExp(`^(└ )?${name}`) }).click(); // 한 번만 누른다
  await page.waitForURL(`${BASE}/@${m.slug}${query}`);
  const ok = await heading.filter({ hasText: name }).waitFor({ timeout: 5000 }).then(() => true, () => false);
  const n = await cards.count();
  check(`[${name}] 한 번 눌러 바뀜: 제목 "${(await heading.innerText()).replace(/\s+/g, " ")}", 글 ${n}개`, ok && n === count);
}

check(`콘솔 오류 없음 ${errors.join(" | ")}`, errors.length === 0);
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
