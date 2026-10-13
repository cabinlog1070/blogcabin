// 휴대폰 조이스틱 (2026-10-13): 화면을 누르면 그 자리에 반투명 조이스틱이 나타나고, 끌면 그쪽으로 걷고, 손을 떼면 사라진다.
// 끌지 않고 떼면(톡 치기) 예전처럼 그곳으로 걸어간다. 컴퓨터(마우스)에는 조이스틱이 없다.
// 사용: 개발 서버를 띄운 상태에서 node e2e/joystick.mjs <스크린샷 폴더> (실행마다 새 회원)
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
mkdirSync(outDir, { recursive: true });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = collectErrors(page);
await loginDev(page, `js${Date.now() % 100_000_000}`);
if (!page.url().includes("/town")) await page.goto(`${BASE}/town`);
const canvas = page.locator("canvas");
await page.waitForFunction(() => document.querySelector("canvas")?.dataset.joystick, null, { timeout: 60000 });
await page.waitForTimeout(800);
check("휴대폰: 조이스틱 켜짐", (await canvas.getAttribute("data-joystick")) === "on");
check("누르기 전에는 안 보임", (await canvas.getAttribute("data-joystick-shown")) === "0");

// 손가락 움직임은 CDP 터치 이벤트로 보낸다 (Playwright에는 끌기용 터치가 없다)
const cdp = await context.newCDPSession(page);
const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const box = await canvas.boundingBox();
const sx = box.x + box.width / 2, sy = box.y + box.height * 0.7;

await touch("touchStart", sx, sy);
await page.waitForTimeout(200);
check("누르면 조이스틱이 나타남", (await canvas.getAttribute("data-joystick-shown")) === "1");
await page.screenshot({ path: `${outDir}/j1-press.png` });
for (let i = 1; i <= 6; i++) await touch("touchMove", sx + i * 3, sy + i * 10);
await page.waitForTimeout(150);
await page.screenshot({ path: `${outDir}/j2-drag.png` });
await page.waitForTimeout(900);
const at1 = (await canvas.getAttribute("data-player-at"))?.split(",").map(Number);
await page.waitForTimeout(500);
const at2 = (await canvas.getAttribute("data-player-at"))?.split(",").map(Number);
check("끌면 그쪽(아래)으로 걸어감", Boolean(at1 && at2) && at2[1] - at1[1] > 5, `${at1} → ${at2}`);
await touch("touchEnd");
await page.waitForTimeout(400);
check("손을 떼면 사라짐", (await canvas.getAttribute("data-joystick-shown")) === "0");
const at3 = await canvas.getAttribute("data-player-at");
await page.waitForTimeout(400);
check("손을 떼면 멈춤", (await canvas.getAttribute("data-player-at")) === at3);
await page.screenshot({ path: `${outDir}/j3-release.png` });

// 톡 치기(끌지 않고 떼기): 조이스틱 대신 그곳으로 걸어간다
await page.evaluate(() => delete document.querySelector("canvas").dataset.arrived);
await touch("touchStart", sx - 80, sy - 60);
await page.waitForTimeout(60);
await touch("touchEnd");
await page.waitForFunction(() => document.querySelector("canvas")?.dataset.arrived, null, { timeout: 20000 }).catch(() => {});
check("톡 치면 그곳으로 걸어감", Boolean(await canvas.getAttribute("data-arrived")), `길 ${await canvas.getAttribute("data-walk-path")}칸`);

// 컴퓨터(마우스)에는 없다
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await context.storageState() });
const d = await desk.newPage();
await d.goto(`${BASE}/town`);
await d.waitForFunction(() => document.querySelector("canvas")?.dataset.joystick, null, { timeout: 60000 });
check("컴퓨터: 조이스틱 없음", (await d.locator("canvas").getAttribute("data-joystick")) === "off");

check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await browser.close();
