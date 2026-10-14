// 동물 농장 2026-10-12: 알 둥지 10개, [모두 부화시키기], 풀밭 10마리, 펫 색 고르기, 새 동물 14종(모두 19종)
// 사용: 개발 서버를 띄운 상태에서 node e2e/farm-ten.mjs <스크린샷 폴더> (실행마다 새 회원)
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
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
const devId = `ften${Date.now() % 100_000_000}`;
await loginDev(page, devId);
const uid = (await one("SELECT id FROM users WHERE username = $1", [devId])).id;
const count = async (status) => (await one("SELECT COUNT(*)::int AS n FROM user_animals WHERE user_id = $1 AND status = $2", [uid, status])).n;

async function go(path) {
  await page.goto(`${BASE}${path}`);
  const ok = page.locator("[data-levelup-modal]").getByRole("button", { name: "확인" });
  if (await ok.waitFor({ timeout: 2000 }).then(() => true, () => false)) await ok.click();
}

// ── 새 동물: 모두 19종, 카드 도감 칸도 19개 ──
const species = (await db.query("SELECT code FROM animal_species")).rows.map((r) => r.code);
const added = ["puppy", "tiger", "dragon", "raccoon", "monkey", "cat", "bear", "fox", "hamster", "unicorn", "wolf", "turtle", "dino", "mole"];
check("동물 종류 19종 (새 동물 14종)", species.length === 19 && added.every((c) => species.includes(c)), species.length);

// ── 알 둥지 10개 ──
await go("/farm");
check("카드 도감 칸 19개", (await page.locator("[data-species-slot]").count()) === 19);

// ── 알 받기 ⓘ: 펫 확률 (부화 비중 그대로) ──
await page.locator("[data-hatch-odds-button]").click();
const odds = page.locator("[data-hatch-odds]");
await odds.waitFor();
const pcts = (await odds.locator("[data-odds-percent]").allInnerTexts()).map((x) => parseFloat(x));
const weights = (await db.query("SELECT asset_key, hatch_weight FROM animal_species")).rows;
const totalW = weights.reduce((s, r) => s + r.hatch_weight, 0);
const dragonPct = parseFloat(await odds.locator('[data-odds-species="animal.dragon"] [data-odds-percent]').innerText());
check("확률 안내: 19종, 합계 약 100%", pcts.length === 19 && Math.abs(pcts.reduce((s, x) => s + x, 0) - 100) < 2, pcts.join(" "));
check("확률 안내: DB 비중 그대로 (드래곤)", Math.abs(dragonPct - (weights.find((r) => r.asset_key === "animal.dragon").hatch_weight / totalW) * 100) < 0.1, dragonPct);
await odds.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outDir}/f0-hatch-odds.png` });
await page.mouse.click(5, 400);
await odds.waitFor({ state: "detached" });
check("확률 안내: 밖을 누르면 닫힌다", true);
await page.getByRole("button", { name: /농장 첫 알/ }).click();
await page.getByRole("status").getByText("알을 받았어요").waitFor();
for (let i = 0; i < 9; i++) await db.query("INSERT INTO user_animals (user_id, source) VALUES ($1, 'shop')", [uid]);
await db.query("INSERT INTO point_ledger (user_id, reason, coin_delta) VALUES ($1, 'signup', 500)", [uid]);
await page.reload();
await page.locator("[data-nest] [data-egg-id]").first().waitFor();
check("둥지에 알 10개가 놓인다", (await page.locator("[data-nest] [data-egg-id]").count()) === 10);
check("알 둥지가 꽉 차면 알 사기가 막힌다", await page.getByRole("button", { name: /알 사기/ }).isDisabled());
await page.screenshot({ path: `${outDir}/f1-nest-10.png` });

// ── 풀밭 10마리: 8마리 키우는 중에 [모두 부화시키기] → 2마리만 태어나고 알 8개는 둥지에 ──
await db.query(
  `INSERT INTO user_animals (user_id, source, status, species_id, growth, name, gender, hatched_at)
   SELECT $1, 'shop', 'growing', s.id, 10, s.name, 'female', now() FROM animal_species s WHERE s.code = ANY($2)`,
  [uid, ["tiger", "dragon", "raccoon", "monkey", "cat", "bear", "fox", "hamster"]],
);
await page.reload();
await page.locator("[data-hatch-all]").click();
await page.getByRole("status").getByText("2마리가 태어났어요").waitFor();
check("한 번에 부화: 풀밭 남은 자리만큼(2마리)", (await count("growing")) === 10 && (await count("egg")) === 8, `${await count("growing")} / ${await count("egg")}`);
check("남은 알 안내", (await page.getByRole("status").innerText()).includes("알 8개는 둥지에 남았어요"));
await page.reload();
await page.locator("[data-farm-field] [data-pet-id]").first().waitFor();
check("풀밭에 펫 10마리", (await page.locator("[data-farm-field] [data-pet-id]").count()) === 10);
check("풀밭이 꽉 차면 [모두 부화시키기]가 막힌다", await page.locator("[data-hatch-all]").isDisabled());
await page.locator("[data-nest] [data-egg-id]").first().click();
check("풀밭이 꽉 차면 알 하나 부화도 막힌다", await page.getByRole("dialog").getByRole("button", { name: "부화시키기", exact: true }).isDisabled());
await page.keyboard.press("Escape");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/f2-field-10.png` });

