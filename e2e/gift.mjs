// 관리자 선물: 관리자가 주민 두 명을 골라 코인·아이템과 함께 보낼 말을 보낸다 → 받은 주민에게 선물 팝업·알림·받은 선물 화면
// 같은 주민에게 한 번 더 보내도 되고, 이미 가진 아이템은 빼고 보낸다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);

// 받는 주민: 로그인해서 팝업을 볼 주민 하나 + 데이터만 있는 주민 하나
const memberId = `gf${tag}`;
const memberCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const member = await memberCtx.newPage();
const memberErrors = collectErrors(member);
await loginDev(member, memberId);
const { rows: [m] } = await db.query("SELECT id FROM users WHERE username = $1", [memberId]);
const other = await fakeMember(db, `gfo${tag}`);
const { rows: giftItems } = await db.query("SELECT id, name FROM items WHERE NOT is_starter AND type IN ('avatar', 'furniture') ORDER BY id LIMIT 2");
const coinsOf = async (userId) => (await db.query("SELECT COALESCE(SUM(coin_delta), 0)::int AS c FROM point_ledger WHERE user_id = $1", [userId])).rows[0].c;
const before = await coinsOf(m.id);

// 관리자 로그인
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await page.goto(BASE);
await page.getByLabel("아이디").fill(ADMIN.username);
await page.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
await page.getByRole("button", { name: "로그인", exact: true }).click();
await page.waitForURL(/town/);
await page.goto(`${BASE}/admin#gift`);

const form = page.locator("[data-admin-gift]");
// 말 없이 보내면 막힘 (브라우저 required를 피하려고 공백만)
await form.locator("[data-gift-message-input]").fill("   ");
await form.locator("[data-gift-coins-input]").fill("100");
await form.locator(`input[name="userId"][value="${m.id}"]`).check();
await form.locator("[data-gift-send]").click();
await form.locator("[data-gift-result]").waitFor();
check("함께 보낼 말이 없으면 막힘", (await form.locator("[data-gift-result]").innerText()).includes("함께 보낼 말"));

