// 글을 발행하고 보상을 못 받으면 실제 이유 하나만 안내한다 (GAME-05). 관리자 글도 같은 규칙으로 보상한다
// 사용: 개발 서버를 띄운 상태에서 node e2e/reward-reason.mjs <스크린샷 폴더> (npm run admin:create로 관리자 계정이 있어야 한다)
// 하루 보상 횟수(글 3번)에 걸리지 않도록 실행할 때마다 새 회원을 만든다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();

/** 글을 발행하고 주소의 new= 값과 발행 안내 문구를 돌려준다 */
async function publish(page, { body, isPrivate = false, shot }) {
  await page.goto(`${BASE}/write`);
  await page.locator(".ProseMirror").waitFor();
  await page.getByPlaceholder("제목").fill(`보상 안내 ${Date.now()}`);
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(body);
  if (isPrivate) await page.getByRole("radio", { name: /서로 이웃만/ }).click();
  await page.getByRole("button", { name: "발행하기" }).click();
  await page.waitForURL(/\?new=/);
  const banner = page.locator(".card", { hasText: "글을 발행했어요" });
  await banner.waitFor();
  if (shot) await banner.screenshot({ path: `${outDir}/${shot}.png` });
  return { result: new URL(page.url()).searchParams.get("new"), text: await banner.innerText() };
}

const long = "오늘은 마을 광장을 산책했다. ".repeat(8); // 100자 이상

// 일반 회원
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
await loginDev(page, `rr${Date.now() % 100_000_000}`);

let r = await publish(page, { body: "짧은 글이에요. 서른 자는 넘지만 백 자는 안 돼요.", shot: "reward-short" });
check("짧은 글: 짧아서라고만 안내", r.result === "short" && /자보다 짧아서/.test(r.text) && !/비공개|다 받아서/.test(r.text), r.text);

r = await publish(page, { body: long, isPrivate: true, shot: "reward-private" });
check("비공개 글: 비공개라서라고만 안내", r.result === "private" && /비공개 글이라/.test(r.text) && !/짧아서|다 받아서/.test(r.text), r.text);

for (let i = 1; i <= 3; i++) {
  r = await publish(page, { body: long });
  check(`긴 공개 글 ${i}번째: 보상`, r.result === "reward" && /받았어요/.test(r.text), r.text);
}
r = await publish(page, { body: long, shot: "reward-limit" });
check("4번째 긴 공개 글: 오늘 다 받아서라고만 안내", r.result === "limit" && /이미 다 받아서/.test(r.text) && !/짧아서|비공개/.test(r.text), r.text);

// 관리자: 공지사항 블로그에 쓴 글도 같은 규칙으로 보상한다
const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await admin.goto(BASE);
await admin.getByLabel("아이디").fill(ADMIN.username);
await admin.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
await admin.getByRole("button", { name: "로그인", exact: true }).click();
await admin.waitForURL(/town/);
r = await publish(admin, { body: long, shot: "reward-admin" });
check("관리자 긴 공개 글: 보상 또는 오늘 다 받음", ["reward", "limit"].includes(r.result), r.text);

check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(results.join("\n"));
process.exit(results.some((line) => line.startsWith("❌")) ? 1 : 0);
