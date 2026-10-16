// 글쓰기 태그 칩 (쉼표·#·엔터로 끊기, 10개까지, 넘으면 3초 알림) + 엔터만 친 빈 줄이 읽는 화면에도 남는다
// + 태그는 적은 순서대로 보인다 (고쳐서 순서를 바꾸면 그 순서로) + 발행·수정 완료 뒤 뒤로 가기는 글쓰기 화면이 아니라 내 블로그로 간다
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctx.newPage();
const errors = collectErrors(a);
await loginDev(a, "tagger1");
await a.goto(`${BASE}/@tagger1`); // 내 블로그 → 글쓰기
await a.goto(`${BASE}/write`);
await a.locator(".ProseMirror").waitFor();
await a.getByPlaceholder("제목").fill("빈 줄과 태그");

// 본문: 첫 줄, 엔터 5번, 마지막 줄
await a.locator(".ProseMirror").click();
await a.keyboard.type("첫 줄");
for (let i = 0; i < 5; i++) await a.keyboard.press("Enter");
await a.keyboard.type("마지막 줄");
const gap = async (page, root) =>
  page.locator(root).evaluate((el) => {
    const ps = [...el.querySelectorAll("p")];
    const first = ps.find((p) => p.textContent === "첫 줄");
    const last = ps.find((p) => p.textContent === "마지막 줄");
    return last.getBoundingClientRect().top - first.getBoundingClientRect().bottom;
  });
const editorGap = await gap(a, ".ProseMirror");

// 태그: 엔터·쉼표·#로 끊으면 칩이 된다
const tagBox = a.getByLabel("태그", { exact: true });
const chips = a.locator("[data-tag]");
await tagBox.click();
await a.keyboard.type("Git");
await a.keyboard.press("Enter");
await a.keyboard.type("회고,");
await a.keyboard.type("#next #react ");
await a.keyboard.press("Tab"); // 칸을 떠나면 쓰던 글자도 칩이 된다
let got = await chips.allInnerTexts();
if (got.map((s) => s.replace("×", "").trim()).join("|") !== "#git|#회고|#next|#react") throw new Error(`태그 칩이 이상해요: ${got.join("|")}`);
// 빈 칸에서 지우기 → 마지막 태그가 빠진다, × 버튼으로도 뺀다
await tagBox.click();
await a.keyboard.press("Backspace");
await a.getByRole("button", { name: "회고 태그 빼기" }).click();
if ((await chips.count()) !== 2) throw new Error(`태그 빼기가 안 돼요: ${await chips.count()}개`);
// 10개까지 넣고, 넘으면 알림 (3초 뒤 사라진다)
await tagBox.fill("하나, 둘, 셋, 넷, 다섯, 여섯, 일곱, 여덟, 아홉");
await a.keyboard.press("Enter");
if ((await chips.count()) !== 10) throw new Error(`태그가 10개까지 들어가지 않아요: ${await chips.count()}개`);
const notice = a.getByText("태그는 10개까지 넣을 수 있어요.");
await notice.waitFor({ timeout: 2000 });
await a.screenshot({ path: `${outDir}/tags-1-full.png` });
await notice.waitFor({ state: "hidden", timeout: 4500 });
if ((await a.locator("input[name=tags]").inputValue()).split(", ").length !== 10) throw new Error("보내는 태그 값이 10개가 아니에요");

await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/@tagger1\/\d+/);
await a.locator("[data-post-body]").waitFor();
const viewGap = await gap(a, "[data-post-body]");
console.log("빈 줄 간격 (에디터 → 읽는 화면):", editorGap, "→", viewGap);
if (Math.abs(viewGap - editorGap) > editorGap * 0.25) throw new Error(`읽는 화면에서 빈 줄이 줄었어요: ${editorGap}px → ${viewGap}px`);
await a.screenshot({ path: `${outDir}/tags-2-post.png`, fullPage: true });
const shownTags = () => a.locator('main a[href^="/tags/"]').allInnerTexts();
const written = ["git", "next", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟"];
const expectTags = async (want, when) => {
  const got = (await shownTags()).map((s) => s.replace(/^#/, "").trim());
  if (got.join("|") !== want.join("|")) throw new Error(`${when} 태그 순서가 달라요: ${got.join("|")}`);
};
await expectTags(written, "발행한 글의");

// 뒤로 가기: 글쓰기가 아니라 내 블로그
const postUrl = a.url().replace(/\?.*$/, "");
const backToBlog = async (when) => {
  await a.goBack();
  await a.waitForURL(`${BASE}/@tagger1`);
  await a.waitForLoadState("networkidle");
  if (await a.locator(".ProseMirror").count()) throw new Error(`${when} 뒤 뒤로 가기에 글쓰기 화면이 보여요`);
  await a.getByRole("link", { name: "빈 줄과 태그" }).first().waitFor({ timeout: 5000 });
};
await backToBlog("발행");
// 글 고치기도 같다: 글 → 고치기 → 수정 완료 → 뒤로 가기 = 내 블로그
await a.goto(postUrl);
await a.goto(postUrl.replace(/\/@tagger1\//, "/write/"));
await a.locator(".ProseMirror").waitFor();
if ((await a.locator("input[name=tags]").inputValue()) !== written.join(", ")) throw new Error("고치기 화면의 태그 순서가 달라요");
// git을 빼고 맨 뒤에 다시 넣으면 그 순서로 저장된다
await a.getByRole("button", { name: "git 태그 빼기" }).click();
await tagBox.click();
await a.keyboard.type("git");
await a.keyboard.press("Enter");
await a.getByRole("button", { name: "수정 완료" }).click();
await a.waitForURL(postUrl);
await a.locator("[data-post-body]").waitFor();
await expectTags([...written.slice(1), "git"], "고친 글의");
await backToBlog("수정 완료");

if (errors.length) throw new Error(errors.join("\n"));
console.log("✅ 태그 칩·10개 제한·빈 줄 유지·태그 순서·발행 뒤 뒤로 가기");
await browser.close();