// 풀밭 자리가 나면 남은 알이 모두 부화한다 (10마리 중 8마리를 다 키움)
await db.query("UPDATE user_animals SET status = 'grown', grown_at = now() WHERE id IN (SELECT id FROM user_animals WHERE user_id = $1 AND status = 'growing' ORDER BY id LIMIT 8)", [uid]);
await page.reload();
await page.locator("[data-hatch-all-card]").click();
await page.getByRole("status").getByText("8마리가 태어났어요").waitFor();
check("남은 알 8개 모두 부화", (await count("egg")) === 0 && (await count("growing")) === 10);

// ── 펫 색: 꾸미기 창에서 검정색 → DB·그림 ──
// 거북이는 검정색이어도 얼굴을 흰색으로 바꾸지 않아서 거북이가 아닌 펫으로 본다
const [pet] = (await db.query("SELECT a.id FROM user_animals a JOIN animal_species s ON s.id = a.species_id WHERE a.user_id = $1 AND a.status = 'growing' AND s.asset_key <> 'animal.turtle' ORDER BY a.id LIMIT 1", [uid])).rows;
await page.reload();
await page.getByRole("button", { name: /펫 꾸미기/ }).click();
await page.locator(`[data-decorate-pick="${pet.id}"]`).click();
const row = page.locator(`[data-decorate-pet="${pet.id}"]`);
await row.locator('[data-pet-color="black"]').click();
await page.getByRole("status").getByText("색을 바꿨어요").waitFor();
check("펫 색 저장 (검정색)", (await one("SELECT color FROM user_animals WHERE id = $1", [pet.id])).color === "black");
await row.locator('img[data-color="black"]').waitFor();
check("꾸미기 창 그림이 검정색 (눈·코는 흰색)", decodeURIComponent((await row.locator("img").first().getAttribute("src")) ?? "").includes("#fffaf2"));
await row.locator('[data-pet-color="pink"]').click();
await row.locator('img[data-color="pink"]').waitFor();
check("다른 색으로 다시 바꾸기 (분홍색)", (await one("SELECT color FROM user_animals WHERE id = $1", [pet.id])).color === "pink");
check("색 13가지 (기본 + 12색)", (await row.locator("[data-pet-color]").count()) === 13);
await row.locator('[data-pet-color="mint"]').click();
await row.locator('img[data-color="mint"]').waitFor();
check("새로 더한 색 (민트색)", (await one("SELECT color FROM user_animals WHERE id = $1", [pet.id])).color === "mint");
await page.screenshot({ path: `${outDir}/f3-color-panel.png` });
// 꾸미기 창에서 이름 바꾸기
await row.locator("[data-decorate-name]").fill("까망이");
await row.getByRole("button", { name: "바꾸기", exact: true }).click();
await page.getByRole("status").getByText("까망이").waitFor();
check("꾸미기 창에서 이름 바꾸기", (await one("SELECT name FROM user_animals WHERE id = $1", [pet.id])).name === "까망이");
// 알림은 3초 뒤에 사라진다
await page.waitForTimeout(3500);
check("알림이 3초 뒤에 사라진다", (await page.getByRole("status").innerText()).trim() === "");
await page.keyboard.press("Escape");

// 풀밭의 펫을 눌러 상태창 → [꾸미기] → 그 펫이 골라진 꾸미기 창
const [pet2] = (await db.query("SELECT id FROM user_animals WHERE user_id = $1 AND status = 'growing' ORDER BY id OFFSET 1 LIMIT 1", [uid])).rows;
const pet2Name = (await one("SELECT name FROM user_animals WHERE id = $1", [pet2.id])).name;
await page.getByRole("button", { name: `${pet2Name} 상태 보기` }).first().click({ force: true });
await page.locator(`[data-pet-status="${pet2.id}"] [data-status-decorate]`).click();
await page.locator(`[data-decorate-pet="${pet2.id}"]`).waitFor();
check("상태창 꾸미기 버튼 → 그 펫 꾸미기", (await page.locator(`[data-decorate-pick="${pet2.id}"]`).getAttribute("aria-pressed")) === "true");
await page.screenshot({ path: `${outDir}/f4-decorate-one.png` });
await page.keyboard.press("Escape");

