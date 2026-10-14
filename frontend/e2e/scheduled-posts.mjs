// 글 예약 발행 (POST-11)과 관리자 글 광장 게시판 게시 시간.
// 예약 글은 그 시각 전까지 주인만 보고, 시각이 지나면(여기서는 DB 시각을 앞당겨 흉내 낸다) 누구나 본다.
// 관리자는 글마다 마을 소식 맨 위에 걸어 둘 시간을 고른다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, fakePost, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);
const postIdOf = (url) => Number(new URL(url).pathname.split("/").pop());

async function write(page, { title, schedule = false, publishAt, pin }) {
  await page.goto(`${BASE}/write`);
  await page.locator(".ProseMirror").waitFor();
  await page.locator('input[name="title"]').fill(title);
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(`${title} 본문입니다.`);
  if (schedule) {
    await page.getByRole("radio", { name: "⏰ 예약하기" }).click();
    if (publishAt) await page.locator('input[name="publishAt"]').fill(publishAt);
  }
  if (pin !== undefined) await page.getByLabel("📌 광장 게시판 맨 위에 걸어 두기").selectOption(String(pin));
}

// ===== 1) 주민이 글을 예약한다 =====
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
const writer = `sp${tag}`;
await loginDev(page, writer);

await write(page, { title: `${tag} 예약 글`, schedule: true });
check("주민 글쓰기에는 광장 게시판 게시 시간이 없다", (await page.getByLabel("📌 광장 게시판 맨 위에 걸어 두기").count()) === 0);
check("예약 시각 기본값이 들어가 있다", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(await page.locator('input[name="publishAt"]').inputValue()));
await page.screenshot({ path: `${outDir}/schedule-write.png`, fullPage: true });
await page.getByRole("button", { name: "예약하기", exact: true }).click();
await page.waitForURL(/\?new=/);
const scheduledId = postIdOf(page.url());
check("예약하면 `글을 예약했어요` 안내", await page.getByText(/글을 예약했어요!/).isVisible());
const { rows: [row1] } = await db.query("SELECT created_at > now() AS future, pin_hours FROM posts WHERE id = $1", [scheduledId]);
check("DB: 올라갈 시각이 미래, 게시 시간 0", row1.future === true && row1.pin_hours === 0);
await page.screenshot({ path: `${outDir}/schedule-post-owner.png` });

await page.goto(`${BASE}/@${writer}`);
check("주인 블로그 홈에 예약 글과 `⏰ 예약` 배지", await page.getByText(/⏰ .* 예약/).first().isVisible());
await page.screenshot({ path: `${outDir}/schedule-blog-home.png` });

// 지난 시각으로 예약하면 막는다
await write(page, { title: `${tag} 지난 시각`, schedule: true, publishAt: "2020-01-01T09:00" });
await page.getByRole("button", { name: "예약하기", exact: true }).click();
await page.getByText("예약 시간은 지금보다 뒤로 정해 주세요").waitFor({ timeout: 10000 });
check("지난 시각 예약은 안내와 함께 막는다", true);

// ===== 2) 다른 사람(방문자)에게는 안 보인다 =====
const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
let res = await visitor.goto(`${BASE}/@${writer}/${scheduledId}`);
check("방문자: 예약 글 주소는 404", res.status() === 404);
await visitor.goto(`${BASE}/@${writer}`);
check("방문자: 블로그 홈에 예약 글 없음", (await visitor.getByText(`${tag} 예약 글`).count()) === 0);
await visitor.goto(`${BASE}/feed`);
check("방문자: 마을 소식에 예약 글 없음", (await visitor.getByText(`${tag} 예약 글`).count()) === 0);

// 시각이 지나면 누구나 본다
await db.query("UPDATE posts SET created_at = now() - interval '1 minute' WHERE id = $1", [scheduledId]);
res = await visitor.goto(`${BASE}/@${writer}/${scheduledId}`);
check("시각이 지나면 방문자도 글을 연다", res.status() === 200);
await visitor.goto(`${BASE}/feed`);
check("시각이 지나면 마을 소식에 나온다", await visitor.getByText(`${tag} 예약 글`).first().isVisible());
await page.goto(`${BASE}/@${writer}/${scheduledId}`);
check("올라간 글에는 예약 안내가 없다", (await page.getByText(/예약 글이에요/).count()) === 0);
await page.goto(`${BASE}/write/${scheduledId}`);
await page.locator(".ProseMirror").waitFor();
check("이미 올라간 글을 고칠 때는 올리는 때를 고르지 않는다", (await page.getByRole("radio", { name: "⏰ 예약하기" }).count()) === 0);

// ===== 3) 예약 글을 고쳐서 시각을 바꾸거나 바로 올린다 =====
await write(page, { title: `${tag} 바로 올릴 글`, schedule: true });
await page.getByRole("button", { name: "예약하기", exact: true }).click();
await page.waitForURL(/\?new=/);
const laterId = postIdOf(page.url());
await page.goto(`${BASE}/@${writer}/${laterId}`);
check("예약 글을 다시 열면 `나만 볼 수 있어요` 안내", await page.getByText(/예약 글이에요/).isVisible());
await page.goto(`${BASE}/write/${laterId}`);
await page.locator(".ProseMirror").waitFor();
check("예약 글을 고칠 때는 예약이 골라져 있다", (await page.getByRole("radio", { name: "⏰ 예약하기" }).getAttribute("aria-checked")) === "true");
await page.locator('input[name="publishAt"]').fill("2099-01-01T09:00");
await page.getByRole("button", { name: "수정 완료" }).click();
await page.getByText("예약은 365일 안으로만 할 수 있어요").waitFor({ timeout: 10000 });
check("시각이 1년 넘게 뒤면 막는다", true);
await page.getByRole("radio", { name: "지금 올리기" }).click();
await page.getByRole("button", { name: "수정 완료" }).click();
await page.waitForURL(new RegExp(`/@${writer}/${laterId}$`));
const { rows: [row2] } = await db.query("SELECT created_at <= now() AS live FROM posts WHERE id = $1", [laterId]);
check("예약 글을 `지금 올리기`로 고치면 바로 올라간다", row2.live === true);
res = await visitor.goto(`${BASE}/@${writer}/${laterId}`);
check("바로 올린 글을 방문자가 연다", res.status() === 200);

