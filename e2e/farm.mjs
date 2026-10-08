// TOWN-09 동물 농장: 울타리 친 풀밭과 돌아다니는 펫, 펫 상태창(이름·성별·만난 날·레벨·경험치), 이름 바꾸기,
// 돌보기(밥·쓰다듬기)와 물약, 펫 레벨업 알림(쪽지), 데리고 다니기(광장·미니룸, 한 마리만), 카드 도감, 프로필 전시, 펫 꾸미기,
// 알 사기, 5마리 제한, 글쓰기 연동
// 사용: 개발 서버를 띄운 상태에서 node e2e/farm.mjs <스크린샷 폴더> (실행마다 새 회원)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, args) => (await db.query(q, args)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
const devId = `farm${Date.now() % 100_000_000}`;
await loginDev(page, devId);
const uid = (await one("SELECT id FROM users WHERE username = $1", [devId])).id;
const slug = devId.toLowerCase();
const animals = async () =>
  (await db.query("SELECT id, status, growth, species_id, name, gender, carried, accessory, hatched_at FROM user_animals WHERE user_id = $1 ORDER BY id", [uid])).rows;
const dialog = () => page.getByRole("dialog");
const kstDate = (d) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** 회원 레벨업 팝업이 뜨면 닫는다 (다 키운 보상 경험치로 레벨이 오를 수 있다) */
async function closeLevelUp() {
  const ok = page.locator("[data-levelup-modal]").getByRole("button", { name: "확인" });
  if (await ok.waitFor({ timeout: 2500 }).then(() => true, () => false)) await ok.click();
}
async function go(path) {
  await page.goto(`${BASE}${path}`);
  await closeLevelUp();
}
async function openPet(name) {
  await page.getByRole("button", { name: `${name} 상태창 열기` }).click();
  await dialog().waitFor();
}
async function act(button, expect) {
  await dialog().getByRole("button", { name: button }).click();
  await page.getByRole("status").getByText(expect).waitFor();
}

// ── 농장 화면: 울타리 친 풀밭 ──
await go("/farm");
check("농장 화면이 열린다", await page.getByRole("heading", { name: /동물 농장/ }).isVisible());
check("풀밭과 가운데 아래 [펫 꾸미기] 버튼", (await page.locator("[data-farm-field]").isVisible()) && (await page.getByRole("button", { name: /펫 꾸미기/ }).isVisible()));
const field = await page.locator("[data-farm-field]").boundingBox();
const deco = await page.getByRole("button", { name: /펫 꾸미기/ }).boundingBox();
check("펫 꾸미기 버튼이 농장 가운데 아래", Math.abs(deco.x + deco.width / 2 - (field.x + field.width / 2)) < 3 && deco.y > field.y + field.height * 0.8);

// ── 첫 알 → 둥지 → 부화 → 상태창 ──
await page.getByRole("button", { name: /농장 첫 알/ }).click();
await page.getByRole("status").getByText("알을 받았어요").waitFor();
check("첫 알을 받으면 둥지에 알이 놓인다", (await page.locator("[data-nest] [data-egg-id]").count()) === 1);
await page.locator("[data-nest] [data-egg-id]").click();
await dialog().getByRole("button", { name: /부화시키기/ }).click();
await page.getByRole("status").getByText(/태어났어요/).waitFor();
const [hatched] = await animals();
const sp = await one("SELECT name, grow_exp, max_level, reward_exp, reward_coins FROM animal_species WHERE id = $1", [hatched.species_id]);
check(
  "부화하면 종류·이름(종류 이름)·성별·만난 날이 정해진다",
  hatched.status === "growing" && hatched.name === sp.name && ["male", "female"].includes(hatched.gender) && hatched.hatched_at !== null,
  `${sp.name} ${hatched.gender}`,
);
await dialog().locator("[data-pet-status]").waitFor();
const st = dialog();
check("상태창: 이름", (await st.locator("[data-pet-name]").innerText()) === sp.name);
check("상태창: 성별", (await st.locator("[data-pet-gender]").innerText()) === (hatched.gender === "male" ? "♂ 수컷" : "♀ 암컷"));
check("상태창: 만난 날 YYYY. MM. DD.", (await st.locator("[data-pet-met]").innerText()) === kstDate(hatched.hatched_at), await st.locator("[data-pet-met]").innerText());
check(
  "상태창: Lv.1 · 경험치 0 / 다음 레벨",
  (await st.locator("[data-pet-level]").getAttribute("data-pet-level")) === "1" && /경험치 0 \/ \d+/.test(await st.locator("[data-pet-exp]").innerText()),
  await st.locator("[data-pet-exp]").innerText(),
);
check(
  "상태창: 사진, 데리고 다니기·두고 다니기 버튼",
  (await st.locator("[data-pet-portrait] img").count()) === 1 &&
    (await st.getByRole("button", { name: /데리고 다니기/ }).isVisible()) &&
    (await st.getByRole("button", { name: /두고 다니기/ }).isVisible()),
);
check("물 주기는 없다 (물약으로 바뀜)", (await page.getByRole("button", { name: /물 주기/ }).count()) === 0);

