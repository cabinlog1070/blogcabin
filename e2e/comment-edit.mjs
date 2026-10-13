// 댓글 수정 (SOC-01): 내 댓글·답글만 [수정]이 보이고, 고치면 "수정됨"이 붙는다. 남의 댓글은 고칠 수 없다
import { chromium } from "@playwright/test";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch();

// --- 글쓴이(tester1)의 글에 tester2가 댓글을 단다 ---
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctxA.newPage();
const errA = collectErrors(a);
await loginDev(a, "tester1");
const { rows: [blog] } = await db.query("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE b.slug = 'tester1'");
const { rows: [post] } = await db.query(
  "INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, '댓글 수정 시험', '<p>본문</p>', '본문') RETURNING id",
  [blog.id],
);
const postUrl = `${BASE}/@tester1/${post.id}`;

const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const b = await ctxB.newPage();
const errB = collectErrors(b);
await loginDev(b, "tester2", "긴 머리");
await b.goto(postUrl);
await b.getByPlaceholder(/따뜻한 댓글/).fill("처음 쓴 댓글");
await b.getByRole("button", { name: "댓글 등록" }).click();
await b.getByText("처음 쓴 댓글").waitFor();

// 글쓴이가 답글을 단다
await a.goto(postUrl);
await a.getByRole("button", { name: "답글", exact: true }).click();
await a.getByPlaceholder("답글을 남겨 주세요").fill("주인 답글");
await a.getByRole("button", { name: "답글 등록" }).click();
await a.getByText("주인 답글").waitFor();

// 글쓴이(블로그 주인)에게는 남의 댓글에 [삭제]만 있고 [수정]은 없다. 자기 답글에는 [수정]
const theirs = a.locator('[id^="comment-"]', { hasText: "처음 쓴 댓글" }).first();
if (await theirs.getByRole("button", { name: "수정", exact: true }).count()) throw new Error("남의 댓글에 [수정]이 보여요");
const mine = a.locator('[id^="comment-"]', { hasText: "주인 답글" });
await mine.getByRole("button", { name: "수정", exact: true }).click();
await mine.getByLabel("댓글 수정").fill("고친 주인 답글");
await mine.getByRole("button", { name: "수정 완료" }).click();
await a.getByText("고친 주인 답글").waitFor();
if (!(await a.locator('[id^="comment-"]', { hasText: "고친 주인 답글" }).locator("[data-edited]").isVisible())) {
  throw new Error("고친 답글에 '수정됨'이 없어요");
}

// tester2가 자기 댓글을 고친다. 취소하면 그대로, 같은 내용으로 저장하면 "수정됨"이 붙지 않는다
await b.reload();
const own = b.locator('[id^="comment-"]', { hasText: "처음 쓴 댓글" }).first();
await own.getByRole("button", { name: "수정", exact: true }).click();
await own.getByLabel("댓글 수정").fill("취소할 내용");
await own.getByRole("button", { name: "취소" }).click();
await b.getByText("처음 쓴 댓글").waitFor();
await own.getByRole("button", { name: "수정", exact: true }).click();
await own.getByRole("button", { name: "수정 완료" }).click();
await own.getByRole("button", { name: "수정", exact: true }).waitFor();
const { rows: [same] } = await db.query("SELECT edited_at FROM comments WHERE post_id = $1 ORDER BY id LIMIT 1", [post.id]);
if (same.edited_at) throw new Error("내용이 같은데 '수정됨'이 붙었어요");

await own.getByRole("button", { name: "수정", exact: true }).click();
await own.getByLabel("댓글 수정").fill("  ");
await own.getByRole("button", { name: "수정 완료" }).click(); // 빈칸은 브라우저가 막지 않으니 서버 메시지
await own.getByText("댓글을 적어 주세요").waitFor();
await own.getByLabel("댓글 수정").fill("고친 댓글이에요\n두 줄로");
await own.getByRole("button", { name: "수정 완료" }).click();
await b.getByText("고친 댓글이에요").waitFor();
await b.reload();
const edited = b.locator('[id^="comment-"]', { hasText: "고친 댓글이에요" }).first();
await edited.locator("[data-edited]").first().waitFor();
await b.screenshot({ path: `${outDir}/comment-edit.png`, fullPage: true });

const { rows } = await db.query("SELECT content, edited_at FROM comments WHERE post_id = $1 ORDER BY id", [post.id]);
console.log("DB:", rows.map((r) => [r.content, Boolean(r.edited_at)]));
if (rows[0].content.replace(/\r\n/g, "\n") !== "고친 댓글이에요\n두 줄로" || !rows[0].edited_at) throw new Error("댓글이 DB에 고쳐지지 않았어요");

// 일본어 화면
await db.query("UPDATE users SET locale = 'ja' WHERE username = 'tester2'");
await ctxB.addCookies([{ name: "lang", value: "ja", url: BASE }]);
await b.reload();
await b.getByText("編集済み").first().waitFor();
await b.screenshot({ path: `${outDir}/comment-edit-ja.png`, fullPage: true });

console.log("errors:", [...errA, ...errB].length ? [...errA, ...errB] : "none");
await browser.close();
await db.end();
