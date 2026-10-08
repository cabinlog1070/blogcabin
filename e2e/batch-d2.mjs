// 배치 D (2): 임시 저장(POST-08), 조회수 하루 1번(POST-06), 비공개 글 첨부 막기(POST-07·09), 회원 탈퇴(AUTH-06), 로그인 시도 제한(NF-10)
// 사용: 개발 서버를 띄운 상태에서 BASE_URL=http://localhost:3100 node e2e/batch-d2.mjs <스크린샷 폴더>
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakePost, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const all = async (q, p = []) => (await db.query(q, p)).rows;
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);

const tag = Date.now().toString(36).slice(-5);
const PW = "test-password-1234";
const browser = await chromium.launch();
const errorsAll = [];
const DESKTOP = { width: 1280, height: 900 };

async function member(id, { viewport = DESKTOP, ctx } = {}) {
  ctx ??= await browser.newContext({ viewport });
  const page = await ctx.newPage();
  errorsAll.push(collectErrors(page));
  await loginDev(page, id);
  const { id: uid } = await one("SELECT id FROM users WHERE username = $1", [id]);
  const { id: blogId } = await one("SELECT id FROM blogs WHERE owner_id = $1", [uid]);
  return { ctx, page, uid, blogId };
}
async function visitor() {
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  errorsAll.push(collectErrors(page));
  return { ctx, page };
}
async function signOut(page) {
  // 로그아웃은 헤더 상태창(내 정보 메뉴) 안에 있다
  await page.getByRole("banner").locator("[data-status-card]").click();
  await page.locator("[data-profile-menu]").getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
}
/** 첫 화면 로그인 폼으로 한 번 시도하고, 보이는 문구(없으면 이동한 주소)를 돌려준다 */
async function tryLogin(page, id, password) {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  const msg = page.getByText(/아이디 또는 비밀번호가 맞지 않아요|로그인을 너무 많이 시도했어요/);
  await msg.or(page.locator("canvas, [data-town-menu]:visible, input[name=nickname]")).first().waitFor({ timeout: 20000 });
  return (await msg.count()) ? msg.innerText() : new URL(page.url()).pathname;
}

