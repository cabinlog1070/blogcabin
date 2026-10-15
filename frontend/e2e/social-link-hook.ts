// e2e/social-account.mjs가 부르는 도우미: 프로필 메뉴 [연동하기]의 마지막 단계를 그대로 흉내 낸다.
// 실제 연동은 소셜 로그인 화면을 거쳐 /api/auth/callback/<소셜>로 돌아오고, Better Auth가
// internalAdapter.createAccount로 accounts 행을 만든다 → databaseHooks.account.create.after(backend/src/auth)가 보상을 준다.
// 로컬에는 소셜 키가 없어서 OAuth를 건너뛰고 같은 createAccount를 직접 부른다 (훅·보상 코드는 실제 그대로 돈다).
// 실행: npx tsx --conditions=react-server e2e/social-link-hook.ts <userId> <kakao|naver|google> <소셜 회원번호>
// 출력: {"ok":true,"accountRowId":"..."} 또는 {"ok":false,"error":"..."}
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const [userId, providerId, accountId] = process.argv.slice(2);
if (!userId || !providerId || !accountId) {
  console.log(
    JSON.stringify({
      ok: false,
      error: "usage: <userId> <providerId> <accountId>",
    }),
  );
  process.exit(2);
}

async function main() {
  // dotenv를 먼저 읽은 뒤에 불러야 db 풀이 DATABASE_URL을 본다
  const { auth } = await import("../../backend/src/auth");
  const ctx = await auth.$context;
  try {
    // Better Auth의 연동(linkOAuthAccount)처럼, 이미 다른 회원에 붙은 소셜 계정이면 연동하지 않는다
    const existing = await ctx.internalAdapter.findAccountByKey({
      providerId,
      accountId,
    });
    if (existing && existing.userId !== userId) {
      console.log(
        JSON.stringify({
          ok: false,
          error: "account_already_linked_to_different_user",
        }),
      );
    } else if (existing) {
      console.log(
        JSON.stringify({ ok: true, accountRowId: existing.id, existed: true }),
      );
    } else {
      const row = await ctx.internalAdapter.createAccount({
        userId,
        providerId,
        accountId,
      });
      console.log(JSON.stringify({ ok: Boolean(row), accountRowId: row?.id }));
    }
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: String(err) }));
  }
}

main().then(() => process.exit(0));
