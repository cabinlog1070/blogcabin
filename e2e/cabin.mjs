// 오두막 마을 확인: 캠프파이어·통나무 오두막 3단계(TOWN-02·11), 갈색·초록 색 테마, 댓글을 블로그 주인·관리자도 삭제 (spec 004)
// 사용: 개발 서버를 띄운 상태에서 node e2e/cabin.mjs <스크린샷 폴더> [theme-before]
//       (3000번이 아니면 BASE_URL=http://localhost:3100 node e2e/cabin.mjs ...)
// 두 번째 인자 theme-before: 색 테마 스크린샷(before-*.png)만 찍고 끝낸다 (색을 바꾸기 전 비교용)
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, fakePost, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const themeOnly = process.argv[3] === "theme-before";
mkdirSync(outDir, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);

const tag = Date.now().toString(36).slice(-5);
const browser = await chromium.launch();
const errorsAll = [];
async function member(id, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  errorsAll.push(collectErrors(page));
  await loginDev(page, id);
  const { id: uid } = await one("SELECT id FROM users WHERE username = $1", [id]);
  return { ctx, page, uid };
}
const setExp = (uid, exp) => db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', $2, 0)", [uid, exp]);
const LV = { 1: 0, 5: 50 * 5 * 4, 15: 50 * 15 * 14 };