// ── 이름 바꾸기 ──
await st.getByRole("button", { name: "이름 바꾸기" }).click();
await st.getByLabel("펫 이름").fill("콩이");
await st.getByRole("button", { name: "저장" }).click();
await page.getByRole("status").getByText("이름을 콩이로 바꿨어요").waitFor();
await st.locator("[data-pet-name]").waitFor();
check("이름 바꾸기 → DB와 상태창", (await animals())[0].name === "콩이" && (await st.locator("[data-pet-name]").innerText()) === "콩이");
await page.screenshot({ path: `${outDir}/c2-pet-popup.png` });
await page.keyboard.press("Escape");

// ── 풀밭에서 돌아다닌다 (자리가 바뀌고, 누르면 상태창) ──
const petEl = page.locator(`[data-farm-field] [data-pet-id="${hatched.id}"]`);
const p0 = await petEl.boundingBox();
let movedSeen = false;
for (let i = 0; i < 40 && !movedSeen; i++) {
  await page.waitForTimeout(200);
  movedSeen = (await petEl.getAttribute("data-moving")) === "true";
}
await page.waitForTimeout(1500);
const p1 = await petEl.boundingBox();
check(
  "펫이 풀밭을 돌아다닌다 (걷기 상태·위치 변화)",
  movedSeen && (Math.abs(p1.x - p0.x) > 2 || Math.abs(p1.y - p0.y) > 2),
  `${Math.round(p0.x)},${Math.round(p0.y)} → ${Math.round(p1.x)},${Math.round(p1.y)}`,
);
await petEl.click({ force: true });
await dialog().waitFor();
check("풀밭의 펫을 누르면 상태창", (await dialog().locator("[data-pet-name]").innerText()) === "콩이");
await page.keyboard.press("Escape");

// ── 돌보기: 밥 +10, 쓰다듬기 +5 (하루 한 번), 물약 +30 (가진 만큼) ──
await openPet("콩이");
await act(/밥 주기/, /밥 주기 완료/);
await act(/쓰다듬기/, /쓰다듬기 완료/);
check("밥·쓰다듬기 → 성장 15", (await animals())[0].growth === 15, `성장 ${(await animals())[0].growth}`);
check("돌본 버튼은 '완료'로 막힌다", (await dialog().getByRole("button", { name: /완료/ }).count()) === 2);
const careExp = await one("SELECT COALESCE(SUM(exp_delta),0)::int AS n, COUNT(*)::int AS c FROM point_ledger WHERE user_id = $1 AND reason = 'farm_care'", [uid]);
check("돌보기마다 주인 경험치 +2 기록", careExp.c === 2 && careExp.n === 4, `${careExp.c}회 ${careExp.n}`);
check("물약이 없으면 물약 쓰기가 막힌다", await dialog().getByRole("button", { name: /물약 쓰기/ }).isDisabled());
await page.keyboard.press("Escape");
const c0 = await coins(page);
await page.getByRole("button", { name: /물약 사기/ }).click();
await page.getByRole("status").getByText("물약을 샀어요").waitFor();
const potion = await one("SELECT quantity FROM farm_items WHERE user_id = $1 AND kind = 'potion'", [uid]);
const potionLedger = await one("SELECT coin_delta FROM point_ledger WHERE user_id = $1 AND reason = 'potion_purchase'", [uid]);
check("물약 사기 → 가방 1개, 코인 −50 (potion_purchase)", potion?.quantity === 1 && potionLedger?.coin_delta === -50);
await page.reload();
check("헤더 코인 −50", c0 - (await coins(page)) === 50, `${c0} → ${await coins(page)}`);
await openPet("콩이");
const expBefore = await dialog().locator("[data-pet-growth]").getAttribute("data-pet-growth");
await act(/물약 쓰기/, /물약을 썼어요/);
check("물약 쓰기 → 성장 +30 (45), 물약 0개", (await animals())[0].growth === 45 && (await one("SELECT quantity FROM farm_items WHERE user_id = $1", [uid])).quantity === 0);
await dialog().locator('[data-pet-growth="45"]').waitFor();
check("상태창 경험치가 오른다", expBefore === "15" && (await dialog().locator("[data-pet-growth]").getAttribute("data-pet-growth")) === "45");
check("물약이 다 떨어지면 다시 막힌다", await dialog().getByRole("button", { name: /물약 쓰기/ }).isDisabled());