// 데리고 다니는 펫 색은 블로그 미니룸에도
await db.query("UPDATE user_animals SET carried = true WHERE id = $1", [pet.id]);
const petName = (await one("SELECT name FROM user_animals WHERE id = $1", [pet.id])).name;
await go(`/@${devId.toLowerCase()}`);
check("미니룸 펫도 고른 색", (await page.locator(`[data-room-pet="${petName}"] img`).getAttribute("data-color")) === "mint");

// ── 카드 도감: 다 자란 카드가 도감 칸에 들어가고, 같은 동물이 여러 장이면 장수 표시와 고르기 창 ──
const cat = await one("SELECT id, grow_exp FROM animal_species WHERE asset_key = 'animal.cat'");
for (const name of ["나비", "치즈"])
  await db.query(
    "INSERT INTO user_animals (user_id, status, growth, source, species_id, name, gender, hatched_at, grown_at) VALUES ($1,'grown',$2,'shop',$3,$4,'female',now(),now())",
    [uid, cat.grow_exp, cat.id, name],
  );
await go("/farm");
const catSlot = page.locator('[data-species-slot="animal.cat"]');
await catSlot.scrollIntoViewIfNeeded();
const catCards = (await one("SELECT COUNT(*)::int AS n FROM user_animals WHERE user_id = $1 AND status = 'grown' AND species_id = $2", [uid, cat.id])).n;
check(`도감 칸에 카드 (고양이 ${catCards}장 → ×${catCards})`, (await catSlot.getAttribute("data-collected")) === "true" && (await catSlot.locator("[data-card-count]").innerText()) === `×${catCards}`);
await catSlot.getByRole("button").click();
const picker = page.locator('[data-species-cards="animal.cat"]');
await picker.waitFor();
check("여러 장이면 카드 고르기 창", (await picker.getByRole("button", { name: /카드 보기/ }).count()) === catCards);
await picker.getByRole("button", { name: "치즈 카드 보기" }).click();
await page.locator("[data-pet-status] [data-pet-name]", { hasText: "치즈" }).waitFor();
check("고른 카드의 상태창", true);
await page.keyboard.press("Escape");

// ── 선물로 알을 많이 받아 둥지가 넘칠 때: 둥지에는 10개만, 나머지는 [+N] (2026-10-14 핫픽스) ──
await db.query("DELETE FROM user_animals WHERE user_id = $1 AND status = 'egg'", [uid]);
const giftSp = await one("SELECT id FROM animal_species ORDER BY id LIMIT 1");
await db.query("INSERT INTO user_animals (user_id, source, egg_species_id) SELECT $1, 'gift', $2 FROM generate_series(1, 19)", [uid, giftSp.id]);
await go("/farm");
const nestBox = await page.locator("[data-nest]").boundingBox();
const eggBoxes = await Promise.all((await page.locator("[data-nest] [data-egg-id]").all()).map((l) => l.boundingBox()));
check("넘치는 둥지: 둥지에는 알 10개", eggBoxes.length === 10, String(eggBoxes.length));
check("넘치는 둥지: 알이 모두 둥지 안에", eggBoxes.every((b) => b.x >= nestBox.x - 1 && b.x + b.width <= nestBox.x + nestBox.width + 1));
check("넘치는 둥지: 나머지는 [+9]", (await page.locator("[data-nest-more]").innerText()) === "+9");
await page.locator("[data-nest]").screenshot({ path: `${outDir}/f5-nest-overflow.png` });
await page.locator("[data-nest-more]").click();
await page.getByRole("dialog").getByRole("button", { name: "부화시키기", exact: true }).waitFor();
check("[+9]를 누르면 알 창이 열린다", true);
await page.keyboard.press("Escape");
await db.query("DELETE FROM user_animals WHERE user_id = $1 AND status = 'egg'", [uid]);

// ── 휴대폰 375px ──
const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
await mctx.addCookies(await page.context().cookies());
const mp = await mctx.newPage();
for (let i = 0; i < 10; i++) await db.query("INSERT INTO user_animals (user_id, source) VALUES ($1, 'shop')", [uid]);
await mp.goto(`${BASE}/farm`);
await mp.locator("[data-farm-field]").waitFor();
const lv = mp.locator("[data-levelup-modal]").getByRole("button", { name: "확인" });
if (await lv.waitFor({ timeout: 2000 }).then(() => true, () => false)) await lv.click();
await mp.waitForTimeout(1500);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px: 알 10개·펫 9마리에도 가로 스크롤 없음", overflow <= 0, `넘침 ${overflow}px`);
await mp.screenshot({ path: `${outDir}/f4-farm-375.png` });
await mctx.close();

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
