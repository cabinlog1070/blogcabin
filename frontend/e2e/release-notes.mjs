// 릴리스 노트: 내 정보 메뉴의 문의하기 바로 아래 항목 → /release-notes, 최신 날짜가 맨 위·그날만 펼침, 날짜를 누르면 버전이 펼쳐짐, 휴대폰 화면
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, `rn${tag}`);

await page.locator("[data-status-card]").click();
const menu = page.locator("[data-profile-menu] nav");
await menu.waitFor();
const items = (await menu.locator("a, button").allInnerTexts()).map((t) => t.trim());
check(`메뉴 순서: 문의하기 바로 아래에 릴리스 노트 (${items.join(" · ")})`, items.indexOf("릴리스 노트") === items.indexOf("문의하기") + 1);
await page.screenshot({ path: `${outDir}/release-notes-menu.png` });

await menu.getByRole("link", { name: "릴리스 노트" }).click();
await page.waitForURL(/\/release-notes$/);
const dates = await page.locator("[data-release]").evaluateAll((els) => els.map((e) => e.getAttribute("data-release")));
check(`릴리스 노트 화면이 열리고 날짜 묶음이 보인다 (${dates.length}개)`, dates.length > 0);
check("최신 날짜가 맨 위", dates.every((d, i) => i === 0 || dates[i - 1] > d));
check("새 기능 표시가 보인다", (await page.getByText("새 기능").count()) > 0);
const opened = await page.locator("details[data-release]").evaluateAll((els) => els.map((e) => e.open));
check("가장 최근 날짜만 펼쳐져 있다", opened[0] && opened.slice(1).every((o) => !o));
const versions = await page.locator("details[data-release]").first().locator("[data-version]").count();
check(`펼친 날짜 안에 버전이 보인다 (${versions}개)`, versions > 0 && (await page.locator("[data-version]").first().isVisible()));
check("지금 버전이 보인다", /v\d+\.\d+\.\d+/.test(await page.locator("[data-current-version]").innerText()));
const second = page.locator("details[data-release]").nth(1);
await second.locator("summary").click();
check("날짜를 누르면 그날 버전이 펼쳐진다", (await second.evaluate((e) => e.open)) && (await second.locator("[data-version]").first().isVisible()));
await page.screenshot({ path: `${outDir}/release-notes-desktop.png`, fullPage: false });

// 화면 사진이 붙은 항목이 있으면: 사진이 불러와지고, 누르면 크게 열리고, Esc로 닫힌다
const shots = page.locator("details[data-release][open] [data-release-image]");
if ((await shots.count()) > 0) {
  const img = shots.first().locator("> button img").first();
  await img.scrollIntoViewIfNeeded();
  check("화면 사진이 불러와진다", await img.evaluate((el) => el.complete && el.naturalWidth > 0));
  await shots.first().locator("> button").click();
  check("사진을 누르면 크게 열린다", (await page.locator("dialog[open][aria-label] img").count()) > 0);
  await page.screenshot({ path: `${outDir}/release-notes-image.png` });
  await page.keyboard.press("Escape");
  check("Esc로 닫힌다", (await page.locator("dialog[open]").count()) === 0);
}

const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const p2 = await phone.newPage();
await p2.goto(`${BASE}/release-notes`);
check("로그인하지 않아도 열린다", (await p2.locator("[data-release]").count()) === dates.length);
const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check("휴대폰에서 옆으로 넘치지 않는다", !overflow);
await p2.screenshot({ path: `${outDir}/release-notes-phone.png` });

check(`콘솔 오류 없음 ${errors.length ? errors.join(" | ") : ""}`, errors.length === 0);
await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
