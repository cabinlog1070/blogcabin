// 글쓰기 도구 줄: 컴퓨터는 아래로 내려도 머리말 밑에 붙어 따라오고,
// 휴대폰은 글을 쓰는 동안 키보드가 올라오면 키보드 바로 위에 붙는다 (키보드를 못 알아채면 위에 따라온다)
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();
const errors = [];

async function openLongPost(page, user) {
  errors.push(...collectErrors(page));
  await loginDev(page, user);
  await page.goto(`${BASE}/write`);
  await page.locator(".ProseMirror").waitFor();
  await page.locator(".ProseMirror").click();
  for (let i = 1; i <= 30; i++) {
    await page.keyboard.type(`${i}번째 줄`);
    await page.keyboard.press("Enter");
  }
}
const toolbarBox = (page) => page.getByRole("toolbar", { name: "글꼴 도구" }).boundingBox();
const headerBottom = (page) => page.locator("header").first().evaluate((h) => h.getBoundingClientRect().bottom);

// 컴퓨터: 아래로 내려도 도구 줄이 머리말 바로 밑에 있다
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await openLongPost(page, "toolbar1");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(200);
  const box = await toolbarBox(page);
  const top = await headerBottom(page);
  if (Math.abs(box.y - top) > 2) throw new Error(`컴퓨터: 도구 줄이 머리말 밑에 없어요 (도구 줄 ${box.y}, 머리말 ${top})`);
  await page.screenshot({ path: `${outDir}/toolbar-pc.png` });
  await ctx.close();
}

// 휴대폰
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await openLongPost(page, "toolbar2");
  const toolbar = page.getByRole("toolbar", { name: "글꼴 도구" });
  // 키보드를 알아채지 못하면(창 크기 그대로) 위에 따라온다
  await page.waitForTimeout(500);
  if (await toolbar.getAttribute("data-docked")) throw new Error("휴대폰: 키보드가 없는데 도구 줄이 아래로 붙었어요");
  // 키보드가 올라와 창이 줄면(안드로이드) 도구 줄이 맨 아래(키보드 바로 위)에 붙는다
  await page.setViewportSize({ width: 390, height: 500 });
  await page.waitForFunction(() => document.querySelector('[role=toolbar][data-docked]'));
  let box = await toolbarBox(page);
  if (Math.abs(box.y + box.height - 500) > 2) throw new Error(`휴대폰: 도구 줄이 키보드 바로 위에 없어요 (아래 끝 ${box.y + box.height})`);
  // 쓰는 줄은 도구 줄에 가리지 않는다
  await page.keyboard.type("지금 쓰는 줄");
  const caret = await page.evaluate(() => window.getSelection().getRangeAt(0).getBoundingClientRect().bottom);
  if (caret > box.y) throw new Error(`휴대폰: 쓰는 줄이 도구 줄에 가려요 (글 ${caret}, 도구 줄 ${box.y})`);
  await page.screenshot({ path: `${outDir}/toolbar-phone-keyboard.png` });
  // 묶음(정렬·줄 간격)을 펼쳐도 계속 키보드 위에 있고 버튼이 화면 안에 있다 (맨 왼쪽 버튼은 개발 서버의 N 표시가 덮는다)
  await page.getByRole("button", { name: "정렬·줄 간격", exact: true }).tap();
  if (!(await toolbar.getAttribute("data-docked"))) throw new Error("휴대폰: 도구 버튼을 누르니 도구 줄이 키보드 위에서 떨어졌어요");
  box = await toolbarBox(page);
  if (box.y < 0 || box.y + box.height > 502) throw new Error("휴대폰: 펼친 도구 줄이 화면 밖으로 나가요");
  await page.screenshot({ path: `${outDir}/toolbar-phone-group.png` });
  // 다 쓰고 제목을 누르면(키보드 내려감) 원래 자리로 돌아간다
  await page.getByPlaceholder("제목").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !document.querySelector('[role=toolbar][data-docked]'));
  await ctx.close();
}

await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log("✅ 도구 줄: 컴퓨터는 위에 따라오고, 휴대폰은 키보드 위에 붙음");
