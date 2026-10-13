// 꾸미기 확인: SHOP-01(판매 목록·정렬·미리 입어 보기), SHOP-06(아바타 꾸미기), SHOP-05(가구 배치), TOWN-01(환영 문구 한 번)
// 사용: npm run db:seed && npm run db:reset 후 node e2e/decorate.mjs <스크린샷 폴더>
//       (개발 서버가 3000번이 아니면 BASE_URL=http://localhost:3100 node e2e/decorate.mjs ...)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
const TEMP_CODE = "e2e_temp_furniture";

try {
  // ── TOWN-01: 환영 문구는 한 번만 ──
  await loginDev(page, "decor01", "남자 주민");
  const welcomeShown = await page.locator("[data-welcome]:visible").first().isVisible().catch(() => false);
  check("TOWN-01 온보딩 직후 환영 문구가 보임", welcomeShown);
  await page.waitForFunction(() => !location.search.includes("welcome"));
  check("TOWN-01 보여준 뒤 주소에서 ?welcome=1이 지워짐", !page.url().includes("welcome"), page.url());
  check("TOWN-01 지운 뒤에도 문구는 그대로 보임", await page.locator("[data-welcome]:visible").first().isVisible());
  await page.reload();
  await page.waitForSelector("canvas");
  check("TOWN-01 새로고침하면 환영 문구 없음", (await page.locator("[data-welcome]").count()) === 0);
  await page.goto(`${BASE}/shop`);
  await page.goBack();
  await page.waitForURL(/\/town/);
  await page.waitForTimeout(500);
  check("TOWN-01 다른 화면에 갔다가 뒤로 와도 없음", (await page.locator("[data-welcome]").count()) === 0, page.url());

  const uid = (await one("SELECT id FROM users WHERE username = 'decor01'")).id;

  // ── SHOP-01: 판매 목록과 정렬 (Lv.1, 🪙 100) ──
  await page.goto(`${BASE}/shop`);
  const headings = await page.getByRole("heading", { level: 2 }).allInnerTexts();
  check("SHOP-01 세 구역: 👕 아바타 꾸미기 · 🪑 가구 · 🖼 배경", JSON.stringify(headings) === JSON.stringify(["👕 아바타 꾸미기", "🪑 가구", "🖼 배경"]), headings.join(" / "));
  check("SHOP-01 캐릭터는 팔지 않음", (await page.locator("article", { hasText: /모험가|고양이|강아지|토끼|여우|판다|로봇|드래곤|유니콘|주민/ }).count()) === 0);
  check("SHOP-01 안내에 새 친구·캐릭터 언급 없음", !(await page.locator("main p").first().innerText()).match(/친구|캐릭터를/));
  check(
    "고정 안내 문구",
    await page.getByText("캐릭터는 가입할 때 고른 남자·여자 주민으로 정해지고, 바꿀 수 없어요. 옷과 소품으로 꾸며 보세요.").isVisible(),
  );
  const counts = await Promise.all(
    ["shop-avatar", "shop-furniture", "shop-background"].map((id) => page.locator(`section[aria-labelledby="${id}"] article`).count()),
  );
  check("SHOP-01 꾸미기 28 · 가구 14 · 배경 5", JSON.stringify(counts) === "[28,14,5]", counts.join(","));
  const furnNames = async () => page.locator('section[aria-labelledby="shop-furniture"] article h3').allInnerTexts();
  check("SHOP-01 기본 정렬은 레벨순", (await furnNames()).join(",") === "꽃바구니,화분,의자,곰인형,러그,램프,책장,책상,티비,게임기,침대,구름,무지개,우주선", (await furnNames()).join(","));
  await page.getByLabel("정렬").selectOption({ label: "비싼 순" });
  check("SHOP-01 비싼 순", (await furnNames()).join(",") === "우주선,무지개,구름,침대,게임기,티비,책상,책장,램프,러그,곰인형,의자,화분,꽃바구니", (await furnNames()).join(","));
  await page.getByLabel("정렬").selectOption({ label: "최신순" });
  check("SHOP-01 최신순", (await furnNames()).join(",") === "우주선,무지개,구름,게임기,티비,책장,러그,곰인형,꽃바구니,침대,책상,램프,의자,화분", (await furnNames()).join(","));
  await page.reload();
  check("SHOP-01 정렬은 기억하지 않음 (새로고침하면 레벨순)", (await page.getByLabel("정렬").inputValue()) === "level");

  // 잠긴 옷: Lv.1에서 털모자(Lv.2)는 잠김
  const beanie = page.locator("article", { hasText: "털모자" });
  check("레벨 잠금: Lv.1에게 털모자는 🔒 Lv.2", (await beanie.getByRole("button", { name: /Lv\.2$/ }).innerText()).includes("🔒 Lv.2"));
  check("레벨 잠금: 그림 위에 크게 '🔒 Lv.2부터'", await beanie.getByText("🔒 Lv.2부터").isVisible());

  // 미리 입어 보기 (사지 않고)
  const preview = page.locator("[data-try-on]");
  const previewSrc = () => preview.locator("img").first().getAttribute("src");
  const plain = await previewSrc();
  await page.getByRole("button", { name: "밀짚모자 입어 보기" }).click();
  check("미리 입어 보기: 누르면 내 캐릭터가 입음", (await previewSrc()).includes("%23f4d78a") && plain !== (await previewSrc()));
  check("미리 입어 보기: 입어 보는 중 표시", (await preview.innerText()).includes("모자 밀짚모자"));
  await page.getByRole("button", { name: "털모자 입어 보기" }).click();
  check("미리 입어 보기: 같은 부위는 바뀜 (잠긴 옷도 입어 볼 수 있음)", !(await previewSrc()).includes("%23f4d78a") && (await previewSrc()).includes("%239c7cdb"));
  await page.screenshot({ path: `${outDir}/a1-shop-try-on.png`, fullPage: true });
  await page.getByRole("button", { name: "원래대로" }).click();
  check("미리 입어 보기: [원래대로]로 돌아옴", (await previewSrc()) === plain);
  check("미리 입어 보기는 코인을 쓰지 않음", (await one("SELECT COUNT(*)::int n FROM point_ledger WHERE user_id = $1 AND reason = 'purchase'", [uid])).n === 0);

  // ── 레벨·코인 올리기 (Lv.5, 코인 넉넉히) ──
  await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', 1000, 2000)", [uid]);
  await page.reload();
  const buy = async (name) => {
    const card = page.locator("article", { has: page.getByRole("heading", { name, exact: true }) });
    await card.getByRole("button", { name: "사기" }).click();
    await page.getByRole("status").filter({ hasText: `${name}을(를) 샀어요` }).waitFor();
  };
  for (const name of ["밀짚모자", "털모자", "후드티", "청바지", "운동화", "화분", "의자", "램프", "책상", "침대"]) await buy(name);
  check("구매: 꾸미기 5개·가구 5개 보유", (await one("SELECT COUNT(*)::int n FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.type IN ('avatar','furniture')", [uid])).n === 10);
  await page.reload();
  await page.getByLabel("정렬").selectOption({ label: "보유순" });
  const ownedFirst = await furnNames();
  check("SHOP-01 보유순 (가진 5개가 먼저, 그 안에서 싼 순)", ownedFirst.slice(0, 6).join(",") === "화분,의자,램프,책상,침대,꽃바구니", ownedFirst.join(","));
  await page.screenshot({ path: `${outDir}/a2-shop.png`, fullPage: true });

  // ── 꾸미기 화면 (2026-10-13): 탭 3개 + 저장하기. 고른 것은 화면에만 보이고, 저장하기를 눌러야 저장된다 ──
  await page.goto(`${BASE}/closet`);
  const tabs = await page.locator("[data-closet-tab]").allInnerTexts();
  check("꾸미기 탭: 캐릭터 꾸미기 · 미니룸 꾸미기 · 집 테마", tabs.map((s) => s.replace(/\s+/g, " ").trim()).join("/") === "👕 캐릭터 꾸미기/🛋 미니룸 꾸미기/🏠 집 테마", tabs.join("/"));
  check("캐릭터 꾸미기 칸: 헤어·모자·상의·하의·신발", (await page.locator("[data-wear-tab]").allInnerTexts()).join("/") === "💇 헤어/🎩 모자/👕 상의/👖 하의/👟 신발", (await page.locator("[data-wear-tab]").allInnerTexts()).join("/"));
  check("꾸미기 맨 아래 문구에 '캐릭터' 없음", !(await page.getByText(/상점에서 만날 수 있어요/).innerText()).includes("캐릭터"));
  check("꾸미기에는 '바꿀 수 없어요' 안내가 없음 (머리는 헤어 칸에서 바꾼다)", (await page.getByText("바꿀 수 없어요. 옷과 소품으로 꾸며 보세요.", { exact: false }).count()) === 0);
  const room = page.locator("[data-mini-room]");
  const roomChar = () => room.locator("[data-room-character] img").first().getAttribute("src");
  const btn = (name) => page.getByRole("button", { name: new RegExp(`${name}`) });
  const tab = (key) => page.locator(`[data-closet-tab="${key}"]`).click();
  const wearTab = (key) => page.locator(`[data-wear-tab="${key}"]`).click();
  const saveBtn = page.locator("[data-save-closet]");
  const saveNow = async () => {
    await saveBtn.click();
    await page.getByRole("status").filter({ hasText: "저장했어요 ✓" }).waitFor();
  };
  check("저장하기: 바꾼 것이 없으면 누를 수 없음", await saveBtn.isDisabled());
  await wearTab("hat");
  await btn("밀짚모자").click();
  check("SHOP-06 누르면 미니룸 캐릭터가 바로 밀짚모자를 씀", (await roomChar()).includes("%23f4d78a"));
  check("저장하기 전에는 DB에 그대로", (await one("SELECT COUNT(*)::int n FROM avatar_equips WHERE user_id = $1", [uid])).n === 0 && (await page.locator("[data-save-bar]").getAttribute("data-save-bar")) === "dirty");
  await btn("되돌리기").click();
  check("되돌리기: 저장한 모습으로 돌아옴", !(await roomChar()).includes("%23f4d78a") && (await saveBtn.isDisabled()));
  await btn("밀짚모자").click();
  await saveNow();
  await page.reload();
  check("SHOP-06 저장하고 새로고침해도 그대로", (await roomChar()).includes("%23f4d78a"));
  await wearTab("hat");
  check("SHOP-06 모자 칸에서 밀짚모자가 입은 상태", (await btn("밀짚모자").getAttribute("aria-pressed")) === "true");
  await btn("털모자").click();
  check("SHOP-06 같은 부위는 하나만 (화면에서 털모자로 바뀜)", (await btn("밀짚모자").getAttribute("aria-pressed")) === "false");
  await saveNow();
  const hats = await db.query("SELECT i.name FROM avatar_equips ae JOIN items i ON i.id = ae.item_id WHERE ae.user_id = $1 AND ae.slot = 'hat'", [uid]);
  check("SHOP-06 저장하면 털모자 하나만", hats.rows.length === 1 && hats.rows[0].name === "털모자");
  await btn("털모자").click();
  await saveNow();
  check("SHOP-06 입은 것을 다시 누르고 저장하면 벗음", (await one("SELECT COUNT(*)::int n FROM avatar_equips WHERE user_id = $1", [uid])).n === 0);
  for (const [slot, name] of [["hat", "밀짚모자"], ["top", "후드티"], ["bottom", "청바지"], ["shoes", "운동화"]]) {
    await wearTab(slot);
    await btn(name).click();
  }
  await saveNow();
  check("SHOP-06 부위별로 4개 입고 한 번에 저장", (await one("SELECT COUNT(*)::int n FROM avatar_equips WHERE user_id = $1", [uid])).n === 4);

  // DB가 직접 막는다: 가지지 않은 아이템, 부위가 다른 자리
  const notOwned = await db
    .query("INSERT INTO avatar_equips (user_id, slot, item_id) SELECT $1, 'top', id FROM items WHERE code = 'av_top_knit' ON CONFLICT (user_id, slot) DO UPDATE SET item_id = EXCLUDED.item_id", [uid])
    .then(() => false)
    .catch((e) => e.message.includes("avatar_equips_owned_fk"));
  check("SHOP-06 가지지 않은 꾸미기는 DB 복합 외래 키가 막음", notOwned);
  const wrongSlot = await db
    .query("UPDATE avatar_equips SET item_id = (SELECT id FROM items WHERE code = 'av_hat_beanie') WHERE user_id = $1 AND slot = 'top'", [uid])
    .then(() => false)
    .catch((e) => e.message.includes("avatar_equips_item_slot_fk"));
  check("SHOP-06 모자를 상의 자리에 입히면 DB가 막음", wrongSlot);

  // ── SHOP-05: 가구 끌어다 놓기 (미니룸 꾸미기 탭) ──
  await page.waitForLoadState("networkidle");
  // 미니룸과 가구 카드가 한 화면에 함께 보여야 마우스로 끌 수 있다 (화면 밖 좌표에는 이벤트가 가지 않는다)
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`${BASE}/closet?tab=room`, { waitUntil: "networkidle" });
  check("주소 ?tab=room으로 미니룸 꾸미기 탭이 열림", (await page.locator('[data-closet-tab="room"]').getAttribute("aria-selected")) === "true");
  const dragTo = async (from, xPct, yPct) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const a = await from.boundingBox();
    const r = await room.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    const tx = xPct === null ? r.x + r.width / 2 : r.x + (r.width * xPct) / 100;
    const ty = yPct === null ? r.y + r.height + 160 : r.y + (r.height * yPct) / 100;
    await page.mouse.move(tx, ty, { steps: 12 });
    await page.mouse.up();
  };
  const furnCard = (name) => page.locator("[data-furniture-section]").getByRole("button", { name: new RegExp(name) });
  const pos = async (code) => one("SELECT x, y FROM room_furniture rf JOIN items i ON i.id = rf.item_id WHERE rf.user_id = $1 AND i.code = $2", [uid, code]);

  await dragTo(furnCard("의자"), 30, 70);
  check("SHOP-05 끌어다 놓으면 미니룸에 바로 보이고, 저장 전엔 DB에 없음", (await room.locator('[data-furniture="furn.chair"]').count()) === 1 && !(await pos("furn_chair")));
  await saveNow();
  let chair = await pos("furn_chair");
  check("SHOP-05 저장하면 비율 위치로 저장", chair && Math.abs(chair.x - 30) < 1.5 && Math.abs(chair.y - 70) < 1.5, chair && `${chair.x}, ${chair.y}`);
  await page.reload({ waitUntil: "networkidle" }); // 화면이 다 살아난(hydration) 뒤에 끌기
  const chairEl = room.locator('[data-furniture="furn.chair"]');
  const left = await chairEl.evaluate((el) => el.style.left);
  check("SHOP-05 새로고침해도 같은 자리", left === `${chair.x}%`, left);
  await dragTo(chairEl, 75, 85);
  await saveNow();
  chair = await pos("furn_chair");
  check("SHOP-05 다시 끌면 옮겨짐 (새 줄이 생기지 않음)", Math.abs(chair.x - 75) < 1.5 && (await one("SELECT COUNT(*)::int n FROM room_furniture WHERE user_id = $1", [uid])).n === 1);
  await dragTo(chairEl, null, null);
  await saveNow();
  check("SHOP-05 미니룸 밖으로 끌어내고 저장하면 빠짐", !(await pos("furn_chair")) && (await chairEl.count()) === 0);

  const spots = { 화분: [10, 80], 의자: [36, 66], 램프: [88, 55], 책상: [72, 74], 침대: [22, 84] };
  for (const [name, [x, y]] of Object.entries(spots)) await dragTo(furnCard(name), x, y);
  await saveNow();
  check("SHOP-05 가구 5개 배치를 한 번에 저장", (await one("SELECT COUNT(*)::int n FROM room_furniture WHERE user_id = $1", [uid])).n === 5);
  // 아래쪽 가구가 앞에: 침대(y 84)가 화분(y 80)보다 앞
  const z = async (code) => Number(await room.locator(`[data-furniture="${code}"]`).evaluate((el) => el.style.zIndex));
  check("SHOP-05 아래쪽에 있는 가구가 앞에 보임", (await z("furn.bed")) > (await z("furn.plant")) && (await z("furn.plant")) > (await z("furn.lamp")));

  // ── SHOP-05 가구 색: 미니룸에서 가구를 누르면 그 가구의 색 고르기가 나온다 ──
  const colorSection = page.locator("[data-furniture-color-section]");
  const chairSrc = () => room.locator('[data-furniture="furn.chair"] img').getAttribute("src");
  await page.reload({ waitUntil: "networkidle" });
  const chairBefore = await chairSrc();
  check("가구 색: 가구를 누르기 전엔 안내만", (await colorSection.getByRole("radio").count()) === 0);
  await room.locator('[data-furniture="furn.chair"]').click();
  check("가구 색: 미니룸에서 누른 의자가 점선으로 표시되고 의자 색 고르기가 나옴", (await room.locator('[data-furniture="furn.chair"]').getAttribute("data-selected")) === "true" && (await colorSection.innerText()).includes("의자 색"));
  await colorSection.getByRole("radio", { name: "민트", exact: true }).click();
  check("가구 색: 고르면 미니룸 의자 그림이 바로 바뀜", (await chairSrc()) !== chairBefore);
  await saveNow();
  const colorOf = async (code) => (await one("SELECT ui.color FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = $2", [uid, code])).color;
  check("SHOP-05 가구 색: 저장됨", (await colorOf("furn_chair")) === "mint");
  await page.reload({ waitUntil: "networkidle" });
  check("SHOP-05 가구 색: 새로고침해도 그대로", (await room.locator('[data-furniture="furn.chair"]').getAttribute("data-furniture-color")) === "mint");
  check("SHOP-05 가구 색: 다른 가구는 기본 색", (await colorOf("furn_bed")) === null && (await room.locator('[data-furniture="furn.bed"]').getAttribute("data-furniture-color")) === null);
  const badColor = await db
    .query("UPDATE user_items SET color = 'gold' WHERE user_id = $1", [uid])
    .then(() => false)
    .catch((e) => e.message.includes("user_items_color_check"));
  check("SHOP-05 가구 색: 목록에 없는 색은 DB가 막음", badColor);
  await room.locator('[data-furniture="furn.chair"]').click();
  await colorSection.getByRole("button", { name: "기본 색" }).click();
  // 목록 카드를 눌러도 고를 수 있다 (이미 미니룸에 있는 가구)
  await furnCard("침대").click();
  await colorSection.getByRole("radio", { name: "남색", exact: true }).click();
  await saveNow();
  check("SHOP-05 가구 색: 의자는 기본 색, 침대는 남색 (목록 카드로 골라도 됨)", (await colorOf("furn_chair")) === null && (await chairSrc()) === chairBefore && (await colorOf("furn_bed")) === "navy");

  // 6번째도 놓인다 (2026-10-13 5개 제한 없앰): 사지 않고 시험용 가구를 잠깐 만들어 준다
  await db.query("INSERT INTO items (code, type, name, price, required_level, is_starter, asset_key) VALUES ($1, 'furniture', '시험 화분', 0, 1, false, 'furn.plant') ON CONFLICT (code) DO NOTHING", [TEMP_CODE]);
  await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = $2", [uid, TEMP_CODE]);
  await page.reload({ waitUntil: "networkidle" });
  await dragTo(furnCard("시험 화분"), 55, 60);
  await saveNow();
  check("SHOP-05 가구 수 제한 없음: 6번째 가구도 놓임", (await one("SELECT COUNT(*)::int n FROM room_furniture WHERE user_id = $1", [uid])).n === 6);
  check("SHOP-05 안내에 '최대' 없이 지금 개수만", (await page.getByText(/미니룸 밖으로 끌어내면 빠져요/).innerText()).includes("(지금 6개)"));
  // 시험용 가구는 다시 지운다 (보유를 지우면 배치도 함께 지워진다)
  await db.query("DELETE FROM user_items WHERE user_id = $1 AND item_id IN (SELECT id FROM items WHERE code = $2)", [uid, TEMP_CODE]);
  await db.query("DELETE FROM items WHERE code = $1", [TEMP_CODE]);

  // ── 벽 장식: 벽 장식 칸, 창문·액자를 가리지 않게 ──
  await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = 'furn_cloud' ON CONFLICT DO NOTHING", [uid]);
  await page.reload({ waitUntil: "networkidle" });
  check("바닥 가구 칸에는 구름이 없음", (await furnCard("구름").count()) === 0);
  await page.locator('[data-room-tab="wall"]').click();
  await dragTo(furnCard("구름"), 16, 30); // 창문 한가운데
  const cloudEl = room.locator('[data-furniture="furn.cloud"]');
  const cloudX = parseFloat(await cloudEl.evaluate((el) => el.style.left));
  check("벽 장식: 창문 위에 놓으면 창문 옆 빈 벽으로 옮겨짐", cloudX > 29.5, String(cloudX));
  await saveNow();
  const cloud = await pos("furn_cloud");
  check("벽 장식: 옮겨진 자리로 저장", cloud && Math.abs(cloud.x - cloudX) < 0.01, cloud && `${cloud.x}, ${cloud.y}`);
  await cloudEl.click();
  await colorSection.getByRole("button", { name: "미니룸에서 빼기" }).click();
  await saveNow();
  check("가구 색 칸의 [미니룸에서 빼기]로 뺌", !(await pos("furn_cloud")));
  await db.query("DELETE FROM user_items WHERE user_id = $1 AND item_id IN (SELECT id FROM items WHERE code = 'furn_cloud')", [uid]);

  // ── 집 테마: 지붕 색·벽지 ──
  await page.reload({ waitUntil: "networkidle" });
  await tab("house");
  const roofSection = page.locator("[data-roof-section]");
  await roofSection.getByRole("radio", { name: "하늘", exact: true }).click();
  check("집 테마: 지붕 색은 미리 보기만 바뀌고 저장 전엔 그대로", (await roofSection.locator("[data-roof-preview]").getAttribute("data-roof-preview")) === "#38bdf8" && (await one("SELECT roof_color FROM blogs WHERE owner_id = $1", [uid])).roof_color === null);
  await saveNow();
  check("집 테마: 지붕 색 저장", (await one("SELECT roof_color FROM blogs WHERE owner_id = $1", [uid])).roof_color === "sky");
  check("집 테마: 벽지 칸에 가진 배경", (await page.locator("[data-wallpaper-section]").getByRole("button").count()) >= 1);
  await roofSection.getByRole("button", { name: "벽지 색 따라가기" }).click();
  await saveNow();
  await page.screenshot({ path: `${outDir}/a3-closet.png`, fullPage: true });

  // ── 같은 모습이 블로그 미니룸·헤더·광장에 ──
  await tab("room");
  const look = await roomChar();
  await page.goto(`${BASE}/@decor01`);
  const blogRoom = page.locator("[data-mini-room]");
  check("SHOP-06 블로그 미니룸에 같은 모습", (await blogRoom.locator("[data-room-character] img").first().getAttribute("src")) === look);
  check("SHOP-05 블로그 미니룸에 가구 5개", (await blogRoom.locator("[data-furniture]").count()) === 5);
  check("블로그 홈 [미니룸 꾸미기 >]는 미니룸 꾸미기 탭으로", (await page.locator("[data-miniroom-edit]").getAttribute("href")) === "/closet?tab=room");
  const headerFace = await page.getByRole("banner").locator("img").last().getAttribute("src");
  check("SHOP-06 헤더 캐릭터 얼굴도 밀짚모자", headerFace.includes("%23f4d78a"));
  await page.screenshot({ path: `${outDir}/a4-blog-miniroom.png` });
  await page.goto(`${BASE}/town`);
  // (2026-10-08 휴대폰 광장 아래 메뉴를 없애서 광장 메뉴 캐릭터 확인은 뺐다)

  // 다른 사람(로그인 안 한 방문자)이 들어와도 같은 배치
  const guest = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const gp = await guest.newPage();
  await gp.goto(`${BASE}/@decor01`);
  const gRoom = gp.locator("[data-mini-room]");
  check("SHOP-05 방문자에게도 같은 가구 배치 (휴대폰 폭)", (await gRoom.locator("[data-furniture]").count()) === 5);
  check(
    "SHOP-05 좁은 화면에서도 같은 비율 위치",
    (await gRoom.locator('[data-furniture="furn.lamp"]').evaluate((el) => el.style.left)) === "88%",
  );
  check("375px 화면에 가로 스크롤 없음", await gp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await gp.screenshot({ path: `${outDir}/a5-blog-mobile.png` });
  await guest.close();

  // ── SHOP-05 미니룸 캐릭터 자리·미니룸 펫 (2026-10-13) ──
  await page.goto(`${BASE}/closet?tab=room`, { waitUntil: "networkidle" });
  const blogSpot = async () => one("SELECT room_char_x x, room_char_y y, room_pet_x px, room_pet_y py FROM blogs WHERE owner_id = $1", [uid]);
  await page.locator('[data-room-tab="pet"]').click();
  check("미니룸 펫: 데리고 다니는 펫이 없으면 농장 안내", await page.locator("[data-room-pet-section]").getByText("동물 농장에서 데리고 다닐 펫을 고르면").isVisible());
  // 캐릭터를 끌어 왼쪽으로 옮긴다
  const charEl = room.locator("[data-room-character]");
  const cb = await charEl.boundingBox();
  const rb = await room.boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width * 0.25, cb.y + cb.height / 2, { steps: 10 });
  await page.mouse.up();
  await saveNow();
  let spot = await blogSpot();
  check("미니룸 캐릭터: 끌고 저장하면 자리가 저장됨", spot.x !== null && Math.abs(spot.x - 25) < 3 && spot.y !== null, `${spot.x}, ${spot.y}`);
  await page.reload();
  check("미니룸 캐릭터: 새로고침해도 그 자리", (await room.locator("[data-room-character]").evaluate((el) => el.style.left)) === `${spot.x}%`);
  // 데리고 다니는 펫을 만들어 준다
  await db.query("INSERT INTO user_animals (user_id, species_id, status, growth, source, name, gender, hatched_at, grown_at, carried) SELECT $1, id, 'grown', 999, 'shop', '뭉치', 'female', now(), now(), true FROM animal_species WHERE asset_key = 'animal.bunny'", [uid]);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-room-tab="pet"]').click();
  const petCard = page.locator("[data-room-pet-card]");
  check("미니룸 펫: 처음엔 캐릭터 옆", (await petCard.innerText()).includes("캐릭터 옆") && (await room.locator("[data-room-pet-placed]").count()) === 0);
  const pc = await petCard.boundingBox();
  await page.mouse.move(pc.x + pc.width / 2, pc.y + pc.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width * 0.7, rb.y + rb.height * 0.9, { steps: 12 });
  await page.mouse.up();
  await saveNow();
  spot = await blogSpot();
  check("미니룸 펫: 끌어다 놓고 저장하면 그 자리에 저장", spot.px !== null && Math.abs(spot.px - 70) < 3, `${spot.px}, ${spot.py}`);
  check("미니룸 펫: 꾸미기 미니룸에 놓인 펫", (await room.locator("[data-room-pet-placed]").count()) === 1 && (await petCard.innerText()).includes("미니룸에서 노는 중"));
  await page.screenshot({ path: `${outDir}/a6-closet-room-pet.png` });
  // 블로그 홈에서는 돌아다닌다
  await page.goto(`${BASE}/@decor01`);
  const roamer = page.locator("[data-mini-room] [data-room-pet-placed]");
  const left0 = await roamer.evaluate((el) => el.style.left);
  await page.waitForFunction((l) => document.querySelector("[data-mini-room] [data-room-pet-placed]")?.style.left !== l, left0, { timeout: 15000 }).catch(() => {});
  check("미니룸 펫: 블로그 홈에서 방 안을 돌아다님", (await roamer.evaluate((el) => el.style.left)) !== left0, `${left0} → ${await roamer.evaluate((el) => el.style.left)}`);
  check("미니룸 캐릭터: 블로그 홈에서도 옮긴 자리", (await page.locator("[data-mini-room] [data-room-character]").evaluate((el) => el.style.left)) === `${spot.x}%`);
  await page.screenshot({ path: `${outDir}/a7-blog-room-pet.png` });
  // 펫 카드를 다시 누르면 캐릭터 옆으로
  await page.goto(`${BASE}/closet?tab=room`, { waitUntil: "networkidle" });
  await page.locator('[data-room-tab="pet"]').click();
  await page.locator("[data-room-pet-card]").click();
  await saveNow();
  spot = await blogSpot();
  check("미니룸 펫: 카드를 다시 누르고 저장하면 캐릭터 옆으로 (자리 지움)", spot.px === null && spot.py === null);
  const badSpot = await db
    .query("UPDATE blogs SET room_pet_x = 50 WHERE owner_id = $1", [uid])
    .then(() => false)
    .catch((e) => e.message.includes("blogs_room_pet_check"));
  check("미니룸 펫: x만 있고 y가 없는 자리는 DB가 막음", badSpot);

  // 휴대폰 꾸미기 화면: 가로 스크롤 없음
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, storageState: await page.context().storageState() });
  const pp = await phone.newPage();
  await pp.goto(`${BASE}/closet?tab=room`, { waitUntil: "networkidle" });
  check("휴대폰 꾸미기: 가로 스크롤 없음", await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await pp.screenshot({ path: `${outDir}/a8-closet-phone.png`, fullPage: true });
  await phone.close();

  // ── 온보딩 안내 ──
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fp = await fresh.newPage();
  await fp.goto(BASE);
  await fp.getByRole("tab", { name: "회원가입" }).click();
  await fp.getByLabel("아이디").fill("decor02");
  await fp.getByLabel("비밀번호", { exact: true }).fill("test-password-1234");
  await fp.getByLabel("비밀번호 확인").fill("test-password-1234");
  await fp.getByRole("button", { name: "회원가입", exact: true }).click();
  await fp.locator('input[name="nickname"]').waitFor({ timeout: 20000 });
  check("온보딩: 캐릭터 고르는 곳에 '한 번 고르면 바꿀 수 없어요'", await fp.getByText("한 번 고르면 바꿀 수 없어요").isVisible());
  await fresh.close();
} finally {
  await db.query("DELETE FROM items WHERE code = $1", [TEMP_CODE]).catch(() => {});
  await db.query("DELETE FROM user_items WHERE item_id IN (SELECT id FROM items WHERE code = $1)", [TEMP_CODE]);
  await db.query("DELETE FROM items WHERE code = $1", [TEMP_CODE]);
  console.log(results.join("\n"));
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
  await db.end();
}
