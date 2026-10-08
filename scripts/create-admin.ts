// 관리자 계정을 만들거나 비밀번호·권한을 갱신한다. 여러 번 실행해도 안전하다.
// - 다시 실행하면 비밀번호를 새로 쓰고 관리자의 로그인(세션)을 모두 끊는다 → 모든 기기에서 다시 로그인해야 한다
// - 이미 일반 회원이 쓰는 아이디면 아무것도 바꾸지 않고 멈춘다 (일반 회원을 관리자로 올리지 않는다)
// 아이디·비밀번호는 .env.local(운영은 호스팅 서비스의 환경 변수)의 ADMIN_USERNAME, ADMIN_PASSWORD에서 읽는다.
// 실행: npm run admin:create
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { accounts, blogs, categories, items, profiles, sessions, userItems, users } from "../src/db/schema";
import { generateInviteCode } from "../src/lib/invite";

config({ path: ".env.local" });

const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const NOTICE_SLUG = "notice";

async function main() {
  if (!username || !password) throw new Error(".env.local에 ADMIN_USERNAME, ADMIN_PASSWORD를 적어 주세요");
  if (!/^[a-z0-9_]{4,20}$/.test(username)) throw new Error("ADMIN_USERNAME은 영문 소문자, 숫자, _ 로 4~20자여야 해요");
  if (password.length < 12) throw new Error("관리자 비밀번호는 12자 이상이어야 해요"); // NF-14
  if (password.toLowerCase().includes(username)) throw new Error("관리자 비밀번호에 아이디를 넣을 수 없어요");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const hash = await hashPassword(password);

  try {
    await db.transaction(async (tx) => {
      // 1. 회원 (role = admin). 이미 있는 일반 회원은 관리자로 올리지 않는다
      let [user] = await tx.select({ id: users.id, role: users.role }).from(users).where(eq(users.username, username));
      const existed = Boolean(user);
      if (user && user.role !== "admin") {
        throw new Error(`아이디 ${username}는 이미 일반 회원 계정이에요. ADMIN_USERNAME을 바꾸거나 그 계정을 먼저 정리해 주세요`);
      }
      if (!user) {
        [user] = await tx
          .insert(users)
          .values({
            id: randomUUID(),
            name: "관리자",
            email: `${username}@users.blogcabin.invalid`,
            emailVerified: true,
            username,
            displayUsername: username,
            role: "admin",
          })
          .returning({ id: users.id, role: users.role });
      }

      // 2. 아이디·비밀번호 로그인 정보 (Better Auth와 같은 형식: providerId = credential)
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")));
      if (account) {
        await tx.update(accounts).set({ password: hash }).where(eq(accounts.id, account.id));
      } else {
        await tx.insert(accounts).values({ id: randomUUID(), userId: user.id, providerId: "credential", accountId: user.id, password: hash });
      }
      // 다시 실행한 경우: 예전 비밀번호로 로그인해 둔 기기를 모두 로그아웃시킨다
      if (existed) await tx.delete(sessions).where(eq(sessions.userId, user.id));

      // 3. 온보딩: 공지사항 블로그 (이미 있으면 건너뜀)
      const [profile] = await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, user.id));
      if (!profile) {
        const [taken] = await tx.select({ ownerId: blogs.ownerId }).from(blogs).where(eq(blogs.slug, NOTICE_SLUG));
        if (taken && taken.ownerId !== user.id) {
          throw new Error(`블로그 주소 ${NOTICE_SLUG}를 이미 다른 회원이 쓰고 있어요. 그 블로그를 먼저 정리해 주세요`);
        }
        const [character] = await tx.select({ id: items.id }).from(items).where(eq(items.code, "char_boy"));
        const [background] = await tx.select({ id: items.id }).from(items).where(eq(items.code, "bg_meadow"));
        if (!character || !background) throw new Error("아이템이 없어요. 먼저 npm run db:seed 를 실행해 주세요");
        // 일반 회원과 똑같이 기본 캐릭터 하나 + 초원 (GAME-01)
        await tx
          .insert(userItems)
          .values([{ userId: user.id, itemId: character.id }, { userId: user.id, itemId: background.id }])
          .onConflictDoNothing();
        // 초대 코드(GAME-09)도 일반 회원처럼 하나 만든다 (32^6가지라 겹칠 일은 거의 없고, 겹치면 다시 실행하면 된다)
        await tx.insert(profiles).values({ userId: user.id, nickname: "관리자", characterItemId: character.id, inviteCode: generateInviteCode() });
        const [blog] = await tx
          .insert(blogs)
          .values({ ownerId: user.id, slug: NOTICE_SLUG, title: "BlogCabin 공지사항", description: "마을 소식과 업데이트를 알려드려요", backgroundItemId: background.id })
          .returning({ id: blogs.id });
        await tx.insert(categories).values({ blogId: blog.id, name: "공지", position: 0 });
      }
    });
    console.log(`✔ 관리자 계정 준비 완료: ${username}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
