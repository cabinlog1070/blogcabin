// 사진 슬라이드: 🎞 슬라이드 버튼으로 사진 여러 장을 한 슬라이드로 넣고, 읽는 화면에서 화살표·키보드·손가락으로 넘긴다
// 사용: 개발 서버를 띄운 상태에서 node e2e/slider.mjs <스크린샷 폴더>  (실행마다 새 회원)
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
mkdirSync(outDir, { recursive: true });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);

const browser = await chromium.launch();

// 눈으로 구분되는 사진 네 장 (색과 번호가 다른 PNG)
const maker = await browser.newPage({ viewport: { width: 800, height: 500 } });
const photos = [];
for (const [i, color] of ["#f4a259", "#5b8e7d", "#bc4b51", "#8cb369"].entries()) {
  await maker.setContent(
    `<body style="margin:0;background:${color};display:flex;align-items:center;justify-content:center;height:100vh;font:bold 160px sans-serif;color:#fff">${i + 1}</body>`,
  );
  photos.push({ name: `사진${i + 1}.png`, mimeType: "image/png", buffer: await maker.screenshot() });
}
await maker.close();

const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
const errors = collectErrors(page);
await loginDev(page, `sl${Date.now() % 100_000_000}`);
await page.goto(`${BASE}/write`);
await page.locator(".ProseMirror").waitFor();
await page.getByPlaceholder("제목").fill("사진 슬라이드 확인용 글");
await page.locator(".ProseMirror").click();
await page.keyboard.type("여행 사진을 슬라이드로 모아 봤어요.");
const idle = () => page.getByText(/올리는 중/).waitFor({ state: "detached", timeout: 30000 }).catch(() => {});

// 1) 슬라이드 버튼으로 세 장
await page.getByLabel("슬라이드 사진 고르기").setInputFiles(photos.slice(0, 3));
await page.locator(".ProseMirror div[data-slider] img").nth(2).waitFor({ timeout: 30000 });
await idle();
check("세 장이 슬라이드 하나로", (await page.locator(".ProseMirror div[data-slider]").count()) === 1 && (await page.locator(".ProseMirror div[data-slider] img").count()) === 3);
await page.keyboard.type("슬라이드 다음 글");
check("슬라이드 뒤에 글을 이어 씀", (await page.locator(".ProseMirror").innerText()).includes("슬라이드 다음 글") && (await page.locator(".ProseMirror div[data-slider] img").count()) === 3);

// 2) 슬라이드 사진을 고른 채 한 장 더 → 같은 슬라이드에 더해진다
await page.locator(".ProseMirror div[data-slider] img").nth(2).click();
await page.getByLabel("슬라이드 사진 고르기").setInputFiles([photos[3]]);
await page.locator(".ProseMirror div[data-slider] img").nth(3).waitFor({ timeout: 30000 });
await idle();
check("고른 슬라이드에 한 장 더", (await page.locator(".ProseMirror div[data-slider]").count()) === 1 && (await page.locator(".ProseMirror div[data-slider] img").count()) === 4);

// 3) 한 장만 고르면 보통 사진
await page.locator(".ProseMirror p").last().click();
await page.keyboard.press("End");
await page.getByLabel("슬라이드 사진 고르기").setInputFiles([photos[0]]);
await page.locator(".ProseMirror > img").first().waitFor({ timeout: 30000 });
await idle();
check("한 장은 보통 사진", (await page.locator(".ProseMirror div[data-slider]").count()) === 1);
await page.locator("[data-rich-editor]").screenshot({ path: `${outDir}/slider-1-editor.png` });

await page.getByRole("button", { name: "발행하기" }).click();
await page.waitForURL(/\/@sl\d+\/\d+/);
const postUrl = page.url().replace(/\?new=\w+$/, "");
await page.goto(postUrl);
const slider = page.locator(".prose-blog .slider-frame div[data-slider]");
await slider.waitFor();
const count = page.locator(".slider-count");
check("읽는 화면: 1 / 4", (await count.textContent()) === "1 / 4");
check("첫 장에서는 이전 화살표 숨김", !(await page.getByRole("button", { name: "이전 사진" }).isVisible()));
await slider.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outDir}/slider-2-desktop.png`, fullPage: false, clip: await page.locator("article").boundingBox().then((b) => ({ x: b.x, y: Math.max(0, b.y + 180), width: b.width, height: 640 })) });
await page.getByRole("button", { name: "다음 사진" }).click();
await page.waitForFunction(() => document.querySelector(".slider-count")?.textContent === "2 / 4");
check("다음 화살표 → 2 / 4", true);
await slider.focus();
await page.keyboard.press("ArrowRight");
await page.waitForFunction(() => document.querySelector(".slider-count")?.textContent === "3 / 4");
await page.keyboard.press("ArrowRight");
await page.waitForFunction(() => document.querySelector(".slider-count")?.textContent === "4 / 4");
check("→ 키로 끝까지, 마지막에서 다음 화살표 숨김", !(await page.getByRole("button", { name: "다음 사진" }).isVisible()));
await page.waitForTimeout(800); // 부드럽게 넘어가는 중이 아니라 멈춘 뒤에 찍는다
await page.screenshot({ path: `${outDir}/slider-3-desktop-last.png`, clip: await page.locator(".slider-frame").boundingBox() });

// 4) 휴대폰: 화살표 없이 손가락으로 민다 (가로 스크롤)
const phone = await browser.newContext({ ...devices["iPhone 13"], storageState: await page.context().storageState() });
const m = await phone.newPage();
const mErrors = collectErrors(m);
await m.goto(postUrl);
const ms = m.locator(".prose-blog .slider-frame div[data-slider]");
await ms.waitFor();
check("휴대폰: 화살표 숨김", !(await m.getByRole("button", { name: "다음 사진" }).isVisible()));
const box = await ms.boundingBox();
// 손가락으로 왼쪽으로 미는 것과 같은 가로 스크롤
await ms.evaluate((el) => el.scrollBy({ left: el.clientWidth }));
await m.waitForFunction(() => document.querySelector(".slider-count")?.textContent === "2 / 4");
check("휴대폰: 밀어서 2 / 4", true);
await m.screenshot({ path: `${outDir}/slider-4-phone.png`, clip: { x: 0, y: Math.max(0, box.y - 60), width: 390, height: box.height + 120 } });
await m.goto(`${BASE}/write`);
await m.locator("[data-rich-editor] [role=toolbar]").waitFor();
check("휴대폰 툴바 첫 줄에 🎞 버튼", await m.getByLabel("슬라이드 사진 고르기").count() === 1);
await m.locator("[data-rich-editor] [role=toolbar]").screenshot({ path: `${outDir}/slider-5-phone-toolbar.png` });

for (const r of results) console.log(r);
const errs = [...errors, ...mErrors];
if (errs.length) console.log("콘솔 오류:", errs);
await browser.close();
if (results.some((r) => r.startsWith("❌")) || errs.length) process.exit(1);
