// 휴대폰 화면 확인: 광장(게임)만, 아래 바로가기·조이스틱 없음 (2026-10-08 결정), 헤더 겹침·블로그 홈 버튼 줄바꿈 (이슈 #5)
// 사용: 개발 서버를 띄운 상태에서 node e2e/mobile.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const phoneSize = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };

// ── 휴대폰(375px): 광장만 (조이스틱·아래 바로가기 없음) ──
const phone = await browser.newContext(phoneSize);
const p = await phone.newPage();
const errors = collectErrors(p);
await loginDev(p, "mobile01");
await p.goto(`${BASE}/town`);
const canvas = p.locator("canvas");
await canvas.waitFor({ timeout: 20000 });
await p.waitForFunction(() => document.querySelector("canvas")?.dataset.joystick);
check("휴대폰: 광장(게임)이 보임", await canvas.isVisible());
check("휴대폰: 조이스틱 없음", (await canvas.getAttribute("data-joystick")) === "off");
check("휴대폰: 아래 바로가기 메뉴 없음", (await p.locator("[data-town-menu]").count()) === 0);
const fill = await p.evaluate(() => document.querySelector("canvas").getBoundingClientRect().bottom - window.innerHeight);
check("휴대폰: 광장이 화면 아래까지", Math.abs(fill) <= 2, `${Math.round(fill)}px`);
await p.screenshot({ path: `${outDir}/m1-town-phone.png` });
await p.goto(`${BASE}/shop`);

// ── 이슈 #5: 헤더의 나가기 버튼이 코인과 겹치지 않고, 레벨도 보인다 ──
const banner = p.getByRole("banner");
const exitBox = await banner.getByRole("link", { name: /나가기/ }).boundingBox();
const levelBox = await banner.getByTitle("레벨").boundingBox();
const gap = Math.round(levelBox.x - (exitBox.x + exitBox.width));
check("이슈 #5 나가기 버튼과 레벨·코인 사이가 떨어져 있음", gap >= 4, `${gap}px`);
check("GAME-02 휴대폰 헤더에도 레벨이 보임", await banner.getByTitle("레벨").isVisible());
await p.screenshot({ path: `${outDir}/m2-header-shop.png` });
await banner.getByRole("link", { name: /나가기/ }).click();
await p.waitForURL(/\/town$/);
await p.locator("canvas").waitFor({ timeout: 20000 });
check("휴대폰: 나가기를 누르면 광장", (await p.locator("canvas").count()) === 1);

// ── 이슈 #5: 블로그 홈 버튼 글자가 두 줄로 깨지지 않는다 ──
await p.goto(`${BASE}/@mobile01`);
const main = p.locator("main");
for (const name of ["글쓰기", "꾸미기", "관리"]) {
  const box = await main.getByRole("link", { name: new RegExp(name) }).first().boundingBox();
  check(`이슈 #5 '${name}' 버튼이 한 줄`, box.height < 48, `높이 ${Math.round(box.height)}px`);
}
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px: 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
await p.screenshot({ path: `${outDir}/m3-blog-home.png` });

// ── 휴대폰을 가로로 돌려도(높이가 낮은 터치 화면) 광장 ──
const land = await browser.newContext({ ...phoneSize, viewport: { width: 812, height: 375 }, storageState: await phone.storageState() });
const lp = await land.newPage();
await lp.goto(`${BASE}/town`);
await lp.locator("canvas").waitFor({ timeout: 20000 });
check("휴대폰 가로: 광장", await lp.locator("canvas").isVisible());
await lp.screenshot({ path: `${outDir}/m4-town-landscape.png` });

// ── 데스크톱은 그대로 광장 ──
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await phone.storageState() });
const d = await desk.newPage();
await d.goto(`${BASE}/town`);
await d.locator("canvas").waitFor();
check("데스크톱: 광장(게임)이 뜸", (await d.locator("canvas").count()) === 1);
await d.waitForFunction(() => document.querySelector("canvas")?.dataset.joystick);
check("데스크톱: 조이스틱 없음", (await d.locator("canvas").getAttribute("data-joystick")) === "off");

// ── 로그인하지 않은 방문자도 휴대폰에서 광장 구경 ──
const guest = await browser.newContext(phoneSize);
const g = await guest.newPage();
await g.goto(`${BASE}/town`);
await g.locator("canvas").waitFor({ timeout: 20000 });
check("방문자 휴대폰: 광장 구경", await g.locator("canvas").isVisible());
await g.screenshot({ path: `${outDir}/m5-town-guest.png`, fullPage: true });

check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await browser.close();
