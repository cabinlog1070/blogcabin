// @ 이웃 목록 (SOC-06): 댓글·글쓰기에서 @를 치면 내가 이웃한 사람(캐릭터·닉네임·@주소)이 뜨고, 고르면 "@주소 "가 들어간다
import { chromium } from "@playwright/test";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch();
const check = (ok, what) => {
  if (!ok) throw new Error(what);
  console.log(`✅ ${what}`);
};

// 이웃이 될 두 사람
for (const id of ["tester2", "tester3"]) {
  const ctx = await browser.newContext();
  await loginDev(await ctx.newPage(), id, "긴 머리");
  await ctx.close();
}
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctx.newPage();
const errs = collectErrors(a);
await loginDev(a, "tester1");
const uid = async (u) => (await db.query("SELECT id FROM users WHERE username = $1", [u])).rows[0].id;
const me = await uid("tester1");
await db.query("DELETE FROM follows WHERE follower_id = $1", [me]);
await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, false), ($1, $3, true)", [me, await uid("tester2"), await uid("tester3")]);
const { rows: [blog] } = await db.query("SELECT id FROM blogs WHERE slug = 'tester1'");
const { rows: [post] } = await db.query("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, '@ 목록 시험', '<p>본문</p>', '본문') RETURNING id", [blog.id]);

// 댓글
await a.goto(`${BASE}/@tester1/${post.id}`);
const box = a.getByPlaceholder(/따뜻한 댓글/);
await box.click();
await box.pressSequentially("우와 @");
const list = a.locator("[data-mention-list]");
await list.waitFor();
const names = await list.locator('[role="option"]').allInnerTexts();
check(names.length === 2 && names[0].includes("tester3"), `@를 치면 이웃 2명, 즐겨찾기 먼저 (${names.map((n) => n.replace(/\s+/g, " ")).join(" / ")})`);
await a.locator("#comments").screenshot({ path: `${outDir}/mention-picker-comment.png` });
await box.pressSequentially("tester2");
check((await list.locator('[role="option"]').count()) === 1, "글자를 더 치면 좁혀진다");
await box.press("Enter");
check((await box.inputValue()) === "우와 @tester2 ", "Enter로 고르면 @주소 와 띄어쓰기가 들어간다");
check(!(await list.isVisible()), "고르면 목록이 닫힌다");
await box.pressSequentially("그리고 @zzz");
check(!(await list.isVisible()), "맞는 이웃이 없으면 목록이 없다");
await box.fill("");
await box.pressSequentially("@t");
await list.waitFor();
await box.press("Escape");
check(!(await list.isVisible()), "Esc로 닫는다");
await box.fill("메일 a@t");
check(!(await list.isVisible()), "메일 주소의 @에는 뜨지 않는다");
await box.fill("");
await box.pressSequentially("안녕 @");
await list.locator('[role="option"]', { hasText: "tester3" }).click();
check((await box.inputValue()) === "안녕 @tester3 ", "눌러서 고른다");
await a.getByRole("button", { name: "댓글 등록" }).click();
await a.locator('#comments a[data-mention][href="/@tester3"]').waitFor();
check(true, "등록한 댓글의 @tester3 이 링크");

// 글쓰기 본문
await a.goto(`${BASE}/write`);
const ed = a.locator(".ProseMirror");
await ed.click();
await a.keyboard.type("오늘 산책은 @");
await list.waitFor();
await a.screenshot({ path: `${outDir}/mention-picker-write.png` });
await a.keyboard.press("ArrowDown");
await a.keyboard.press("Enter");
const text = await ed.innerText();
check(text.includes("오늘 산책은 @tester2 ") || text.includes("오늘 산책은 @tester2 "), `글쓰기에서도 고르면 들어간다 (${JSON.stringify(text)})`);
check((await ed.locator("p").count()) === 1, "Enter로 골라도 줄이 바뀌지 않는다");

// 휴대폰
const phoneCtx = await browser.newContext({ viewport: { width: 375, height: 800 }, storageState: await ctx.storageState() });
const p = await phoneCtx.newPage();
await p.goto(`${BASE}/@tester1/${post.id}`);
const pbox = p.getByPlaceholder(/따뜻한 댓글/);
await pbox.click();
await pbox.pressSequentially("@");
const plist = p.locator("[data-mention-list]");
await plist.waitFor();
const r = await plist.boundingBox();
check(r.x >= 0 && r.x + r.width <= 375, "휴대폰에서 목록이 화면 밖으로 넘치지 않는다");
await plist.scrollIntoViewIfNeeded();
await p.screenshot({ path: `${outDir}/mention-picker-phone.png` });

console.log("errors:", errs.length ? errs : "none");
await browser.close();
await db.end();
