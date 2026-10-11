// 미니룸이 블로그 홈과 꾸미기에서, 휴대폰과 컴퓨터에서 같은 비율·같은 배치로 보이는지
import { chromium } from "@playwright/test";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch();
let seeded = false;
for (const [name, opts] of [
  ["desktop", { viewport: { width: 1280, height: 900 } }],
  ["phone", { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, "layout1");
  if (!seeded) {
    // 가구 두 개를 왼쪽 앞·오른쪽 뒤에 놓는다
    const { rows: [u] } = await db.query("SELECT id FROM users WHERE name = 'layout1'");
    const { rows: items } = await db.query("SELECT id FROM items WHERE type = 'furniture' ORDER BY id LIMIT 2");
    await db.query("DELETE FROM room_furniture WHERE user_id = $1", [u.id]);
    for (const [i, it] of items.entries()) {
      await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [u.id, it.id]);
      await db.query("INSERT INTO room_furniture (user_id, item_id, x, y) VALUES ($1, $2, $3, $4)", [u.id, it.id, i ? 75 : 25, i ? 60 : 80]);
    }
    seeded = true;
  }
  for (const [where, url] of [["blog", "/@layout1"], ["closet", "/closet"]]) {
    await page.goto(`${BASE}${url}`);
    const room = page.locator("[data-mini-room]").first();
    await room.waitFor();
    await page.waitForTimeout(300);
    const b = await room.boundingBox();
    console.log(name, where, `${Math.round(b.width)}x${Math.round(b.height)}`, (b.width / b.height).toFixed(2));
    await room.screenshot({ path: `${outDir}/room-${name}-${where}.png` });
  }
  console.log(name, errors.length ? errors : "오류 없음");
  await ctx.close();
}
await browser.close();
await db.end();
