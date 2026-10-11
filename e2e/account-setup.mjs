// 한 회원 = 아이디 하나 (/account-setup) + 소셜 연동 보상 🪙 100
// 로컬에는 소셜 키가 없어서 "소셜로 처음 들어온 회원"을 DB에 바로 만든다:
//   users 행 + accounts 행(provider_id = kakao/naver/google, credential 없음, 프로필 없음) + sessions 행,
//   브라우저에는 Better Auth와 같은 방식으로 서명한 better-auth.session_token 쿠키를 넣는다.
// 사용: 개발 서버를 띄운 상태에서 BASE_URL=http://localhost:3200 node e2e/account-setup.mjs <스크린샷 폴더>
import { createHmac, randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const run = String(Date.now()).slice(-6);
const PW = "test-password-1234";

/** 소셜로 처음 로그인한 것처럼: 빈 회원 + 소셜 계정 + 세션. 반환: { uid, cookie } */
async function socialUser(provider, accountId, name = `${provider}친구`) {
  const uid = randomUUID();
  await db.query("INSERT INTO users (id, name, email) VALUES ($1, $2, $3)", [uid, name, `${provider}_${accountId}@${provider}.blogcabin.invalid`]);
  await db.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, $3, $4)", [randomUUID(), uid, provider, accountId]);
  const token = randomUUID().replaceAll("-", "");
  await db.query("INSERT INTO sessions (id, token, user_id, expires_at) VALUES ($1, $2, $3, now() + interval '7 days')", [randomUUID(), token, uid]);
  const sig = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
  return { uid, cookie: { name: "better-auth.session_token", value: encodeURIComponent(`${token}.${sig}`), url: BASE } };
}
const ledger = async (uid, reason = "social_link") =>
  (await db.query("SELECT ref_id, coin_delta FROM point_ledger WHERE user_id = $1 AND reason = $2", [uid, reason])).rows;
const userCount = async () => (await one("SELECT count(*)::int AS n FROM users")).n;

const browser = await chromium.launch();
const newPage = async (social) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (social) await ctx.addCookies([social.cookie]);
  const page = await ctx.newPage();
  page.errors = collectErrors(page);
  return page;
};
async function onboard(page, nick, slug) {
  await page.locator('input[name="nickname"]').fill(nick);
  await page.locator('input[name="blogTitle"]').fill(`${nick}집`.slice(0, 12));
  await page.locator('input[name="slug"]').fill(slug);
  await page.locator("label", { hasText: "남자 주민" }).click();
  await page.getByRole("button", { name: /광장으로 출발/ }).click();
  await page.waitForURL(/town/);
}

