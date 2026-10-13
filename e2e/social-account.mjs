// 소셜 로그인 연동 보상(🪙 100)과 한 회원 = 아이디 하나(/account-setup)를 처음부터 끝까지 확인
// 로컬에는 소셜 키가 없어서 소셜 쪽은 이렇게 흉내 낸다:
//   - "소셜로 처음 들어온 회원": DB에 users 행 + accounts 행(provider_id = kakao/naver/google, credential·프로필 없음)
//     + sessions 행을 바로 넣고, 브라우저에는 Better Auth와 같은 방식(HMAC-SHA256, BETTER_AUTH_SECRET)으로 서명한
//     better-auth.session_token 쿠키를 넣는다.
//   - "프로필 메뉴 [연동하기]": OAuth 콜백의 마지막 단계(internalAdapter.createAccount)를 e2e/social-link-hook.ts가
//     그대로 부른다 → src/lib/auth.ts databaseHooks.account.create.after → grantSocialLinkReward (실제 코드 그대로)
// 사용: 개발 서버를 띄운 상태에서 BASE_URL=http://localhost:3200 node e2e/social-account.mjs <스크린샷 폴더>
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createHmac, randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

// 소셜 연동 보상 기록은 소셜 번호 대신 해시로 남는다 (src/server/points.ts socialAccountHash와 같은 계산)
const rewardHash = (provider, accountId) => createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(`${provider}:${accountId}`).digest("hex");

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const run = Date.now().toString(36).slice(-6);
const PW = "test-password-1234";

/** 소셜로 처음 로그인한 것처럼: 빈 회원 + 소셜 계정 + 세션. 반환: { uid, cookie } */
async function socialUser(provider, accountId) {
  const uid = randomUUID();
  await db.query("INSERT INTO users (id, name, email) VALUES ($1, $2, $3)", [uid, `${provider}친구`, `${provider}_${accountId}@${provider}.blogcabin.invalid`]);
  await db.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, $3, $4)", [randomUUID(), uid, provider, accountId]);
  const token = randomUUID().replaceAll("-", "");
  await db.query("INSERT INTO sessions (id, token, user_id, expires_at) VALUES ($1, $2, $3, now() + interval '7 days')", [randomUUID(), token, uid]);
  const sig = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
  return { uid, cookie: { name: "better-auth.session_token", value: encodeURIComponent(`${token}.${sig}`), url: BASE } };
}
/** 이 화면이 생기기 전에 소셜로 주민 등록까지 마친 회원 (아이디·비밀번호 없음) */
async function legacySocialMember(provider, accountId, slug) {
  const s = await socialUser(provider, accountId);
  const { id: charId } = await one("SELECT id FROM items WHERE code = 'char_boy'");
  const { id: bgId } = await one("SELECT id FROM items WHERE code = 'bg_meadow'");
  const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2), ($1, $3)", [s.uid, charId, bgId]);
  await db.query("INSERT INTO profiles (user_id, nickname, character_item_id, invite_code) VALUES ($1, $2, $3, $4)", [s.uid, slug.slice(0, 12), charId, code]);
  await db.query("INSERT INTO blogs (owner_id, slug, title, background_item_id) VALUES ($1, $2, $3, $4)", [s.uid, slug, "옛 소셜 집", bgId]);
  return s;
}
/** 프로필 메뉴 [연동하기] → 소셜 로그인 → 콜백에서 accounts 행이 생기는 단계 (훅·보상은 실제 코드) */
function linkSocial(userId, provider, accountId) {
  const out = execFileSync("npx", ["tsx", "--conditions=react-server", "e2e/social-link-hook.ts", userId, provider, accountId], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop());
}
async function linkSocialAsync(userId, provider, accountId) {
  const { stdout } = await promisify(execFile)("npx", ["tsx", "--conditions=react-server", "e2e/social-link-hook.ts", userId, provider, accountId], { encoding: "utf8" });
  return JSON.parse(stdout.trim().split("\n").pop());
}
const socialRows = async (uid) =>
  (await db.query("SELECT ref_id, coin_delta, exp_delta FROM point_ledger WHERE user_id = $1 AND reason = 'social_link' ORDER BY id", [uid])).rows;
const coinSum = async (uid) => (await one("SELECT COALESCE(sum(coin_delta), 0)::int AS c FROM point_ledger WHERE user_id = $1", [uid])).c;
const userCount = async () => (await one("SELECT count(*)::int AS n FROM users")).n;
const uidOf = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username]))?.id;

