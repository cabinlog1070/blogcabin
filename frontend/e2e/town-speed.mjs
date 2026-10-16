// 광장 첫 화면이 뜨기까지 걸리는 시간 (컴퓨터 / 휴대폰 흉내: CPU 4배 느리게)
// 즐겨찾기 이웃 10명(모두 다른 모습, 펫 있음)이 있는 회원으로 처음 방문(저장된 그림 없음)·다시 방문을 잰다.
// 사용: 운영과 같은 빌드(next build && next start)를 띄운 상태에서 node e2e/town-speed.mjs [회원 아이디]
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, fakeMember, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, args) => (await db.query(q, args)).rows[0];
const devId = process.argv[2] ?? `sp${Date.now() % 100_000_000}`;
const browser = await chromium.launch();

// 회원과 이웃 10명 준비 (이미 있으면 그대로)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await loginDev(page, devId);
  await ctx.storageState({ path: `/tmp/town-speed-${devId}.json` });
  await ctx.close();
  const uid = (await one("SELECT id FROM users WHERE username = $1", [devId])).id;
  const has = await one("SELECT count(*)::int n FROM follows WHERE follower_id = $1 AND is_favorite", [uid]);
  if (!has.n) {
    const girl = (await one("SELECT id FROM items WHERE code = 'char_girl'")).id;
    const colors = ["black", "brown", "caramel", "blonde", "red", "pink", "blue", "purple", "mint", "black"];
    const pets = ["bunny", "piglet", "chick", "bunny", "piglet", "chick", "bunny", "piglet", "chick", "bunny"];
    for (let i = 0; i < 10; i++) {
      const m = await fakeMember(db, `${devId}n${i}`.slice(-12), { nickname: `이웃${i}_${devId.slice(-4)}` });
      if (i % 2) {
        await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2)", [m.uid, girl]);
        await db.query("UPDATE profiles SET character_item_id = $2 WHERE user_id = $1", [m.uid, girl]);
      }
      // 모두 다른 모습 (머리·상의): 주민 모습마다 걷는 그림이 9장씩 생긴다
      const hairs = ["av_hair_pigtails", "av_hair_ponytail", "av_hair_buns", "av_hair_short", "av_hair_long", "av_hair_buzz", "av_hair_bowl", "av_hair_spiky", "av_hair_curly", "av_hair_bob"];
      const tops = ["av_top_coat", "av_top_vest", "av_top_stripe", "av_top_dino", "av_top_jeogori", "av_top_knit", "av_top_hoodie", "av_top_kimono", "av_top_coat", "av_top_vest"];
      for (const [slot, code] of [["hair", hairs[i]], ["top", tops[i]]]) {
        const item = (await one("SELECT id FROM items WHERE code = $1", [code])).id;
        await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [m.uid, item]);
        await db.query("INSERT INTO avatar_equips (user_id, slot, item_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, slot) DO UPDATE SET item_id = $3", [m.uid, slot, item]);
      }
      await db.query("UPDATE profiles SET hair_color = $2, status_message = '안녕' WHERE user_id = $1", [m.uid, colors[i]]);
      await db.query(
        "INSERT INTO user_animals (user_id, source, status, species_id, growth, name, gender, hatched_at, carried, accessory) VALUES ($1, 'shop', 'growing', (SELECT id FROM animal_species WHERE code = $2), 200, '펫', 'female', now(), true, 'none')",
        [m.uid, pets[i]],
      );
      await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, true)", [uid, m.uid]);
      for (let p = 0; p < i; p++) await db.query("INSERT INTO posts (blog_id, title, content_html, content_text, visibility) VALUES ($1, '글', '<p>글</p>', '글', 'public')", [m.blogId]);
    }
  }
}

async function measure(label, { phone }) {
  const ctx = await browser.newContext({
    storageState: `/tmp/town-speed-${devId}.json`,
    ...(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }),
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (phone) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const times = [];
  if (process.env.SPEED_LOG) page.on("console", (m) => m.text().startsWith("[speed]") && console.log("   ", label, m.text()));
  for (const visit of ["처음", "다시"]) {
    const t0 = Date.now();
    await page.goto(`${BASE}/town${process.env.HOUR ? `?hour=${process.env.HOUR}` : ""}`);
    const html = Date.now() - t0;
    await page.waitForFunction(() => document.querySelector("canvas") && !document.querySelector("[data-town-loading]"), null, { timeout: 180000, polling: 50 });
    const total = Date.now() - t0;
    const tex = await page.evaluate(() => document.querySelector("canvas")?.dataset.residents?.split(",").length);
    times.push(`${visit} ${(total / 1000).toFixed(1)}초 (페이지 ${(html / 1000).toFixed(1)}초, 주민 ${tex})`);
  }
  console.log(`${label}: ${times.join(" / ")}`);
  await ctx.close();
}

if (process.env.ONLY !== "phone") await measure("컴퓨터", { phone: false });
if (process.env.ONLY !== "pc") await measure("휴대폰 흉내", { phone: true });
await browser.close();
await db.end();
