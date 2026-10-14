// 관리자 글 관리: 관리자 화면 → 글 관리 → 글/댓글 탭, 30일보다 오래된 글·비공개 글도 보임, 검색, 페이지 넘김, 댓글·글 삭제
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, fakePost } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);

// 준비: 회원 둘, 90일 전 글·비공개 글, 페이지가 넘어가도록 글 31개, 댓글 둘
const writer = await fakeMember(db, `acw${tag}`);
const reader = await fakeMember(db, `acr${tag}`);
const oldPost = await fakePost(db, writer.blogId, { title: `오래된 글 ${tag}`, minutesAgo: 90 * 24 * 60 });
await fakePost(db, writer.blogId, { title: `비공개 글 ${tag}`, visibility: "private", minutesAgo: 1 });
for (let i = 0; i < 31; i++) await fakePost(db, reader.blogId, { title: `채우기 ${tag} ${i}`, minutesAgo: 10 + i });
const { rows: [c1] } = await db.query("INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING id", [oldPost, reader.uid, `지울 댓글 ${tag}`]);
await db.query("INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3)", [oldPost, reader.uid, `남을 댓글 ${tag}`]);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
page.on("dialog", (d) => d.accept());
await page.goto(BASE);
await page.getByLabel("아이디").fill(ADMIN.username);
await page.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
await page.getByRole("button", { name: "로그인", exact: true }).click();
await page.waitForURL(/town/);

await page.goto(`${BASE}/admin`);
check("관리자 화면에 회원 관리 옆 글 관리 버튼", await page.locator("[data-admin-content-link]").isVisible());
await page.screenshot({ path: `${outDir}/ac-0-admin.png` });
await page.locator("[data-admin-content-link]").click();
await page.waitForURL(/\/admin\/content$/);

const postRows = page.locator("[data-admin-content-posts] tbody tr");
check("글 탭 첫 쪽 30개", (await postRows.count()) === 30);
check("비공개 글도 보임 (맨 위)", (await postRows.first().innerText()).includes(`비공개 글 ${tag}`));
check("페이지 번호", await page.getByRole("navigation", { name: "페이지" }).isVisible());
await page.screenshot({ path: `${outDir}/ac-1-posts.png`, fullPage: true });

await page.getByLabel("글 검색").fill(`오래된 글 ${tag}`);
await page.getByRole("button", { name: "검색" }).click();
await page.waitForURL(/q=/);
check("90일 전 글도 검색됨", (await postRows.count()) === 1 && (await postRows.first().innerText()).includes(`오래된 글 ${tag}`));

await page.locator("[data-admin-content-tabs]").getByRole("link", { name: /작성한 댓글/ }).click();
await page.waitForURL(/tab=comments/);
const commentRows = page.locator("[data-admin-content-comments] tbody tr");
check("댓글 탭: 탭을 바꾸면 검색어는 비움", !page.url().includes("q="));
check("댓글 탭에 댓글이 보임", (await commentRows.count()) >= 2 && (await commentRows.first().innerText()).includes(tag));
await page.screenshot({ path: `${outDir}/ac-2-comments.png`, fullPage: true });

await page.getByLabel("댓글 검색").fill(tag);
await page.getByRole("button", { name: "검색" }).click();
await page.waitForURL(/q=/);
check("댓글 검색 2개, 탭 유지", (await commentRows.count()) === 2 && page.url().includes("tab=comments"));
await commentRows.filter({ hasText: `지울 댓글 ${tag}` }).getByRole("button", { name: "삭제" }).click();
await commentRows.nth(1).waitFor({ state: "detached" });
check("댓글 삭제 → 삭제 표시", (await db.query("SELECT deleted_at FROM comments WHERE id = $1", [c1.id])).rows[0].deleted_at !== null);

await page.goto(`${BASE}/admin/content?page=2`);
check("2쪽에 남은 글", (await postRows.count()) >= 3);
const firstOnPage2 = await postRows.first().innerText();
await postRows.first().getByRole("button", { name: "삭제" }).click();
await page.waitForFunction((t) => !document.querySelector("[data-admin-content-posts] tbody tr")?.textContent?.includes(t.split("\t")[0]), firstOnPage2);
check("글 삭제", true);

// 휴대폰: 카드로
const phone = await browser.newContext({ viewport: { width: 375, height: 760 }, storageState: await ctx.storageState() });
const p2 = await phone.newPage();
await p2.goto(`${BASE}/admin/content?tab=comments`);
check("휴대폰은 카드 목록", await p2.locator("[data-admin-content-comment-list]").isVisible());
check("휴대폰 가로 넘침 없음", await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await p2.screenshot({ path: `${outDir}/ac-3-phone.png`, fullPage: true });
await p2.goto(`${BASE}/admin/content`);
await p2.screenshot({ path: `${outDir}/ac-4-phone-posts.png` });

// 일본어
await ctx.addCookies([{ name: "lang", value: "ja", url: BASE }]);
await page.goto(`${BASE}/admin/content`);
check("일본어 탭", await page.getByText("投稿した記事").first().isVisible());
await page.screenshot({ path: `${outDir}/ac-5-ja.png` });

check("콘솔 오류 없음", errors.length === 0);
await db.query("DELETE FROM comments WHERE author_id = ANY($1)", [[writer.uid, reader.uid]]);
await db.query("DELETE FROM users WHERE id = ANY($1)", [[writer.uid, reader.uid]]);
await browser.close();
await db.end();
console.log(results.join("\n"));
if (errors.length) console.log(errors);