const browser = await chromium.launch();
const allErrors = [];
const newPage = async (social) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (social) await ctx.addCookies([social.cookie]);
  const page = await ctx.newPage();
  page.errors = collectErrors(page);
  allErrors.push(page.errors);
  return page;
};
async function onboard(page, nick, slug) {
  await page.locator('input[name="nickname"]').fill(nick);
  await page.locator('input[name="blogTitle"]').fill(`${nick}집`.slice(0, 12));
  await page.locator('input[name="slug"]').fill(slug);
  await page.locator("label", { hasText: "짧은 머리" }).click();
  await page.getByRole("button", { name: /광장으로 출발/ }).click();
  await page.waitForURL(/town/);
}
async function mergeInto(page, username, password) {
  await page.getByRole("tab", { name: "이미 아이디가 있어요" }).click();
  const form = page.locator("form").first();
  await form.getByLabel("아이디").fill(username);
  await form.getByLabel("비밀번호", { exact: true }).fill(password);
  await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
}
async function createId(page, username, password = PW) {
  const form = page.locator("form").first();
  await form.getByLabel("아이디").fill(username);
  await form.getByLabel("비밀번호", { exact: true }).fill(password);
  await form.getByLabel("비밀번호 확인").fill(password);
  await form.getByRole("button", { name: "아이디 만들기" }).click();
}
const sessionUser = (page) => page.evaluate(async () => (await (await fetch("/api/auth/get-session")).json())?.user ?? null);

// ── 1. 아이디 회원이 프로필 메뉴에서 카카오 연동 → 🪙100 한 번, 다시는 0, 지갑에 "소셜 로그인 연동" ──
{
  const id = `sa${run}`;
  const page = await newPage();
  await loginDev(page, id);
  const uid = await uidOf(id);
  const before = await coinSum(uid);
  // 연동 전: 메뉴에 카카오 줄이 없다 (로컬은 소셜 키가 없어서 꺼진 소셜은 안 보인다)
  await page.getByRole("button", { name: /내 정보/ }).click();
  check("연동 전 메뉴에는 아이디만", (await page.locator("[data-login-method]").count()) === 1);
  await page.keyboard.press("Escape");

  const r1 = linkSocial(uid, "kakao", `ka${run}`);
  check("카카오 연동(accounts 행 생성)", r1.ok, JSON.stringify(r1));
  const rows1 = await socialRows(uid);
  check("연동하면 🪙100 (경험치 0)", rows1.length === 1 && rows1[0].coin_delta === 100 && rows1[0].exp_delta === 0 && rows1[0].ref_id === `kakao:ka${run}`, JSON.stringify(rows1));
  check("잔액 +100", (await coinSum(uid)) - before === 100);
  check("준 기록(social_link_rewards)", Boolean(await one("SELECT 1 AS ok FROM social_link_rewards WHERE provider_id = 'kakao' AND account_hash = $1", [rewardHash("kakao", `ka${run}`)])));

  // 연동하고 돌아온 화면(?linked=kakao): 한 번 알림, 헤더 코인·메뉴 ✓
  let alertText = "";
  page.once("dialog", (d) => {
    alertText = d.message();
    d.accept();
  });
  await page.goto(`${BASE}/town?linked=kakao`);
  await page.waitForTimeout(800);
  check("돌아오면 '🪙 100을 받았어요' 알림", alertText.includes("100을 받았어요"), alertText);
  check("알림 뒤 주소에서 ?linked 지움", !page.url().includes("linked="), page.url());
  check("헤더 코인에 반영", (await coins(page)) === before + 100, String(await coins(page)));
  await page.getByRole("button", { name: /내 정보/ }).click();
  const kakaoRow = page.locator('[data-login-method="kakao"]');
  check("메뉴에 카카오 ✓ 연결됨", (await kakaoRow.getAttribute("data-linked")) === "true" && (await kakaoRow.getByText("연결됨").isVisible()));
  check("받은 소셜에는 +🪙100 표시 없음", (await kakaoRow.locator("[data-link-reward]").count()) === 0);
  await page.screenshot({ path: `${outDir}/sa1-menu.png` });
  await page.keyboard.press("Escape");

  // 같은 소셜 계정을 다시 연동 (이미 붙어 있음) → 새 행 없음, 0
  const r2 = linkSocial(uid, "kakao", `ka${run}`);
  check("같은 카카오 계정 다시 연동 → 0", r2.ok && r2.existed && (await socialRows(uid)).length === 1);
  // 같은 회원이 다른 카카오 계정을 또 붙여도 → 카카오 몫은 이미 받아서 0
  const r3 = linkSocial(uid, "kakao", `kb${run}`);
  check("다른 카카오 계정을 또 붙여도 0 (회원·소셜당 한 번)", r3.ok && (await socialRows(uid)).length === 1 && (await coinSum(uid)) - before === 100);
  check("받지 못한 두 번째 카카오는 준 기록도 남기지 않음", !(await one("SELECT 1 AS ok FROM social_link_rewards WHERE account_hash = $1", [rewardHash("kakao", `kb${run}`)])));

  // 이미 받은 소셜이면 돌아와도 "받았어요"가 아니라 "연동했어요"
  await page.evaluate(() => sessionStorage.setItem("bc_link_rewarded_before", JSON.stringify({ provider: "kakao", before: true })));
  alertText = "";
  page.once("dialog", (d) => {
    alertText = d.message();
    d.accept();
  });
  await page.goto(`${BASE}/town?linked=kakao`);
  await page.waitForTimeout(800);
  check("이미 받은 소셜이면 '연동을 마쳤어요'만", alertText.includes("연동을 마쳤어요") && !alertText.includes("받았어요"), alertText);

  // 네이버도 연동 → 또 🪙100 (소셜마다)
  linkSocial(uid, "naver", `na${run}`);
  check("네이버 연동 → 또 🪙100", (await socialRows(uid)).length === 2 && (await coinSum(uid)) - before === 200);

  await page.goto(`${BASE}/wallet`);
  check("지갑에 '소셜 로그인 연동' 사유", (await page.getByText("소셜 로그인 연동").count()) === 2);
  await page.screenshot({ path: `${outDir}/sa1-wallet.png` });
  await page.context().close();
}

