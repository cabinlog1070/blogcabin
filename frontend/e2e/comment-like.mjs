// 댓글 하트 (SOC-01): [답글] 앞 하트를 누르면 채워지고 수가 오른다. 다시 누르면 취소. 로그인 전에는 수만 보인다
// 답글에 답글: 답글에도 [답글]이 있고, 상대 @주소가 미리 들어가며 같은 원댓글 아래에 모인다. 상대에게 답글 알림
import { chromium } from "@playwright/test";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch();

const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctxA.newPage();
const errA = collectErrors(a);
await loginDev(a, "tester1");
const { rows: [blog] } = await db.query("SELECT b.id FROM blogs b WHERE b.slug = 'tester1'");
const { rows: [post] } = await db.query(
  "INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, '댓글 하트 시험', '<p>본문</p>', '본문') RETURNING id",
  [blog.id],
);
const postUrl = `${BASE}/@tester1/${post.id}`;

const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const b = await ctxB.newPage();
const errB = collectErrors(b);
await loginDev(b, "tester2", "긴 머리");
await b.goto(postUrl);
await b.getByPlaceholder(/따뜻한 댓글/).fill("냐냐냥!!!!");
await b.getByRole("button", { name: "댓글 등록" }).click();
await b.getByText("냐냐냥!!!!").waitFor();

await a.goto(postUrl);
await a.getByRole("button", { name: "답글", exact: true }).click();
await a.getByPlaceholder("답글을 남겨 주세요").fill("ㅋㅋㅋ 귀여워");
await a.getByRole("button", { name: "답글 등록" }).click();
await a.getByText("ㅋㅋㅋ 귀여워").waitFor();

const heartOf = (page, text) => page.locator('[id^="comment-"]', { hasText: text }).first().locator("[data-comment-heart]").first();
const count = (commentText) =>
  db.query("SELECT COUNT(*)::int AS n FROM comment_likes l JOIN comments c ON c.id = l.comment_id WHERE c.content = $1 AND c.post_id = $2", [commentText, post.id]).then((r) => r.rows[0].n);

// 하트는 [답글] 앞에, 처음엔 숫자 없이
const heart = heartOf(a, "냐냐냥!!!!");
if ((await heart.innerText()).trim() !== "♡") throw new Error(`처음 하트 모양이 달라요: ${await heart.innerText()}`);
await heart.click();
await a.waitForFunction(() => document.querySelector('[data-comment-heart][aria-pressed="true"]'));
for (let i = 0; i < 20 && (await count("냐냐냥!!!!")) !== 1; i++) await a.waitForTimeout(100);
if ((await count("냐냐냥!!!!")) !== 1) throw new Error("하트가 DB에 저장되지 않았어요");
await a.reload();
if ((await heartOf(a, "냐냐냥!!!!").innerText()).replace(/\s/g, "") !== "♥1") throw new Error("새로 고친 뒤 채운 하트 1이 아니에요");

// tester2도 같은 댓글과 답글에 누른다
await b.reload();
await heartOf(b, "냐냐냥!!!!").click();
await heartOf(b, "ㅋㅋㅋ 귀여워").click();
await b.waitForTimeout(500);
await b.reload();
if ((await heartOf(b, "냐냐냥!!!!").innerText()).replace(/\s/g, "") !== "♥2") throw new Error("두 사람이 누른 수가 2가 아니에요");
await b.locator("#comments").screenshot({ path: `${outDir}/comment-like.png` });

// 다시 누르면 취소
await heartOf(b, "냐냐냥!!!!").click();
await b.waitForTimeout(500);
if ((await count("냐냐냥!!!!")) !== 1) throw new Error("하트 취소가 안 됐어요");

// 답글에 답글: tester1의 답글에 tester2가 [답글] → @tester1 이 미리 들어가 있다
const replyRow = b.locator('[id^="comment-"]', { hasText: "ㅋㅋㅋ 귀여워" }).first();
await replyRow.getByRole("button", { name: "답글", exact: true }).click();
const box = replyRow.getByPlaceholder("답글을 남겨 주세요");
if ((await box.inputValue()) !== "@tester1 ") throw new Error(`답글 칸에 @주소가 없어요: ${await box.inputValue()}`);
await box.pressSequentially("나도 그렇게 생각해!");
await replyRow.getByRole("button", { name: "답글 등록" }).click();
await b.getByText("나도 그렇게 생각해!").waitFor();
const { rows: thread } = await db.query("SELECT content, parent_id FROM comments WHERE post_id = $1 ORDER BY id", [post.id]);
const rootId = (await db.query("SELECT id FROM comments WHERE post_id = $1 AND parent_id IS NULL", [post.id])).rows[0].id;
if (thread[2].content !== "@tester1 나도 그렇게 생각해!" || thread[2].parent_id !== rootId) throw new Error(`답글에 단 답글이 이상해요: ${JSON.stringify(thread[2])}`);
const { rows: noti } = await db.query(
  "SELECT n.kind FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.username = 'tester1' AND n.post_id = $1 AND n.kind IN ('reply','mention')",
  [post.id],
);
if (noti.length !== 1 || noti[0].kind !== "reply") throw new Error(`tester1 알림이 답글 한 번이 아니에요: ${JSON.stringify(noti)}`);
await b.locator("#comments").screenshot({ path: `${outDir}/comment-reply-reply.png` });

// 로그인 전: 수만 보이고 버튼이 아니다
const ctxC = await browser.newContext({ viewport: { width: 375, height: 800 } });
const c = await ctxC.newPage();
await c.goto(postUrl);
const guest = heartOf(c, "냐냐냥!!!!");
if ((await guest.evaluate((el) => el.tagName)) === "BUTTON") throw new Error("손님에게 하트 버튼이 보여요");
if ((await guest.innerText()).replace(/\s/g, "") !== "♡1") throw new Error("손님에게 하트 수가 안 보여요");
await c.locator("#comments").screenshot({ path: `${outDir}/comment-like-guest-phone.png` });

// 지운 댓글에는 누를 수 없다 (API)
const { rows: [reply] } = await db.query("SELECT id FROM comments WHERE post_id = $1 AND content = 'ㅋㅋㅋ 귀여워'", [post.id]);
await db.query("UPDATE comments SET deleted_at = now() WHERE id = $1", [reply.id]);
const res = await b.request.post(`${BASE}/api/v1/blog/comments/${reply.id}/like`, { headers: { origin: BASE } });
if (res.status() !== 404) throw new Error(`지운 댓글 하트가 ${res.status()}`);

// 일본어
await ctxB.addCookies([{ name: "lang", value: "ja", url: BASE }]);
await db.query("UPDATE users SET locale = 'ja' WHERE username = 'tester2'");
await b.reload();
await b.locator('[data-comment-heart][aria-label^="ハート"]').first().waitFor();

console.log("errors:", [...errA, ...errB].length ? [...errA, ...errB] : "none");
await browser.close();
await db.end();
