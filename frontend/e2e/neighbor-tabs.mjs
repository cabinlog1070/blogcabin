// 내 블로그 홈의 이웃 칸 세 탭: 내 이웃 · 서로 이웃 · 나를 이웃한 사람
// 사용: 개발 서버를 띄운 상태에서 node e2e/neighbor-tabs.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);

const tag = Date.now().toString(36).slice(-5);
const A = `na${tag}`; // 주인공
const B = `nb${tag}`; // A를 이웃 추가 (A는 아직 안 함)
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
const tabCount = async (list, key) => Number((await list.locator(`[data-neighbor-tab="${key}"] span`).innerText()).trim());
const isFollowing = async (follower, followee) => !!(await one("SELECT 1 AS x FROM follows WHERE follower_id = $1 AND followee_id = $2", [follower, followee]));

try {
  const a = await member(A);
  const b = await member(B);
  const c = await fakeMember(db, `nc${tag}`); // A와 서로 이웃
  const d = await fakeMember(db, `nd${tag}`); // A만 이웃 추가 (한쪽)

  // B는 화면에서 A를 이웃 추가, C는 A와 서로 이웃, A는 D를 이웃 추가
  await b.page.goto(`${BASE}/@${A}`);
  await b.page.getByRole("button", { name: "+ 이웃 추가" }).click();
  await b.page.getByRole("button", { name: "✓ 이웃" }).waitFor();
  await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2), ($2, $1), ($1, $3)", [a.uid, c.uid, d.uid]);
  const baseFollowing = Number((await one("SELECT count(*)::int AS n FROM follows WHERE follower_id = $1", [a.uid])).n); // 기본 이웃(관리자) 포함

  await a.page.goto(`${BASE}/@${A}`);
  const list = a.page.locator("[data-my-neighbors]");
  await list.waitFor();
  check("내 이웃 탭이 먼저 열려 있음", (await list.locator('[data-neighbor-tab="following"]').getAttribute("aria-selected")) === "true");
  check("내 이웃 수 = 내가 이웃 추가한 사람", (await tabCount(list, "following")) === baseFollowing, `${await tabCount(list, "following")}/${baseFollowing}`);
  check("서로 이웃 수 1 (C)", (await tabCount(list, "mutual")) === 1);
  check("나를 이웃한 사람 수 2 (B, C)", (await tabCount(list, "followers")) === 2);
  await a.page.screenshot({ path: `${outDir}/neighbor-tabs-following.png`, clip: await list.boundingBox() });

  await list.locator('[data-neighbor-tab="mutual"]').click();
  check("서로 이웃 탭: C만", (await list.locator("[data-neighbor]").count()) === 1 && (await list.locator(`[data-neighbor="${c.slug}"]`).count()) === 1);
  check("서로 이웃 탭: 안내 문구", await list.getByText("서로의 🔒 비공개 글을 볼 수 있어요").isVisible());

  await list.locator('[data-neighbor-tab="followers"]').click();
  const rowB = list.locator(`[data-neighbor="${B}"]`);
  const rowC = list.locator(`[data-neighbor="${c.slug}"]`);
  check("나를 이웃한 사람 탭: B와 C", (await rowB.count()) === 1 && (await rowC.count()) === 1);
  check("나를 이웃한 사람 탭: D(내가 한쪽으로만 추가)는 없음", (await list.locator(`[data-neighbor="${d.slug}"]`).count()) === 0);
  check("C 옆에는 서로 이웃 표시", await rowC.getByText("서로 이웃").isVisible());
  check("B 옆에는 + 이웃 버튼", await rowB.getByRole("button", { name: /이웃 추가/ }).isVisible());
  await a.page.screenshot({ path: `${outDir}/neighbor-tabs-followers.png`, clip: await list.boundingBox() });

  await rowB.getByRole("button", { name: /이웃 추가/ }).click();
  await rowB.getByText("서로 이웃").waitFor();
  check("+ 이웃을 누르면 A → B 이웃이 됨", await isFollowing(a.uid, b.uid));
  check("서로 이웃 수 2로 늘어남", (await tabCount(list, "mutual")) === 2);
  check("내 이웃 수 1 늘어남", (await tabCount(list, "following")) === baseFollowing + 1);

  await a.page.reload();
  await list.locator('[data-neighbor-tab="mutual"]').click();
  check("새로 고쳐도 서로 이웃에 B가 있음", (await list.locator(`[data-neighbor="${B}"]`).count()) === 1);

  // 남의 블로그 홈에는 이웃 칸이 없다
  check("남의 블로그 홈에는 이웃 칸이 없음", (await b.page.goto(`${BASE}/@${A}`), (await b.page.locator("[data-my-neighbors]").count()) === 0));

  // 휴대폰 화면
  const phone = await member(A, { width: 360, height: 780 });
  await phone.page.goto(`${BASE}/@${A}`);
  const pl = phone.page.locator("[data-my-neighbors]");
  await pl.locator('[data-neighbor-tab="followers"]').click();
  await phone.page.screenshot({ path: `${outDir}/neighbor-tabs-phone.png`, clip: await pl.boundingBox() });
  check("휴대폰: 가로 넘침 없음", await phone.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
} finally {
  await browser.close();
  await db.end();
}

const errs = errorsAll.flat();
check("화면 오류 없음", errs.length === 0, errs.slice(0, 3).join(" | "));
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