// ── 2. 소셜로 처음 → /account-setup 문 → 새로 시작해요 → 주민 등록에서 🪙100 → 새 아이디로 로그인 ──
{
  const K = `kc${run}`;
  const s = await socialUser("kakao", K);
  const page = await newPage(s);
  for (const path of ["/town", "/onboarding", "/", "/wallet"]) {
    await page.goto(`${BASE}${path}`);
    check(`아이디 없는 소셜 회원: ${path} → /account-setup`, page.url().endsWith("/account-setup"), page.url());
  }
  check("새로 시작해요 / 이미 아이디가 있어요 두 갈래", (await page.getByRole("tab").count()) === 2);
  await page.screenshot({ path: `${outDir}/sa2-gate.png` });
  const newId = `sb${run}`;
  await createId(page, newId);
  await page.waitForURL(/onboarding/);
  check("아이디를 만들면 주민 등록으로", true);
  check("주민 등록 전에는 보상 없음", (await socialRows(s.uid)).length === 0);
  await page.goto(`${BASE}/town`);
  check("아이디를 만든 뒤 /town은 주민 등록으로", page.url().includes("/onboarding"), page.url());
  await onboard(page, `소셜${run.slice(-4)}`, newId);
  const rows = await socialRows(s.uid);
  check("주민 등록을 마치면 카카오 몫 🪙100", rows.length === 1 && rows[0].ref_id === `kakao:${K}`, JSON.stringify(rows));
  check("헤더 코인에 연동 보상 포함", (await coins(page)) === (await coinSum(s.uid)), String(await coins(page)));
  await page.context().close();

  const p2 = await newPage();
  await p2.goto(BASE);
  await p2.getByLabel("아이디").fill(newId);
  await p2.getByLabel("비밀번호", { exact: true }).fill(PW);
  await p2.getByRole("button", { name: "로그인", exact: true }).click();
  await p2.waitForURL(/town/);
  check("만든 아이디·비밀번호로 로그인 된다", (await sessionUser(p2))?.id === s.uid);
  await p2.context().close();
}