// ── 1. 카카오 처음 → 새로 시작해요 → 주민 등록 → 🪙100, 아이디로도 로그인 ──
{
  const s = await socialUser("kakao", `k1${run}`);
  const page = await newPage(s);
  await page.goto(`${BASE}/town`);
  check("아이디 없는 소셜 회원은 /town → /account-setup", page.url().endsWith("/account-setup"), page.url());
  await page.goto(`${BASE}/onboarding`);
  check("주민 등록 화면도 /account-setup으로", page.url().endsWith("/account-setup"), page.url());
  await page.goto(`${BASE}/wallet`);
  check("회원 화면(지갑)도 /account-setup으로", page.url().endsWith("/account-setup"), page.url());
  await page.goto(`${BASE}/`);
  check("첫 화면도 /account-setup으로", page.url().endsWith("/account-setup"), page.url());
  check("안내 한 줄", await page.getByText("어느 소셜로 들어와도 같은 집으로 와요").isVisible());
  await page.screenshot({ path: `${outDir}/s1-account-setup.png` });

  const form = page.locator("form");
  const tryNew = async (u, pw = PW, pw2 = pw) => {
    await form.getByLabel("아이디").fill(u);
    await form.getByLabel("비밀번호", { exact: true }).fill(pw);
    await form.getByLabel("비밀번호 확인").fill(pw2);
    await form.getByRole("button", { name: "아이디 만들기" }).click();
  };
  await tryNew("admin");
  await page.getByText("이미 있는 아이디예요").waitFor();
  check("남겨 둔 아이디(admin)는 막는다", true);
  await page.screenshot({ path: `${outDir}/s1-reserved.png` });
  await tryNew(`kk${run}`, PW, "different-pass-1");
  await page.getByText("비밀번호가 서로 달라요").waitFor();
  check("비밀번호 확인이 다르면 막는다", true);
  const taken = await one("SELECT username FROM users WHERE username IS NOT NULL AND role = 'user' LIMIT 1");
  if (taken) {
    await tryNew(taken.username);
    await page.getByText("이미 있는 아이디예요").waitFor();
    check("이미 있는 아이디는 막는다", true, taken.username);
  }
  await tryNew(`kk${run}`);
  await page.waitForURL(/onboarding/);
  check("아이디를 만들면 주민 등록으로", true);
  const u = await one("SELECT username, display_username FROM users WHERE id = $1", [s.uid]);
  const cred = await one("SELECT count(*)::int AS n FROM accounts WHERE user_id = $1 AND provider_id = 'credential'", [s.uid]);
  check("username·displayUsername·credential 저장", u.username === `kk${run}` && u.display_username === `kk${run}` && cred.n === 1);
  check("주민 등록 전에는 연동 보상 없음", (await ledger(s.uid)).length === 0);
  await onboard(page, `카카${run.slice(-4)}`, `kk${run}`);
  const l = await ledger(s.uid);
  check("주민 등록을 마치면 카카오 몫 🪙100", l.length === 1 && l[0].coin_delta === 100 && l[0].ref_id === `kakao:k1${run}`, JSON.stringify(l));
  await page.screenshot({ path: `${outDir}/s1-town.png` });

  // 아이디로도 로그인 된다 (새 브라우저)
  const p2 = await newPage();
  await p2.goto(BASE);
  await p2.getByLabel("아이디").fill(`kk${run}`);
  await p2.getByLabel("비밀번호", { exact: true }).fill(PW);
  await p2.getByRole("button", { name: "로그인", exact: true }).click();
  await p2.waitForURL(/town/);
  check("만든 아이디로 로그인 된다", true);
  await p2.context().close();
  check("화면 오류 없음 (1)", page.errors.length === 0, page.errors.join(" | "));
  await page.context().close();
}

