// 배치 D (1): 즐겨찾는 이웃(TOWN-08)·광장 집(TOWN-04), 지붕 색(TOWN-07), 친구 초대(GAME-09), 방문자 수(BLOG-06), 마을 검색(BLOG-07)
// 사용: 개발 서버를 띄운 상태에서 BASE_URL=http://localhost:3100 node e2e/batch-d.mjs <스크린샷 폴더>
// 회원은 매번 새로 만든다 (이름 뒤에 무작위 글자). 블로그가 많이 필요한 곳은 DB에 바로 만든다 (fakeMember).
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, fakeMember, fakePost, loginDev, blogTitleFor } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const all = async (q, p = []) => (await db.query(q, p)).rows;
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);

const tag = Date.now().toString(36).slice(-5);
const A = `da${tag}`; // 주인공 (이웃·즐겨찾기·지붕·초대·검색)
const B = `db${tag}`; // 다른 회원
const browser = await chromium.launch();
const errorsAll = [];
const DESKTOP = { width: 1280, height: 900 };

async function member(id, viewport = DESKTOP) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  errorsAll.push(collectErrors(page));
  await loginDev(page, id);
  const { id: uid } = await one("SELECT id FROM users WHERE username = $1", [id]);
  const { id: blogId } = await one("SELECT id FROM blogs WHERE owner_id = $1", [uid]);
  return { ctx, page, uid, blogId };
}
async function visitor(viewport = DESKTOP) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  errorsAll.push(collectErrors(page));
  return { ctx, page };
}
const townAttr = async (page, name) => {
  await page.goto(`${BASE}/town`);
  const el = page.locator(`[${name}]`);
  await el.waitFor({ state: "attached" });
  return el.getAttribute(name);
};
const neighborSlugs = async (page) => ((await townAttr(page, "data-neighbor-stages")) || "").split(",").filter(Boolean).map((s) => s.split(":")[0]);