// ── 펫 레벨업 → 쪽지 알림 ──
const lv = Number(await dialog().locator("[data-pet-level]").getAttribute("data-pet-level"));
const petNotes = (await db.query("SELECT level FROM notifications WHERE user_id = $1 AND kind = 'pet_level_up' AND ref_id = $2 ORDER BY level", [uid, String(hatched.id)])).rows;
check("펫 레벨이 오를 때마다 pet_level_up 알림", lv >= 2 && petNotes.length === lv - 1 && petNotes.at(-1).level === lv, `Lv.${lv}, 알림 ${petNotes.map((n) => n.level).join(",")}`);
await page.keyboard.press("Escape");
await page.getByRole("banner").locator("[data-notification-button]").click();
const panel = page.locator("[data-notification-panel]");
await panel.locator("li").first().waitFor();
const noteTexts = await panel.locator("li").allInnerTexts();
check("쪽지 알림함에 `🐣 콩이가 Lv.N이 되었어요!`", noteTexts.some((t) => t.includes(`🐣 콩이가 Lv.${lv}이 되었어요!`)), noteTexts[0]?.split("\n")[0]);
await page.keyboard.press("Escape");

// ── 데리고 다니기: 광장에서 따라오고, 미니룸에 함께 선다 ──
await openPet("콩이");
await act(/데리고 다니기/, /함께 다녀요/);
check("데리고 다니기 → carried", (await animals())[0].carried === true);
await page.keyboard.press("Escape");
await page.locator(`[data-walking-pet="${hatched.id}"]`).waitFor();
check("데리고 다니는 펫은 풀밭에 없고 `산책 중`", (await petEl.count()) === 0);
await go("/town");
await page.locator('canvas[data-follow-pet="콩이"]').waitFor({ timeout: 20000 });
check("광장에서 내 캐릭터를 따라다닌다 (캔버스 data-follow-pet)", (await page.locator("[data-carried-pet]").getAttribute("data-carried-pet")) === "콩이");
// 오른쪽으로 걸어가 보기 (펫이 뒤따라오는 모습 스크린샷)
await page.locator("canvas").click({ position: { x: 700, y: 520 } });
await page.waitForTimeout(300);
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(800);
await page.keyboard.up("ArrowRight");
await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}/c5-town-following-pet.png` });
await go(`/@${slug}`);
check("내 블로그 미니룸에 캐릭터 옆 펫", await page.locator('[data-mini-room] [data-room-pet="콩이"]').isVisible());

// ── 다른 펫을 데리고 다니면 바뀐다 (한 마리만, DB도 막는다) ──
const second = await one(
  "INSERT INTO user_animals (user_id, source, status, species_id, growth, name, gender, hatched_at) VALUES ($1, 'shop', 'growing', (SELECT id FROM animal_species WHERE code = 'bunny'), 0, '둘째', 'female', now()) RETURNING id",
  [uid],
);
await go("/farm");
await openPet("둘째");
await act(/데리고 다니기/, /둘째와 함께 다녀요/);
const carriedRows = (await animals()).filter((a) => a.carried);
check("다른 펫을 고르면 바뀐다 (한 마리만)", carriedRows.length === 1 && carriedRows[0].id === second.id);
let dbBlocked = false;
try {
  await db.query("UPDATE user_animals SET carried = true WHERE user_id = $1 AND status <> 'egg'", [uid]);
} catch (e) {
  dbBlocked = e.code === "23505";
}
check("DB: 데리고 다니는 펫은 회원당 한 마리 (부분 고유 인덱스)", dbBlocked);
await act(/두고 다니기/, /두고 다녀요/);
check("두고 다니기 → 아무도 안 데리고 다님", (await animals()).every((a) => !a.carried));
await page.keyboard.press("Escape");
await openPet("콩이");
await act(/데리고 다니기/, /함께 다녀요/);
await page.keyboard.press("Escape");

// ── 다 자라기 → 카드 도감 ──
await db.query("UPDATE user_animals SET growth = $2 WHERE id = $1", [hatched.id, sp.grow_exp - 5]);
await db.query("DELETE FROM animal_cares WHERE animal_id = $1", [hatched.id]);
await page.reload();
const coinsBeforeGrown = await coins(page);
await openPet("콩이");
await act(/밥 주기/, /다 자랐어요/);
const grownRow = (await animals())[0];
check("다 자라면 grown + 성장치는 최대에서 멈춤", grownRow.status === "grown" && grownRow.growth === sp.grow_exp);
const maxNote = await one("SELECT 1 AS ok FROM notifications WHERE user_id = $1 AND kind = 'pet_level_up' AND ref_id = $2 AND level = $3", [uid, String(hatched.id), sp.max_level]);
check(`다 자라면 최고 레벨 Lv.${sp.max_level} 알림`, Boolean(maxNote));
const grownLedger = await one("SELECT exp_delta, coin_delta FROM point_ledger WHERE user_id = $1 AND reason = 'farm_grown'", [uid]);
check(`다 키운 보상 = 종류 표 숫자 (${sp.name})`, grownLedger?.exp_delta === sp.reward_exp && grownLedger?.coin_delta === sp.reward_coins);
await page.keyboard.press("Escape");
await page.reload();
await closeLevelUp();
check("헤더 코인에 보상 반영", (await coins(page)) - coinsBeforeGrown === sp.reward_coins, `${coinsBeforeGrown} → ${await coins(page)}`);
const book = page.locator("[data-card-book]");
check("카드 도감: 모은 종류는 색칠, 나머지는 실루엣", (await book.locator('[data-collected="true"]').count()) === 1 && (await book.locator('[data-collected="false"]').count()) === 4);
check("카드 도감에 콩이 카드", await book.locator(`[data-card-id="${hatched.id}"]`).getByText("콩이").isVisible());
check("다 키운 펫도 계속 데리고 다닌다", (await animals())[0].carried === true);

// ── 프로필에 카드 전시 ──
await book.getByRole("button", { name: "콩이 카드 보기" }).click();
await act(/프로필에 전시하기/, /프로필에 카드를 전시했어요/);
check("프로필 전시 → profiles.displayed_animal_id", (await one("SELECT displayed_animal_id FROM profiles WHERE user_id = $1", [uid])).displayed_animal_id === hatched.id);
let othersBlocked = false;
const other = await one("SELECT id FROM user_animals WHERE user_id <> $1 LIMIT 1", [uid]);
if (other) {
  try {
    await db.query("UPDATE profiles SET displayed_animal_id = $2 WHERE user_id = $1", [uid, other.id]);
  } catch (e) {
    othersBlocked = e.code === "23503";
  }
} else othersBlocked = true;
check("DB: 남의 동물은 전시할 수 없다 (복합 외래 키)", othersBlocked);
await page.keyboard.press("Escape");
await book.scrollIntoViewIfNeeded();
await book.screenshot({ path: `${outDir}/c4-card-book.png` });

// ── 펫 꾸미기 (무료, 펫마다 저장) ──
await page.getByRole("button", { name: /펫 꾸미기/ }).click();
const decoPanel = page.locator("[data-decorate-panel]");
await decoPanel.waitFor();
await decoPanel.locator(`[data-decorate-pet="${hatched.id}"]`).getByRole("button", { name: /리본/ }).click();
await page.getByRole("status").getByText(/콩이 꾸미기를 바꿨어요/).waitFor();
await decoPanel.locator(`[data-decorate-pet="${second.id}"]`).getByRole("button", { name: /스카프/ }).click();
await decoPanel.locator(`[data-decorate-pet="${second.id}"] [aria-pressed="true"]`).getByText(/스카프/).waitFor();
await page.screenshot({ path: `${outDir}/c3-pet-decorate.png` });
const accs = Object.fromEntries((await animals()).map((a) => [a.id, a.accessory]));
check("펫 꾸미기 저장 (콩이 리본, 둘째 스카프)", accs[hatched.id] === "ribbon" && accs[second.id] === "scarf");
await page.reload();
await page.getByRole("button", { name: /펫 꾸미기/ }).click();
check("새로고침해도 꾸미기가 남아 있다", (await page.locator(`[data-decorate-pet="${hatched.id}"] [aria-pressed="true"]`).innerText()).includes("리본"));
await page.keyboard.press("Escape");
await go(`/@${slug}`);
check("블로그 홈 프로필에 전시 카드", await page.locator(`[data-displayed-card="${hatched.id}"]`).getByText("콩이").isVisible());
check("블로그 미니룸 펫은 꾸미기를 한 그림 (리본)", decodeURIComponent((await page.locator('[data-room-pet="콩이"] img').getAttribute("src")) ?? "").includes("#f37c9e"));
await page.screenshot({ path: `${outDir}/c6-blog-profile-card.png` });

// ── 농장 전체 화면 (데스크톱): 펫 여러 마리 + 둥지의 알 ──
await db.query(
  "INSERT INTO user_animals (user_id, source, status, species_id, growth, name, gender, hatched_at, accessory) VALUES ($1, 'shop', 'growing', (SELECT id FROM animal_species WHERE code = 'piglet'), 40, '꿀꿀이', 'male', now(), 'flower'), ($1, 'shop', 'growing', (SELECT id FROM animal_species WHERE code = 'lamb'), 120, '몽실이', 'female', now(), 'none')",
  [uid],
);
await db.query("INSERT INTO user_animals (user_id, source) VALUES ($1, 'shop')", [uid]);
await go("/farm");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/c1-farm-field-desktop.png` });