// 주민 두 명 + 코인 300 + 아이템 2개 + 말
const message = `이벤트 참여 고마워요! ${tag}\n작은 선물이에요`;
await form.locator("[data-gift-member-search]").fill(`gfo${tag}`);
await form.locator(`input[name="userId"][value="${other.uid}"]`).check();
await form.locator("[data-gift-member-search]").fill("");
await form.locator("[data-gift-message-input]").fill(message);
await form.locator("[data-gift-coins-input]").fill("300");
for (const it of giftItems) await form.locator(`[data-gift-item="${it.id}"]`).click();
await page.screenshot({ path: `${outDir}/gift-1-admin-form.png`, fullPage: true });
await form.locator("[data-gift-send]").click();
await page.waitForFunction(() => document.querySelector("[data-gift-result]")?.textContent?.includes("선물을 보냈어요"));
check("두 명에게 보냈다는 안내", (await form.locator("[data-gift-result]").innerText()).includes("선물을 보냈어요"));
await form.locator("[data-gift-result]").scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outDir}/gift-2-admin-sent.png` });

check("받은 주민 코인 +300", (await coinsOf(m.id)) === before + 300);
const { rows: owned } = await db.query("SELECT item_id FROM user_items WHERE user_id = $1 AND item_id = ANY($2)", [m.id, giftItems.map((i) => i.id)]);
check("아이템 2개가 바로 주민 것", owned.length === 2);
const { rows: notes } = await db.query("SELECT kind, actor_id, read_at FROM notifications WHERE user_id = $1 AND kind = 'gift'", [other.uid]);
check("다른 주민에게도 선물 알림", notes.length === 1 && notes[0].actor_id !== null);

// 받은 주민: 다음 화면에서 선물 팝업
await member.goto(`${BASE}/feed`);
const modal = member.locator("[data-gift-modal]");
await modal.waitFor({ timeout: 15000 });
check("선물 팝업에 관리자가 적은 말", (await modal.locator("[data-gift-message]").innerText()).includes(`이벤트 참여 고마워요! ${tag}`));
check("선물 팝업에 코인과 아이템 2개", (await modal.locator("[data-gift-coins]").innerText()).includes("300") && (await modal.locator("[data-gift-items] li").count()) === 2);
await member.screenshot({ path: `${outDir}/gift-3-popup.png` });
await modal.getByRole("button", { name: "받은 선물 보기" }).click();
await member.waitForURL(/\/gifts$/);
await member.locator("[data-gift-list] li").first().waitFor();
check("받은 선물 화면에 선물 하나", (await member.locator("[data-gift-list] > li").count()) === 1);
await member.screenshot({ path: `${outDir}/gift-4-list.png`, fullPage: true });
const { rows: [seen] } = await db.query("SELECT read_at FROM notifications WHERE user_id = $1 AND kind = 'gift'", [m.id]);
check("팝업을 닫으면 선물 알림 읽음", seen.read_at !== null);

// 같은 주민에게 한 번 더: 이미 가진 아이템만 고르고 코인 50 → 코인만 간다
await page.reload();
await form.locator(`input[name="userId"][value="${m.id}"]`).check();
await form.locator("[data-gift-message-input]").fill(`한 번 더! ${tag}`);
await form.locator("[data-gift-coins-input]").fill("50");
await form.locator(`[data-gift-item="${giftItems[0].id}"]`).click();
await form.locator("[data-gift-send]").click();
await page.waitForFunction(() => document.querySelector("[data-gift-result]")?.textContent?.includes("선물을 보냈어요"));
check("같은 주민에게 두 번째 선물도 됨 (코인 +50)", (await coinsOf(m.id)) === before + 350);
const { rows: [second] } = await db.query("SELECT g.coins, (SELECT COUNT(*)::int FROM gift_items gi WHERE gi.gift_id = g.id) AS items FROM gifts g WHERE recipient_id = $1 ORDER BY id DESC LIMIT 1", [m.id]);
check("이미 가진 아이템은 빼고 보냄", second.coins === 50 && second.items === 0);

// 이미 가진 아이템만, 코인 없이 → 보낼 게 없다고 막힘
await page.reload();
await form.locator(`input[name="userId"][value="${m.id}"]`).check();
await form.locator("[data-gift-message-input]").fill(`또! ${tag}`);
await form.locator(`[data-gift-item="${giftItems[0].id}"]`).click();
await form.locator("[data-gift-send]").click();
await form.locator("[data-gift-result]").waitFor();
check("보낼 게 없으면 막힘", (await form.locator("[data-gift-result]").innerText()).includes("보낼 선물이 없어요"));

// 알림함 문구
await member.goto(`${BASE}/notifications`);
const firstRow = member.locator("[data-notification-list] li").first();
check("알림함에 선물 알림과 함께 보낸 말", (await firstRow.innerText()).includes(`한 번 더! ${tag}`));
await member.screenshot({ path: `${outDir}/gift-5-notifications.png` });

// 일본어 화면의 선물 팝업 (두 번째 선물이 아직 안 읽음)
await db.query("UPDATE users SET locale = 'ja' WHERE id = $1", [m.id]);
await db.query("UPDATE notifications SET read_at = NULL WHERE user_id = $1 AND kind = 'gift'", [m.id]);
await member.goto(`${BASE}/feed`);
await modal.waitFor({ timeout: 15000 });
check("일본어 선물 팝업", (await modal.innerText()).includes("プレゼント"));
await member.screenshot({ path: `${outDir}/gift-6-popup-ja.png` });
await db.query("UPDATE users SET locale = 'ko' WHERE id = $1", [m.id]);

// 휴대폰 관리자 화면
const phone = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
await phone.addCookies(await ctx.cookies());
const pp = await phone.newPage();
await pp.goto(`${BASE}/admin`);
await pp.locator("[data-admin-gift]").scrollIntoViewIfNeeded();
await pp.screenshot({ path: `${outDir}/gift-7-admin-phone.png`, fullPage: true });
check("휴대폰에서 가로로 넘치지 않음", await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

check("관리자 화면 오류 없음", errors.length === 0);
check("주민 화면 오류 없음", memberErrors.length === 0);
if (errors.length || memberErrors.length) console.log([...errors, ...memberErrors].join("\n"));
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