try {
  const a = await member(A);
  const b = await member(B);

  // ════════ TOWN-08 즐겨찾는 이웃 · TOWN-04 광장 집 ════════
  await a.page.goto(`${BASE}/@${A}`);
  const list = a.page.locator("[data-my-neighbors]");
  check("TOWN-08 이웃이 없으면 안내 문구", await list.getByText("아직 이웃이 없어요. 마을 소식에서 마음에 드는 블로그를 이웃으로 추가해 보세요.").isVisible());
  check("TOWN-04 즐겨찾기가 없으면 광장 안내 문구", (await a.page.goto(`${BASE}/town`), (await a.page.locator("[data-no-favorites]").innerText()) === "마음에 드는 블로그를 즐겨찾기하면 광장에 집이 생겨요"));
  check("TOWN-04 즐겨찾기가 없으면 이웃집 자리가 비어 있음", (await neighborSlugs(a.page)).length === 0);

  // 이웃 12명: B(화면에서 이웃 추가) + 글 없는 블로그 11개(DB)
  await a.page.goto(`${BASE}/@${B}`);
  await a.page.getByRole("button", { name: "+ 이웃 추가" }).click();
  await a.page.getByRole("button", { name: "✓ 이웃" }).waitFor();
  const fakes = [];
  for (let i = 0; i < 11; i++) {
    const f = await fakeMember(db, `nb${tag}${i.toString().padStart(2, "0")}`);
    fakes.push(f);
    await db.query("INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1, $2, now() - make_interval(mins => $3))", [a.uid, f.uid, 100 - i]);
  }
  await a.page.goto(`${BASE}/@${A}`);
  check("TOWN-08 내 블로그 홈에 내 이웃 목록 12명", (await list.locator("[data-neighbor]").count()) === 12);
  check("TOWN-08 처음에는 모두 ☆", (await list.getByRole("button", { name: /즐겨찾기$/ }).count()) === 12);
  await b.page.goto(`${BASE}/@${A}`);
  check("TOWN-08 남의 블로그 홈에는 내 이웃 목록이 없음", (await b.page.locator("[data-my-neighbors]").count()) === 0);

  // ☆ → ⭐ 10명
  for (let i = 0; i < 10; i++) {
    const row = list.locator(`[data-neighbor="${fakes[i].slug}"]`);
    await row.getByRole("button").click();
    await row.getByRole("button", { name: /즐겨찾기 취소$/ }).waitFor();
  }
  const favCount = async () => (await one("SELECT COUNT(*)::int AS n FROM follows WHERE follower_id = $1 AND is_favorite", [a.uid])).n;
  await a.page.waitForTimeout(500);
  check("TOWN-08 ☆을 누르면 ⭐ (10명 저장)", (await favCount()) === 10, `${await favCount()}명`);
  await list.locator(`[data-neighbor="${fakes[10].slug}"]`).getByRole("button").click();
  check("TOWN-08 11번째는 `즐겨찾기할 이웃은 최대 10명이에요`", await list.getByText("즐겨찾기할 이웃은 최대 10명이에요").isVisible());
  check("TOWN-08 11번째는 저장되지 않음", (await favCount()) === 10);
  // 다시 누르면 취소
  const row0 = list.locator(`[data-neighbor="${fakes[0].slug}"]`);
  await row0.getByRole("button").click();
  await row0.getByRole("button", { name: /즐겨찾기$/ }).waitFor();
  await a.page.waitForTimeout(300);
  check("TOWN-08 ⭐을 다시 누르면 취소", (await favCount()) === 9);

  // 동시에 두 화면에서 ☆ (9명일 때) → 10명을 넘지 않는다
  const a2page = await a.ctx.newPage();
  await a2page.goto(`${BASE}/@${A}`);
  await a.page.reload();
  await Promise.all([
    list.locator(`[data-neighbor="${fakes[0].slug}"]`).getByRole("button").click(),
    a2page.locator(`[data-my-neighbors] [data-neighbor="${fakes[10].slug}"]`).getByRole("button").click(),
  ]);
  await a.page.waitForTimeout(1500);
  check("TOWN-08 동시에 눌러도 10명을 넘지 않음", (await favCount()) === 10, `${await favCount()}명`);
  await a2page.close();
  // 시험을 이어가기 위해 즐겨찾기를 fakes[0..9]로 맞춘다
  await db.query("UPDATE follows SET is_favorite = (followee_id = ANY($2)) WHERE follower_id = $1", [a.uid, fakes.slice(0, 10).map((f) => f.uid)]);

  // 광장: 즐겨찾기한 10곳만, 글이 없어도 집, 최근 공개 글 순
  await fakePost(db, fakes[7].blogId, { title: "즐겨찾기 이웃의 새 글", minutesAgo: 1 });
  await fakePost(db, fakes[3].blogId, { title: "즐겨찾기 이웃의 옛 글", minutesAgo: 30 });
  const slugs = await neighborSlugs(a.page);
  const favSlugs = fakes.slice(0, 10).map((f) => f.slug);
  check("TOWN-04 즐겨찾기한 10곳 모두 집으로 (글 없는 블로그 포함)", slugs.length === 10 && favSlugs.every((s) => slugs.includes(s)), slugs.join(","));
  check("TOWN-04 즐겨찾기하지 않은 이웃(B, 11번째)의 집은 없음", !slugs.includes(B) && !slugs.includes(fakes[10].slug));
  check("TOWN-04 순서는 최근 공개 글 순 (글 없는 블로그는 뒤)", slugs[0] === fakes[7].slug && slugs[1] === fakes[3].slug, slugs.slice(0, 3).join(","));
  const panel = a.page.locator("[data-neighbor-panel]");
  check("TOWN-04 🏘 이웃집 패널은 남아 있고 즐겨찾기하지 않은 이웃(B)도 들어갈 수 있음", (await panel.getByRole("link", { name: new RegExp(blogTitleFor(B)) }).count()) === 1);
  check("TOWN-08 패널에서 즐겨찾기는 ⭐ 표시", (await panel.getByLabel("즐겨찾기").count()) === 10);
  check("TOWN-04 즐겨찾기가 있으면 안내 문구 없음", (await a.page.locator("[data-no-favorites]").count()) === 0);
  await a.page.locator("canvas").waitFor();
  await a.page.waitForTimeout(1500); // 광장 그림이 다 그려질 때까지
  await a.page.screenshot({ path: `${outDir}/d1-town-favorites.png` });
  await a.page.goto(`${BASE}/@${A}`);
  await list.scrollIntoViewIfNeeded();
  await list.screenshot({ path: `${outDir}/d1-my-neighbors-list.png` });

  // 💛 이웃 새 글: 즐겨찾기 이웃의 글이 위
  const bPostId = await fakePost(db, b.blogId, { title: "즐겨찾기 아닌 이웃의 최신 글", minutesAgo: 0 });
  await a.page.goto(`${BASE}/feed/following`);
  const titles = await a.page.locator("article h3").allInnerTexts();
  check(
    "TOWN-08 💛 이웃 새 글에서 즐겨찾기 이웃의 글이 위",
    titles.indexOf("즐겨찾기 이웃의 새 글") === 0 && titles.indexOf("즐겨찾기 이웃의 옛 글") === 1 && titles.indexOf("즐겨찾기 아닌 이웃의 최신 글") === 2,
    titles.slice(0, 3).join(" / "),
  );

  // 이웃 취소 → 즐겨찾기도 풀리고 광장에서 사라짐
  await a.page.goto(`${BASE}/@${fakes[7].slug}`);
  await a.page.getByRole("button", { name: "✓ 이웃" }).click();
  await a.page.getByRole("button", { name: "+ 이웃 추가" }).waitFor();
  check("TOWN-08 이웃을 취소하면 즐겨찾기도 풀림", (await favCount()) === 9);
  check("TOWN-08 이웃을 취소하면 광장에서 그 집이 사라짐", !(await neighborSlugs(a.page)).includes(fakes[7].slug));

  // 방문자: 인기 100곳 중 무작위 10곳 (공개 글이 있는 블로그만)
  const popular = [];
  for (let i = 0; i < 14; i++) {
    const f = await fakeMember(db, `pp${tag}${i.toString().padStart(2, "0")}`);
    const pid = await fakePost(db, f.blogId, { title: `인기 후보 ${i}`, minutesAgo: i });
    // 앞쪽일수록 최근 30일 공감이 많다
    for (let k = 0; k < Math.max(0, 6 - Math.floor(i / 2)); k++) await db.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [pid, fakes[k].uid]);
    popular.push(f);
  }
  const privOnly = await fakeMember(db, `pv${tag}`);
  await fakePost(db, privOnly.blogId, { title: "비공개만", visibility: "private" });
  const top100 = (
    await all(`
      SELECT b.slug FROM blogs b
      WHERE EXISTS (SELECT 1 FROM posts p WHERE p.blog_id = b.id AND p.visibility = 'public')
      ORDER BY (SELECT COUNT(*) FROM post_likes l JOIN posts p ON p.id = l.post_id
                WHERE p.blog_id = b.id AND p.visibility = 'public' AND l.created_at >= now() - interval '30 days') DESC,
               (SELECT MAX(created_at) FROM posts p WHERE p.blog_id = b.id AND p.visibility = 'public') DESC, b.id DESC
      LIMIT 100`)
  ).map((r) => r.slug);
  const v = await visitor();
  const seen = new Set();
  let allInTop = true;
  let alwaysTen = true;
  for (let i = 0; i < 4; i++) {
    const s = await neighborSlugs(v.page);
    if (s.length !== Math.min(10, top100.length)) alwaysTen = false;
    if (!s.every((x) => top100.includes(x))) allInTop = false;
    seen.add(s.slice().sort().join(","));
    if (s.includes(privOnly.slug) || s.includes(fakes[10].slug)) allInTop = false;
  }
  check("TOWN-04 방문자: 집 10채", alwaysTen, `후보 ${top100.length}곳`);
  check("TOWN-04 방문자: 모두 인기 상위 100곳 안 (글 없는·비공개만 블로그 제외)", allInTop);
  check("TOWN-04 방문자: 새로고침하면 다른 조합이 나올 수 있음", top100.length <= 10 || seen.size > 1, `${seen.size}가지`);
  check("TOWN-04 방문자에게는 즐겨찾기 안내 문구 없음", (await v.page.getByText("마음에 드는 블로그를 즐겨찾기하면").count()) === 0);
  await v.ctx.close();

  // ════════ TOWN-07 지붕 색 ════════
  // B가 A를 즐겨찾기 → B의 광장에서 A의 지붕 색을 본다
  await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, true)", [b.uid, a.uid]);
  await db.query("DELETE FROM point_ledger WHERE user_id = $1 AND reason = 'signup' AND coin_delta > 0", [a.uid]); // 코인 0인 회원으로
  const ledgerCount = async () => (await one("SELECT COUNT(*)::int AS n FROM point_ledger WHERE user_id = $1", [a.uid])).n;
  const before = await ledgerCount();
  await a.page.goto(`${BASE}/closet`);
  const roofSection = a.page.locator("[data-roof-section]");
  check("TOWN-07 꾸미기에 🏠 지붕 색 8가지와 [배경 색 따라가기]", (await roofSection.getByRole("radio").count()) === 8 && (await roofSection.getByRole("button", { name: "배경 색 따라가기" }).isVisible()));
  await roofSection.getByRole("radio", { name: "하늘" }).click();
  await a.page.getByText("지붕 색을 하늘(으)로 바꿨어요 ✓").waitFor();
  await roofSection.getByRole("radio", { name: "보라" }).click();
  await a.page.getByText("지붕 색을 보라(으)로 바꿨어요 ✓").waitFor();
  check("TOWN-07 코인 0이어도 연달아 바뀜 (저장: 보라)", (await one("SELECT roof_color FROM blogs WHERE id = $1", [a.blogId])).roof_color === "purple");
  check("TOWN-07 무료: 코인 그대로 0, 원장 기록 없음", (await coins(a.page)) === 0 && (await ledgerCount()) === before, `코인 ${await coins(a.page)}`);
  check("TOWN-07 미리 보기 지붕이 보라", (await roofSection.locator("[data-roof-preview]").getAttribute("data-roof-preview")) === "#9333ea");
  await roofSection.screenshot({ path: `${outDir}/d2-roof-color-closet.png` });
  check("TOWN-07 내 광장의 내 집 지붕이 보라", (await townAttr(a.page, "data-my-roof")) === "#9333ea");
  await a.page.locator("canvas").waitFor();
  await a.page.waitForTimeout(1500);
  await a.page.screenshot({ path: `${outDir}/d2-roof-color-town.png` });
  check("TOWN-07 다른 회원 광장의 이웃집도 보라", ((await townAttr(b.page, "data-neighbor-roofs")) || "").includes(`${A}:#9333ea`));
  // 배경을 바꿔도 지붕 색은 그대로
  const sea = await one("SELECT id FROM items WHERE code = 'bg_beach'");
  if (sea) {
    await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [a.uid, sea.id]);
    await db.query("UPDATE blogs SET background_item_id = $2 WHERE id = $1", [a.blogId, sea.id]);
  }
  check("TOWN-07 배경을 바꿔도 지붕 색은 그대로", (await townAttr(a.page, "data-my-roof")) === "#9333ea");
  await a.page.goto(`${BASE}/closet`);
  await roofSection.getByRole("button", { name: "배경 색 따라가기" }).click();
  await a.page.getByText("지붕 색이 배경 색을 따라가요 ✓").waitFor();
  const accent = sea ? "#0369a1" : "#2f855a";
  check("TOWN-07 [배경 색 따라가기] → 장착한 배경 색", (await one("SELECT roof_color FROM blogs WHERE id = $1", [a.blogId])).roof_color === null && (await townAttr(a.page, "data-my-roof")) === accent);
  // 집 단계도 함께 (TOWN-11): Lv.5로 올리면 2단계 집에 고른 지붕 색
  await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', 1000, 0)", [a.uid]);
  await db.query("UPDATE blogs SET roof_color = 'red' WHERE id = $1", [a.blogId]);
  const stage = await townAttr(a.page, "data-my-house-stage");
  check("TOWN-07·11 2단계 집에도 고른 지붕 색", stage === "2" && (await a.page.locator("[data-my-roof]").getAttribute("data-my-roof")) === "#dc2626", `단계 ${stage}`);
  let checkBlocked = false;
  try {
    await db.query("UPDATE blogs SET roof_color = 'pink' WHERE id = $1", [a.blogId]);
  } catch {
    checkBlocked = true;
  }
  check("TOWN-07 목록에 없는 색은 DB가 거부 (CHECK)", checkBlocked);

  // ════════ GAME-09 친구 초대 ════════
  const code = (await one("SELECT invite_code FROM profiles WHERE user_id = $1", [a.uid])).invite_code;
  const codes = await all("SELECT invite_code FROM profiles");
  check(
    "GAME-09 모든 회원의 초대 코드가 6자리·0OI1 없음·겹침 없음 (기존 회원 포함)",
    codes.every((r) => /^[A-HJ-NP-Z2-9]{6}$/.test(r.invite_code)) && new Set(codes.map((r) => r.invite_code)).size === codes.length,
    `${codes.length}명`,
  );
  await a.ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await a.page.goto(`${BASE}/@${A}`);
  const card = a.page.locator("[data-invite-card]");
  check("GAME-09 내 블로그 홈에 🎁 친구 초대 카드와 내 코드", (await card.getByRole("heading", { name: "🎁 친구 초대" }).isVisible()) && (await card.locator("[data-invite-code]").innerText()) === code);
  check("GAME-09 안내 문구", await card.getByText("친구가 이 코드로 가입해 100자 이상 공개 글을 처음 쓰면 둘 다 🪙 50을 받아요").isVisible());
  await card.getByRole("button", { name: "초대 링크 복사" }).click();
  check("GAME-09 [초대 링크 복사] → `초대 링크를 복사했어요`", await card.getByText("초대 링크를 복사했어요").waitFor({ timeout: 3000 }).then(() => true, () => false));
  const clip = await a.page.evaluate(() => navigator.clipboard.readText());
  check("GAME-09 복사한 링크 = /?invite=코드", clip === `${BASE}/?invite=${code}`, clip);
  await card.screenshot({ path: `${outDir}/d3-invite-card.png` });
  await a.page.reload();
  check("GAME-09 다시 봐도 같은 코드", (await card.locator("[data-invite-code]").innerText()) === code);
  await b.page.goto(`${BASE}/@${A}`);
  check("GAME-09 남의 블로그 홈에는 초대 카드 없음", (await b.page.locator("[data-invite-card]").count()) === 0);

  // 친구 F: 초대 링크(소문자) → 회원가입 → 온보딩 칸이 채워져 있다
  const F = `df${tag}`;
  const f = await visitor();
  await f.page.goto(`${BASE}/?invite=${code.toLowerCase()}`);
  await f.page.getByRole("tab", { name: "회원가입" }).click();
  await f.page.getByLabel("아이디").fill(F);
  await f.page.getByLabel("비밀번호", { exact: true }).fill("test-password-1234");
  await f.page.getByLabel("비밀번호 확인").fill("test-password-1234");
  await f.page.getByRole("button", { name: "회원가입", exact: true }).click();
  await f.page.locator('input[name="nickname"]').waitFor();
  check("GAME-09 초대 링크로 가입하면 온보딩 초대 코드 칸이 채워져 있음", (await f.page.locator('input[name="inviteCode"]').inputValue()) === code);
  // 없는 코드 → 문구, 입력값 유지
  await f.page.locator('input[name="blogTitle"]').fill(blogTitleFor(F));
  await f.page.locator('input[name="slug"]').fill(F);
  await f.page.locator('input[name="inviteCode"]').fill("ZZZZZ9");
  await f.page.getByRole("button", { name: /광장으로 출발/ }).click();
  await f.page.getByText("없는 초대 코드예요").waitFor();
  check("GAME-09 없는 초대 코드 → `없는 초대 코드예요`", (await f.page.locator('input[name="slug"]').inputValue()) === F && (await one("SELECT COUNT(*)::int AS n FROM blogs WHERE slug = $1", [F])).n === 0);
  await f.page.screenshot({ path: `${outDir}/d3-invite-onboarding-error.png` });
  await f.page.locator('input[name="inviteCode"]').fill(code.toLowerCase());
  await f.page.getByRole("button", { name: /광장으로 출발/ }).click();
  await f.page.waitForURL(/town/);
  const fUid = (await one("SELECT id FROM users WHERE username = $1", [F])).id;
  check("GAME-09 초대한 사람 기록 (소문자로 넣어도)", (await one("SELECT invited_by FROM profiles WHERE user_id = $1", [fUid])).invited_by === a.uid);
  const inviteRows = async () => (await all("SELECT user_id, reason, coin_delta, exp_delta FROM point_ledger WHERE reason IN ('invite', 'invited') AND user_id IN ($1, $2)", [a.uid, fUid]));
  check("GAME-09 온보딩만으로는 보상 없음", (await inviteRows()).length === 0);
  const fCookies = await f.ctx.cookies();
  check("GAME-09 온보딩을 마치면 초대 쿠키를 지움", !fCookies.some((c) => c.name === "bc_invite"));

  async function write(page, title, body, visibility = "public") {
    const dismiss = (d) => d.dismiss(); // 임시 글을 불러올지 묻는 창이 뜨면 불러오지 않는다
    page.on("dialog", dismiss);
    await page.goto(`${BASE}/write`);
    await page.locator(".ProseMirror").waitFor();
    await page.getByPlaceholder("제목").fill(title);
    if (visibility === "private") await page.getByRole("radio", { name: "🔒 비공개" }).click();
    await page.locator(".ProseMirror").click();
    await page.keyboard.insertText(body);
    await page.getByRole("button", { name: "발행하기" }).click();
    await page.waitForURL(/\/@[a-z0-9_]+\/\d+/);
    page.off("dialog", dismiss);
  }
  await write(f.page, "짧은 공개 글", "가".repeat(99));
  await write(f.page, "긴 비공개 글", "나".repeat(120), "private");
  check("GAME-09 99자 공개 글·비공개 글로는 보상 없음", (await inviteRows()).length === 0);
  await a.page.goto(`${BASE}/wallet`);
  const aCoinsBefore = await coins(a.page);
  await write(f.page, "첫 100자 공개 글", "다".repeat(100));
  let rows = await inviteRows();
  check(
    "GAME-09 친구의 첫 100자 이상 공개 글 → 둘 다 🪙 50 (경험치 0)",
    rows.length === 2 && rows.some((r) => r.user_id === a.uid && r.reason === "invite" && r.coin_delta === 50 && r.exp_delta === 0) && rows.some((r) => r.user_id === fUid && r.reason === "invited" && r.coin_delta === 50),
    JSON.stringify(rows),
  );
  await a.page.goto(`${BASE}/wallet`);
  check("GAME-09 초대한 사람 코인 +50", (await coins(a.page)) - aCoinsBefore === 50, `${aCoinsBefore} → ${await coins(a.page)}`);
  check("GAME-07 내역에 `🤝 친구 초대` (초대한 사람)", await a.page.getByText("🤝 친구 초대").first().isVisible());
  await f.page.goto(`${BASE}/wallet`);
  check("GAME-07 내역에 `🤝 친구 초대` (친구)", await f.page.getByText("🤝 친구 초대").first().isVisible());
  await write(f.page, "두 번째 100자 공개 글", "라".repeat(150));
  rows = await inviteRows();
  check("GAME-09 같은 친구로는 한 번만", rows.length === 2);
  let selfBlocked = false;
  try {
    await db.query("UPDATE profiles SET invited_by = user_id WHERE user_id = $1", [fUid]);
  } catch {
    selfBlocked = true;
  }
  check("GAME-09 자기 자신을 초대한 사람으로 저장할 수 없음 (DB CHECK)", selfBlocked);
  // 두 번째 친구 G: 링크 없이 코드를 직접 입력 → 횟수 제한 없이 또 받음. 동시에 글 두 개를 저장해도 한 번
  const G = `dg${tag}`;
  const g = await visitor();
  await g.page.goto(BASE);
  await g.page.getByRole("tab", { name: "회원가입" }).click();
  await g.page.getByLabel("아이디").fill(G);
  await g.page.getByLabel("비밀번호", { exact: true }).fill("test-password-1234");
  await g.page.getByLabel("비밀번호 확인").fill("test-password-1234");
  await g.page.getByRole("button", { name: "회원가입", exact: true }).click();
  await g.page.locator('input[name="nickname"]').waitFor();
  check("GAME-09 그냥 가입하면 초대 코드 칸이 비어 있음", (await g.page.locator('input[name="inviteCode"]').inputValue()) === "");
  await g.page.locator('input[name="blogTitle"]').fill(blogTitleFor(G));
  await g.page.locator('input[name="slug"]').fill(G);
  await g.page.locator('input[name="inviteCode"]').fill(` ${code.toLowerCase()} `.trim());
  await g.page.getByRole("button", { name: /광장으로 출발/ }).click();
  await g.page.waitForURL(/town/);
  const gUid = (await one("SELECT id FROM users WHERE username = $1", [G])).id;
  const g2 = await g.ctx.newPage();
  await Promise.all([write(g.page, "동시 글 1", "마".repeat(110)), write(g2, "동시 글 2", "바".repeat(110))]);
  const gRows = await all("SELECT reason FROM point_ledger WHERE (user_id = $1 AND reason = 'invited') OR (user_id = $2 AND reason = 'invite' AND ref_id = $1)", [gUid, a.uid]);
  check("GAME-09 두 번째 친구로 또 받음 + 동시에 글 2개여도 한 번씩", gRows.length === 2, `${gRows.length}줄`);
  await f.ctx.close();
  await g.ctx.close();

  // ════════ BLOG-06 방문자 수 ════════ (아직 아무도 오지 않은 새 회원 C의 블로그)
  const C = `dc${tag}`;
  const c = await member(C);
  const visits = async () => one("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE date = (now() AT TIME ZONE 'Asia/Seoul')::date)::int AS today FROM blog_visits WHERE blog_id = $1", [c.blogId]);
  const shown = async (page) => {
    const el = page.locator("[data-visit-count]");
    await el.waitFor();
    return { today: Number(await el.locator("[data-visit-today]").innerText()), total: Number(await el.locator("[data-visit-total]").innerText()) };
  };
  const waitShown = async (page, want) => {
    for (let i = 0; i < 20; i++) {
      const s = await shown(page);
      if (s.today === want.today && s.total === want.total) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  const v1 = await visitor();
  let visitReq = null;
  v1.page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"] && !visitReq) visitReq = r;
  });
  await v1.page.goto(`${BASE}/@${C}`);
  check("BLOG-06 처음 온 방문자 → 오늘 1·전체 1 (새로고침 없이)", await waitShown(v1.page, { today: 1, total: 1 }));
  check("BLOG-06 정보 줄 `오늘 방문 N · 전체 방문 N`", /@dc\w+ · 글 \d+ · 이웃 \d+ · 오늘 방문 1 · 전체 방문 1/.test(await v1.page.locator("[data-visit-count]").locator("..").innerText()));
  const cookie = (await v1.ctx.cookies()).find((c) => c.name === "bv_visitor");
  check(
    "BLOG-06 방문자 쿠키: HttpOnly·SameSite=Lax·1년·UUID",
    cookie && cookie.httpOnly && cookie.sameSite === "Lax" && Math.abs(cookie.expires - Date.now() / 1000 - 31536000) < 120 && /^[0-9a-f-]{36}$/.test(cookie.value),
    cookie ? `${cookie.sameSite} ${Math.round((cookie.expires - Date.now() / 1000) / 86400)}일` : "없음",
  );
  await v1.page.reload();
  await v1.page.goto(`${BASE}/@${C}?page=2`);
  await v1.page.waitForTimeout(800);
  check("BLOG-06 같은 브라우저는 새로고침·페이지 이동해도 그대로", (await visits()).total === 1);
  const v2 = await visitor();
  await v2.page.goto(`${BASE}/@${C}`);
  check("BLOG-06 다른 브라우저 → 2", await waitShown(v2.page, { today: 2, total: 2 }));
  await c.page.goto(`${BASE}/@${C}`);
  await b.page.waitForTimeout(800);
  check("BLOG-06 주인이 열면 오르지 않음 (숫자는 보임)", (await visits()).total === 2 && (await shown(c.page)).total === 2);
  // 주인이 기록 요청을 직접 보내도 기록되지 않는다 (방문자의 요청을 주인 쿠키로 다시 보냄)
  const forgedStatus = await c.page.evaluate(
    async ({ actionId, body }) => (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }, body })).status,
    { actionId: visitReq.headers()["next-action"], body: visitReq.postData() },
  );
  check("BLOG-06 주인이 기록 요청을 직접 보내도 기록되지 않음", forgedStatus === 200 && (await visits()).total === 2, `HTTP ${forgedStatus}`);
  // 로그인 회원은 기기가 달라도 한 사람 (A가 두 브라우저에서)
  await a.page.goto(`${BASE}/@${C}`);
  await waitShown(a.page, { today: 3, total: 3 });
  const a3 = await member(A);
  await a3.page.goto(`${BASE}/@${C}`);
  await a3.page.waitForTimeout(1000);
  check("BLOG-06 로그인 회원은 다른 브라우저에서 다시 열어도 1번", (await visits()).total === 3, `${(await visits()).total}`);
  await a3.ctx.close();
  // 스크립트를 실행하지 않는 요청(curl 같은 GET)은 세지 않는다
  await fetch(`${BASE}/@${C}`);
  check("BLOG-06 스크립트를 실행하지 않는 요청은 세지 않음", (await visits()).total === 3);
  // 없는 블로그 ID로 조작한 요청 → 아무것도 기록하지 않음
  const ghostStatus = await v1.page.evaluate(
    async ({ actionId }) => (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }, body: "[2000000000]" })).status,
    { actionId: visitReq.headers()["next-action"] },
  );
  check("BLOG-06 없는 블로그로 조작한 요청은 기록 없음", ghostStatus === 200 && (await one("SELECT COUNT(*)::int AS n FROM blog_visits WHERE blog_id = 2000000000")).n === 0);
  await v1.page.goto(`${BASE}/@${C}`);
  await waitShown(v1.page, { today: 3, total: 3 });
  await v1.page.locator("[data-visit-count]").scrollIntoViewIfNeeded();
  await v1.page.screenshot({ path: `${outDir}/d4-visit-count.png`, clip: { x: 0, y: 0, width: 1280, height: 520 } });
  // 한국 시간 0시가 지나면 오늘은 0부터 (어제 기록으로 옮겨 흉내)
  await db.query("UPDATE blog_visits SET date = date - 1 WHERE blog_id = $1", [c.blogId]);
  await v2.page.reload();
  check("BLOG-06 다음 날: 오늘은 다시 세고 전체는 줄지 않음", await waitShown(v2.page, { today: 1, total: 4 }));
  let dupBlocked = false;
  try {
    const r = await one("SELECT date, visitor_key FROM blog_visits WHERE blog_id = $1 LIMIT 1", [c.blogId]);
    await db.query("INSERT INTO blog_visits (blog_id, date, visitor_key) VALUES ($1, $2, $3)", [c.blogId, r.date, r.visitor_key]);
  } catch {
    dupBlocked = true;
  }
  check("BLOG-06 같은 (블로그, 날짜, 사람)은 DB가 거부", dupBlocked);
  const mv = await visitor({ width: 375, height: 812 });
  await mv.page.goto(`${BASE}/@${C}`);
  await mv.page.locator("[data-visit-count]").waitFor();
  check("BLOG-06 375px 가로 스크롤 없음", await mv.page.evaluate(() => document.documentElement.scrollWidth <= 375));
  await mv.ctx.close();
  await v1.ctx.close();
  await v2.ctx.close();

  // ════════ BLOG-07 마을 검색 ════════
  const word = `zq${tag}`;
  // 블로그 7곳 (이름 4·닉네임 2·주소 1에 검색어). 최근 공개 글 순으로 5곳만
  const sb = [];
  for (let i = 0; i < 7; i++) {
    const slug = i === 6 ? `${word}s6` : `sb${tag}${i}`;
    const fm = await fakeMember(db, slug, {
      nickname: i === 4 || i === 5 ? `${word}${i}`.slice(0, 12) : `sn${tag}${i}`,
      title: i < 4 ? `${word} 블로그 ${i}` : `그냥 블로그 ${i}`,
    });
    if (i !== 2) await fakePost(db, fm.blogId, { title: `블로그 ${i}의 글`, minutesAgo: 10 + i * 5 }); // 2번은 공개 글이 없다 → 맨 뒤
    sb.push(fm);
  }
  // 태그에만 검색어가 든 공개 글 9개 (+ 비공개 글: 남의 것·내 것)
  const tagRow = await one("INSERT INTO tags (name) VALUES ($1) RETURNING id", [`${word}태그`]);
  for (let i = 0; i < 9; i++) {
    const pid = await fakePost(db, popular[i].blogId, { title: `태그만 맞는 글 ${i}`, minutesAgo: 200 + i });
    await db.query("INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)", [pid, tagRow.id]);
  }
  await fakePost(db, popular[0].blogId, { title: `남의 비공개 ${word}`, visibility: "private" });
  await fakePost(db, a.blogId, { title: `내 비공개 ${word}`, visibility: "private" });
  const bodyHit = await fakePost(db, popular[1].blogId, { title: "본문에만", text: `본문 속 ${word} 단어`, minutesAgo: 1 });

  await a.page.goto(`${BASE}/@${A}`);
  check("BLOG-07 내 블로그 홈에 검색창", await a.page.getByRole("searchbox").isVisible());
  await b.page.goto(`${BASE}/@${A}`);
  check("BLOG-07 남의 블로그 홈에는 검색창 없음", (await b.page.getByRole("searchbox").count()) === 0);
  const vs = await visitor();
  await vs.page.goto(`${BASE}/@${A}`);
  check("BLOG-07 방문자에게는 검색창 없음", (await vs.page.getByRole("searchbox").count()) === 0);
  await vs.page.goto(`${BASE}/search?q=${word}`);
  check("BLOG-07 방문자가 검색 주소로 오면 첫 화면으로", new URL(vs.page.url()).pathname === "/");
  await vs.ctx.close();
  await a.page.goto(`${BASE}/town`);
  check("BLOG-07 광장에는 검색 없음", (await a.page.getByRole("searchbox").count()) === 0);

  await a.page.goto(`${BASE}/@${A}`);
  await a.page.getByRole("searchbox").fill("   ");
  await a.page.getByRole("button", { name: "검색", exact: true }).click();
  check("BLOG-07 공백만 → `검색어를 입력해 주세요`, 검색하지 않음", (await a.page.getByText("검색어를 입력해 주세요").isVisible()) && new URL(a.page.url()).pathname === `/@${A}`);
  await a.page.getByRole("searchbox").fill(` ${word} `);
  await a.page.getByRole("button", { name: "검색", exact: true }).click();
  await a.page.waitForURL(/\/search\?q=/);
  const blogSec = a.page.locator("[data-search-blogs]");
  const blogLinks = await blogSec.getByRole("link").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const expectBlogs = [`/@${sb[0].slug}`, `/@${sb[1].slug}`, `/@${sb[3].slug}`, `/@${sb[4].slug}`, `/@${sb[5].slug}`];
  check("BLOG-07 블로그 구역: 이름·닉네임·주소로 찾아 최근 공개 글 순 5곳", JSON.stringify(blogLinks) === JSON.stringify(expectBlogs), blogLinks.join(","));
  const postSec = a.page.locator("[data-search-posts]");
  const p1 = await postSec.locator("article h3").allInnerTexts();
  check("BLOG-07 글 구역: 1페이지 8개 최신순 (본문 일치가 맨 위)", p1.length === 8 && p1[0] === "본문에만" && p1[1] === "태그만 맞는 글 0", p1.slice(0, 3).join(" / "));
  check("BLOG-07 비공개 글은 (내 글이라도) 나오지 않음", !(await postSec.innerText()).includes(`비공개 ${word}`) && (await postSec.locator("article").count()) === 8);
  check("BLOG-07 글 카드 윗줄 `{닉네임} · {블로그 이름}`", (await postSec.locator("article").first().innerText()).includes(`· ${popular[1].slug} 블로그`));
  await a.page.screenshot({ path: `${outDir}/d5-search-results.png`, fullPage: true });
  await postSec.getByRole("link", { name: "2", exact: true }).click();
  await a.page.waitForURL(/page=2/);
  const p2 = await a.page.locator("[data-search-posts] article h3").allInnerTexts();
  check("BLOG-07 2페이지에 나머지 2개 (태그 9 + 본문 1 = 10)", p2.length === 2, p2.join(" / "));
  await blogSec.count();
  await a.page.goto(`${BASE}/search?q=${encodeURIComponent(`${word}s6`)}`);
  check("BLOG-07 블로그만 맞으면 글 구역은 그리지 않음", (await a.page.locator("[data-search-blogs]").count()) === 1 && (await a.page.locator("[data-search-posts]").count()) === 0);
  await a.page.locator("[data-search-blogs]").getByRole("link").first().click();
  await a.page.waitForURL(new RegExp(`/@${word}s6$`));
  check("BLOG-07 블로그를 누르면 그 블로그 홈", a.page.url().endsWith(`/@${word}s6`));
  await a.page.goto(`${BASE}/search?q=zzqq${tag}`);
  check("BLOG-07 결과 없음 → `'검색어'에 맞는 글이나 블로그가 없어요`", await a.page.getByText(`'zzqq${tag}'에 맞는 글이나 블로그가 없어요`).isVisible());
  await a.page.screenshot({ path: `${outDir}/d5-search-empty.png` });
  const long = await fetch(`${BASE}/search?q=${"가".repeat(51)}`, { headers: { cookie: (await a.ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } });
  check("BLOG-07 50자를 넘는 요청은 오류 없이 검색하지 않음", long.status === 200 && !(await long.text()).includes("data-search-posts"));
  void bodyHit;

  // 375px: 주인 블로그 홈(검색창·이웃·초대 카드) 가로 스크롤 없음
  const am = await member(A, { width: 375, height: 812 });
  await am.page.goto(`${BASE}/@${A}`);
  check("NF-06 375px 내 블로그 홈 가로 스크롤 없음", await am.page.evaluate(() => document.documentElement.scrollWidth <= 375));
  await am.page.screenshot({ path: `${outDir}/d6-my-blog-375.png`, fullPage: true });
  await am.ctx.close();

  void bPostId;
} catch (err) {
  check("시나리오 실행", false, String(err?.stack ?? err).slice(0, 600));
}

const errors = errorsAll.flat();
check("콘솔 오류 없음", errors.length === 0, errors.slice(0, 5).join(" | "));
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✅")).length}/${results.length} 통과`);
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
