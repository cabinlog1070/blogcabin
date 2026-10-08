// 알림함(GAME-08)·레벨업 팝업(GAME-06)·헤더 상태창(TOWN-10)·집 단계(TOWN-11) 확인
// 사용: 개발 서버를 띄운 상태에서 node e2e/notify.mjs <스크린샷 폴더>
//       (3000번이 아니면 BASE_URL=http://localhost:3100 node e2e/notify.mjs ...)
// 회원은 매번 새로 만든다 (이름 뒤에 무작위 글자). 레벨은 원장(point_ledger)에 경험치를 직접 넣어 맞춘다.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);

const tag = Date.now().toString(36).slice(-5);
const A = `na${tag}`; // 글 주인
const B = `nb${tag}`; // 공감·댓글하는 이웃
const C = `nc${tag}`; // Lv.15 (3단계 집)

const browser = await chromium.launch();
const errorsAll = [];
async function member(id, character = "남자 주민", viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  errorsAll.push(collectErrors(page));
  await loginDev(page, id, character);
  const { id: uid } = await one("SELECT id FROM users WHERE username = $1", [id]);
  return { ctx, page, uid };
}
const expOf = async (uid) => (await one("SELECT COALESCE(SUM(exp_delta), 0)::int AS e FROM point_ledger WHERE user_id = $1", [uid])).e;
/** 원장에 경험치를 넣어 누적 경험치를 target으로 맞춘다 (알림은 만들지 않는다) */
async function setExp(uid, target) {
  const diff = target - (await expOf(uid));
  if (diff > 0) await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', $2, 0)", [uid, diff]);
}
async function addPost(uid, title) {
  const { id: blogId, slug } = await one("SELECT id, slug FROM blogs WHERE owner_id = $1", [uid]);
  const { id } = await one(
    "INSERT INTO posts (blog_id, title, content_html, content_text, visibility) VALUES ($1, $2, '<p>알림 시험 글</p>', '알림 시험 글', 'public') RETURNING id",
    [blogId, title],
  );
  return { url: `${BASE}/@${slug}/${id}`, id, slug };
}
/** 헤더 쪽지의 빨간 숫자 (없으면 0) */
async function unread(page) {
  const badge = page.getByRole("banner").locator("[data-unread-count]");
  if (!(await badge.count())) return 0;
  const t = await badge.innerText();
  return t === "9+" ? 10 : Number(t);
}
const closePopupIfAny = async (page) => {
  const ok = page.locator("[data-levelup-modal]").getByRole("button", { name: "확인" });
  if (await ok.isVisible().catch(() => false)) await ok.click();
};