// ── 알 사기 (코인 100) · 5마리 제한 ──
await db.query("INSERT INTO point_ledger (user_id, reason, coin_delta) VALUES ($1, 'signup', 500)", [uid]); // 알 살 코인
await page.reload();
const e0 = await coins(page);
await page.getByRole("button", { name: /알 사기/ }).click();
await page.getByRole("status").getByText("알을 샀어요").waitFor();
await page.reload();
check("알 사기 → 코인 −100", e0 - (await coins(page)) === 100, `${e0} → ${await coins(page)}`);
check("알·키우는 동물 5마리면 알 버튼이 막힌다", await page.getByRole("button", { name: /알 사기/ }).isDisabled());

// ── 휴대폰 375px: 가로 스크롤 없이 농장이 보인다 ──
const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
await mctx.addCookies(await page.context().cookies());
const mp = await mctx.newPage();
await mp.goto(`${BASE}/farm`);
await mp.locator("[data-farm-field]").waitFor();
const lvModal = mp.locator("[data-levelup-modal]").getByRole("button", { name: "확인" });
if (await lvModal.waitFor({ timeout: 2500 }).then(() => true, () => false)) await lvModal.click();
await mp.waitForTimeout(1500);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px: 가로 스크롤 없음, 펫 꾸미기 버튼 보임", overflow <= 0 && (await mp.getByRole("button", { name: /펫 꾸미기/ }).isVisible()), `넘침 ${overflow}px`);
await mp.screenshot({ path: `${outDir}/c1-farm-field-375.png` });
await mp.getByRole("button", { name: "꿀꿀이 상태창 열기" }).click();
await mp.getByRole("dialog").locator("[data-pet-status]").waitFor();
const dlg = await mp.getByRole("dialog").boundingBox();
check("375px: 상태창이 화면 안에 들어온다", dlg.x >= 0 && dlg.x + dlg.width <= 375);
await mp.screenshot({ path: `${outDir}/c2-pet-popup-375.png` });
await mctx.close();

// ── 글쓰기 보상 → 키우는 동물마다 성장 +10 ──
const before = (await db.query("SELECT id, growth FROM user_animals WHERE user_id = $1 AND status = 'growing' ORDER BY id", [uid])).rows;
await go("/write");
await page.locator(".ProseMirror").waitFor();
await page.getByPlaceholder("제목").fill("농장 동물에게 들려주는 글");
await page.locator(".ProseMirror").click();
await page.keyboard.type("오늘은 동물 농장을 만들었다. ".repeat(8));
await page.getByRole("button", { name: "발행하기" }).click();
await page.waitForURL(/new=reward/);
const after = (await db.query("SELECT id, growth FROM user_animals WHERE user_id = $1 AND status = 'growing' ORDER BY id", [uid])).rows;
check("공개 글 보상 → 키우는 동물마다 성장 +10", before.length === 3 && after.every((a, i) => a.growth === before[i].growth + 10), after.map((a) => a.growth).join(","));

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