try {
  // ════════ POST-08 임시 저장 ════════
  const A = `ea${tag}`;
  const a = await member(A);
  const key = `blogcabin:draft:${a.uid}`;
  const draft = () => a.page.evaluate((k) => localStorage.getItem(k), key);
  const { id: catId } = await one("SELECT id FROM categories WHERE blog_id = $1 LIMIT 1", [a.blogId]);

  let asked = 0;
  let answer = "accept";
  a.page.on("dialog", async (d) => {
    if (d.message() === "작성 중이던 글이 있어요. 불러올까요?") asked++;
    await (answer === "accept" ? d.accept() : d.dismiss());
  });
  await a.page.goto(`${BASE}/write`);
  await a.page.locator(".ProseMirror").waitFor();
  check("POST-08 처음에는 자동 저장 안내", await a.page.getByText("작성 중인 글은 이 브라우저에 자동 저장돼요.").isVisible());
  await a.page.getByPlaceholder("제목").fill("임시 저장 시험");
  await a.page.getByLabel("카테고리").selectOption(String(catId));
  await a.page.getByRole("radio", { name: "🔒 비공개" }).click();
  await a.page.locator(".ProseMirror").click();
  await a.page.keyboard.press("ControlOrMeta+b");
  await a.page.keyboard.type("굵은 글");
  await a.page.keyboard.press("ControlOrMeta+b");
  await a.page.keyboard.type(" 그리고 보통 글");
  await a.page.getByLabel("태그").fill("임시, 저장");
  check("POST-08 2초가 지나기 전에는 저장하지 않음", (await draft()) === null);
  await a.page.getByText(/임시 저장됨 \d{2}:\d{2}/).waitFor({ timeout: 5000 });
  const hm = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  check("POST-08 2초 뒤 아래 상자에 `임시 저장됨 시:분` (한국 시간)", (await a.page.locator("[data-draft-status]").innerText()).includes("임시 저장됨"), `${await a.page.locator("[data-draft-status]").innerText()} / 지금 ${hm}`);
  const saved = JSON.parse(await draft());
  check("POST-08 이 브라우저에 회원별 키로 저장", saved.title === "임시 저장 시험" && saved.tags === "임시, 저장" && saved.visibility === "private" && saved.categoryId === String(catId));
  await a.page.screenshot({ path: `${outDir}/d7-draft-saved.png` });

  // 새로고침 → 불러오기
  answer = "accept";
  await a.page.reload();
  await a.page.locator(".ProseMirror").waitFor();
  await a.page.waitForFunction(() => document.querySelector("input[name=title]")?.value === "임시 저장 시험", null, { timeout: 5000 }).catch(() => {});
  check("POST-08 다시 열면 한 번 묻는다", asked === 1, `${asked}번`);
  check(
    "POST-08 불러오면 제목·카테고리·공개 설정·본문(서식)·태그가 채워짐",
    (await a.page.getByPlaceholder("제목").inputValue()) === "임시 저장 시험" &&
      (await a.page.getByLabel("카테고리").inputValue()) === String(catId) &&
      (await a.page.getByRole("radio", { name: "🔒 비공개" }).getAttribute("aria-checked")) === "true" &&
      (await a.page.locator(".ProseMirror strong").innerText()) === "굵은 글" &&
      (await a.page.getByLabel("태그").inputValue()) === "임시, 저장",
  );
  // 불러오지 않기 → 빈 화면
  answer = "dismiss";
  await a.page.reload();
  await a.page.locator(".ProseMirror").waitFor();
  await a.page.waitForTimeout(500);
  check("POST-08 불러오지 않으면 빈 글쓰기 화면", asked === 2 && (await a.page.getByPlaceholder("제목").inputValue()) === "" && (await draft()) !== null);
  // 제목·본문이 비어 있으면 저장하지 않는다 (카테고리만 바꿈)
  await a.page.evaluate((k) => localStorage.removeItem(k), key);
  await a.page.reload();
  await a.page.locator(".ProseMirror").waitFor();
  await a.page.getByLabel("카테고리").selectOption(String(catId));
  await a.page.waitForTimeout(2600);
  await a.page.reload();
  await a.page.locator(".ProseMirror").waitFor();
  await a.page.waitForTimeout(500);
  check("POST-08 제목·본문이 비어 있으면 저장하지 않고 묻지 않음", (await draft()) === null && asked === 2);
  // 발행 실패(본문이 빈 줄뿐) → 임시 글이 남는다
  await a.page.getByPlaceholder("제목").fill("본문 없는 글");
  await a.page.locator(".ProseMirror").click();
  await a.page.keyboard.press("Enter");
  await a.page.keyboard.press("Enter");
  await a.page.waitForTimeout(2600);
  await a.page.getByRole("button", { name: "발행하기" }).click();
  await a.page.getByText("본문을 적어 주세요").waitFor();
  check("POST-08 발행이 실패하면 임시 글이 남음", JSON.parse((await draft()) ?? "{}").title === "본문 없는 글");
  // 발행 성공 → 지워진다 (마지막 입력 뒤 2초 안에 눌러도)
  await a.page.locator(".ProseMirror").click();
  await a.page.keyboard.type("이번에는 본문이 있어요");
  await a.page.getByRole("button", { name: "발행하기" }).click();
  await a.page.waitForURL(/\/@[a-z0-9_]+\/\d+\?new=/);
  await a.page.waitForTimeout(2500);
  check("POST-08 발행에 성공하면 임시 글을 지움 (2초 안에 눌러도)", (await draft()) === null);
  const editId = (await one("SELECT id FROM posts WHERE blog_id = $1 ORDER BY id DESC LIMIT 1", [a.blogId])).id;
  await a.page.goto(`${BASE}/write`);
  await a.page.locator(".ProseMirror").waitFor();
  await a.page.waitForTimeout(500);
  check("POST-08 발행 뒤 다시 열면 묻지 않음", asked === 2);
  // 글 수정 화면: 임시 저장·질문 없음
  await a.page.goto(`${BASE}/write/${editId}`);
  await a.page.locator(".ProseMirror").waitFor();
  await a.page.getByPlaceholder("제목").fill("고친 제목");
  await a.page.waitForTimeout(2600);
  check("POST-08 글 수정 화면은 임시 저장·안내 없음", (await draft()) === null && (await a.page.locator("[data-draft-status]").count()) === 0);
  // 같은 브라우저에서 회원 B로 로그인하면 A의 임시 글은 보이지 않는다
  await a.page.goto(`${BASE}/write`);
  await a.page.locator(".ProseMirror").waitFor();
  await a.page.getByPlaceholder("제목").fill("A의 임시 글");
  await a.page.getByText(/임시 저장됨/).waitFor({ timeout: 5000 });
  await signOut(a.page);
  const B = `eb${tag}`;
  const bSame = await member(B, { ctx: a.ctx });
  let askedB = 0;
  bSame.page.on("dialog", async (d) => {
    askedB++;
    await d.dismiss();
  });
  await bSame.page.goto(`${BASE}/write`);
  await bSame.page.locator(".ProseMirror").waitFor();
  await bSame.page.waitForTimeout(800);
  check("POST-08 같은 브라우저의 다른 회원(B)에게는 A의 임시 글이 보이지 않음", askedB === 0 && (await bSame.page.getByPlaceholder("제목").inputValue()) === "");
  await signOut(bSame.page);
  await bSame.page.close();
  // 다른 브라우저의 A → 묻지 않는다
  const aOther = await member(A);
  let askedOther = 0;
  aOther.page.on("dialog", async (d) => {
    askedOther++;
    await d.dismiss();
  });
  await aOther.page.goto(`${BASE}/write`);
  await aOther.page.locator(".ProseMirror").waitFor();
  await aOther.page.waitForTimeout(800);
  check("POST-08 다른 브라우저에서는 불러올지 묻지 않음", askedOther === 0);
  await aOther.ctx.close();
  // 저장소를 쓸 수 없는 브라우저 → 글쓰기·발행 정상, 오류 없음
  const blockedCtx = await browser.newContext({ viewport: DESKTOP });
  await blockedCtx.addInitScript(() => {
    const deny = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
    Storage.prototype.removeItem = deny;
  });
  const blocked = await member(B, { ctx: blockedCtx });
  await blocked.page.goto(`${BASE}/write`);
  await blocked.page.locator(".ProseMirror").waitFor();
  await blocked.page.getByPlaceholder("제목").fill("저장소 없는 글");
  await blocked.page.locator(".ProseMirror").click();
  await blocked.page.keyboard.type("저장소를 쓸 수 없어도 발행된다");
  await blocked.page.waitForTimeout(2500);
  await blocked.page.getByRole("button", { name: "발행하기" }).click();
  await blocked.page.waitForURL(/\?new=/);
  check("POST-08 저장소를 쓸 수 없어도 글쓰기·발행 정상", await blocked.page.getByRole("heading", { name: "저장소 없는 글" }).isVisible());
  await blockedCtx.close();
  check("POST-08 DB에 임시 글 테이블·칸 없음", (await one("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND column_name ILIKE '%draft%'")).n === 0);

  // ════════ POST-06 조회수 ════════
  const owner = await member(`ec${tag}`);
  const postId = await fakePost(db, owner.blogId, { title: "조회수 시험 글" });
  const ownerSlug = `ec${tag}`;
  const viewCount = async () => (await one("SELECT view_count, updated_at FROM posts WHERE id = $1", [postId]));
  const { updated_at: updatedBefore } = await viewCount();
  const shownViews = async (page, want) => {
    for (let i = 0; i < 20; i++) {
      if ((await page.locator("[data-view-count]").innerText()) === `👀 ${want}`) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  const vw1 = await visitor();
  await vw1.page.goto(`${BASE}/@${ownerSlug}/${postId}`);
  check("POST-06 처음 연 방문자 → 1 (화면에도 바로)", (await shownViews(vw1.page, 1)) && (await viewCount()).view_count === 1);
  await vw1.page.reload();
  await vw1.page.waitForTimeout(800);
  check("POST-06 같은 날 새로고침하면 오르지 않음", (await viewCount()).view_count === 1);
  const vw2 = await visitor();
  await vw2.page.goto(`${BASE}/@${ownerSlug}/${postId}`);
  check("POST-06 다른 브라우저(새 방문자) → 2", await shownViews(vw2.page, 2));
  await owner.page.goto(`${BASE}/@${ownerSlug}/${postId}`);
  await owner.page.waitForTimeout(800);
  check("POST-06 작성자가 열면 오르지 않음", (await viewCount()).view_count === 2 && (await owner.page.locator("[data-view-count]").innerText()) === "👀 2");
  const m1 = await member(`ed${tag}`);
  await m1.page.goto(`${BASE}/@${ownerSlug}/${postId}`);
  await shownViews(m1.page, 3);
  const m2 = await member(`ed${tag}`);
  await m2.page.goto(`${BASE}/@${ownerSlug}/${postId}`);
  await m2.page.waitForTimeout(800);
  check("POST-06 로그인 회원은 다른 기기에서 다시 열어도 1번", (await viewCount()).view_count === 3);
  // 공감·댓글 뒤 다시 그려도 오르지 않는다
  await m1.page.getByRole("button", { name: /♥|공감/ }).first().click();
  await m1.page.waitForTimeout(800);
  await m1.page.getByPlaceholder("따뜻한 댓글을 남겨 주세요 💬").fill("조회수 시험 댓글");
  await m1.page.getByRole("button", { name: "댓글 등록" }).click();
  await m1.page.getByText("조회수 시험 댓글").waitFor();
  await m1.page.waitForTimeout(800);
  check("POST-06 공감·댓글을 해도 오르지 않음", (await viewCount()).view_count === 3);
  check("POST-06 조회수가 올라도 수정 시각은 그대로", (await viewCount()).updated_at.getTime() === updatedBefore.getTime());
  await fetch(`${BASE}/@${ownerSlug}/${postId}`);
  check("POST-06 스크립트를 실행하지 않는 요청은 세지 않음", (await viewCount()).view_count === 3);
  await db.query("UPDATE post_views SET date = date - 1 WHERE post_id = $1", [postId]);
  await vw1.page.reload();
  check("POST-06 다음 날(한국 시간) 다시 열면 1 오름", await shownViews(vw1.page, 4));
  const privId = await fakePost(db, owner.blogId, { title: "남의 비공개", visibility: "private" });
  const r404 = await vw1.page.goto(`${BASE}/@${ownerSlug}/${privId}`);
  await vw1.page.waitForTimeout(800);
  check("POST-06 남의 비공개 글(404)은 세지 않음", r404.status() === 404 && (await one("SELECT view_count FROM posts WHERE id = $1", [privId])).view_count === 0);
  await m2.ctx.close();
  await vw2.ctx.close();

  // ════════ POST-07·09 비공개 글 첨부는 주인에게만 ════════
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || "storage/uploads");
  mkdirSync(uploadDir, { recursive: true });
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  async function addFile(uid) {
    const k = randomBytes(16).toString("hex");
    writeFileSync(path.join(uploadDir, k), PNG);
    await db.query("INSERT INTO attachments (key, user_id, kind, name, mime, size) VALUES ($1, $2, 'image', '점.png', 'image/png', $3)", [k, uid, PNG.length]);
    return k;
  }
  const usedKey = await addFile(owner.uid);
  const unusedKey = await addFile(owner.uid);
  const attPost = (
    await one("INSERT INTO posts (blog_id, title, content_html, content_text, visibility) VALUES ($1, '사진 비공개 글', $2, '사진', 'private') RETURNING id", [owner.blogId, `<p>사진</p><img src="/files/${usedKey}">`])
  ).id;
  const status = async (page, k) => page.evaluate(async (u) => (await fetch(u)).status, `/files/${k}`);
  check("POST-07 비공개 글의 사진: 방문자 404", (await status(vw1.page, usedKey)) === 404);
  check("POST-07 비공개 글의 사진: 다른 회원 404", (await status(m1.page, usedKey)) === 404);
  check("POST-07 비공개 글의 사진: 주인 200", (await status(owner.page, usedKey)) === 200);
  await db.query("UPDATE posts SET visibility = 'public' WHERE id = $1", [attPost]);
  check("POST-07 공개로 바꾸면 바로 누구나 200", (await status(vw1.page, usedKey)) === 200);
  await db.query("UPDATE posts SET visibility = 'private' WHERE id = $1", [attPost]);
  check("POST-07 다시 비공개로 바꾸면 바로 404", (await status(vw1.page, usedKey)) === 404);
  check("POST-07 어느 글에도 쓰이지 않은 첨부: 올린 사람만 (주인 200 / 남 404)", (await status(owner.page, unusedKey)) === 200 && (await status(m1.page, unusedKey)) === 404);
  const missing = await vw1.page.evaluate(async () => {
    const r = await fetch(`/files/${"0".repeat(32)}`);
    return `${r.status} ${await r.text()}`;
  });
  const hidden = await vw1.page.evaluate(async (u) => {
    const r = await fetch(u);
    return `${r.status} ${await r.text()}`;
  }, `/files/${usedKey}`);
  check("POST-07 막힌 첨부는 없는 주소와 같은 응답 (`파일을 찾을 수 없어요`)", hidden === missing && missing === "404 파일을 찾을 수 없어요", hidden);
  await m1.ctx.close();
  await vw1.ctx.close();

  // ════════ AUTH-06 회원 탈퇴 ════════
  // W: 탈퇴할 회원. X의 글에 댓글 두 개(하나엔 Y의 답글), Y의 댓글에 답글 하나. W의 글엔 Y의 댓글
  const W = `ew${tag}`;
  const w = await member(W);
  const x = await member(`ex${tag}`);
  const y = await member(`ey${tag}`);
  const xPost = await fakePost(db, x.blogId, { title: "X의 글" });
  const wPost = await fakePost(db, w.blogId, { title: "W의 글" });
  const ins = async (postId, authorId, content, parentId = null) =>
    (await one("INSERT INTO comments (post_id, author_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING id", [postId, authorId, content, parentId])).id;
  const wc1 = await ins(xPost, w.uid, "W의 댓글 (답글 있음)");
  const yReply = await ins(xPost, y.uid, "Y의 답글", wc1);
  const wc2 = await ins(xPost, w.uid, "W의 댓글 (답글 없음)");
  const yc = await ins(xPost, y.uid, "Y의 댓글");
  const wReply = await ins(xPost, w.uid, "W의 답글", yc);
  await ins(wPost, y.uid, "Y가 W 글에 단 댓글");
  // Y가 이미 받은 보상 (W의 댓글에 답글을 달아 받은 댓글 보상)
  await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) VALUES ($1, 'comment', 5, 5, $2)", [y.uid, String(yReply)]);
  const yLedger = async () => (await one("SELECT COALESCE(SUM(coin_delta), 0)::int AS c, COALESCE(SUM(exp_delta), 0)::int AS e FROM point_ledger WHERE user_id = $1", [y.uid]));
  const yBefore = await yLedger();
  await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2), ($2, $1)", [w.uid, y.uid]);

  await w.page.goto(`${BASE}/settings/blog`);
  const form = w.page.locator("[data-withdraw-form]");
  check("AUTH-06 블로그 관리에 회원 탈퇴 (비밀번호 다시 입력)", (await form.getByLabel("비밀번호 확인").isVisible()) && (await form.getByRole("button", { name: "회원 탈퇴" }).isVisible()));
  // 확인 창에서 취소하면 아무 일도 없다
  let confirmText = "";
  w.page.once("dialog", async (d) => {
    confirmText = d.message();
    await d.dismiss();
  });
  await form.getByLabel("비밀번호 확인").fill(PW);
  await form.scrollIntoViewIfNeeded();
  await w.page.screenshot({ path: `${outDir}/d8-withdraw-confirm.png`, fullPage: false });
  await form.getByRole("button", { name: "회원 탈퇴" }).click();
  await w.page.waitForTimeout(800);
  check("AUTH-06 확인 창 `정말 탈퇴할까요? …`, 취소하면 그대로", confirmText.startsWith("정말 탈퇴할까요?") && Boolean(await one("SELECT id FROM users WHERE id = $1", [w.uid])), confirmText);
  // 틀린 비밀번호
  w.page.once("dialog", (d) => d.accept());
  await form.getByLabel("비밀번호 확인").fill("wrong-password-1");
  await form.getByRole("button", { name: "회원 탈퇴" }).click();
  await form.getByText("비밀번호가 맞지 않아요").waitFor();
  check("AUTH-06 비밀번호가 틀리면 `비밀번호가 맞지 않아요`, 지워지지 않음", Boolean(await one("SELECT id FROM users WHERE id = $1", [w.uid])));
  await form.screenshot({ path: `${outDir}/d8-withdraw-wrong-password.png` });
  // 진짜 탈퇴
  w.page.once("dialog", (d) => d.accept());
  await form.getByLabel("비밀번호 확인").fill(PW);
  await form.getByRole("button", { name: "회원 탈퇴" }).click();
  await w.page.waitForURL(/\/\?withdrawn=1/);
  check("AUTH-06 탈퇴하면 첫 화면으로 + 로그인 끝 (헤더에 [시작하기])", (await w.page.getByText("탈퇴가 끝났어요").isVisible()) && (await w.page.getByRole("banner").getByRole("link", { name: "시작하기" }).isVisible()));
  await w.page.screenshot({ path: `${outDir}/d8-withdraw-done.png` });
  const gone = await one(
    `SELECT (SELECT COUNT(*) FROM users WHERE id = $1)::int AS users, (SELECT COUNT(*) FROM accounts WHERE user_id = $1)::int AS accounts,
            (SELECT COUNT(*) FROM sessions WHERE user_id = $1)::int AS sessions, (SELECT COUNT(*) FROM profiles WHERE user_id = $1)::int AS profiles,
            (SELECT COUNT(*) FROM blogs WHERE owner_id = $1)::int AS blogs, (SELECT COUNT(*) FROM posts WHERE id = $2)::int AS posts,
            (SELECT COUNT(*) FROM point_ledger WHERE user_id = $1)::int AS ledger, (SELECT COUNT(*) FROM follows WHERE follower_id = $1 OR followee_id = $1)::int AS follows,
            (SELECT COUNT(*) FROM comments WHERE author_id = $1)::int AS comments`,
    [w.uid, wPost],
  );
  check("AUTH-06 프로필·블로그·글·코인 기록·로그인 정보·이웃이 지워짐", Object.values(gone).every((n) => n === 0), JSON.stringify(gone));
  check("AUTH-06 탈퇴한 아이디로 로그인 → `아이디 또는 비밀번호가 맞지 않아요`", (await tryLogin(w.page, W, PW)) === "아이디 또는 비밀번호가 맞지 않아요");
  const cRows = await all("SELECT id, author_id, deleted_at, content FROM comments WHERE post_id = $1 ORDER BY id", [xPost]);
  const byId = Object.fromEntries(cRows.map((r) => [r.id, r]));
  check("AUTH-06 답글이 달린 W의 댓글은 작성자 없이 삭제된 자리로", byId[wc1] && byId[wc1].author_id === null && byId[wc1].deleted_at !== null && byId[wc1].content === "삭제된 댓글이에요");
  check("AUTH-06 답글 없는 W의 댓글·W의 답글은 완전히 지워짐", !byId[wc2] && !byId[wReply]);
  check("AUTH-06 다른 회원(Y)의 답글·댓글은 그대로", byId[yReply]?.author_id === y.uid && byId[yc]?.author_id === y.uid);
  await y.page.goto(`${BASE}/@${`ex${tag}`}/${xPost}`);
  const section = y.page.locator("#comments");
  const sectionText = await section.innerText();
  check("AUTH-06 화면: `삭제된 댓글이에요`(작성자·시각 없음) + 답글 그대로", (await section.locator("[data-deleted-comment]").count()) === 1 && sectionText.includes("Y의 답글") && !sectionText.includes(W) && !sectionText.includes("W의 댓글"));
  check("AUTH-06 댓글 수에서 삭제된 자리는 빠짐 (`💬 댓글 2`)", sectionText.includes("💬 댓글 2"));
  await section.screenshot({ path: `${outDir}/d8-withdraw-comments.png` });
  const yAfter = await yLedger();
  check("AUTH-06 다른 회원이 이미 받은 보상은 회수하지 않음", yAfter.c === yBefore.c && yAfter.e === yBefore.e);
  // 답글이 모두 지워지면 그 자리도 사라진다
  await db.query("UPDATE comments SET deleted_at = now() WHERE id = $1", [yReply]);
  await y.page.reload();
  check("SOC-01 삭제된 자리의 답글이 모두 지워지면 자리도 사라짐", (await y.page.locator("#comments [data-deleted-comment]").count()) === 0 && (await y.page.locator("#comments").innerText()).includes("💬 댓글 1"));

  // ════════ NF-10 로그인 시도 제한 ════════
  const L = `el${tag}`;
  const lp = await member(L);
  await signOut(lp.page);
  const fails = [];
  for (let i = 0; i < 5; i++) fails.push(await tryLogin(lp.page, L, "wrong-password-1"));
  check("NF-10 1~5번째 실패는 `아이디 또는 비밀번호가 맞지 않아요`", fails.every((m) => m === "아이디 또는 비밀번호가 맞지 않아요"), fails.join(" | "));
  const sixth = await tryLogin(lp.page, L, PW);
  check("NF-10 5번 연속 실패 뒤에는 맞는 비밀번호도 막힘", sixth === "로그인을 너무 많이 시도했어요. 5분 뒤에 다시 시도해 주세요", sixth);
  await lp.page.screenshot({ path: `${outDir}/d9-login-locked.png` });
  check("NF-10 아이디 칸은 그대로", (await lp.page.getByLabel("아이디").inputValue()) === L);
  const lock = await one("SELECT failures, EXTRACT(EPOCH FROM (locked_until - now()))::int AS sec FROM login_attempts WHERE login_key = $1", [L]);
  check("NF-10 5분 잠금", lock && lock.sec > 280 && lock.sec <= 300, JSON.stringify(lock));
  const api = await fetch(`${BASE}/api/auth/sign-in/username`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ username: L, password: PW }) });
  check("NF-10 로그인 API를 직접 불러도 막힘", api.status === 429 && !api.headers.get("set-cookie")?.includes("session_token=") , `HTTP ${api.status}`);
  // 5분이 지나면 (잠금 시각을 지난 것으로 바꿔 흉내) 다시 로그인되고 횟수가 초기화된다
  await db.query("UPDATE login_attempts SET locked_until = now() - interval '1 second' WHERE login_key = $1", [L]);
  check("NF-10 5분이 지나면 다시 로그인", ["/town"].includes(await tryLogin(lp.page, L, PW)));
  check("NF-10 성공하면 실패 횟수 초기화", !(await one("SELECT 1 AS x FROM login_attempts WHERE login_key = $1", [L])));
  await signOut(lp.page);
  // 실패 3번 → 성공 → 다시 4번 실패해도 잠기지 않는다 (연속 실패만 센다)
  for (let i = 0; i < 3; i++) await tryLogin(lp.page, L, "wrong-password-1");
  await tryLogin(lp.page, L, PW);
  await signOut(lp.page);
  for (let i = 0; i < 4; i++) await tryLogin(lp.page, L, "wrong-password-1");
  check("NF-10 성공 사이의 실패는 이어서 세지 않음 (4번째에도 안 잠김)", (await tryLogin(lp.page, L, PW)) === "/town");
  await signOut(lp.page);
  // 없는 아이디도 똑같이
  const ghost = `nouser${tag}`;
  for (let i = 0; i < 5; i++) await tryLogin(lp.page, ghost, "whatever-1234");
  check("NF-10 없는 아이디도 5번 실패하면 같은 문구로 막힘", (await tryLogin(lp.page, ghost, "whatever-1234")) === "로그인을 너무 많이 시도했어요. 5분 뒤에 다시 시도해 주세요");
  // 대문자로 바꿔도 같은 아이디
  check("NF-10 대문자로 입력해도 같은 아이디로 막힘", (await tryLogin(lp.page, ghost.toUpperCase(), "whatever-1234")).startsWith("로그인을 너무 많이"));
} catch (err) {
  check("시나리오 실행", false, String(err?.stack ?? err).slice(0, 600));
}

// 비공개 첨부·남의 비공개 글을 일부러 열어 보는 404는 오류가 아니다
const errors = errorsAll.flat().filter((e) => !e.includes("status of 404 (Not Found)"));
check("콘솔 오류 없음", errors.length === 0, errors.slice(0, 5).join(" | "));
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✅")).length}/${results.length} 통과`);
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
