// 마을 소식 검색창 (BLOG-07): 탭 줄 오른쪽(휴대폰은 탭 아래 한 줄)에서 검색하면 마을 검색 결과로 가고,
// 결과 화면의 돌아가기는 마을 소식으로. 로그인하지 않은 손님에게는 검색창이 없다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, fakePost, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);

const a = await fakeMember(db, `fs${tag}`);
await fakePost(db, a.blogId, { title: `${tag} 가을 산책`, text: "단풍 구경", minutesAgo: 1 });
await fakePost(db, a.blogId, { title: `${tag} 비공개 산책`, visibility: "private", minutesAgo: 2 });

// 1) 손님: 검색창 없음
const guest = await browser.newPage();
await guest.goto(`${BASE}/feed`);
check("손님에게는 마을 소식 검색창이 없다", (await guest.locator("[data-feed-search]").count()) === 0);
await guest.close();

// 2) 회원 (컴퓨터): 탭 줄과 같은 줄 오른쪽
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = collectErrors(page);
await loginDev(page, `fsv${tag}`);
await page.goto(`${BASE}/feed`);
const box = page.locator("[data-feed-search]");
const tabBox = await page.getByRole("link", { name: /마을 전체/ }).boundingBox();
const searchBox = await box.boundingBox();
check(`컴퓨터: 검색창이 탭과 같은 줄 오른쪽 (${Math.round(searchBox.y)} vs ${Math.round(tabBox.y)})`, Math.abs(searchBox.y + searchBox.height / 2 - (tabBox.y + tabBox.height / 2)) < 8 && searchBox.x > tabBox.x + 400);
// 공백만 넣으면 검색하지 않는다
await box.locator("input").fill("   ");
await box.locator("input").press("Enter");
await page.waitForTimeout(300);
check("공백만 넣으면 안내 문구, 화면 그대로", page.url().endsWith("/feed") && (await page.getByText("검색어를 입력해 주세요").isVisible()));
await page.screenshot({ path: `${outDir}/feed-search-pc.png` });
// 검색 → 결과 화면, 공개 글만
await box.locator("input").fill(`${tag}`);
await box.locator("input").press("Enter");
await page.waitForURL(/\/search\?.*from=feed/);
const hit = page.getByRole("link", { name: new RegExp(`${tag} 가을 산책`) });
await hit.waitFor({ timeout: 10000 }).catch(() => {});
check("검색하면 마을 검색 결과로", await hit.isVisible());
check("비공개 글은 결과에 없다", (await page.getByText(`${tag} 비공개 산책`).count()) === 0);
await page.screenshot({ path: `${outDir}/feed-search-result.png` });
// 결과 화면에서 다시 검색해도 마을 소식에서 온 것을 기억한다
await page.locator("#village-search").fill(`${tag} 가을`);
await page.locator("#village-search").press("Enter");
await page.waitForURL(/q=.*%EA%B0%80%EC%9D%84.*from=feed|from=feed.*q=/);
const back = page.getByRole("link", { name: "← 마을 소식으로" });
check("결과 화면의 돌아가기는 마을 소식으로", await back.isVisible());
await back.click();
await page.waitForURL(/\/feed$/);
check("돌아가기를 누르면 마을 소식", page.url().endsWith("/feed"));

// 3) 휴대폰: 탭 아래 한 줄을 다 쓴다
await page.setViewportSize({ width: 375, height: 760 });
await page.goto(`${BASE}/feed`);
const pb = await box.boundingBox();
const pt = await page.getByRole("link", { name: /마을 전체/ }).boundingBox();
check(`휴대폰: 검색창이 탭 아래 한 줄 (폭 ${Math.round(pb.width)})`, pb.y > pt.y + pt.height && pb.width > 300);
await page.screenshot({ path: `${outDir}/feed-search-phone.png` });

check(`콘솔 오류 없음 ${errors.join(" | ")}`, errors.length === 0);
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