// ── 2. 기존 아이디 회원 + 카카오 처음 → 이미 아이디가 있어요 → 합치기 ──
const memberId = `mm${run}`;
{
  const m = await newPage();
  await loginDev(m, memberId);
  await m.context().close();
}
const member = await one("SELECT id FROM users WHERE username = $1", [memberId]);
{
  const before = await one("SELECT COALESCE(sum(coin_delta),0)::int AS c FROM point_ledger WHERE user_id = $1", [member.id]);
  const s = await socialUser("kakao", `k2${run}`);
  const countWithSocial = await userCount();
  const page = await newPage(s);
  await page.goto(`${BASE}/account-setup`);
  await page.getByRole("tab", { name: "이미 아이디가 있어요" }).click();
  const form = page.locator("form");
  await form.getByLabel("아이디").fill(memberId);
  await form.getByLabel("비밀번호", { exact: true }).fill("wrong-password-1");
  await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
  await page.getByText("아이디 또는 비밀번호가 맞지 않아요").waitFor();
  check("틀린 비밀번호면 합치지 않는다", (await one("SELECT user_id FROM accounts WHERE account_id = $1", [`k2${run}`])).user_id === s.uid);
  const attempts = await one("SELECT failures FROM login_attempts WHERE login_key = $1", [memberId]);
  check("틀리면 로그인 실패 횟수에 들어간다", attempts?.failures === 1, JSON.stringify(attempts));
  await page.screenshot({ path: `${outDir}/s2-wrong.png` });
  await form.getByLabel("비밀번호", { exact: true }).fill(PW);
  await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
  await page.waitForURL(/account-setup\/done/);
  await page.screenshot({ path: `${outDir}/s2-merged.png` });
  const acc = await one("SELECT user_id FROM accounts WHERE provider_id = 'kakao' AND account_id = $1", [`k2${run}`]);
  check("카카오 계정이 기존 회원으로 옮겨졌다", acc.user_id === member.id);
  check("빈 소셜 회원은 지워졌다 (회원 수 그대로)", !(await one("SELECT id FROM users WHERE id = $1", [s.uid])) && (await userCount()) === countWithSocial - 1);
  const after = await one("SELECT COALESCE(sum(coin_delta),0)::int AS c FROM point_ledger WHERE user_id = $1", [member.id]);
  check("합치면 그 자리에서 🪙100", after.c - before.c === 100, `${before.c} → ${after.c}`);
  check("결과 화면에 보상 안내", await page.getByText(/연동 보상/).isVisible());
  check("성공하면 실패 횟수 초기화", !(await one("SELECT failures FROM login_attempts WHERE login_key = $1", [memberId])));
  await page.getByRole("link", { name: "광장으로 가기" }).click();
  await page.waitForURL(/town/);
  // 브라우저 로그인이 기존 회원으로 바뀌었다: 프로필 메뉴에 카카오 ✓
  await page.getByRole("banner").getByRole("button", { name: /내 정보|프로필|메뉴/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/s2-town-menu.png` });
  const loggedAs = await page.evaluate(async () => (await (await fetch("/api/auth/get-session")).json())?.user?.username);
  check("브라우저 세션이 기존 회원으로 바뀌었다", loggedAs === memberId, loggedAs);
  check("화면 오류 없음 (2)", page.errors.length === 0, page.errors.join(" | "));
  await page.context().close();
}

// ── 3. 같은 소셜(카카오)이 이미 붙은 회원에 다른 카카오 계정을 합치면 옮기지 않고 안내 ──
{
  const before = await one("SELECT COALESCE(sum(coin_delta),0)::int AS c FROM point_ledger WHERE user_id = $1", [member.id]);
  const s = await socialUser("kakao", `k3${run}`);
  const page = await newPage(s);
  await page.goto(`${BASE}/account-setup`);
  await page.getByRole("tab", { name: "이미 아이디가 있어요" }).click();
  const form = page.locator("form");
  await form.getByLabel("아이디").fill(memberId);
  await form.getByLabel("비밀번호", { exact: true }).fill(PW);
  await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
  await page.waitForURL(/account-setup\/done/);
  check("이미 붙은 소셜이면 안내", await page.getByText(/이미 다른 카카오 계정이 연결돼 있어서/).isVisible());
  await page.screenshot({ path: `${outDir}/s3-skipped.png` });
  const kakaoCount = await one("SELECT count(*)::int AS n FROM accounts WHERE user_id = $1 AND provider_id = 'kakao'", [member.id]);
  check("카카오는 여전히 하나", kakaoCount.n === 1);
  check("빈 회원과 붙지 않은 카카오 계정은 지워졌다", !(await one("SELECT id FROM users WHERE id = $1", [s.uid])) && !(await one("SELECT id FROM accounts WHERE account_id = $1", [`k3${run}`])));
  const after = await one("SELECT COALESCE(sum(coin_delta),0)::int AS c FROM point_ledger WHERE user_id = $1", [member.id]);
  check("보상은 다시 주지 않는다", after.c === before.c);
  await page.context().close();
}

// ── 4. 네이버 처음 → 같은 회원에 합치기 → 🪙100 (회원·소셜마다) ──
{
  const before = await one("SELECT COALESCE(sum(coin_delta),0)::int AS c FROM point_ledger WHERE user_id = $1", [member.id]);
  const s = await socialUser("naver", `n4${run}`);
  const page = await newPage(s);
  await page.goto(`${BASE}/account-setup`);
  await page.getByRole("tab", { name: "이미 아이디가 있어요" }).click();
  const form = page.locator("form");
  await form.getByLabel("아이디").fill(memberId);
  await form.getByLabel("비밀번호", { exact: true }).fill(PW);
  await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
  await page.waitForURL(/account-setup\/done/);
  const after = await one("SELECT COALESCE(sum(coin_delta),0)::int AS c FROM point_ledger WHERE user_id = $1", [member.id]);
  check("네이버를 합치면 또 🪙100", after.c - before.c === 100);
  await page.goto(`${BASE}/wallet`);
  check("지갑에 '소셜 로그인 연동' 사유", await page.getByText("소셜 로그인 연동").first().isVisible());
  await page.screenshot({ path: `${outDir}/s4-wallet.png` });
  await page.context().close();
}

// ── 5. 로그인 시도 제한: 합치기에서 5번 틀리면 5분 잠금 ──
{
  const lockId = `lk${run}`;
  const m = await newPage();
  await loginDev(m, lockId);
  await m.context().close();
  const s = await socialUser("google", `g5${run}`);
  const page = await newPage(s);
  await page.goto(`${BASE}/account-setup`);
  await page.getByRole("tab", { name: "이미 아이디가 있어요" }).click();
  const form = page.locator("form");
  for (let i = 0; i < 5; i++) {
    await form.getByLabel("아이디").fill(lockId);
    await form.getByLabel("비밀번호", { exact: true }).fill(`wrong-password-${i}`);
    await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
    await page.getByRole("button", { name: "내 아이디에 합치기" }).waitFor();
    await page.waitForTimeout(300);
  }
  await form.getByLabel("비밀번호", { exact: true }).fill(PW);
  await form.getByRole("button", { name: "내 아이디에 합치기" }).click();
  await page.getByText("로그인을 너무 많이 시도했어요").waitFor();
  check("5번 틀리면 맞는 비밀번호도 5분 동안 막힌다", (await one("SELECT user_id FROM accounts WHERE account_id = $1", [`g5${run}`])).user_id === s.uid);
  await page.screenshot({ path: `${outDir}/s5-locked.png` });
  // 정리: 잠금과 시험용 소셜 회원
  await db.query("DELETE FROM login_attempts WHERE login_key = $1", [lockId]);
  await db.query("DELETE FROM users WHERE id = $1", [s.uid]);
  await page.context().close();
}

// ── 6. 이 화면이 생기기 전에 소셜로 주민 등록까지 마친 회원 → 아이디 만들기만, 만들면 🪙100 ──
{
  const s = await socialUser("google", `g6${run}`);
  const { id: charId } = await one("SELECT id FROM items WHERE code = 'char_boy'");
  const { id: bgId } = await one("SELECT id FROM items WHERE code = 'bg_meadow'");
  await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2), ($1, $3)", [s.uid, charId, bgId]);
  await db.query("INSERT INTO profiles (user_id, nickname, character_item_id, invite_code) VALUES ($1, $2, $3, $4)", [s.uid, `구글${run.slice(-4)}`, charId, Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("")]);
  await db.query("INSERT INTO blogs (owner_id, slug, title, background_item_id) VALUES ($1, $2, $3, $4)", [s.uid, `gg${run}`, "구글집", bgId]);
  const page = await newPage(s);
  await page.goto(`${BASE}/town`);
  check("주민 등록을 마친 소셜 회원도 /account-setup으로", page.url().endsWith("/account-setup"));
  check("합치기 탭은 없다", (await page.getByRole("tab", { name: "이미 아이디가 있어요" }).count()) === 0);
  await page.screenshot({ path: `${outDir}/s6-member-setup.png` });
  const form = page.locator("form");
  await form.getByLabel("아이디").fill(`gg${run}`);
  await form.getByLabel("비밀번호", { exact: true }).fill(PW);
  await form.getByLabel("비밀번호 확인").fill(PW);
  await form.getByRole("button", { name: "아이디 만들기" }).click();
  await page.waitForURL(/town/);
  const l = await ledger(s.uid);
  check("아이디를 만들면 바로 구글 몫 🪙100", l.length === 1 && l[0].coin_delta === 100, JSON.stringify(l));
  check("헤더 코인에 반영", (await coins(page)) === 100, String(await coins(page)));
  await page.screenshot({ path: `${outDir}/s6-town.png` });
  await page.context().close();
}

// ── 7. 방문자·아이디 회원은 그대로 ──
{
  const v = await newPage();
  await v.goto(`${BASE}/town`);
  check("방문자는 광장을 그대로 본다", v.url().endsWith("/town"));
  await v.context().close();
  const m = await newPage();
  await loginDev(m, memberId);
  check("아이디 회원은 광장으로", m.url().includes("/town"));
  await m.goto(`${BASE}/account-setup`);
  check("아이디 회원이 /account-setup을 열면 광장으로", m.url().endsWith("/town"));
  await m.context().close();
}

// ── 8. 아이디가 없는 소셜 회원도 /account-setup에서 탈퇴할 수 있다 (빈 회원·주민 등록을 마친 회원) ──
{
  const s = await socialUser("naver", `n8${run}`);
  const page = await newPage(s);
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/account-setup`);
  await page.screenshot({ path: `${outDir}/s8-leave.png`, fullPage: true });
  await page.getByRole("button", { name: "그만두고 나가기" }).click();
  await page.waitForURL(/withdrawn=1/);
  check("빈 소셜 회원이 [그만두고 나가기]로 지워진다", !(await one("SELECT id FROM users WHERE id = $1", [s.uid])) && !(await one("SELECT id FROM accounts WHERE account_id = $1", [`n8${run}`])));
  await page.context().close();

  const g = await socialUser("google", `g8${run}`);
  const { id: charId } = await one("SELECT id FROM items WHERE code = 'char_boy'");
  const { id: bgId } = await one("SELECT id FROM items WHERE code = 'bg_meadow'");
  await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2), ($1, $3)", [g.uid, charId, bgId]);
  await db.query("INSERT INTO profiles (user_id, nickname, character_item_id, invite_code) VALUES ($1, $2, $3, $4)", [g.uid, `구탈${run.slice(-4)}`, charId, Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("")]);
  await db.query("INSERT INTO blogs (owner_id, slug, title, background_item_id) VALUES ($1, $2, $3, $4)", [g.uid, `gw${run}`, "구글집", bgId]);
  const p2 = await newPage(g);
  p2.on("dialog", (d) => d.accept());
  await p2.goto(`${BASE}/account-setup`);
  await p2.getByRole("button", { name: "회원 탈퇴" }).click();
  await p2.waitForURL(/withdrawn=1/);
  check("주민 등록을 마친 소셜 회원도 아이디 없이 탈퇴된다", !(await one("SELECT id FROM users WHERE id = $1", [g.uid])) && !(await one("SELECT id FROM blogs WHERE slug = $1", [`gw${run}`])));
  check("화면 오류 없음 (8)", page.errors.length === 0 && p2.errors.length === 0, [...page.errors, ...p2.errors].join(" | "));
  await p2.context().close();
}

