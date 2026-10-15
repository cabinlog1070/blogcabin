// 지금 보는 사람 (화면의 src/server/dal.ts가 페이지마다 한 번 부른다): GET /api/v1/me
// 로그인하지 않았으면 { user: null }. 로그인했으면 회원 정보·프로필(주민 등록 전이면 null)·로그인 수단·화면 언어,
// 주민이면 헤더에 보일 지갑·알림 상태·소셜 연동 보상 받은 목록까지 한 번에 준다
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth, enabledProviders } from "../auth";
import { lookSql } from "../blog/look";
import { db } from "../db";
import { accounts, blogs, items, pointLedger, profiles, users } from "../db/schema";
import { getWallet } from "../game/points";
import { getNotificationState } from "../notifications";

/** 이 회원이 연동 보상을 받은 소셜 목록 (프로필 메뉴의 +🪙100 표시용) */
async function rewardedSocialProviders(userId: string): Promise<string[]> {
  const rows = await db
    .select({ refId: pointLedger.refId })
    .from(pointLedger)
    .where(and(eq(pointLedger.userId, userId), eq(pointLedger.reason, "social_link")));
  return rows.map((r) => (r.refId ?? "").split(":")[0]).filter(Boolean);
}

export async function me(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) return { user: null, providers: enabledProviders };
  const userId = session.user.id;
  const [[profile], methods, [row]] = await Promise.all([
    db
      .select({
        nickname: profiles.nickname,
        characterAsset: lookSql(items.assetKey, profiles.userId),
        baseCharacterAsset: items.assetKey, // 꾸미기를 뺀 캐릭터 키 (상점 미리 입어 보기)
        blogId: blogs.id,
        blogSlug: blogs.slug,
        blogTitle: blogs.title,
      })
      .from(profiles)
      .innerJoin(items, eq(items.id, profiles.characterItemId))
      .innerJoin(blogs, eq(blogs.ownerId, profiles.userId))
      .where(eq(profiles.userId, userId)),
    // 로그인 수단 (AUTH-05): credential = 아이디 로그인, 그 밖에는 google·kakao·naver
    db.selectDistinct({ providerId: accounts.providerId }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ role: users.role, locale: users.locale }).from(users).where(eq(users.id, userId)),
  ]);
  const header = profile
    ? await Promise.all([getWallet(userId), getNotificationState(userId), rewardedSocialProviders(userId)]).then(([wallet, notice, rewardedSocial]) => ({ wallet, notice, rewardedSocial }))
    : null;
  return {
    user: { id: userId, name: session.user.name, role: row?.role ?? "user" },
    profile: profile ?? null,
    loginMethods: methods.map((m) => m.providerId),
    locale: row?.locale ?? null,
    header,
    providers: enabledProviders,
  };
}

export const meRoutes = new Hono().get("/", async (c) => c.json(await me(c.req.raw.headers)));
