// 광장 캔버스가 화면 픽셀 밀도(devicePixelRatio)로 그려지는지: 휴대폰(3배)·태블릿(2배, 조이스틱)·컴퓨터
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();
for (const [name, opts] of [
  ["phone", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ["tablet", { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ["desktop", { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, "layout1");
  await page.goto(`${BASE}/town`);
  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(1500);
  const info = await canvas.evaluate((c) => ({ px: [c.width, c.height], css: [Math.round(c.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().height)], joystick: c.dataset.joystick }));
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path: `${outDir}/town-${name}.png` });
  // 탭해서 이동: 캐릭터 아래쪽을 눌러 본다
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/town-${name}-moved.png` });
  console.log(name, errors.length ? errors : "오류 없음");
  await ctx.close();
}
await browser.close();