// ── 9. 연동 보상을 받은 소셜 계정은 탈퇴 후 새 회원에 붙여도 다시 받지 못한다 ──
{
  const aId = `wa${run}`;
  const m = await newPage();
  await loginDev(m, aId);
  await m.context().close();
  const a = await one("SELECT id FROM users WHERE username = $1", [aId]);
  const K = `k9${run}`;
  // A가 카카오 K를 합쳐서 🪙100
  const s = await socialUser("kakao", K);
  const page = await newPage(s);
  await page.goto(`${BASE}/account-setup`);
  await page.getByRole("tab", { name: "이미 아이디가 있어요" }).click();
  await page.locator("form").getByLabel("아이디").fill(aId);
  await page.locator("form").getByLabel("비밀번호", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "내 아이디에 합치기" }).click();
  await page.waitForURL(/account-setup\/done/);
  check("A가 카카오 K를 연동하고 🪙100", (await ledger(a.id)).length === 1);
  // A 탈퇴 (블로그 관리의 탈퇴 칸, 비밀번호 확인)
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/settings/blog`);
  await page.locator("[data-withdraw-form]").getByLabel("비밀번호 확인").fill(PW);
  await page.getByRole("button", { name: "회원 탈퇴" }).click();
  await page.waitForURL(/withdrawn=1/);
  check("A 탈퇴 → 원장·카카오 계정이 함께 지워짐", !(await one("SELECT id FROM users WHERE id = $1", [a.id])) && !(await one("SELECT id FROM accounts WHERE account_id = $1", [K])));
  check("준 기록은 탈퇴 뒤에도 남는다", Boolean(await one("SELECT 1 AS ok FROM social_link_rewards WHERE provider_id = 'kakao' AND account_id = $1", [K])));
  await page.context().close();

  // 같은 카카오 K로 다시 로그인 → 새로 시작해요 → 주민 등록 → 0
  const s2 = await socialUser("kakao", K);
  const p2 = await newPage(s2);
  await p2.goto(`${BASE}/account-setup`);
  const form = p2.locator("form").first();
  await form.getByLabel("아이디").fill(`wb${run}`);
  await form.getByLabel("비밀번호", { exact: true }).fill(PW);
  await form.getByLabel("비밀번호 확인").fill(PW);
  await form.getByRole("button", { name: "아이디 만들기" }).click();
  await p2.waitForURL(/onboarding/);
  await onboard(p2, `다시${run.slice(-4)}`, `wb${run}`);
  check("탈퇴 후 같은 카카오로 새로 시작해도 연동 보상 없음", (await ledger(s2.uid)).length === 0, JSON.stringify(await ledger(s2.uid)));
  check("화면 오류 없음 (9)", p2.errors.length === 0, p2.errors.join(" | "));
  await p2.context().close();
}

console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
