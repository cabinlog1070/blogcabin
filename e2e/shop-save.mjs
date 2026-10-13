// 상점 옷 카테고리와 [저장하기] 확인 (SHOP-01, SHOP-06, 2026-10-13)
// 사용: npm run db:seed && npm run db:reset 후 node e2e/shop-save.mjs <스크린샷 폴더>
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

try {
  await loginDev(page, "shopsave01", "긴 머리");
  const uid = (await one("SELECT id FROM users WHERE username = 'shopsave01'")).id;
  const coinsBefore = 500;
  await db.query("DELETE FROM point_ledger WHERE user_id = $1 AND reason <> 'signup'", [uid]);
  await db.query("UPDATE point_ledger SET coin_delta = $2, exp_delta = 0 WHERE user_id = $1", [uid, coinsBefore]);

  await page.goto(`${BASE}/shop`);
  const avatar = page.locator('section[aria-labelledby="shop-avatar"]');
  const names = () => avatar.locator("article h3").allInnerTexts();
  const tabs = await avatar.getByRole("tab").allInnerTexts();
  check("카테고리 탭: 전체·헤어·모자·상의·하의·신발", tabs.map((x) => x.replace(/\s*\d+$/, "")).join(",") === "전체,헤어,모자,상의,하의,신발", tabs.join(" / "));
  await avatar.getByRole("tab", { name: /^헤어/ }).click();
  const hairNames = await names();
  check("헤어 탭: 헤어 10가지", hairNames.length === 10 && hairNames.includes("양쪽 똥머리"), hairNames.join(","));
  // 머리 색 (2026-10-13): 헤어 탭에서만 동그라미가 보이고, 누르면 바로 저장된다
  const preview = () => page.locator("[data-try-on] img").first().getAttribute("src");
  const plainLook = await preview();
  await page.getByRole("button", { name: "금발", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "머리 색을 바꿨어요" }).waitFor();
  check("머리 색: 금발로 저장", (await one("SELECT hair_color FROM profiles WHERE user_id = $1", [uid])).hair_color === "blonde");
  // 크레용 그림은 색을 파스텔로 옮겨 칠해서 색 코드를 그대로 찾을 수 없다: 그림이 바뀌었는지와 헤더 얼굴 모습 키로 본다
  check("머리 색: 미리 입어 보기 캐릭터 그림이 바뀜", (await preview()) !== plainLook);
  await page.getByRole("button", { name: "기본 색", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "머리 색을 바꿨어요" }).waitFor();
  check("머리 색: 기본 색으로 되돌림", (await one("SELECT hair_color FROM profiles WHERE user_id = $1", [uid])).hair_color === null);
  // 알림은 3초 뒤에 저절로 사라진다 (산 뒤 알림은 맨 끝에서 본다)
  const gone = (text) => page.getByRole("status").filter({ hasText: text }).waitFor({ state: "detached", timeout: 4500 }).then(() => true, () => false);
  check("머리 색 알림이 3초 뒤에 사라진다", await gone("머리 색을 바꿨어요"));
  await page.screenshot({ path: `${outDir}/shop-category-hair.png`, clip: { x: 0, y: 150, width: 1280, height: 600 } });
  await avatar.getByRole("tab", { name: /^전체/ }).click();
  check("머리 색 동그라미는 헤어 탭에서만", (await page.locator("[data-hair-colors]").count()) === 0);
  check("전체 (38개)", (await names()).length === 38, String((await names()).length));
  await avatar.getByRole("tab", { name: /^모자/ }).click();
  const hats = await names();
  check("모자 탭은 모자만", hats.length > 0 && hats.every((n) => /모자|왕관|반다나/.test(n)), hats.join(","));
  await avatar.getByRole("tab", { name: /^상의/ }).click();
  check("기모노는 상의에", (await names()).includes("기모노"));
  await page.screenshot({ path: `${outDir}/shop-category-top.png`, fullPage: false, clip: { x: 0, y: 150, width: 1280, height: 750 } });

  const save = page.locator("[data-save-look]");
  check("입어 본 옷이 없으면 저장하기 꺼짐", await save.isDisabled());
  await avatar.getByRole("tab", { name: /^모자/ }).click();
  await page.getByRole("button", { name: "밀짚모자 입어 보기" }).click();
  await avatar.getByRole("tab", { name: /^하의/ }).click();
  await page.getByRole("button", { name: "반바지 입어 보기" }).click();
  check("없는 옷은 값과 함께 '사서 입고 저장하기'", (await save.innerText()).includes("사서 입고 저장하기") && (await save.innerText()).includes("80"), await save.innerText());

  // 잠긴 옷을 입어 보면 저장하기가 꺼지고 이유가 보인다
  await avatar.getByRole("tab", { name: /^모자/ }).click();
  await page.getByRole("button", { name: "털모자 입어 보기" }).click();
  check("잠긴 옷을 입어 보면 저장 꺼짐", await save.isDisabled());
  check("잠긴 이유 표시", (await page.locator("[data-try-on] [role=alert]").innerText()).includes("털모자은(는) 레벨 2부터"));
  await page.getByRole("button", { name: "밀짚모자 입어 보기" }).click();
  await page.screenshot({ path: `${outDir}/shop-save-ready.png`, clip: { x: 0, y: 150, width: 1280, height: 750 } });

  await save.click();
  await page.waitForURL(/\/town/);
  check("저장하면 광장으로 나감", page.url().includes("/town"));
  const worn = await db.query("SELECT i.name FROM avatar_equips ae JOIN items i ON i.id = ae.item_id WHERE ae.user_id = $1 ORDER BY i.name", [uid]);
  // 긴 머리 주민은 가입할 때부터 "긴 머리" 헤어를 입고 있다 (2026-10-13)
  check("밀짚모자·반바지를 입음 (가입 때 헤어 그대로)", worn.rows.map((r) => r.name).sort().join(",") === ["긴 머리", "밀짚모자", "반바지"].sort().join(","), worn.rows.map((r) => r.name).join(","));
  const spent = await one("SELECT COUNT(*)::int n, -SUM(coin_delta)::int c FROM point_ledger WHERE user_id = $1 AND reason = 'purchase'", [uid]);
  check("두 벌을 사고 코인 80 차감", spent.n === 2 && spent.c === 80, JSON.stringify(spent));

  // 가진 옷만 입어 보면 '저장하기'(코인 안 씀)
  await page.goto(`${BASE}/shop`);
  await page.getByRole("button", { name: "반바지 입어 보기" }).click();
  check("가진 옷만이면 그냥 '저장하기'", (await save.innerText()).trim() === "저장하기", await save.innerText());

  // 코인이 모자라면 꺼짐
  await page.getByRole("button", { name: "반바지 입어 보기" }).click();
  await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', 1000, -380)", [uid]);
  await page.reload();
  await page.getByRole("button", { name: "왕관 입어 보기" }).click();
  check("코인이 모자라면 저장 꺼짐", (await save.isDisabled()) && (await page.locator("[data-try-on] [role=alert]").innerText()).includes("코인이"));

  // 산 뒤 뜨는 알림도 3초 뒤에 사라진다 (다른 확인에 영향이 없게 맨 끝에서 코인을 채우고 산다)
  await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', 0, 1000)", [uid]);
  await page.reload();
  const buyable = page.locator("article").filter({ has: page.getByRole("button", { name: "사기", exact: true }) }).first();
  const boughtName = await buyable.getByRole("heading").innerText();
  await buyable.getByRole("button", { name: "사기", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "샀어요" }).waitFor();
  check(`산 뒤 알림이 3초 뒤에 사라진다 (${boughtName})`, await gone("샀어요"));

  const phone = await browser.newContext({ viewport: { width: 375, height: 800 }, storageState: await ctx.storageState() });
  const pp = await phone.newPage();
  await pp.goto(`${BASE}/shop`);
  await pp.getByRole("button", { name: "운동화 입어 보기" }).click();
  await pp.locator('section[aria-labelledby="shop-avatar"]').scrollIntoViewIfNeeded();
  await pp.screenshot({ path: `${outDir}/shop-phone.png`, fullPage: true });
} finally {
  console.log(results.join("\n"));
  if (errors.length) console.log("오류:", errors);
  await browser.close();
  await db.end();
}