try {
  const X = `cx${tag}`;
  const x = await member(X);
  const slugX = X.toLowerCase();

  // ── 색 테마 비교 스크린샷: 헤더+광장, 상점, 블로그 홈, 농장 ──
  const prefix = themeOnly ? "before" : "after";
  const themeShots = async () => {
    await x.page.goto(`${BASE}/town`);
    await x.page.locator("canvas").waitFor();
    await x.page.waitForTimeout(1500);
    await x.page.screenshot({ path: `${outDir}/${prefix}-header-town.png` });
    for (const [name, path] of [["shop", "/shop"], ["blog-home", `/@${slugX}`], ["farm", "/farm"]]) {
      await x.page.goto(`${BASE}${path}`);
      await x.page.waitForLoadState("networkidle");
      await x.page.waitForTimeout(500);
      await x.page.screenshot({ path: `${outDir}/${prefix}-${name}.png` });
    }
  };
  if (themeOnly) {
    await themeShots();
    throw "done";
  }

  // ── 광장: 단계별 이웃 오두막 (Lv.1·5·15) + 내 집 3단계 ──
  await setExp(x.uid, LV[15]);
  const neighbors = [];
  for (const [i, lv] of [[1, 1], [2, 5], [3, 15]]) {
    const n = await fakeMember(db, `cn${i}${tag}`, { nickname: `오두막${i}${tag}`, title: `${lv}레벨 오두막` });
    if (LV[lv]) await setExp(n.uid, LV[lv]);
    await fakePost(db, n.blogId, { title: "안녕" });
    await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, true)", [x.uid, n.uid]);
    neighbors.push(n);
  }
  await db.query("UPDATE blogs SET roof_color = 'green' WHERE id = $1", [neighbors[1].blogId]);

  // 광장 전체가 한 화면에 들어오게 크게 연다 (광장 1800 × 1400)
  const big = await browser.newContext({ viewport: { width: 1800, height: 1460 }, storageState: await x.ctx.storageState() });
  const bp = await big.newPage();
  errorsAll.push(collectErrors(bp));
  await bp.goto(`${BASE}/town`);
  const canvas = bp.locator("canvas");
  await canvas.waitFor();
  await bp.waitForTimeout(2500);
  const town = bp.locator("[data-my-house-stage]");
  const slotStages = (await town.getAttribute("data-neighbor-stages")).split(",").map((s) => s.split(":")); // 자리 순서
  const stages = Object.fromEntries(slotStages);
  check(
    "TOWN-11 이웃 오두막 Lv.1·5·15 → 1·2·3단계",
    stages[neighbors[0].slug] === "1" && stages[neighbors[1].slug] === "2" && stages[neighbors[2].slug] === "3",
    JSON.stringify(stages),
  );
  check("TOWN-11 내 집 Lv.15 → 3단계", (await town.getAttribute("data-my-house-stage")) === "3");
  const fire = await canvas.getAttribute("data-campfire");
  check("TOWN-02 가운데 캠프파이어 (불꽃 움직임)", fire === "animated", fire ?? "없음");
  // 불꽃이 실제로 바뀌는지: 캠프파이어 부분을 두 번 찍어 비교
  const box = await canvas.boundingBox();
  const fireClip = { x: box.x + 900 - 110, y: box.y + 700 - 90, width: 220, height: 180 };
  const f1 = await bp.screenshot({ clip: fireClip });
  await bp.waitForTimeout(400);
  const f2 = await bp.screenshot({ clip: fireClip });
  check("TOWN-02 불꽃이 일렁인다 (화면이 바뀜)", !f1.equals(f2));
  await bp.screenshot({ path: `${outDir}/c1-plaza-full.png` });
  await bp.screenshot({ path: `${outDir}/c2-campfire.png`, clip: { x: box.x + 900 - 260, y: box.y + 700 - 220, width: 520, height: 400 } });
  // 이웃 집 자리는 들어올 때마다 무작위라 캔버스의 data-neighbor-slots(slug:x,y)에서 읽는다. 파일 이름은 그 집의 단계
  await bp.evaluate(() => document.querySelector("[data-neighbor-panel]")?.style.setProperty("visibility", "hidden")); // 왼쪽 위 자리 집을 가리지 않게
  const placed = (await canvas.getAttribute("data-neighbor-slots")).split(";").map((v) => {
    const [slug, xy] = v.split(":");
    const [sx, sy] = xy.split(",").map(Number);
    return { slug, x: sx, y: sy };
  });
  for (const s of placed) {
    const stage = stages[s.slug];
    await bp.screenshot({ path: `${outDir}/c${2 + Number(stage)}-cabin-stage${stage}.png`, clip: { x: box.x + s.x - 130, y: box.y + s.y - 225, width: 260, height: 285 } });
  }
  await bp.screenshot({ path: `${outDir}/c6-my-cabin-stage3.png`, clip: { x: box.x + 900 - 150, y: box.y + 1140 - 230, width: 300, height: 290 } });

  // 캠프파이어는 지나갈 수 없다: 아래에서 위로 걸어가면 불 앞에서 멈춘다
  await x.page.goto(`${BASE}/town`);
  await x.page.locator("canvas").waitFor();
  await x.page.waitForTimeout(1500);
  await x.page.locator("canvas").click({ position: { x: 5, y: 5 } }).catch(() => {}); // 키 입력이 게임에 가도록
  await x.page.keyboard.down("ArrowUp");
  await x.page.waitForTimeout(1500);
  await x.page.keyboard.up("ArrowUp");
  await x.page.screenshot({ path: `${outDir}/c7-blocked-by-campfire.png` });

  // 동작 줄이기 설정: 불꽃이 멈춘다
  const calm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", storageState: await x.ctx.storageState() });
  const cp = await calm.newPage();
  await cp.goto(`${BASE}/town`);
  await cp.locator("canvas").waitFor();
  await cp.waitForTimeout(1500);
  check("TOWN-02 동작 줄이기면 불꽃이 멈춤", (await cp.locator("canvas").getAttribute("data-campfire")) === "1");

  // 휴대폰(375px)에서도 광장 (가로 스크롤 없음)
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: await x.ctx.storageState() });
  const pp = await phone.newPage();
  await pp.goto(`${BASE}/town`);
  await pp.locator("canvas").waitFor({ timeout: 20000 });
  await pp.screenshot({ path: `${outDir}/c8-town-375.png`, fullPage: true });
  check("375px 광장 (가로 스크롤 없음)", (await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);

  // ── 색 테마 (after) ──
  await themeShots();
  const logoColor = await x.page.getByRole("banner").getByRole("link", { name: "BlogCabin" }).evaluate((el) => getComputedStyle(el).color);
  check("로고가 갈색", logoColor === "rgb(122, 75, 42)", logoColor);

  // ── 댓글 삭제: 블로그 주인·관리자도 (spec 004) ──
  const { id: blogX } = await one("SELECT id FROM blogs WHERE owner_id = $1", [x.uid]);
  const postId = await fakePost(db, blogX, { title: "댓글 시험" });
  const postUrl = `${BASE}/@${slugX}/${postId}`;
  const Y = `cy${tag}`;
  const Z = `cz${tag}`;
  const y = await member(Y);
  const z = await member(Z);
  await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [z.uid]);
  const W = `cw${tag}`;
  const w = await member(W);

  await y.page.goto(postUrl);
  for (const text of ["주인이 지울 댓글", "관리자가 지울 댓글"]) {
    await y.page.locator('textarea[name="content"]').fill(text);
    await y.page.getByRole("button", { name: "댓글 등록" }).click();
    await y.page.getByText(text).waitFor();
  }
  const commentRow = (page, text) => page.locator("#comments div.flex.gap-3", { hasText: text });

  // 다른 회원(W): 남의 댓글에 [삭제]가 없다
  await w.page.goto(postUrl);
  check("일반 회원은 남의 댓글에 [삭제]가 없음", (await commentRow(w.page, "주인이 지울 댓글").getByRole("button", { name: "삭제" }).count()) === 0);

  // 블로그 주인(X): 남의 댓글도 [삭제]
  x.page.on("dialog", (d) => d.accept());
  await x.page.goto(postUrl);
  const ownerBtn = commentRow(x.page, "주인이 지울 댓글").getByRole("button", { name: "삭제" });
  check("블로그 주인은 남의 댓글에 [삭제]가 보임", await ownerBtn.isVisible());
  await ownerBtn.click();
  await x.page.getByText("주인이 지울 댓글").waitFor({ state: "detached" });
  await x.page.screenshot({ path: `${outDir}/c9-owner-deleted-comment.png`, fullPage: true });
  const del1 = await one("SELECT deleted_at FROM comments WHERE post_id = $1 AND content = '주인이 지울 댓글'", [postId]);
  check("블로그 주인이 지운 댓글은 삭제 표시 (행은 남음)", del1?.deleted_at !== null);

  // 관리자(Z)
  z.page.on("dialog", (d) => d.accept());
  await z.page.goto(postUrl);
  const adminBtn = commentRow(z.page, "관리자가 지울 댓글").getByRole("button", { name: "삭제" });
  check("관리자는 남의 댓글에 [삭제]가 보임", await adminBtn.isVisible());
  await adminBtn.click();
  await z.page.getByText("관리자가 지울 댓글").waitFor({ state: "detached" });
  const del2 = await one("SELECT deleted_at FROM comments WHERE post_id = $1 AND content = '관리자가 지울 댓글'", [postId]);
  check("관리자가 지운 댓글은 삭제 표시", del2?.deleted_at !== null);
  // 답글이 남은 댓글을 주인이 지우면 `삭제된 댓글이에요` 자리 (같은 표시 규칙)
  await y.page.goto(postUrl);
  await y.page.locator('textarea[name="content"]').fill("답글 달린 댓글");
  await y.page.getByRole("button", { name: "댓글 등록" }).click();
  await y.page.getByText("답글 달린 댓글").waitFor();
  await commentRow(y.page, "답글 달린 댓글").getByRole("button", { name: "답글" }).click();
  await y.page.locator('textarea[placeholder="답글을 남겨 주세요"]').fill("남는 답글");
  await y.page.getByRole("button", { name: "답글 등록" }).click();
  await y.page.getByText("남는 답글").waitFor();
  await x.page.goto(postUrl);
  await commentRow(x.page, "답글 달린 댓글").getByRole("button", { name: "삭제" }).click();
  await x.page.locator("[data-deleted-comment]").waitFor();
  check("답글이 남은 댓글을 주인이 지우면 `삭제된 댓글이에요`", await x.page.getByText("남는 답글").isVisible());
  await x.page.screenshot({ path: `${outDir}/c10-owner-deleted-with-reply.png`, fullPage: true });
} catch (e) {
  if (e !== "done") results.push(`❌ 실행 중 오류: ${e.message ?? e}`);
} finally {
  await browser.close();
  await db.end();
}

const errors = errorsAll.flat();
if (!themeOnly) check("브라우저 콘솔 오류 없음", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
