// 비밀번호를 잊었을 때 대비: 로그인·회원가입 안내 → 환경 설정에서 비밀번호 바꾸기(지금 비밀번호 확인,
// 소셜로 방금 로그인했으면 비워도 됨) → 관리자 임시 비밀번호 초기화 (다른 기기 로그아웃, 옛 비밀번호로는 못 들어감)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };

const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);
/** 몇 초 안에 보이면 true (API 응답을 기다린다) */
const sees = (loc) => loc.waitFor({ timeout: 8000 }).then(() => true, () => false);

/** 로그인 화면에서 아이디·비밀번호로 들어가 본다. 되면 true */
async function trySignIn(page, username, password) {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.locator("canvas, [data-town-menu]:visible").or(page.getByText("아이디 또는 비밀번호가")).first().waitFor({ timeout: 20000 });
  return !(await page.getByText("아이디 또는 비밀번호가").isVisible());
}

// 1) 로그인·회원가입 화면 안내
const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const guest = await guestCtx.newPage();
await guest.goto(BASE);
await guest.getByText("비밀번호를 잊었나요?").click();
check("로그인 화면: 비밀번호를 잊었을 때 안내가 펼쳐짐", await guest.getByText("임시 비밀번호를 답장해 드려요").isVisible());
await guest.locator("[data-forgot-password]").screenshot({ path: `${outDir}/password-1-forgot.png` });
await guest.getByRole("tab", { name: "회원가입" }).click();
check("회원가입 화면: 소셜 연동 부탁 문구", await guest.locator("[data-signup-link-hint]").isVisible());
await guest.screenshot({ path: `${outDir}/password-2-signup-phone.png`, fullPage: true });

// 2) 회원이 환경 설정에서 비밀번호 바꾸기
const userId = `pw${tag}`;
const pw1 = "test-password-1234";
const pw2 = "new-password-5678";
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, userId, "짧은 머리", pw1);
const { rows: [u] } = await db.query("SELECT id FROM users WHERE username = $1", [userId]);

const form = page.locator("[data-password-form]");
const submit = (cur, next, confirm = next) =>
  form.locator('input[name="currentPassword"]').fill(cur)
    .then(() => form.locator('input[name="newPassword"]').fill(next))
    .then(() => form.locator('input[name="newPasswordConfirm"]').fill(confirm))
    .then(() => form.getByRole("button", { name: "비밀번호 바꾸기" }).click());

await page.goto(`${BASE}/settings/blog`);
check("소셜 연동이 없으면 '비워도 된다' 안내가 없음", !(await page.locator("[data-skip-current]").isVisible()));
await form.locator('input[name="currentPassword"]').evaluate((el) => el.removeAttribute("required"));
await submit("", pw2);
check("지금 비밀번호를 비우면 막힘 (소셜 연동 없음)", await sees(form.getByText("지금 비밀번호를 적어 주세요")));
await submit("wrong-password-0", pw2);
check("지금 비밀번호가 틀리면 막힘", await sees(form.getByText("지금 비밀번호가 맞지 않아요")));
await submit(pw1, pw2, "different-pass-1");
check("새 비밀번호 확인이 다르면 막힘", await sees(form.getByText("비밀번호가 서로 달라요")));

// 다른 기기 로그인 하나 더 (바꾸면 로그아웃돼야 한다)
const otherCtx = await browser.newContext();
const other = await otherCtx.newPage();
check("다른 기기에서 옛 비밀번호로 로그인", await trySignIn(other, userId, pw1));

await submit(pw1, pw2);
await form.getByText("비밀번호를 바꿨어요").waitFor();
check("지금 비밀번호로 확인하고 바꿈", true);
await page.screenshot({ path: `${outDir}/password-3-settings-done.png`, fullPage: true });
await page.waitForTimeout(3300);
check("바꿨다는 안내가 3초 뒤 사라짐", !(await form.getByText("비밀번호를 바꿨어요").isVisible()));
await page.goto(`${BASE}/settings/blog`);
check("바꾼 브라우저는 로그인 그대로", await form.isVisible());
const otherMe = await other.request.get(`${BASE}/api/v1/me`).then((r) => r.json()).catch(() => null);
check("다른 기기는 로그아웃됨", !otherMe?.user);

// 소셜을 연동한 회원이 방금 로그인했으면 지금 비밀번호 없이 바꾼다 (카카오 연동을 DB에 직접 넣어 흉내)
await db.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, 'kakao', $3)", [`acc${tag}`, u.id, `k${tag}`]);
await page.goto(`${BASE}/settings/blog`);
check("소셜 연동 + 방금 로그인: '비워도 된다' 안내", await page.locator("[data-skip-current]").isVisible());
await page.locator("#password").screenshot({ path: `${outDir}/password-4-skip-current.png` });
const pw3 = "social-reset-999";
await submit("", pw3);
check("지금 비밀번호 없이 바꿈 (소셜로 방금 로그인)", await sees(form.getByText("비밀번호를 바꿨어요")));
// 로그인한 지 오래되면(10분 넘게) 다시 지금 비밀번호가 필요하다
await db.query("UPDATE sessions SET created_at = now() - interval '20 minutes' WHERE user_id = $1", [u.id]);
await page.goto(`${BASE}/settings/blog`);
await form.locator('input[name="currentPassword"]').evaluate((el) => el.removeAttribute("required"));
await submit("", "after-ten-min-1");
check("로그인한 지 10분이 지나면 다시 지금 비밀번호가 필요", await sees(form.getByText("지금 비밀번호를 적어 주세요")));

// 3) 관리자 임시 비밀번호
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
admin.on("dialog", (d) => d.accept());
check("관리자 로그인", await trySignIn(admin, ADMIN.username, ADMIN.password));
await admin.goto(`${BASE}/admin/members/${u.id}`);
await admin.getByRole("button", { name: "임시 비밀번호 만들기" }).click();
const temp = (await admin.locator("[data-temp-password] code").textContent({ timeout: 10000 }))?.trim() ?? "";
check("임시 비밀번호가 화면에 보임 (10자)", temp.length === 10);
await admin.locator('[aria-label="비밀번호 초기화"]').screenshot({ path: `${outDir}/password-5-admin-reset.png` });
const { rows: [{ n }] } = await db.query("SELECT count(*)::int AS n FROM sessions WHERE user_id = $1", [u.id]);
check("초기화하면 그 회원의 모든 기기가 로그아웃", n === 0);
const fresh = await (await browser.newContext()).newPage();
check("옛 비밀번호로는 못 들어감", !(await trySignIn(fresh, userId, pw3)));
check("임시 비밀번호로 들어감", await trySignIn(fresh, userId, temp));
await admin.goto(`${BASE}/admin/members`);
const { rows: [a] } = await db.query("SELECT id FROM users WHERE username = $1", [ADMIN.username]);
await admin.goto(`${BASE}/admin/members/${a.id}`);
check("관리자 계정은 초기화 버튼이 없음", !(await admin.getByRole("button", { name: "임시 비밀번호 만들기" }).isVisible()));

// 4) 일본어 화면
await guestCtx.addCookies([{ name: "lang", value: "ja", url: BASE }]);
await guest.goto(BASE);
await guest.getByText("パスワードを忘れましたか？").click().catch(() => {});
check("일본어: 비밀번호를 잊었을 때 안내", await guest.getByText("パスワードを忘れましたか？").isVisible().catch(() => false));
await guest.screenshot({ path: `${outDir}/password-6-ja.png`, fullPage: true });

check("화면 오류 없음", errors.length === 0);
if (errors.length) console.log(errors);
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
