// 글에 표 넣기: 툴바 표 버튼 → 행·열 고르기 → 칸 쓰기 → 표 도구로 행·열 더하기 → 발행 → 읽는 화면 (컴퓨터·휴대폰)
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();

// --- 컴퓨터 ---
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctx.newPage();
const errors = collectErrors(a);
await loginDev(a, "tabler1");
await a.goto(`${BASE}/write`);
await a.locator(".ProseMirror").waitFor();
await a.getByPlaceholder("제목").fill("이번 주 공부 계획표");
await a.locator(".ProseMirror").click();
await a.keyboard.type("요일마다 할 일을 표로 정리했다.");
await a.keyboard.press("Enter");

// 표 버튼 → 3행 × 2열 고르기 (첫 행은 제목 행)
await a.getByRole("button", { name: "표 넣기" }).click();
await a.getByRole("button", { name: "3행 × 2열" }).hover();
await a.screenshot({ path: `${outDir}/table-1-picker.png` });
await a.getByRole("button", { name: "3행 × 2열" }).click();
if ((await a.locator(".ProseMirror table").count()) !== 1) throw new Error("표가 들어가지 않았어요");
if ((await a.locator(".ProseMirror th").count()) !== 2 || (await a.locator(".ProseMirror td").count()) !== 4) throw new Error("3행 × 2열이 아니에요");

// 커서가 첫 칸에 있다. Tab으로 다음 칸
const cells = ["요일", "할 일", "월", "Git 브랜치 연습", "화"];
for (const [i, text] of cells.entries()) {
  if (i) await a.keyboard.press("Tab");
  await a.keyboard.type(text);
}
// 표 안에 있으면 표 도구가 보인다: 아래에 행 넣고 마지막 칸 채우기, 오른쪽에 열 넣기
const tools = a.getByRole("toolbar", { name: "표 도구" });
await tools.waitFor();
await a.keyboard.press("Tab");
await a.keyboard.type("Next.js 라우팅 복습");
// 행을 넣어도 커서는 그 칸에 남는다. Tab으로 새 행 첫 칸으로
await tools.getByRole("button", { name: "＋ 아래에 행" }).click();
await a.keyboard.press("Tab");
await a.keyboard.type("수");
await a.keyboard.press("Tab");
await a.keyboard.type("표 기능 만들기 🎉");
await tools.getByRole("button", { name: "＋ 오른쪽에 열" }).click();
if ((await a.locator(".ProseMirror tr").count()) !== 4) throw new Error("행이 늘지 않았어요");
if ((await a.locator(".ProseMirror tr").first().locator("th").count()) !== 3) throw new Error("열이 늘지 않았어요");
// 새 열 제목 칸에 쓰기
await a.locator(".ProseMirror th").nth(2).click();
await a.keyboard.type("완료");
// 표 안에서는 표 버튼을 다시 누를 수 없다 (표 속 표를 막는다)
if (!(await a.getByRole("button", { name: "표 넣기" }).isDisabled())) throw new Error("표 안에서 표 버튼이 눌려요");
await a.screenshot({ path: `${outDir}/table-2-editor.png` });

// 표 밖으로 나오면 표 도구가 사라진다
await a.locator(".ProseMirror p").first().click();
await tools.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {
  throw new Error("표 밖에서도 표 도구가 보여요");
});

await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/@tabler1\/\d+/);
const postUrl = a.url().replace(/\?new=\w+$/, "");
await a.goto(postUrl);
const view = a.locator(".prose-blog");
await view.locator(".table-scroll table").waitFor();
const headers = await view.locator("th").allInnerTexts();
if (headers.join("|") !== "요일|할 일|완료") throw new Error(`제목 행이 이상해요: ${headers.join("|")}`);
if ((await view.locator("tr").count()) !== 4) throw new Error("읽는 화면 행 수가 이상해요");
await view.locator("table").screenshot({ path: `${outDir}/table-3-post-desktop.png` });
await a.screenshot({ path: `${outDir}/table-3-post-desktop-full.png`, fullPage: true });

// 수정 화면에서 표가 그대로 다시 열린다
await a.goto(`${BASE}/write/${postUrl.split("/").pop()}`);
await a.locator(".ProseMirror table").waitFor();
if ((await a.locator(".ProseMirror tr").count()) !== 4) throw new Error("수정 화면에서 표가 달라졌어요");

// --- 휴대폰 (360px) ---
const phone = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
const p = await phone.newPage();
const errorsP = collectErrors(p);
await p.goto(BASE);
await loginDev(p, "tabler1");
await p.goto(postUrl);
await p.locator(".prose-blog table").waitFor();
// 표가 넓어도 화면은 옆으로 밀리지 않는다 (표만 밀린다)
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (overflow > 1) throw new Error(`휴대폰 화면이 옆으로 ${overflow}px 넘쳐요`);
await p.screenshot({ path: `${outDir}/table-4-post-phone.png`, fullPage: true });

// 휴대폰 글쓰기: 목록·인용·링크·표 묶음을 펼치면 표 버튼이 있다
await p.goto(`${BASE}/write`);
await p.locator(".ProseMirror").waitFor();
await p.locator(".ProseMirror").tap();
await p.getByRole("button", { name: "목록·인용·링크·표" }).tap();
await p.getByRole("button", { name: "표 넣기" }).tap();
await p.screenshot({ path: `${outDir}/table-5-phone-picker.png` });
const pickerBox = await p.getByRole("dialog", { name: "표 넣기" }).boundingBox();
if (!pickerBox || pickerBox.x < 0 || pickerBox.x + pickerBox.width > 360) throw new Error("휴대폰에서 표 고르기 판이 화면 밖으로 나가요");
await p.getByRole("button", { name: "2행 × 3열" }).tap();
await p.getByRole("toolbar", { name: "표 도구" }).waitFor();
await p.keyboard.type("휴대폰");
await p.screenshot({ path: `${outDir}/table-6-phone-editor.png` });

const all = [...errors, ...errorsP];
if (all.length) throw new Error(all.join("\n"));
console.log("✅ 표 넣기·고치기·읽기 (컴퓨터·휴대폰)");
await browser.close();
