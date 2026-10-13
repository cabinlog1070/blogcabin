// 나올 펫이 정해진 알 (관리자 선물 알, 2026-10-13): 둥지·내 동물 목록에 어떤 펫 알인지 보이고, 부화하면 그 펫이 나온다
// 사용: 개발 서버를 띄운 상태에서 node e2e/egg-species.mjs <스크린샷 폴더> (실행마다 새 회원)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
const devId = `egg${Date.now() % 100_000_000}`;
await loginDev(page, devId);
const { rows: [u] } = await db.query("SELECT id FROM users WHERE username = $1", [devId]);
const { rows: [dragon] } = await db.query("SELECT id, name FROM animal_species WHERE code = 'dragon'");
// 드래곤 알 두 개 (한 번씩 부화, 한 번에 부화) + 보통 알 하나
await db.query(
  "INSERT INTO user_animals (user_id, source, egg_species_id) VALUES ($1, 'gift', $2), ($1, 'gift', $2), ($1, 'shop', NULL)",
  [u.id, dragon.id],
);

await page.goto(`${BASE}/farm`);
const list = page.getByRole("list", { name: "키우는 동물" });
await list.waitFor();
check("내 동물 목록에 `드래곤 알`", (await list.getByRole("button", { name: /드래곤 알 \(부화 전\)/ }).count()) === 2);
check("보통 알은 그대로 `알 (부화 전)`", (await list.getByRole("button", { name: /^알 \(부화 전\)$/ }).count()) === 1);

await list.getByRole("button", { name: /드래곤 알/ }).first().click();
const dialog = page.getByRole("dialog");
await dialog.waitFor();
check("알을 열면 어떤 펫이 나오는지 보인다", (await dialog.locator("[data-egg-hint]").innerText()).includes("드래곤이 나오는 알"));
await page.screenshot({ path: `${outDir}/egg-species-1-open.png` });
await dialog.getByRole("button", { name: /^.*부화시키기$/ }).first().click();
await page.getByRole("status").getByText("드래곤이 태어났어요").waitFor();
const hatched = async () =>
  (await db.query("SELECT s.code FROM user_animals a JOIN animal_species s ON s.id = a.species_id WHERE a.user_id = $1 AND a.source = 'gift' ORDER BY a.id", [u.id])).rows.map((r) => r.code);
check("부화하면 정해진 펫(드래곤)", (await hatched()).join() === "dragon");

// 한 번에 부화: 정해진 알은 정해진 펫 (태어난 펫 상태창은 닫고)
await page.keyboard.press("Escape");
await dialog.waitFor({ state: "hidden" });
await list.getByRole("button", { name: /드래곤 알/ }).nth(0).waitFor();
await page.waitForFunction(() => document.querySelectorAll("[data-nest] [data-egg-id]").length === 2);
await list.getByRole("button", { name: /드래곤 알/ }).first().click();
await dialog.getByRole("button", { name: "모두 부화시키기" }).click();
await page.getByRole("status").getByText(/마리가 태어났어요/).waitFor();
check("한 번에 부화해도 정해진 펫", (await hatched()).join() === "dragon,dragon");
await page.screenshot({ path: `${outDir}/egg-species-2-hatched.png` });

// 일본어
await db.query("INSERT INTO user_animals (user_id, source, egg_species_id) VALUES ($1, 'gift', $2)", [u.id, dragon.id]);
await db.query("UPDATE users SET locale = 'ja' WHERE id = $1", [u.id]);
await page.goto(`${BASE}/farm`);
await page.locator("[data-nest] [data-egg-id]").first().click();
await dialog.waitFor();
check("일본어: 어떤 펫이 나오는지", (await dialog.locator("[data-egg-hint]").innerText()).includes("が生まれるたまご"), await dialog.locator("[data-egg-hint]").innerText());
await page.screenshot({ path: `${outDir}/egg-species-3-ja.png` });

check("화면 오류 없음", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