try {
  const a = await member(A, "여자 주민");
  const b = await member(B);
  const post = await addPost(a.uid, "알림이 오는지 보는 글");

  // ── TOWN-10 헤더 상태창 ──
  await a.page.goto(`${BASE}/shop`);
  const banner = a.page.getByRole("banner");
  check("TOWN-10 왼쪽 로고", await banner.getByRole("link", { name: "BlogCabin" }).isVisible());
  const card = banner.locator("[data-status-card]");
  check("TOWN-10 상태창 닉네임", (await card.locator("[data-status-nickname]").innerText()) === A);
  check("TOWN-10 상태창 블로그 제목", (await card.locator("[data-status-blog-title]").innerText()) === `${A}의 블로그`);
  check("TOWN-10 상태창 얼굴 그림", (await card.locator("img").count()) === 1);
  check("TOWN-10 Lv·코인·나가기 유지", (await banner.getByTitle("레벨").isVisible()) && (await banner.getByTitle("코인").isVisible()) && (await banner.getByRole("link", { name: /나가기/ }).isVisible()));
  check("TOWN-10 로그아웃은 헤더가 아니라 내 정보 메뉴에", (await banner.getByRole("button", { name: "로그아웃" }).count()) === 0);
  const lvBox = await banner.getByTitle("레벨").boundingBox();
  const envBox = await banner.locator("[data-notification-button]").boundingBox();
  const bannerBox = await banner.boundingBox();
  check("GAME-08 쪽지가 레벨 바로 왼쪽", envBox.x + envBox.width <= lvBox.x && lvBox.x - (envBox.x + envBox.width) < 16 && envBox.y + envBox.height <= bannerBox.y + bannerBox.height, `쪽지 오른쪽 ${Math.round(envBox.x + envBox.width)}, Lv 왼쪽 ${Math.round(lvBox.x)}`);
  await a.page.screenshot({ path: `${outDir}/b1-header-desktop.png`, clip: { x: 0, y: 0, width: 1280, height: 120 } });
  // 상태창을 누르면 내 정보 메뉴 (큰 얼굴·닉네임·블로그 제목·로그인 수단·내 블로그·환경 설정·문의하기·로그아웃)
  await card.click();
  const menu = a.page.locator("[data-profile-menu]");
  await menu.waitFor();
  check("TOWN-10 상태창 누르면 내 정보 메뉴", (await menu.locator("[data-menu-nickname]").innerText()) === A && (await menu.locator("[data-menu-blog-title]").innerText()) === `${A}의 블로그`);
  check("AUTH-05 내 정보 메뉴: 아이디 로그인 ✓", (await menu.locator('[data-login-method="credential"][data-linked="true"]').count()) === 1);
  check("TOWN-10 내 정보 메뉴: 로그아웃 버튼", await menu.getByRole("button", { name: "로그아웃" }).isVisible());
  await a.page.screenshot({ path: `${outDir}/b1-profile-menu.png`, clip: { x: 640, y: 0, width: 640, height: 480 } });
  await menu.getByRole("link", { name: "내 블로그" }).click();
  await a.page.waitForURL(new RegExp(`/@${A}$`));
  check("TOWN-10 내 정보 메뉴 → 내 블로그 홈", a.page.url().endsWith(`/@${A}`));

  // 375px: 블로그 제목 숨김, 가로 넘침 없음
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, storageState: await a.ctx.storageState() });
  const mp = await m.newPage();
  errorsAll.push(collectErrors(mp));
  await mp.goto(`${BASE}/shop`);
  const mb = mp.getByRole("banner");
  check("TOWN-10 휴대폰: 상태창은 얼굴만 (닉네임·블로그 제목 숨김)", !(await mb.locator("[data-status-blog-title]").isVisible()) && !(await mb.locator("[data-status-nickname]").isVisible()) && (await mb.locator("[data-status-card] img").isVisible()));
  check("TOWN-10 휴대폰: 레벨 보임", await mb.getByTitle("레벨").isVisible());
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const right = Math.max(...(await mb.locator("a, button, span[title]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))));
  check("TOWN-10 휴대폰: 가로 넘침 없음", overflow <= 0 && right <= 375, `scroll ${overflow}, 오른쪽 끝 ${Math.round(right)}`);
  await mp.screenshot({ path: `${outDir}/b2-header-375.png`, clip: { x: 0, y: 0, width: 375, height: 110 } });
  // 휴대폰에서도 쪽지·레벨·내 정보 창이 화면 양옆 12px 안에 뜬다
  for (const [button, popover] of [["[data-notification-button]", "[data-notification-panel]"], ["[data-level-button]", "[data-level-popover]"], ["[data-status-card]", "[data-profile-menu]"]]) {
    await mb.locator(button).click();
    const box = await mp.locator(popover).boundingBox();
    check(`TOWN-10 휴대폰: ${popover} 화면 안`, box.x >= 12 && box.x + box.width <= 375 - 12, `${Math.round(box.x)} ~ ${Math.round(box.x + box.width)}`);
    await mp.keyboard.press("Escape");
  }
  await m.close();

  // ── GAME-08: 남이 공감·댓글 → 숫자 +1씩 ──
  await a.page.goto(`${BASE}/town`);
  const before = await unread(a.page);
  check("GAME-08 처음엔 안 읽은 알림 없음", before === 0, String(before));

  await b.page.goto(post.url);
  await b.page.getByRole("button", { name: /공감/ }).click();
  await b.page.waitForLoadState("networkidle");
  await a.page.reload();
  check("GAME-08 남이 공감 → 숫자 1", (await unread(a.page)) === 1, String(await unread(a.page)));

  // 공감 취소 후 다시 공감해도 알림은 하나
  await b.page.getByRole("button", { name: /공감/ }).click();
  await b.page.waitForLoadState("networkidle");
  await b.page.getByRole("button", { name: /공감/ }).click();
  await b.page.waitForLoadState("networkidle");
  await b.page.getByPlaceholder("따뜻한 댓글을 남겨 주세요 💬").fill("좋은 글이에요!");
  await b.page.getByRole("button", { name: "댓글 등록" }).click();
  await b.page.getByText("좋은 글이에요!").waitFor();
  await a.page.reload();
  check("GAME-08 남이 댓글 → 숫자 2 (다시 공감은 안 셈)", (await unread(a.page)) === 2, String(await unread(a.page)));

  // 내 글에 내가 공감·댓글 → 늘지 않음. 내가 B 댓글에 답글 → B에게 답글 알림
  await a.page.goto(post.url);
  await a.page.getByRole("button", { name: /공감/ }).click();
  await a.page.waitForLoadState("networkidle");
  await a.page.getByPlaceholder("따뜻한 댓글을 남겨 주세요 💬").fill("제 글에 제가 남겨요");
  await a.page.getByRole("button", { name: "댓글 등록" }).click();
  await a.page.getByText("제 글에 제가 남겨요").waitFor();
  await a.page.getByRole("button", { name: "답글", exact: true }).first().click();
  await a.page.getByPlaceholder("답글을 남겨 주세요").fill("고마워요!");
  await a.page.getByRole("button", { name: "답글 등록" }).click();
  await a.page.getByText("고마워요!").waitFor();
  await a.page.reload();
  check("GAME-08 내 글에 내 공감·댓글·답글 → 숫자 그대로 2", (await unread(a.page)) === 2, String(await unread(a.page)));
  await b.page.reload();
  check("GAME-08 내 댓글에 답글 → 숫자 1", (await unread(b.page)) === 1, String(await unread(b.page)));

  // 쪽지 열기: 최신순, 안 읽은 줄 강조, 문구
  await a.page.getByRole("banner").locator("[data-notification-button]").click();
  const panel = a.page.locator("[data-notification-panel]");
  await panel.locator("li").first().waitFor();
  const texts = await panel.locator("li").allInnerTexts();
  check("GAME-08 목록 최신순: 댓글 → 공감", texts[0].includes(`${B}님이 「알림이 오는지 보는 글」에 댓글을 달았어요`) && texts[1].includes(`${B}님이 「알림이 오는지 보는 글」에 공감했어요`), texts.join(" | "));
  check("GAME-08 시간 표시 '방금'", texts[0].includes("방금"));
  check("GAME-08 안 읽은 알림 강조 2줄", (await panel.locator('[data-read="false"]').count()) === 2);
  await a.page.screenshot({ path: `${outDir}/b3-notification-panel.png` });

  // 하나 누르면 그 글로 가고 읽음
  await panel.locator("li", { hasText: "공감했어요" }).locator("button").click();
  await a.page.waitForURL((u) => u.pathname === `/@${post.slug}/${post.id}`);
  await a.page.waitForLoadState("networkidle");
  check("GAME-08 알림 누르면 그 글로 이동", a.page.url().includes(`/@${post.slug}/${post.id}`));
  await a.page.reload();
  check("GAME-08 누른 알림은 읽음 → 숫자 1", (await unread(a.page)) === 1, String(await unread(a.page)));

  // 모두 읽음
  await a.page.getByRole("banner").locator("[data-notification-button]").click();
  await panel.getByRole("button", { name: "모두 읽음" }).click();
  check("GAME-08 모두 읽음 → 숫자 사라짐", (await unread(a.page)) === 0);
  await a.page.waitForLoadState("networkidle"); // 저장 요청이 끝난 뒤 새로고침
  await a.page.reload();
  check("GAME-08 새로고침해도 0", (await unread(a.page)) === 0);
  await a.page.goto(`${BASE}/notifications`);
  check("GAME-08 /notifications 전체 화면에 내 알림 2개", (await a.page.locator("[data-notification-list] li").count()) === 2);
  const others = await one("SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND actor_id = $1", [a.uid]);
  check("GAME-08 자기 자신에게 온 알림은 DB에도 없음", others.n === 0);

  // ── GAME-06: 경험치 290에서 출석(+10) → Lv.3 팝업 한 번 ──
  await setExp(a.uid, 290);
  await a.page.goto(`${BASE}/attendance`);
  await a.page.getByRole("button", { name: /출석하고/ }).click();
  const modal = a.page.locator("[data-levelup-modal]");
  await modal.waitFor({ timeout: 10000 });
  check("GAME-06 출석 화면에서 바로 'Lv.3이 되었어요!'", (await modal.getByRole("heading").innerText()) === "Lv.3이 되었어요!");
  const unlocked = await modal.locator("[data-unlocked-items] li").allInnerTexts();
  check("GAME-06 'Lv.3부터 쓸 수 있는 아이템' (캐릭터 제외, 3개 + 외 1개)", (await modal.getByText("이제 이런 아이템을 쓸 수 있어요").isVisible()) && unlocked.join(",") === "장화,주름치마,침대" && (await modal.getByText("외 1개").isVisible()), unlocked.join(","));
  check("GAME-06 판다(캐릭터)는 안 보임", !(await modal.getByText("판다").isVisible()));
  check("GAME-06 Lv.3은 집 단계 그대로 (집이 커졌어요 없음)", (await modal.locator("[data-house-grown]").count()) === 0);
  await a.page.screenshot({ path: `${outDir}/b4-levelup-popup.png` });
  await modal.getByRole("button", { name: "확인" }).click();
  await a.page.waitForLoadState("networkidle");
  await a.page.reload();
  check("GAME-06 [확인] 뒤 새로고침해도 다시 안 뜸", (await a.page.locator("[data-levelup-modal]").count()) === 0);
  await a.page.getByRole("banner").locator("[data-notification-button]").click();
  await panel.locator("li").first().waitFor();
  check("GAME-06 알림함에는 '🎉 Lv.3이 되었어요!' 남음", (await panel.locator("li").first().innerText()).includes("🎉 Lv.3이 되었어요!"));
  await a.page.keyboard.press("Escape");

  // 남의 공감으로 레벨업 → 다음 화면 이동 때 팝업 (Lv.3 → Lv.4)
  const post2 = await addPost(a.uid, "두 번째 글");
  await setExp(a.uid, 598);
  await b.page.goto(post2.url);
  await b.page.getByRole("button", { name: /공감/ }).click();
  await b.page.waitForLoadState("networkidle");
  await a.page.goto(`${BASE}/notifications`);
  await a.page.locator("[data-levelup-modal]").waitFor({ timeout: 10000 });
  check("GAME-06 남의 공감으로 오른 레벨: 다음 화면에서 'Lv.4' 팝업", (await a.page.locator("[data-levelup-modal]").getByRole("heading").innerText()) === "Lv.4이 되었어요!");
  await a.page.locator("[data-levelup-modal]").getByRole("button", { name: "상점 가기" }).click();
  await a.page.waitForURL(/\/shop/);
  check("GAME-06 [상점 가기] → 상점, 팝업 닫힘", a.page.url().endsWith("/shop") && (await a.page.locator("[data-levelup-modal]").count()) === 0);

  // ── TOWN-11: 댓글 보상으로 Lv.5 → 2단계 집, 팝업에 '집이 커졌어요! (2단계)' ──
  await setExp(b.uid, 997);
  await b.page.goto(post2.url);
  await b.page.getByPlaceholder("따뜻한 댓글을 남겨 주세요 💬").fill("레벨 5 가는 댓글");
  await b.page.getByRole("button", { name: "댓글 등록" }).click();
  const bModal = b.page.locator("[data-levelup-modal]");
  await bModal.waitFor({ timeout: 10000 });
  check("GAME-06 댓글 보상으로 'Lv.5이 되었어요!'", (await bModal.getByRole("heading").innerText()) === "Lv.5이 되었어요!");
  check("TOWN-11 팝업에 '🏠 집이 커졌어요! (2단계)'", (await bModal.locator("[data-house-grown]").innerText()).includes("집이 커졌어요! (2단계)"));
  const lv5 = await bModal.locator("[data-unlocked-items] li").allInnerTexts();
  check("GAME-06 Lv.5 아이템 니트·구두·왕관", lv5.join(",") === "니트 스웨터,반짝 구두,왕관", lv5.join(","));
  await b.page.screenshot({ path: `${outDir}/b5-levelup-house.png` });
  await bModal.getByRole("button", { name: "확인" }).click();
  await b.page.goto(`${BASE}/town`);
  await b.page.waitForSelector("canvas");
  const stageB = await b.page.locator("[data-my-house-stage]").getAttribute("data-my-house-stage");
  check("TOWN-11 Lv.5 회원의 내 집은 2단계", stageB === "2", stageB);

  // ── TOWN-11: 세 단계 집을 한 광장에 (A Lv.4 → 1단계, B Lv.5 → 2단계, C Lv.15 → 3단계 내 집) ──
  await addPost(b.uid, "B의 글");
  const c = await member(C, "여자 주민", { width: 1800, height: 1460 });
  await setExp(c.uid, 10500);
  await addPost(c.uid, "C의 글");
  // 회원 광장에는 즐겨찾기한 이웃의 집만 나온다 (TOWN-04·08, batch D) → C가 A·B를 즐겨찾기
  await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, true), ($1, $3, true)", [c.uid, a.uid, b.uid]);
  await c.page.goto(`${BASE}/town`);
  await c.page.waitForSelector("canvas");
  await closePopupIfAny(c.page);
  const town = c.page.locator("[data-my-house-stage]");
  const stages = Object.fromEntries((await town.getAttribute("data-neighbor-stages")).split(",").map((s) => s.split(":")));
  check("TOWN-11 Lv.15 내 집은 3단계", (await town.getAttribute("data-my-house-stage")) === "3");
  check("TOWN-11 이웃 Lv.4 → 1단계, Lv.5 → 2단계", stages[A] === "1" && stages[B] === "2", JSON.stringify({ [A]: stages[A], [B]: stages[B] }));
  await c.page.waitForTimeout(1200);
  await c.page.screenshot({ path: `${outDir}/b6-town-house-stages.png` });

  const errors = errorsAll.flat();
  check("콘솔 오류 없음", errors.length === 0, errors.slice(0, 3).join(" / "));
} catch (e) {
  results.push(`❌ 실행 중 오류: ${e.message}`);
} finally {
  console.log(results.join("\n"));
  await browser.close();
  await db.end();
  if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
}