// ── 3. 소셜로 처음 → 이미 아이디가 있어요: 틀린 비밀번호, 5번 잠금, 맞으면 합치기 ──
{
  const memberId = `sc${run}`;
  const m = await newPage();
  await loginDev(m, memberId);
  await m.context().close();
  const memberUid = await uidOf(memberId);
  const before = await coinSum(memberUid);
  const countBefore = await userCount();

  const K = `kd${run}`;
  const s = await socialUser("kakao", K);
  const page = await newPage(s);
  await page.goto(`${BASE}/account-setup`);
  await mergeInto(page, memberId, "wrong-password-1");
  await page.getByText("아이디 또는 비밀번호가 맞지 않아요").waitFor();
  check("틀린 비밀번호 → 오류, 합치지 않음", (await one("SELECT user_id FROM accounts WHERE account_id = $1", [K])).user_id === s.uid);
  check("틀리면 로그인 실패 횟수 +1", (await one("SELECT failures FROM login_attempts WHERE login_key = $1", [memberId]))?.failures === 1);
  check("틀려도 브라우저는 그대로 소셜 회원", (await sessionUser(page))?.id === s.uid);
  await page.screenshot({ path: `${outDir}/sa3-wrong.png` });

  await mergeInto(page, memberId, PW);
  await page.waitForURL(/account-setup\/done/);
  check("맞으면 카카오가 기존 회원으로 옮겨짐", (await one("SELECT user_id FROM accounts WHERE provider_id = 'kakao' AND account_id = $1", [K]))?.user_id === memberUid);
  check("빈 소셜 회원은 지워짐 (회원 수 그대로)", !(await one("SELECT id FROM users WHERE id = $1", [s.uid])) && (await userCount()) === countBefore);
  check("프로필 있는 회원이라 그 자리에서 🪙100", (await coinSum(memberUid)) - before === 100 && (await socialRows(memberUid)).length === 1);
  check("결과 화면에 보상 안내", await page.getByText(/연동 보상/).isVisible());
  check("세션이 기존 회원으로 바뀜", (await sessionUser(page))?.id === memberUid);
  check("성공하면 실패 횟수 초기화", !(await one("SELECT failures FROM login_attempts WHERE login_key = $1", [memberId])));
  await page.screenshot({ path: `${outDir}/sa3-merged.png` });
  await page.getByRole("link", { name: "광장으로 가기" }).click();
  await page.waitForURL(/town/);
  await page.getByRole("button", { name: /내 정보/ }).click();
  check("기존 회원 메뉴에 카카오 ✓", (await page.locator('[data-login-method="kakao"]').getAttribute("data-linked")) === "true");
  await page.context().close();

  // 5번 틀리면 맞는 비밀번호도 5분 동안 막힌다
  const lockId = `sd${run}`;
  const l = await newPage();
  await loginDev(l, lockId);
  await l.context().close();
  const g = await socialUser("google", `gd${run}`);
  const lp = await newPage(g);
  await lp.goto(`${BASE}/account-setup`);
  await lp.getByRole("tab", { name: "이미 아이디가 있어요" }).click();
  const form = lp.locator("form").first();
  for (let i = 0; i < 5; i++) {
    await form.getByLabel("아이디").fill(lockId);
    await form.getByLabel("비밀번호", { exact: true }).fill(`wrong-password-${i}`);
    await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
    await lp.getByRole("button", { name: "내 아이디에 합치기" }).waitFor();
    await lp.waitForTimeout(300);
  }
  check("5번 틀리면 잠김", Boolean((await one("SELECT locked_until > now() AS l FROM login_attempts WHERE login_key = $1", [lockId]))?.l));
  await form.getByLabel("비밀번호", { exact: true }).fill(PW);
  await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
  await lp.getByText("로그인을 너무 많이 시도했어요").waitFor();
  check("잠긴 동안은 맞는 비밀번호도 막힘 (합치지 않음)", (await one("SELECT user_id FROM accounts WHERE account_id = $1", [`gd${run}`])).user_id === g.uid);
  await lp.screenshot({ path: `${outDir}/sa3-locked.png` });
  await db.query("DELETE FROM login_attempts WHERE login_key = $1", [lockId]);
  await lp.context().close();
}

// ── 3-1. 아직 주민 등록 전인 아이디 회원에 합치면 그때는 0, 주민 등록을 마칠 때 🪙100 ──
{
  const id = `se${run}`;
  const m = await newPage();
  await m.goto(BASE);
  await m.getByRole("tab", { name: "회원가입" }).click();
  await m.getByLabel("아이디").fill(id);
  await m.getByLabel("비밀번호", { exact: true }).fill(PW);
  await m.getByLabel("비밀번호 확인").fill(PW);
  await m.getByRole("button", { name: "회원가입", exact: true }).click();
  await m.waitForURL(/onboarding/);
  await m.context().close();
  const uid = await uidOf(id);
  const s = await socialUser("naver", `ne${run}`);
  const page = await newPage(s);
  await page.goto(`${BASE}/account-setup`);
  await mergeInto(page, id, PW);
  await page.waitForURL(/account-setup\/done/);
  check("주민 등록 전 회원에 합치면 그때는 0", (await socialRows(uid)).length === 0);
  check("결과 화면 버튼은 '주민 등록하러 가기'", await page.getByRole("link", { name: "주민 등록하러 가기" }).isVisible());
  await page.getByRole("link", { name: "주민 등록하러 가기" }).click();
  await page.waitForURL(/onboarding/);
  await onboard(page, `합침${run.slice(-4)}`, id);
  check("주민 등록을 마치면 네이버 몫 🪙100", (await socialRows(uid)).length === 1);
  await page.context().close();
}

