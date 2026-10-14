// 블로그 홈 레이아웃: 머리 카드(정보 왼쪽·미니룸 오른쪽), 이웃 더보기, 정렬·보기 전환
import { chromium } from "@playwright/test";
import pg from "pg";
import { BASE, collectErrors, fakeMember, fakePost, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, "layout1");

const { rows: [me] } = await db.query("SELECT b.id, b.slug, b.owner_id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.name = 'layout1'");
// 글 3개(좋아요 순서가 최신순과 다르게) + 이웃 5명 (즐겨찾기 2명)
const { rows: [{ n }] } = await db.query("SELECT count(*)::int AS n FROM posts WHERE blog_id = $1", [me.id]);
if (n === 0) {
  await fakePost(db, me.id, { title: "첫 번째 글", text: "가장 오래된 글이에요. 조회수가 많아요.", minutesAgo: 300 });
  await fakePost(db, me.id, { title: "두 번째 글", text: "중간 글", minutesAgo: 200 });
  await fakePost(db, me.id, { title: "세 번째 글", text: "가장 최근 글", minutesAgo: 100 });
  for (let i = 1; i <= 5; i++) {
    const m = await fakeMember(db, `lnb${i}${Date.now() % 10000}`);
    await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, $3)", [me.owner_id, m.uid, i <= 2]);
  }
}

await page.goto(`${BASE}/@${me.slug}`);
await page.locator("[data-miniroom-edit]").waitFor();
await page.screenshot({ path: `${outDir}/blog-home-desktop.png`, fullPage: true });

const visible = () => page.locator("[data-neighbor]").count();
console.log("이웃 접힘:", await visible());
await page.getByRole("button", { name: /이웃 더보기/ }).click();
console.log("이웃 펼침:", await visible());

await page.locator("#post-sort").selectOption("oldest");
await page.waitForURL(/sort=oldest/);
console.log("오래된순 첫 글:", await page.locator("article h3").first().innerText());
await page.getByRole("link", { name: "바둑판형으로 보기" }).click();
await page.waitForURL(/view=grid/);
await page.locator('[data-post-view="grid"]').waitFor();
await page.screenshot({ path: `${outDir}/blog-home-grid.png`, fullPage: true });

await page.setViewportSize({ width: 375, height: 800 });
await page.goto(`${BASE}/@${me.slug}`);
await page.screenshot({ path: `${outDir}/blog-home-mobile.png`, fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
console.log("휴대폰 가로 넘침(px):", overflow);

console.log(errors.length ? errors : "오류 없음");
await browser.close();
await db.end();
