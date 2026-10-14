// 관리자 회원 관리: 회원 검색 → 회원 상세 → 댓글·글 삭제 → 강제 탈퇴 (로그인 중이던 회원은 바로 로그아웃)
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

// 준비: 로그인할 수 있는 회원(강제 탈퇴 대상)과 그 회원이 다른 블로그 글에 단 댓글
const victimId = `amv${tag}`;
const victimCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const victim = await victimCtx.newPage();
await loginDev(victim, victimId);
const { rows: [v] } = await db.query("SELECT u.id, b.id AS blog_id FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [victimId]);
const other = await fakeMember(db, `amo${tag}`);
const otherPost = await fakePost(db, other.blogId, { title: `남의 글 ${tag}` });
const victimPost = await fakePost(db, v.blog_id, { title: `지울 글 ${tag}` });
await fakePost(db, v.blog_id, { title: `남을 글 ${tag}` });
const { rows: [c1] } = await db.query("INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING id", [otherPost, v.id, `지울 댓글 ${tag}`]);
await db.query("INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3)", [otherPost, v.id, `남을 댓글 ${tag}`]);

// 관리자
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
await page.locator("[data-admin-members-link]").click();
await page.waitForURL(/\/admin\/members$/);
check("관리자 화면 → 회원 관리 버튼", true);

await page.getByLabel("회원 검색").fill(victimId);
await page.getByRole("button", { name: "검색" }).click();
await page.waitForURL(/q=/);
const found = page.locator("[data-admin-members] tbody tr");
check("아이디로 검색하면 그 회원 한 명", (await found.count()) === 1 && (await found.first().innerText()).includes(victimId));
await page.screenshot({ path: `${outDir}/am-1-search.png`, fullPage: true });

await found.first().getByRole("link").first().click();
await page.waitForURL(/\/admin\/members\/.+/);
check("회원 상세에 글 2개", (await page.locator("[data-admin-member-posts] tbody tr").count()) === 2);
check("회원 상세에 댓글 2개", (await page.locator("[data-admin-member-comments] tbody tr").count()) === 2);
await page.screenshot({ path: `${outDir}/am-2-detail.png`, fullPage: true });

await page.locator("[data-admin-member-comments] tr", { hasText: `지울 댓글 ${tag}` }).getByRole("button", { name: "삭제" }).click();
await page.locator("[data-admin-member-comments] tbody tr").nth(1).waitFor({ state: "detached" });
const { rows: [c1row] } = await db.query("SELECT deleted_at FROM comments WHERE id = $1", [c1.id]);
check("댓글 삭제 → 삭제 표시", c1row.deleted_at !== null);

await page.locator("[data-admin-member-posts] tr", { hasText: `지울 글 ${tag}` }).getByRole("button", { name: "삭제" }).click();
await page.locator("[data-admin-member-posts] tbody tr").nth(1).waitFor({ state: "detached" });
check("글 삭제 → DB에서 사라짐", (await db.query("SELECT 1 FROM posts WHERE id = $1", [victimPost])).rowCount === 0);

await page.locator("[data-admin-withdraw]").getByRole("button", { name: "강제 탈퇴" }).click();
await page.waitForURL(/withdrawn=/);
check("강제 탈퇴 안내", await page.getByText("강제 탈퇴시켰어요").isVisible());
check("강제 탈퇴 → 회원 행 삭제", (await db.query("SELECT 1 FROM users WHERE id = $1", [v.id])).rowCount === 0);
check("강제 탈퇴 → 남의 글에 단 댓글도 정리", (await db.query("SELECT 1 FROM comments WHERE author_id = $1", [v.id])).rowCount === 0);
await page.screenshot({ path: `${outDir}/am-3-withdrawn.png`, fullPage: true });

// 탈퇴당한 회원은 다음 이동에서 로그인 화면
// (광장은 방문자도 볼 수 있으니 회원 전용 화면으로 확인)
await victim.goto(`${BASE}/settings/blog`);
check("강제 탈퇴된 회원은 바로 로그아웃", new URL(victim.url()).pathname === "/");

// 관리자 계정은 강제 탈퇴 버튼이 없다
const { rows: [adminRow] } = await db.query("SELECT id FROM users WHERE username = $1", [ADMIN.username]);
await page.goto(`${BASE}/admin/members/${adminRow.id}`);
check("관리자 계정에는 강제 탈퇴 버튼 없음", (await page.locator("[data-admin-withdraw]").count()) === 0);

check("콘솔 오류 없음", errors.length === 0);
await db.query("DELETE FROM users WHERE id = $1", [other.uid]);
await browser.close();
await db.end();
console.log(results.join("\n"));
if (errors.length) console.log(errors);
