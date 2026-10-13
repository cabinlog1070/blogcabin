// 휴대폰에서 글씨 잘림·캐릭터 크기 확인 (2026-10-13):
// 미니룸 오른쪽 끝에 세운 캐릭터·놓은 펫, 농장 오른쪽 울타리 쪽 펫이 작아지지 않는지, 즐겨찾기 안내가 카드 안에 보이는지
import { chromium } from "@playwright/test";
import pg from "pg";
import { BASE, collectErrors, loginDev, fakeMember } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch();
let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "✓" : "✗", name, extra); if (!ok) fails++; };

const phone = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1280, height: 900 } };

// 준비: edge1 회원, 펫 한 마리(미니룸에 놓음)
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await loginDev(page, "edge1");
  await ctx.close();
}
const { rows: [me] } = await db.query("SELECT u.id, b.id AS blog_id FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.name = 'edge1'");
await db.query("DELETE FROM user_animals WHERE user_id = $1", [me.id]);
await db.query(
  "INSERT INTO user_animals (user_id, species_id, status, growth, source, name, gender, hatched_at, grown_at, carried) SELECT $1, id, 'growing', 10, 'shop', '펫' || id, 'female', now(), NULL, false FROM animal_species ORDER BY id LIMIT 8",
  [me.id],
);
// 데리고 다니는 다 자란 펫 (미니룸에 놓는다)
await db.query(
  "INSERT INTO user_animals (user_id, species_id, status, growth, source, name, gender, hatched_at, grown_at, carried) SELECT $1, id, 'grown', 999, 'shop', '뭉치', 'female', now(), now(), true FROM animal_species WHERE asset_key = 'animal.bunny'",
  [me.id],
);

for (const [name, opts] of [["phone", phone], ["desktop", desktop]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, "edge1");

  // 1) 미니룸: 캐릭터를 가운데 → 오른쪽 끝, 펫도 오른쪽 끝
  const sizes = {};
  for (const [spot, x] of [["middle", 50], ["right", 94], ["left", 6]]) {
    await db.query("UPDATE blogs SET room_char_x = $2, room_char_y = 70, room_pet_x = $2, room_pet_y = 96 WHERE id = $1", [me.blog_id, x]);
    await page.goto(`${BASE}/@edge1`);
    const room = page.locator("[data-mini-room]").first();
    await room.waitFor();
    await page.waitForTimeout(300);
    const c = await page.locator("[data-room-character] img").first().boundingBox();
    const p = await page.locator("[data-room-pet-placed] img").first().boundingBox();
    sizes[spot] = { c: Math.round(c.width), p: Math.round(p.width) };
    await room.screenshot({ path: `${outDir}/room-${name}-${spot}.png` });
  }
  console.log(name, "미니룸 크기", JSON.stringify(sizes));
  check(`${name} 미니룸 캐릭터 크기가 자리마다 같다`, sizes.right.c === sizes.middle.c && sizes.left.c === sizes.middle.c);
  check(`${name} 미니룸 펫 크기가 자리마다 같다`, Math.abs(sizes.right.p - sizes.middle.p) <= 1 && Math.abs(sizes.left.p - sizes.middle.p) <= 1);

  // 2) 농장: 돌아다니는 펫 그림 폭이 늘 같은지 (4초 동안 여러 번 잰다)
  await page.goto(`${BASE}/farm`);
  await page.locator("[data-pet-id]").first().waitFor();
  // 펫 하나를 오른쪽 끝에 세워 본다
  await page.evaluate(() => { const el = document.querySelector("[data-pet-id]"); el.style.left = "92%"; });
  const widths = new Set();
  for (let i = 0; i < 8; i++) {
    for (const w of await page.locator("[data-pet-id] [data-pet-img] img").evaluateAll((els) => els.map((e) => e.offsetWidth))) widths.add(w);
    await page.waitForTimeout(500);
  }
  console.log(name, "농장 펫 그림 폭", [...widths]);
  check(`${name} 농장 펫 크기가 늘 같다`, widths.size === 1);
  await page.locator("[data-farm-field], main").first().screenshot({ path: `${outDir}/farm-${name}.png` }).catch(() => {});

  if (errors.length) console.log(name, errors);
  await ctx.close();
}

// 3) 즐겨찾기 10명 꽉 찬 상태에서 11번째 블로그의 ☆ 누르기 → 안내가 카드 안에 다 보인다
{
  const fakes = [];
  await db.query("DELETE FROM users WHERE id LIKE 'fk_edgefav%'");
  for (let i = 0; i < 11; i++) fakes.push(await fakeMember(db, `edgefav${i}`));
  await db.query("DELETE FROM follows WHERE follower_id = $1", [me.id]);
  for (const [i, f] of fakes.entries()) {
    await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, $3)", [me.id, f.uid, i < 10]);
  }
  for (const [name, opts] of [["phone", phone], ["desktop", desktop]]) {
    for (const locale of ["ko", "ja"]) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      await loginDev(page, "edge1");
      await ctx.addCookies([{ name: "lang", value: locale, url: BASE }]);
      await page.goto(`${BASE}/@edgefav10`);
      await page.locator("[data-favorite-star]").click();
      await page.getByText(locale === "ja" ? "お気に入りにできる" : "즐겨찾기할 이웃은").waitFor();
      const card = await page.locator("section.card").first().boundingBox();
      const m = await page.getByText(locale === "ja" ? "お気に入りにできる" : "즐겨찾기할 이웃은").boundingBox();
      check(`${name} ${locale} 즐겨찾기 안내가 카드 안에 있다`, m.x >= card.x && m.x + m.width <= card.x + card.width && m.y + m.height <= card.y + card.height, JSON.stringify({ m, card }));
      await page.locator("section.card").first().screenshot({ path: `${outDir}/favorite-${name}-${locale}.png` });
      await page.waitForTimeout(3300);
      check(`${name} ${locale} 안내는 3초 뒤 사라진다`, (await page.getByText(locale === "ja" ? "お気に入りにできる" : "즐겨찾기할 이웃은").count()) === 0);
      await ctx.close();
    }
  }
}

await browser.close();
await db.end();
console.log(fails ? `실패 ${fails}` : "모두 통과");
process.exit(fails ? 1 : 0);
