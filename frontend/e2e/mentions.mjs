// @주소 언급 (2026-10-15): 글·댓글의 @블로그주소는 그 블로그로 가는 링크가 되고, 언급된 회원에게 알림이 간다.
// 없는 주소는 글자 그대로, 고쳐 저장해도 같은 사람에게 알림이 두 번 가지 않는다
import { chromium } from "@playwright/test";
import pg from "pg";
import { BASE, collectErrors, fakeMember, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch();
const one = async (q, p) => (await db.query(q, p)).rows[0];

// 언급만 받을 회원 (로그인하지 않음)
await db.query("DELETE FROM users WHERE id = 'fk_mentionee'");
const third = await fakeMember(db, "mentionee");

const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctxA.newPage();
const errA = collectErrors(a);
await loginDev(a, "tester1");
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const b = await ctxB.newPage();
const errB = collectErrors(b);
await loginDev(b, "tester2", "긴 머리");
const { id: tester2 } = await one("SELECT owner_id AS id FROM blogs WHERE slug = 'tester2'");

/** 브라우저에서 글 저장 API를 부른다 (글쓰기 화면이 보내는 것과 같은 값) */
const savePost = (page, body, id) =>
  page.evaluate(
    async ([body, id]) => {
      const res = await fetch(id ? `/api/v1/posts/${id}` : "/api/v1/posts", {
        method: id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    [body, id],
  );
const content = "<p>오늘 @tester2 님이랑 @mentionee 님, 그리고 없는 @nobody_here 님을 불러요. 메일 me@tester2.com</p><p><code>@tester2</code></p>";
const post = { title: "언급 시험", contentHtml: content, tags: "", visibility: "public", publishMode: "now" };
const saved = await savePost(a, post);
if (!saved.ok) throw new Error(`글 저장 실패: ${JSON.stringify(saved)}`);
const postUrl = `${BASE}/@tester1/${saved.postId}`;

const mentionCount = async (userId, refNull = true) =>
  Number(
    (
      await one(
        `SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND kind = 'mention' AND post_id = $2 AND ref_id IS ${refNull ? "" : "NOT "}NULL`,
        [userId, saved.postId],
      )
    ).n,
  );
if ((await mentionCount(tester2)) !== 1 || (await mentionCount(third.uid)) !== 1) throw new Error("글 언급 알림이 한 번씩 가지 않았어요");

// 읽는 화면: 있는 주소만 링크 (코드 안·메일 주소는 그대로)
await a.goto(postUrl);
const links = await a.locator(".prose-blog a[data-mention]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
if (JSON.stringify(links) !== JSON.stringify(["/@tester2", "/@mentionee"])) throw new Error(`언급 링크가 달라요: ${links}`);
if (await a.locator('.prose-blog a[data-mention][target]').count()) throw new Error("언급 링크가 새 탭으로 열려요");
await a.locator(".prose-blog").screenshot({ path: `${outDir}/mention-post.png` });

// 같은 내용으로 고쳐 저장해도 알림은 그대로 한 번
const again = await savePost(a, post, saved.postId);
if (!again.ok || (await mentionCount(tester2)) !== 1) throw new Error("고쳐 저장했더니 언급 알림이 또 갔어요");

// tester2가 댓글에서 tester1(글 주인, 댓글 알림만)과 mentionee를 언급
await b.goto(postUrl);
await b.getByPlaceholder(/따뜻한 댓글/).fill("@tester1 님 글 좋아요! @mentionee 님도 보세요 @nobody_here");
await b.getByRole("button", { name: "댓글 등록" }).click();
const comment = b.locator('[id^="comment-"]', { hasText: "글 좋아요" }).first();
await comment.locator("a[data-mention]").first().waitFor();
const commentLinks = await comment.locator("a[data-mention]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
if (JSON.stringify(commentLinks) !== JSON.stringify(["/@tester1", "/@mentionee"])) throw new Error(`댓글 언급 링크가 달라요: ${commentLinks}`);
const { id: tester1 } = await one("SELECT owner_id AS id FROM blogs WHERE slug = 'tester1'");
if ((await mentionCount(tester1, false)) !== 0) throw new Error("글 주인에게 댓글 알림과 언급 알림이 둘 다 갔어요");
if ((await mentionCount(third.uid, false)) !== 1) throw new Error("댓글 언급 알림이 가지 않았어요");
await comment.screenshot({ path: `${outDir}/mention-comment.png` });

// 언급 링크를 누르면 그 블로그로
await comment.getByRole("link", { name: "@tester1" }).click();
await b.waitForURL(/\/@tester1$/);

// tester2의 알림함에 언급 알림
await b.goto(`${BASE}/notifications`);
await b.getByText(/tester1님이 「언급 시험」에서 나를 언급했어요/).waitFor();
await b.screenshot({ path: `${outDir}/mention-notifications.png` });
await b.getByText(/에서 나를 언급했어요/).click();
await b.waitForURL(new RegExp(`/@tester1/${saved.postId}`));

// 일본어 알림 문구
await b.evaluate(() => fetch("/api/v1/locale", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: "ja" }) }));
await b.goto(`${BASE}/notifications`);
await b.getByText(/であなたをメンションしました/).first().waitFor();
await b.screenshot({ path: `${outDir}/mention-notifications-ja.png` });
await b.evaluate(() => fetch("/api/v1/locale", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: "ko" }) }));

// 비공개 글의 언급은 그 글을 볼 수 없는 사람에게 알리지 않는다
const priv = await savePost(a, { ...post, title: "비공개 언급", visibility: "private" });
const { n } = await one("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'mention' AND post_id = $1", [priv.postId]);
if (Number(n) !== 0) throw new Error("볼 수 없는 비공개 글 언급 알림이 갔어요");

const errors = [...errA, ...errB];
if (errors.length) throw new Error(errors.join("\n"));
await db.query("DELETE FROM posts WHERE id = ANY($1)", [[saved.postId, priv.postId]]);
await db.query("DELETE FROM users WHERE id = 'fk_mentionee'");
console.log("✅ mentions: 글·댓글 언급 링크, 알림 한 번씩, 글 주인 중복 없음, 비공개 글 제외, 일본어 문구");
await browser.close();
await db.end();