// ── 4. 예전 소셜 회원(프로필 있음, 비밀번호 없음) → 문 → 새로 시작해요 → 그 자리에서 🪙100 ──
{
  const s = await legacySocialMember("kakao", `kf${run}`, `sf${run}`);
  const page = await newPage(s);
  await page.goto(`${BASE}/town`);
  check("예전 소셜 회원도 /account-setup으로", page.url().endsWith("/account-setup"), page.url());
  check("합치기 탭 없이 아이디 만들기만", (await page.getByRole("tab", { name: "이미 아이디가 있어요" }).count()) === 0);
  check("아이디를 만들기 전에는 보상 없음", (await socialRows(s.uid)).length === 0);
  await createId(page, `sf${run}`);
  await page.waitForURL(/town/);
  const rows = await socialRows(s.uid);
  check("아이디를 만들면 바로 카카오 몫 🪙100", rows.length === 1 && rows[0].coin_delta === 100, JSON.stringify(rows));
  check("헤더 코인 100", (await coins(page)) === 100, String(await coins(page)));
  await page.screenshot({ path: `${outDir}/sa4-legacy.png` });
  await page.context().close();
}

// ── 5. 같은 카카오 계정으로는 사이트 전체에서 한 번만 ──
{
  const K = `kg${run}`;
  const a = await newPage();
  await loginDev(a, `sg${run}`);
  await a.context().close();
  const aUid = await uidOf(`sg${run}`);
  linkSocial(aUid, "kakao", K);
  check("A가 카카오 K 연동 → 🪙100", (await socialRows(aUid)).length === 1);

  const b = await newPage();
  await loginDev(b, `sh${run}`);
  await b.context().close();
  const bUid = await uidOf(`sh${run}`);
  const busy = linkSocial(bUid, "kakao", K);
  check("A에 붙어 있는 K는 B에 연동되지 않음", !busy.ok && busy.error === "account_already_linked_to_different_user", JSON.stringify(busy));

  // A에서 K를 떼어 낸 뒤(나중에 생길 연동 해제) B에 붙여도 보상은 다시 없다
  await db.query("DELETE FROM accounts WHERE provider_id = 'kakao' AND account_id = $1", [K]);
  const moved = linkSocial(bUid, "kakao", K);
  check("떼어 낸 K를 B에 연동", moved.ok);
  check("같은 K라서 B는 0", (await socialRows(bUid)).length === 0 && (await coinSum(bUid)) === (await one("SELECT COALESCE(sum(coin_delta),0)::int AS c FROM point_ledger WHERE user_id = $1 AND reason <> 'social_link'", [bUid])).c);

  // A가 탈퇴해 원장이 지워져도, K로 새로 가입한 회원은 0
  await db.query("DELETE FROM accounts WHERE provider_id = 'kakao' AND account_id = $1", [K]);
  await db.query("DELETE FROM users WHERE id = $1", [aUid]);
  check("A 탈퇴 뒤에도 준 기록은 남음", Boolean(await one("SELECT 1 AS ok FROM social_link_rewards WHERE provider_id = 'kakao' AND account_hash = $1", [rewardHash("kakao", K)])));
  const s = await socialUser("kakao", K);
  const page = await newPage(s);
  await page.goto(`${BASE}/account-setup`);
  await createId(page, `si${run}`);
  await page.waitForURL(/onboarding/);
  await onboard(page, `다시${run.slice(-4)}`, `si${run}`);
  check("같은 K로 새로 시작해 주민 등록해도 0", (await socialRows(s.uid)).length === 0, JSON.stringify(await socialRows(s.uid)));
  await page.context().close();

  // 동시에 두 번 연동이 들어와도(같은 회원·같은 소셜) 한 번만
  const c = await newPage();
  await loginDev(c, `sj${run}`);
  await c.context().close();
  const cUid = await uidOf(`sj${run}`);
  await Promise.all([`kj1${run}`, `kj2${run}`, `kj3${run}`].map((acc) => linkSocialAsync(cUid, "kakao", acc)));
  check("같은 회원·카카오 연동이 겹쳐도 한 번만", (await socialRows(cUid)).length === 1);
}

const errs = allErrors.flat();
check("화면 오류 없음", errs.length === 0, errs.slice(0, 3).join(" | "));
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✅")).length} ✅ / ${results.filter((r) => r.startsWith("❌")).length} ❌`);
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
