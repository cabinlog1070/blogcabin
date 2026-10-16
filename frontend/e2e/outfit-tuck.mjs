// 상의 넣어 입기 / 빼 입기 (2026-10-16): 꾸미기 상의 칸의 [넣어 입기]·[빼 입기]를 고르고 [저장하기]하면
// 모습 키의 상의 뒤에 @out이 붙어 광장·미니룸·헤더가 같은 모습으로 그린다
// 사용: npm run db:seed && npm run db:reset 후 node e2e/outfit-tuck.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const LOCALE_COOKIE = "lang";
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
  await loginDev(page, "tuckcheck1", "긴 머리");
  const uid = (await one("SELECT id FROM users WHERE username = 'tuckcheck1'")).id;
  // 줄무늬 티셔츠와 반바지를 (레벨 1) 가진 채 입혀 둔다
  await db.query(
    `INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code IN ('av_top_stripe', 'av_bottom_shorts') ON CONFLICT DO NOTHING`,
    [uid],
  );
  await db.query(
    `INSERT INTO avatar_equips (user_id, slot, item_id) SELECT $1, slot, id FROM items WHERE code IN ('av_top_stripe', 'av_bottom_shorts')
     ON CONFLICT (user_id, slot) DO UPDATE SET item_id = excluded.item_id`,
    [uid],
  );
  const look = async () => (await (await page.request.get(`${BASE}/api/v1/me`)).json())?.profile?.characterAsset ?? "";

  await page.goto(`${BASE}/closet`);
  check("헤어 칸에는 입는 법이 없다", (await page.locator("[data-closet-top-style]").count()) === 0);
  await page.locator("[data-wear-tab=top]").click();
  const row = page.locator("[data-closet-top-style]");
  check("상의 칸: 입는 법 [넣어 입기]·[빼 입기]", (await row.innerText()).includes("넣어 입기") && (await row.innerText()).includes("빼 입기"));
  check("처음은 넣어 입기", (await page.locator("[data-top-out=in]").getAttribute("aria-checked")) === "true");
  check("버튼마다 작은 캐릭터 그림", (await row.locator("img").count()) === 2);
  const roomArt = () => page.locator("img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src")).join("|"));
  const before = await roomArt();
  await page.locator("[data-top-out=out]").click();
  check("빼 입기를 고르면 미니룸 캐릭터가 바뀐다", (await roomArt()) !== before);
  check("저장 전에는 바뀐 것이 있다고 알려 준다", await page.getByText("바꾼 것이 있어요").isVisible());
  await page.screenshot({ path: `${outDir}/outfit-tuck-out.png` });
  await page.getByRole("button", { name: /저장하기/ }).click();
  await page.getByText("저장했어요").waitFor({ timeout: 10000 });
  check("저장: profiles.top_out = true", (await one("SELECT top_out FROM profiles WHERE user_id = $1", [uid])).top_out === true);
  const out = await look();
  check("모습 키의 상의 뒤에 @out", out.includes("avatar.top.stripe@out"), out);

  await page.reload();
  await page.locator("[data-wear-tab=top]").click();
  check("다시 열어도 빼 입기", (await page.locator("[data-top-out=out]").getAttribute("aria-checked")) === "true");
  await page.locator("[data-top-out=in]").click();
  await page.getByRole("button", { name: /저장하기/ }).click();
  await page.getByText("저장했어요").waitFor({ timeout: 10000 });
  const back = await look();
  check("넣어 입기로 되돌리면 @out이 빠진다", back.includes("avatar.top.stripe") && !back.includes("@out"), back);

  // 일본어 화면
  await db.query("UPDATE users SET locale = 'ja' WHERE id = $1", [uid]);
  await ctx.addCookies([{ name: LOCALE_COOKIE, value: "ja", url: BASE }]);
  await page.goto(`${BASE}/closet`);
  await page.locator("[data-wear-tab=top]").click();
  const ja = await page.locator("[data-closet-top-style]").innerText();
  check("일본어: 着かた・タックイン・すそ出し", ja.includes("着かた") && ja.includes("タックイン") && ja.includes("すそ出し"), ja.replace(/\s+/g, " "));
  await page.screenshot({ path: `${outDir}/outfit-tuck-ja.png` });

  check("화면 오류 없음", errors.length === 0, errors.join(" / "));
} finally {
  console.log(results.join("\n"));
  await browser.close();
  await db.end();
}
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
