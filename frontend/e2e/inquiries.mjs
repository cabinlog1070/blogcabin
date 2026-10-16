// 문의함: 로그인 없이 문의(비밀번호) → 회원 문의 → 관리자 문의함에서 답하기·처리 완료 → 회원이 알림과 답을 본다
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
const sees = (loc) => loc.waitFor({ timeout: 8000 }).then(() => true, () => false);
const tag = Date.now().toString(36).slice(-5);
const memberId = `iq${tag}`;

// 1) 로그인 없이 비밀번호 문의 (휴대폰 크기)
const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const guest = await guestCtx.newPage();
const guestErrors = collectErrors(guest);
await guest.goto(`${BASE}/support?topic=password#inquiry`);
const gForm = guest.locator("[data-inquiry-form]");
check("로그인 없이: 아이디·이메일 칸이 보임", await gForm.locator('input[name="contactEmail"]').isVisible());
check("?topic=password면 [비밀번호]가 골라져 있음", (await gForm.getByRole("button", { name: "비밀번호" }).getAttribute("aria-pressed")) === "true");
await gForm.locator('input[name="guestUsername"]').fill(memberId);
await gForm.locator('input[name="contactEmail"]').fill(`${tag}@example.com`);
await gForm.locator("textarea").fill(`비밀번호를 잊었어요. 닉네임 ${memberId}, 블로그 이름 ${memberId}의 블로그`);
await guest.screenshot({ path: `${outDir}/inquiry-1-guest-phone.png`, fullPage: true });
await gForm.getByRole("button", { name: "문의 보내기" }).click();
check("로그인 없이 문의를 보냄", await sees(gForm.getByText("적어 준 이메일로 답해 드려요")));
const noEmail = await guest.request.post(`${BASE}/api/v1/inquiries`, { data: { topic: "other", content: "이메일 없음" }, headers: { origin: BASE } });
check("로그인 없이 이메일을 안 적으면 막힘", noEmail.status() === 400);

// 2) 회원 문의
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, memberId);
await page.goto(`${BASE}/support#inquiry`);
const form = page.locator("[data-inquiry-form]");
check("로그인한 회원: 이메일 칸이 없음", !(await form.locator('input[name="contactEmail"]').isVisible()));
await form.getByRole("button", { name: "오류 신고" }).click();
await form.locator("textarea").fill(`농장에서 알이 안 보여요 ${tag}`);
await form.getByRole("button", { name: "문의 보내기" }).click();
check("회원 문의를 보냄", await sees(form.getByText("답이 오면 알림으로 알려 드려요")));
check("내 문의에 '답 기다리는 중'으로 보임", await sees(page.locator("[data-my-inquiries]").getByText(`농장에서 알이 안 보여요 ${tag}`)));

// 3) 관리자 문의함
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
const adminErrors = collectErrors(admin);
await admin.goto(BASE);
await admin.getByLabel("아이디").fill(ADMIN.username);
await admin.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
await admin.getByRole("button", { name: "로그인", exact: true }).click();
await admin.waitForURL(/town/);
await admin.goto(`${BASE}/admin`);
check("관리자 첫 화면: 문의함 버튼에 기다리는 수", /\d/.test((await admin.locator("[data-admin-inquiries-link]").textContent()) ?? ""));
await admin.locator("[data-admin-inquiries-link]").click();
await admin.waitForURL(/admin\/inquiries/);
await admin.waitForLoadState("networkidle");
const { rows: [mq] } = await db.query("SELECT id FROM inquiries WHERE content LIKE $1", [`%${tag}`]);
const { rows: [gq] } = await db.query("SELECT id FROM inquiries WHERE contact_email = $1", [`${tag}@example.com`]);
const memberCard = admin.locator(`[data-admin-inquiry="${mq.id}"]`);
const guestCard = admin.locator(`[data-admin-inquiry="${gq.id}"]`);
check("문의함에 회원 문의가 보임", await memberCard.isVisible());
check("로그인 없이 보낸 문의: 이메일과 '이 아이디 회원 보기'", (await guestCard.getByText(`${tag}@example.com`).isVisible()) && (await guestCard.getByText("이 아이디 회원 보기").isVisible()));
await admin.screenshot({ path: `${outDir}/inquiry-3-admin-inbox.png`, fullPage: true });

await memberCard.locator("textarea").fill("알려 주셔서 고마워요! 고쳐 둘게요.");
const answered = admin.waitForResponse((r) => r.url().includes(`/inquiries/${mq.id}/answer`));
await memberCard.getByRole("button", { name: "답하기" }).click();
check("관리자가 답함", (await answered).ok());
// 답하면 '답변함'으로 옮겨져 대기 목록에서 빠진다
await memberCard.waitFor({ state: "detached" });
const closed = admin.waitForResponse((r) => r.url().includes(`/inquiries/${gq.id}/status`));
await guestCard.getByRole("button", { name: "처리 완료" }).click();
await closed;
await admin.goto(`${BASE}/admin/inquiries?status=closed`);
check("로그인 없이 보낸 문의를 처리 완료로", await admin.locator(`[data-admin-inquiry="${gq.id}"]`).isVisible());
await admin.goto(`${BASE}/admin/inquiries?status=answered`);
check("답한 문의는 '답변함' 칸에", await admin.locator(`[data-admin-inquiry="${mq.id}"]`).isVisible());

// 4) 회원이 알림과 답을 본다
const { rows: [noti] } = await db.query("SELECT n.id FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.username = $1 AND n.kind = 'inquiry_answer'", [memberId]);
check("회원에게 '문의 답변' 알림", Boolean(noti));
await page.goto(`${BASE}/notifications`);
check("알림함에 문장이 보임", await sees(page.getByText("관리자가 내 문의에 답했어요")));
await page.goto(`${BASE}/support#my-inquiries`);
check("내 문의에서 관리자 답이 보임", await sees(page.locator("[data-my-inquiries]").getByText("알려 주셔서 고마워요!")));
await page.locator("[data-my-inquiries]").screenshot({ path: `${outDir}/inquiry-2-member-answer.png` });

// 5) 탈퇴하면 그 회원의 문의도 지워진다
const { rows: [u] } = await db.query("SELECT id FROM users WHERE username = $1", [memberId]);
await db.query("DELETE FROM users WHERE id = $1", [u.id]);
const { rows: [{ n }] } = await db.query("SELECT count(*)::int AS n FROM inquiries WHERE id = $1", [mq.id]);
check("회원이 지워지면 그 회원의 문의도 지워짐", n === 0);

const allErrors = [...guestErrors, ...errors, ...adminErrors];
check("화면 오류 없음", allErrors.length === 0);
if (allErrors.length) console.log(allErrors);
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
