// 마을 소식에서 연 글의 이전·다음 글: 글쓴이와 상관없이 목록(마을 전체·💛 이웃 새 글·태그) 순서대로 넘어간다.
// 블로그에서 연 글은 그대로 그 블로그 글 안에서 넘어간다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, fakeMember, fakePost, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);
const tag = Date.now().toString(36).slice(-5);

// 두 사람의 글이 번갈아 (가장 최근 글이 마을 소식 맨 위)
const a = await fakeMember(db, `fa${tag}`);
const b = await fakeMember(db, `fb${tag}`);
const t = (n) => `${tag} 글${n}`;
const a1 = await fakePost(db, a.blogId, { title: t("A1"), minutesAgo: 1 });
const b1 = await fakePost(db, b.blogId, { title: t("B1"), minutesAgo: 2 });
const a2 = await fakePost(db, a.blogId, { title: t("A2"), minutesAgo: 3 });
const b2 = await fakePost(db, b.blogId, { title: t("B2"), minutesAgo: 4 });
// 태그 #tag는 A1·B2에만
const { rows: [{ id: tagId }] } = await db.query("INSERT INTO tags (name) VALUES ($1) RETURNING id", [`t${tag}`]);
await db.query("INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $3), ($2, $3)", [a1, b2, tagId]);

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
const viewer = `fv${tag}`;
await loginDev(page, viewer);
const { rows: [{ id: viewerId }] } = await db.query("SELECT id FROM users WHERE username = $1", [viewer]);
// 이웃 새 글: A만 이웃 (B 글은 빠진다)
await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [viewerId, a.uid]);

const navTitles = async () => ({
  prev: (await page.getByRole("link", { name: /이전 글/ }).locator("span.block").textContent().catch(() => null)) ?? null,
  next: (await page.getByRole("link", { name: /다음 글/ }).locator("span.block").textContent().catch(() => null)) ?? null,
});

// 1) 마을 전체에서 B1을 열면: 이전 = A2(다른 사람), 다음 = A1
await page.goto(`${BASE}/feed`);
await page.getByRole("link", { name: new RegExp(t("B1")) }).click();
await page.waitForURL(new RegExp(`/${b1}\\?from=feed`));
let nav = await navTitles();
check(`마을 전체: B1의 이전 글 A2, 다음 글 A1 (${JSON.stringify(nav)})`, nav.prev === t("A2") && nav.next === t("A1"));
await page.screenshot({ path: `${outDir}/feed-adjacent-all.png`, fullPage: true });
// 이전 글을 누르면 다른 블로그의 A2로, 거기서도 목록 순서를 따른다
await page.getByRole("link", { name: /이전 글/ }).click();
await page.waitForURL(new RegExp(`/@${a.slug}/${a2}\\?from=feed`));
nav = await navTitles();
check(`마을 전체: A2로 넘어가도 이전 B2, 다음 B1 (${JSON.stringify(nav)})`, nav.prev === t("B2") && nav.next === t("B1"));

// 2) 블로그에서 열면 그 블로그 글 안에서
await page.goto(`${BASE}/@${a.slug}/${a2}`);
nav = await navTitles();
check(`블로그에서: A2의 다음 글 A1, 이전 글 없음 (${JSON.stringify(nav)})`, nav.next === t("A1") && nav.prev === null);

// 3) 이웃 새 글: A 글만, A2 다음 = A1
await page.goto(`${BASE}/feed/following`);
await page.getByRole("link", { name: new RegExp(t("A2")) }).click();
await page.waitForURL(new RegExp(`/${a2}\\?from=following`));
nav = await navTitles();
check(`이웃 새 글: A2의 다음 글 A1 (${JSON.stringify(nav)})`, nav.next === t("A1"));

// 4) 태그 목록: A1 → 이전 B2
await page.goto(`${BASE}/tags/t${tag}`);
await page.getByRole("link", { name: new RegExp(t("A1")) }).click();
await page.waitForURL(new RegExp(`/${a1}\\?from=tag`));
nav = await navTitles();
check(`태그: A1의 이전 글 B2, 다음 글 없음 (${JSON.stringify(nav)})`, nav.prev === t("B2") && nav.next === null);

// 5) 이상한 from 값은 블로그 안의 이전·다음
await page.goto(`${BASE}/@${b.slug}/${b1}?from=zzz`);
nav = await navTitles();
check(`모르는 목록 값: 블로그 안 (B1의 이전 B2) (${JSON.stringify(nav)})`, nav.prev === t("B2") && nav.next === null);

check(`콘솔 오류 없음 ${errors.join(" | ")}`, errors.length === 0);
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