// ===== 4) 관리자 글의 광장 게시판 게시 시간 =====
const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const adminErrors = collectErrors(admin);
await admin.goto(BASE);
await admin.getByLabel("아이디").fill(ADMIN.username);
await admin.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
await admin.getByRole("button", { name: "로그인", exact: true }).click();
await admin.waitForURL(/town/);

await write(admin, { title: `${tag} 공지 3시간` });
const pinSelect = admin.getByLabel("📌 광장 게시판 맨 위에 걸어 두기");
check("관리자 글쓰기의 게시 시간 기본값은 7일(168시간)", (await pinSelect.inputValue()) === "168");
await pinSelect.selectOption("3");
await admin.screenshot({ path: `${outDir}/schedule-admin-write.png`, fullPage: true });
await admin.getByRole("button", { name: "발행하기" }).click();
await admin.waitForURL(/\?new=/);
const pin3 = postIdOf(admin.url());

await write(admin, { title: `${tag} 공지 안 걸기`, pin: 0 });
await admin.getByRole("button", { name: "발행하기" }).click();
await admin.waitForURL(/\?new=/);
const pin0 = postIdOf(admin.url());
const { rows: pins } = await db.query("SELECT id, pin_hours FROM posts WHERE id = ANY($1) ORDER BY id", [[pin3, pin0]]);
check(`DB: 게시 시간 3, 0 (${JSON.stringify(pins)})`, pins[0].pin_hours === 3 && pins[1].pin_hours === 0);

// 두 공지보다 나중에 쓴 주민 글
const other = await fakeMember(db, `so${tag}`);
await fakePost(db, other.blogId, { title: `${tag} 주민 새 글` });
const feedTitles = async () => {
  await visitor.goto(`${BASE}/feed`);
  return visitor.locator("article h3").allInnerTexts();
};
// 맨 위에 걸린 글은 가장 최근의 주민 새 글보다 위에 있다 (앞선 실행에서 남은 공지가 있어도 되게 이 실행의 글끼리 비교한다)
const above = (titles, title) => titles.includes(title) && titles.indexOf(title) < titles.indexOf(`${tag} 주민 새 글`);
let titles = await feedTitles();
check(`마을 소식: 3시간 공지가 맨 위 (${titles.slice(0, 3).join(" / ")})`, above(titles, `${tag} 공지 3시간`));
check("마을 소식: 걸지 않은 공지는 주민 새 글보다 아래", titles.indexOf(`${tag} 공지 안 걸기`) > titles.indexOf(`${tag} 주민 새 글`));
await visitor.screenshot({ path: `${outDir}/schedule-feed.png` });

// 3시간이 지나면 맨 위에서 내려온다
await db.query("UPDATE posts SET created_at = now() - interval '3 hours 1 minute' WHERE id = $1", [pin3]);
titles = await feedTitles();
check("3시간이 지나면 공지가 맨 위에서 내려온다", !above(titles, `${tag} 공지 3시간`));

// 고칠 때 게시 시간을 바꾼다 (올라간 때부터 다시 센다)
await admin.goto(`${BASE}/write/${pin3}`);
await admin.locator(".ProseMirror").waitFor();
check("관리자 글을 고칠 때 지금 게시 시간이 골라져 있다", (await pinSelect.inputValue()) === "3");
await pinSelect.selectOption("24");
await admin.getByRole("button", { name: "수정 완료" }).click();
await admin.waitForURL(new RegExp(`/@[^/]+/${pin3}$`));
titles = await feedTitles();
check("게시 시간을 하루로 늘리면 다시 맨 위", above(titles, `${tag} 공지 3시간`));

// 관리자 예약 공지: 올라가기 전엔 안 보이고, 올라간 때부터 걸린다
await write(admin, { title: `${tag} 예약 공지`, schedule: true, pin: 6 });
await admin.getByRole("button", { name: "예약하기", exact: true }).click();
await admin.waitForURL(/\?new=/);
const scheduledNotice = postIdOf(admin.url());
titles = await feedTitles();
check("예약 공지는 올라가기 전 마을 소식에 없다", !titles.includes(`${tag} 예약 공지`));
await db.query("UPDATE posts SET created_at = now() - interval '1 minute' WHERE id = $1", [scheduledNotice]);
titles = await feedTitles();
check("예약 공지가 올라가면 맨 위", above(titles, `${tag} 예약 공지`));

// 휴대폰 화면 글쓰기
const phone = await (await browser.newContext({ viewport: { width: 375, height: 800 }, storageState: await ctx.storageState() })).newPage();
await write(phone, { title: `${tag} 폰`, schedule: true });
await phone.locator('input[name="publishAt"]').scrollIntoViewIfNeeded();
await phone.screenshot({ path: `${outDir}/schedule-write-phone.png` });
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check("휴대폰 글쓰기 화면이 옆으로 넘치지 않는다", !overflow);

check(`콘솔 오류 없음 ${[...errors, ...adminErrors].join(" | ")}`, errors.length + adminErrors.length === 0);
console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
