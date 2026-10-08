// E2E 공통 도우미
export const BASE = process.env.BASE_URL ?? "http://localhost:3000"; // 다른 포트: BASE_URL=http://localhost:3100

export function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Playwright 스크린샷이 넣는 caret 스타일 때문에 생기는 하이드레이션 경고는 제외
    if (m.type() === "error" && !m.text().includes("caret-color") && !m.text().includes("401")) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  return errors;
}

/** 아이디로 로그인하고, 없는 계정이면 회원가입 + 온보딩까지 마친다 */
export async function loginDev(page, devId, character = "남자 주민", password = "test-password-1234") {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(devId);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  // 로그인 성공(광장/휴대폰 메뉴/온보딩) 또는 실패 메시지 중 먼저 나오는 것
  await page
    .locator('canvas, [data-town-menu]:visible, input[name="nickname"]')
    .or(page.getByText("아이디 또는 비밀번호가"))
    .first()
    .waitFor({ timeout: 20000 });

  if (await page.getByText("아이디 또는 비밀번호가").isVisible()) {
    await page.getByRole("tab", { name: "회원가입" }).click();
    await page.getByLabel("아이디").fill(devId);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인").fill(password);
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    await page.locator('input[name="nickname"]').waitFor({ timeout: 20000 });
  }

  if (page.url().includes("onboarding")) {
    await page.locator('input[name="nickname"]').fill(devId.slice(0, 12));
    await page.locator('input[name="blogTitle"]').fill(`${devId}의 블로그`);
    await page.locator('input[name="slug"]').fill(devId.toLowerCase());
    await page.locator("label", { hasText: character }).click();
    await page.getByRole("button", { name: /광장으로 출발/ }).click();
    await page.waitForURL(/town/);
  }
}

export async function coins(page) {
  const text = await page.getByRole("banner").getByTitle("코인").innerText();
  return Number(text.replace(/[^0-9]/g, ""));
}

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from({ length: 6 }, () => INVITE_ALPHABET[Math.floor(Math.random() * 32)]).join("");

/**
 * 화면을 거치지 않고 DB에 바로 온보딩을 마친 회원을 만든다 (블로그 수가 많이 필요한 시험용, 로그인은 할 수 없다).
 * 반환: { uid, slug, blogId }
 */
export async function fakeMember(db, slug, { nickname = slug.slice(0, 12), title = `${slug} 블로그` } = {}) {
  const uid = `fk_${slug}`;
  const one = async (q, p) => (await db.query(q, p)).rows[0];
  const { id: charId } = await one("SELECT id FROM items WHERE code = 'char_boy'");
  const { id: bgId } = await one("SELECT id FROM items WHERE code = 'bg_meadow'");
  await db.query("INSERT INTO users (id, name, email) VALUES ($1, $2, $3)", [uid, slug, `${slug}@fake.blogcabin.invalid`]);
  await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2), ($1, $3)", [uid, charId, bgId]);
  await db.query("INSERT INTO profiles (user_id, nickname, character_item_id, invite_code) VALUES ($1, $2, $3, $4)", [uid, nickname, charId, randomCode()]);
  const { id: blogId } = await one("INSERT INTO blogs (owner_id, slug, title, background_item_id) VALUES ($1, $2, $3, $4) RETURNING id", [uid, slug, title, bgId]);
  return { uid, slug, blogId };
}

/** DB에 바로 글 하나 (createdAt: 몇 분 전인지) */
export async function fakePost(db, blogId, { title = "시험 글", text = "시험 글 본문", visibility = "public", minutesAgo = 0 } = {}) {
  const { rows } = await db.query(
    `INSERT INTO posts (blog_id, title, content_html, content_text, visibility, created_at)
     VALUES ($1, $2, $3, $4, $5, now() - make_interval(mins => $6)) RETURNING id`,
    [blogId, title, `<p>${text}</p>`, text, visibility, minutesAgo],
  );
  return rows[0].id;
}
