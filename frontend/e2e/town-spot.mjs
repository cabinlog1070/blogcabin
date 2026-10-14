// 광장 위치 기억하기 (2026-10-13): 같은 탭에서 다른 화면에 갔다가 광장으로 돌아오면(뒤로 가기·광장으로 나가기)
// 캐릭터가 떠나기 전 자리에서 시작하고, 새 탭에서 열면 원래 시작 자리(캠프파이어 앞)에서 시작한다.
// 사용: 개발 서버를 띄운 상태에서 node e2e/town-spot.mjs <스크린샷 폴더> (실행마다 새 회원)
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
mkdirSync(outDir, { recursive: true });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = collectErrors(page);
await loginDev(page, `ts${Date.now() % 100_000_000}`);

const canvas = page.locator("canvas");
/** 광장이 새로 그려질 때까지 기다렸다가 시작한 자리 */
async function spawnOf(p) {
  await p.waitForFunction(() => document.querySelector("canvas")?.dataset.spawn, null, { timeout: 60000 });
  return (await p.locator("canvas").getAttribute("data-spawn")).split(",").map(Number);
}
/** 화면 가운데에서 (dx, dy)만큼 떨어진 곳을 눌러 걸어가고, 도착한 자리 */
async function walk(dx, dy) {
  await page.evaluate(() => delete document.querySelector("canvas").dataset.arrived);
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width / 2 + dx, y: box.height / 2 + dy } });
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.arrived, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  return (await canvas.getAttribute("data-arrived")).split(",").map(Number);
}
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 3;

if (!page.url().includes("/town")) await page.goto(`${BASE}/town`);
const start = await spawnOf(page);
check("처음 들어오면 시작 자리에서", start.length === 2, start.join());

// ① 걸어간 뒤 다른 화면에 갔다가 [뒤로] 버튼으로 돌아오기
const p1 = await walk(-260, -120);
check("걸어서 다른 자리로", !near(p1, start), p1.join());
await page.goto(`${BASE}/release-notes`);
await page.locator("[data-back-button]").click();
await page.waitForURL(/\/town/);
const back1 = await spawnOf(page);
check("[뒤로]로 돌아오면 떠나기 전 자리", near(back1, p1), `${back1} ↔ ${p1}`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/town-spot-back.png` });

// ② 또 걸어간 뒤 [광장으로 나가기] 링크로 돌아오기
const p2 = await walk(300, 80);
await page.goto(`${BASE}/release-notes`);
await page.getByRole("link", { name: "광장으로 나가기" }).click();
await page.waitForURL(/\/town/);
const back2 = await spawnOf(page);
check("[광장으로 나가기]로 돌아오면 떠나기 전 자리", near(back2, p2), `${back2} ↔ ${p2}`);

// ③ 브라우저 뒤로 가기 (다른 화면 → 광장)
const p3 = await walk(-200, 150);
await page.goto(`${BASE}/release-notes`);
await page.goBack();
await page.waitForURL(/\/town/);
const back3 = await spawnOf(page);
check("브라우저 뒤로 가기로 돌아와도 떠나기 전 자리", near(back3, p3), `${back3} ↔ ${p3}`);

// ④ 새 탭(같은 로그인)으로 열면 시작 자리
const tab = await context.newPage();
await tab.goto(`${BASE}/town`);
const fresh = await spawnOf(tab);
check("새 탭에서는 원래 시작 자리", near(fresh, start), `${fresh} ↔ ${start}`);

check("화면 오류 없음", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(results.join("\n"));
await browser.close();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
