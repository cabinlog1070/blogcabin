// 즐겨찾기 ⭐을 바꾸고 뒤로 가기로 돌아간 화면(광장 이웃집 패널·내 블로그 이웃 칸)에 바로 보이는지
// 실행: node e2e/favorite-back.mjs e2e-shots/favorite-back  (운영 빌드로 확인: prefetch는 운영 빌드에서만 켜진다)
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`); if (!ok) failed++; };

const browser = await chromium.launch();
const stamp = Date.now().toString(36).slice(-5);
const friendId = "fb" + stamp;
const friend = await browser.newContext();
await loginDev(await friend.newPage(), friendId);
await friend.close();

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
const meId = "fa" + stamp;
await loginDev(page, meId);

// 이웃 추가 + 즐겨찾기
await page.goto(`${BASE}/@${friendId}`);
await page.getByRole("button", { name: "+ 이웃 추가" }).click();
await page.locator("[data-favorite-star]").waitFor();
await page.locator("[data-favorite-star]").click();
await page.waitForFunction(() => document.querySelector("[data-favorite-star]")?.getAttribute("aria-pressed") === "true" && !document.querySelector("[data-favorite-star]")?.disabled);

const panelStar = () => page.locator(`[data-neighbor-panel] a[href="/@${friendId}"] span[aria-label]`).count();

// 1) 광장 이웃집 → 블로그에서 ⭐ 해제 → 브라우저 뒤로
await page.goto(`${BASE}/town`);
await page.locator("[data-neighbor-panel]").waitFor();
check("처음 광장 패널에 ⭐", (await panelStar()) === 1);
await page.locator(`[data-neighbor-panel] a[href="/@${friendId}"]`).click();
await page.locator("[data-favorite-star][aria-pressed=true]").waitFor();
await page.locator("[data-favorite-star]").click();
await page.waitForFunction(() => document.querySelector("[data-favorite-star]")?.getAttribute("aria-pressed") === "false" && !document.querySelector("[data-favorite-star]")?.disabled);
await page.waitForTimeout(1500);
await page.goBack();
await page.locator("[data-neighbor-panel]").waitFor();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/town-after-unfavorite.png` });
check("해제 → 뒤로: 광장 패널에 ⭐ 없음", (await panelStar()) === 0);

// 2) 다시 즐겨찾기 → 헤더 [← 뒤로]
await page.locator(`[data-neighbor-panel] a[href="/@${friendId}"]`).click();
await page.locator("[data-favorite-star][aria-pressed=false]").waitFor();
await page.locator("[data-favorite-star]").click();
await page.waitForFunction(() => document.querySelector("[data-favorite-star]")?.getAttribute("aria-pressed") === "true" && !document.querySelector("[data-favorite-star]")?.disabled);
await page.waitForTimeout(1500);
await page.getByRole("banner").getByRole("button", { name: "뒤로 가기" }).click();
await page.locator("[data-neighbor-panel]").waitFor();
await page.waitForTimeout(1500);
check("추가 → 헤더 뒤로: 광장 패널에 ⭐", (await panelStar()) === 1);

// 3) 내 블로그 이웃 칸에서 ⭐ 해제 → 이웃 블로그로 → 뒤로
await page.goto(`${BASE}/@${meId}`);
const row = page.locator(`[data-my-neighbors] [data-neighbor="${friendId}"]`);
await row.waitFor();
await row.getByRole("button").first().click();
await page.waitForFunction((s) => document.querySelector(`[data-neighbor="${s}"] button`)?.getAttribute("aria-pressed") === "false" && !document.querySelector(`[data-neighbor="${s}"] button`)?.disabled, friendId);
await page.waitForTimeout(1500);
await row.getByRole("link").click();
await page.locator("[data-favorite-star]").waitFor();
check("이웃 블로그 헤더도 ☆", (await page.locator("[data-favorite-star]").getAttribute("aria-pressed")) === "false");
await page.goBack();
await row.waitFor();
await page.waitForTimeout(1500);
check("내 이웃 칸 해제 → 이동 → 뒤로: ☆ 유지", (await row.getByRole("button").first().getAttribute("aria-pressed")) === "false");

check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
