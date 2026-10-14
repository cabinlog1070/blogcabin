// 헤더 [← 뒤로] 버튼: 바로 전 화면으로, 이 탭에서 처음 연 화면이면 광장으로
// 실행: BASE_URL=http://localhost:3100 node e2e/back.mjs e2e-shots/back
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`); if (!ok) failed++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, "bk" + Date.now().toString(36).slice(-6));

await page.goto(`${BASE}/shop`);
await page.goto(`${BASE}/closet`);
await page.waitForFunction(() => sessionStorage.getItem("bc_nav_last") === "/closet");
const banner = page.getByRole("banner");
check("뒤로 가기 버튼이 나가기 옆에 보임", await banner.getByRole("button", { name: "뒤로 가기" }).isVisible() && await banner.getByRole("link", { name: "광장으로 나가기" }).isVisible());
await page.screenshot({ path: `${outDir}/back-header.png`, clip: { x: 0, y: 0, width: 1280, height: 70 } });
await banner.getByRole("button", { name: "뒤로 가기" }).click();
await page.waitForURL(/\/shop$/, { waitUntil: "commit" });
check("꾸미기 → 뒤로 → 상점", page.url().endsWith("/shop"));

const fresh = await ctx.newPage();
await fresh.goto(`${BASE}/wallet`);
await fresh.waitForFunction(() => sessionStorage.getItem("bc_nav_count") !== null); // 화면이 준비될 때까지
await fresh.getByRole("banner").getByRole("button", { name: "뒤로 가기" }).click();
await fresh.waitForURL(/\/town$/, { waitUntil: "commit" });
check("새 탭에서 바로 연 화면은 뒤로 → 광장", fresh.url().endsWith("/town"));

const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
const pp = await phone.newPage();
await pp.goto(`${BASE}/shop`);
await pp.screenshot({ path: `${outDir}/back-header-375.png`, clip: { x: 0, y: 0, width: 375, height: 70 } });
check("375px 가로 넘침 없음", (await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
