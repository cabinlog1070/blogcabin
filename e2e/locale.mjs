// 화면 언어 고르기 (한국어·일본어): 방문자는 쿠키로, 회원은 users.locale로 기억한다. 회원이 쓴 글은 그대로
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);
const localeOf = async (username) => (await db.query("SELECT locale FROM users WHERE username = $1", [username])).rows[0]?.locale;
const htmlLang = (page) => page.locator("html").getAttribute("lang");

// 1) 방문자: 첫 화면 아래 언어 고르기
const gctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const guest = await gctx.newPage();
const errors = collectErrors(guest);
await guest.goto(BASE);
check("처음에는 한국어", (await htmlLang(guest)) === "ko" && (await guest.getByRole("button", { name: "로그인", exact: true }).isVisible()));
await guest.locator('[data-language-switcher] [data-locale="ja"]').click();
await guest.locator('html[lang="ja"]').waitFor();
check("日本語를 누르면 첫 화면이 일본어로 바뀐다", await guest.getByRole("button", { name: "ログイン", exact: true }).isVisible());
await guest.screenshot({ path: `${outDir}/locale-landing-ja.png`, fullPage: true });
await guest.reload();
check("새로고침해도 일본어 (쿠키)", (await htmlLang(guest)) === "ja");
await guest.locator('[data-language-switcher] [data-locale="ko"]').click();
await guest.locator('html[lang="ko"]').waitFor();
check("한국어로 돌아온다", await guest.getByRole("button", { name: "로그인", exact: true }).isVisible());

// 2) 회원: 내 정보 메뉴에서 일본어로
const devId = `lc${tag}`;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const memberErrors = collectErrors(page);
await loginDev(page, devId);
await page.goto(`${BASE}/shop`);
await page.locator("[data-status-card]").click();
await page.locator('[data-profile-menu] [data-locale="ja"]').click();
await page.locator('html[lang="ja"]').waitFor();
check("내 정보 메뉴에서 일본어로 바꿀 수 있다", (await localeOf(devId)) === "ja");
check("헤더가 일본어 (広場に出る)", await page.getByRole("link", { name: "広場に出る" }).isVisible());
await page.keyboard.press("Escape");
await page.screenshot({ path: `${outDir}/locale-shop-ja.png`, fullPage: true });
for (const [path, name] of [["/farm", "farm"], ["/closet", "closet"], ["/settings/blog", "settings"], ["/attendance", "attendance"], ["/wallet", "wallet"], ["/write", "write"], ["/support", "support"]]) {
  await page.goto(`${BASE}${path}`);
  await page.screenshot({ path: `${outDir}/locale-${name}-ja.png`, fullPage: true });
}
await page.goto(`${BASE}/town`);
await page.locator("canvas").waitFor();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/locale-town-ja.png` });

// 회원이 쓴 글은 쓴 그대로
await page.goto(`${BASE}/@${devId}`);
const blogTitle = (await db.query("SELECT b.title FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [devId])).rows[0].title;
check("블로그 이름(회원이 쓴 글)은 그대로", (await page.content()).includes(blogTitle));
check("기본 카테고리 '일상'은 일본어 화면에서 '日常'", (await page.getByRole("link", { name: /日常/ }).count()) > 0 && (await page.getByRole("link", { name: /일상/ }).count()) === 0);
await page.screenshot({ path: `${outDir}/locale-blog-ja.png`, fullPage: true });

// 3) 다른 기기(쿠키 없음)에서 로그인해도 일본어
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await ctx2.newPage();
await loginDev(p2, devId);
check("다른 기기에서 로그인해도 회원이 고른 일본어", (await htmlLang(p2)) === "ja");
await p2.screenshot({ path: `${outDir}/locale-phone-ja.png`, fullPage: true });

// 4) 다시 한국어
await page.goto(`${BASE}/shop`);
await page.locator("[data-status-card]").click();
await page.locator('[data-profile-menu] [data-locale="ko"]').click();
await page.locator('html[lang="ko"]').waitFor();
check("한국어로 돌리면 회원 언어도 ko", (await localeOf(devId)) === "ko");

const allErrors = [...errors, ...memberErrors];
check(`콘솔 오류 없음 ${allErrors.join(" | ")}`, allErrors.length === 0);
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
