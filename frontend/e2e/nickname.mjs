// 블로그 관리 기본 정보에서 닉네임 바꾸기 (BLOG-03): 저장·헤더 반영·중복·관리자 닉네임·관리자 본인 저장·관리자 블로그 이름 고정
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
const nicknameOf = async (username) =>
  (await db.query("SELECT p.nickname FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.username = $1", [username])).rows[0]?.nickname;

const taken = `남의닉${tag}`;
const other = await fakeMember(db, `nko${tag}`, { nickname: taken });

const devId = `nk${tag}`;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, devId);
await page.goto(`${BASE}/settings/blog`);
const nick = page.locator('input[name="nickname"]');
check("기본 정보에 지금 닉네임이 채워져 있다", (await nick.inputValue()) === devId);

const save = page.getByRole("button", { name: "저장", exact: true }).first();
const newNick = `새닉${tag}`;
await nick.fill(`  ${newNick}  `);
await save.click();
await page.getByText("저장했어요 ✓").waitFor();
check("닉네임을 바꾸면 앞뒤 공백을 지워 저장된다", (await nicknameOf(devId)) === newNick);
check("헤더 상태창에 바뀐 닉네임이 보인다", (await page.locator("[data-status-card]").innerText()).includes(newNick));
await page.screenshot({ path: `${outDir}/nickname-saved.png` });

await page.locator('input[name="nickname"]').fill(taken);
await page.getByRole("button", { name: "저장", exact: true }).first().click();
await page.getByText("이미 있는 닉네임이에요").waitFor();
check("다른 회원의 닉네임은 쓸 수 없다", (await nicknameOf(devId)) === newNick);
await page.screenshot({ path: `${outDir}/nickname-taken.png` });

await page.locator('input[name="nickname"]').fill("관리자");
await page.getByRole("button", { name: "저장", exact: true }).first().click();
await page.getByText("이 닉네임은 쓸 수 없어요").waitFor();
check("회원은 '관리자' 닉네임을 쓸 수 없다", (await nicknameOf(devId)) === newNick);

// 관리자는 닉네임 '관리자' 그대로 기본 정보를 저장할 수 있다
const actx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const admin = await actx.newPage();
await admin.goto(BASE);
await admin.getByLabel("아이디").fill(ADMIN.username);
await admin.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
await admin.getByRole("button", { name: "로그인", exact: true }).click();
await admin.waitForURL(/town/);
// 예전에 바꿔 둔 공지 블로그 이름도 저장하면 원래 이름으로 돌아간다
await db.query("UPDATE blogs SET title = '공지사항' WHERE slug = 'notice'");
await admin.goto(`${BASE}/settings/blog`);
// 공지 블로그 이름(BlogCabin 공지사항)은 고정: 이름 칸이 없고 읽기 전용으로 보여 준다
check("관리자 블로그 이름은 바꿀 수 없다 (이름 칸 없음)", (await admin.locator('input[name="title"]').count()) === 0);
await admin.getByText("관리자 블로그 이름은 바꿀 수 없어요").waitFor();
await admin.getByRole("button", { name: "저장", exact: true }).first().click();
await admin.getByText("저장했어요 ✓").waitFor();
check("관리자는 닉네임 '관리자'로 기본 정보를 저장할 수 있다", (await nicknameOf(ADMIN.username)) === "관리자");
const noticeTitle = (await db.query("SELECT title FROM blogs WHERE slug = 'notice'")).rows[0]?.title;
check("저장하면 공지 블로그 이름이 'BlogCabin 공지사항'으로 돌아간다", noticeTitle === "BlogCabin 공지사항");
await admin.screenshot({ path: `${outDir}/admin-title-locked.png` });

// 휴대폰 화면
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
const m = await mctx.newPage();
await m.goto(`${BASE}/settings/blog`);
await m.screenshot({ path: `${outDir}/nickname-mobile.png` });

check(`콘솔 오류 없음 ${errors.join(" | ")}`, errors.length === 0);
await db.query("DELETE FROM users WHERE id = $1", [other.uid]);
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
