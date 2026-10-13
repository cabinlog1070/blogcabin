// TOWN-12 광장 이웃 주민: 즐겨찾기한 이웃이 펫과 함께 광장을 돌아다니고, 가까이 가면 상태 메시지 말풍선이 뜬다.
// 무작위 동작(걷기·의자에 앉기·기타·노래·펫 쓰다듬기·꽃에 물 주기·마시멜로)이 하나씩 나오는지 지켜본다.
// 블로그 관리에서 상태 메시지를 저장할 수 있다 (30자까지, 비우면 지워진다).
// 사용: 개발 서버를 띄운 상태에서 node e2e/residents.mjs <스크린샷 폴더> (실행마다 새 회원)
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
mkdirSync(outDir, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, args) => (await db.query(q, args)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
const run = Date.now() % 100_000_000;
const devId = `rs${run}`;
await loginDev(page, devId);
const uid = (await one("SELECT id FROM users WHERE username = $1", [devId])).id;

// ── 즐겨찾기 이웃 5명 (상태 메시지 4명, 펫 3마리) + 즐겨찾기하지 않은 이웃 1명 ──
const girl = (await one("SELECT id FROM items WHERE code = 'char_girl'")).id;
const neighbors = [];
const statuses = ["오늘은 캠프파이어 앞에서 기타 연습 🎸", "마시멜로 구워 먹을 사람?", null, "꽃에 물 주는 중이에요", "今日もいい天気！"];
const pets = ["bunny", "piglet", null, "chick", null];
for (let i = 0; i < 5; i++) {
  const m = await fakeMember(db, `rs${run}n${i}`, { nickname: `이웃${i}_${run % 1000}` });
  if (i % 2) {
    await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2)", [m.uid, girl]);
    await db.query("UPDATE profiles SET character_item_id = $2 WHERE user_id = $1", [m.uid, girl]);
  }
  await db.query("UPDATE profiles SET status_message = $2 WHERE user_id = $1", [m.uid, statuses[i]]);
  if (pets[i]) {
    await db.query(
      "INSERT INTO user_animals (user_id, source, status, species_id, growth, name, gender, hatched_at, carried, accessory) VALUES ($1, 'shop', 'growing', (SELECT id FROM animal_species WHERE code = $2), 200, '펫', 'female', now(), true, $3)",
      [m.uid, pets[i], i === 0 ? "ribbon" : "none"],
    );
  }
  await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, true)", [uid, m.uid]);
  neighbors.push(m);
}
const plain = await fakeMember(db, `rs${run}x`);
await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, false)", [uid, plain.uid]);

// ── 광장: 주민 5명 ──
await page.goto(`${BASE}/town`);
const canvas = page.locator("canvas");
await page.waitForFunction(() => document.querySelector("canvas")?.dataset.residents !== undefined, null, { timeout: 60000 });
const residents = (await canvas.getAttribute("data-residents")).split(",").filter(Boolean);
check("즐겨찾기 이웃 5명이 광장에 나온다", residents.length === 5 && neighbors.every((n) => residents.includes(n.slug)), residents.join(","));
check("즐겨찾기하지 않은 이웃은 돌아다니지 않는다", !residents.includes(plain.slug));

// ── 무작위 동작: 지켜보면서 나온 동작을 모은다 ──
const seen = new Set();
const shot = new Set();
const deadline = Date.now() + Number(process.env.WATCH_MS ?? 90000);
const positions = async () =>
  Object.fromEntries(
    ((await canvas.getAttribute("data-resident-pos")) ?? "").split(";").filter(Boolean).map((s) => {
      const [slug, xy] = s.split(":");
      const [x, y] = xy.split(",").map(Number);
      return [slug, { x, y }];
    }),
  );
while (Date.now() < deadline) {
  await page.waitForTimeout(700);
  const acts = ((await canvas.getAttribute("data-resident-acts")) ?? "").split(",").map((s) => s.split(":")[1]);
  for (const a of acts) {
    if (!a || a === "rest" || a.startsWith("go-")) continue;
    seen.add(a);
    if (!shot.has(a) && a !== "wander") {
      shot.add(a);
      await page.screenshot({ path: `${outDir}/residents-${a}.png` });
    }
  }
  if (["sit", "guitar", "pet", "water", "marshmallow"].every((a) => seen.has(a)) && seen.has("sing")) break;
}
check("주민이 걷다 멈춰 무작위 동작을 한다", seen.size >= 3, [...seen].join(","));
for (const a of ["sit", "guitar", "pet", "water", "marshmallow", "sing"]) {
  if (!seen.has(a)) results.push(`ℹ️ 지켜보는 동안 '${a}' 동작은 나오지 않음 (무작위)`);
}

// ── 상태 메시지 말풍선: 상태 메시지가 있는 이웃에게 다가간다 ──
const target = neighbors[0].slug;
let bubble = "";
for (let i = 0; i < 14 && !bubble; i++) {
  const pos = await positions();
  const me = await page.evaluate(() => document.querySelector("canvas").dataset.playerPos);
  const [px, py] = (me ?? "0,0").split(",").map(Number);
  const zoom = Number(await canvas.getAttribute("data-zoom"));
  const box = await canvas.boundingBox();
  const p = pos[target];
  // 카메라는 내 캐릭터를 가운데에 둔다 (조금 아래로 20px). 화면 밖이면 그 방향 가장자리를 누른다
  const sx = Math.min(box.width - 20, Math.max(20, box.width / 2 + (p.x - px) * zoom));
  const sy = Math.min(box.height - 20, Math.max(20, box.height / 2 + (p.y - py + 20) * zoom));
  await page.mouse.click(box.x + sx, box.y + sy);
  await page.waitForTimeout(1200);
  bubble = (await canvas.getAttribute("data-bubble")) ?? "";
}
check("상태 메시지가 있는 이웃에게 다가가면 말풍선이 뜬다", bubble !== "", bubble);
await page.screenshot({ path: `${outDir}/residents-bubble.png` });

// ── 블로그 관리: 상태 메시지 저장 ──
await page.goto(`${BASE}/settings/blog`);
const field = page.locator('input[name="statusMessage"]');
await field.fill("광장에서 만나요");
await page.getByRole("button", { name: "저장", exact: true }).first().click();
await page.getByText("저장했어요 ✓").waitFor();
check("블로그 관리에서 상태 메시지를 저장한다", (await one("SELECT status_message FROM profiles WHERE user_id = $1", [uid])).status_message === "광장에서 만나요");
check("상태 메시지는 30자까지 (입력 칸 maxlength)", (await field.getAttribute("maxlength")) === "30");
await field.fill("");
await page.getByRole("button", { name: "저장", exact: true }).first().click();
await page.waitForTimeout(800);
check("비우고 저장하면 상태 메시지가 지워진다", (await one("SELECT status_message FROM profiles WHERE user_id = $1", [uid])).status_message === null);
await page.screenshot({ path: `${outDir}/residents-settings.png`, fullPage: true });

check("화면 오류 없음", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
