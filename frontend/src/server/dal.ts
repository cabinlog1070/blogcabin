// 데이터 접근 계층(DAL): "지금 보고 있는 사람이 누구인가"를 확인하는 유일한 곳
// Next.js 권장: 인증 확인은 레이아웃이 아니라 각 페이지와 Server Action에서 한다
import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { accounts, blogs, items, profiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { lookSql } from "@/server/look";

/** 로그인 세션 (한 요청 안에서는 한 번만 조회) */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** 로그인한 회원의 프로필과 블로그. 온보딩 전이면 profile이 null */
export const getViewer = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
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
    .where(eq(profiles.userId, session.user.id));

  return { userId: session.user.id, user: session.user, profile: row ?? null };
});

/**
 * 지금 로그인한 회원에 연결된 로그인 수단 (AUTH-05): accounts.provider_id 목록.
 * credential = 아이디 로그인, 그 밖에는 google·kakao·naver. 헤더 내 정보 메뉴에서 쓴다
 */
export const getViewerLoginMethods = cache(async (): Promise<string[]> => {
  const session = await getSession();
  if (!session) return [];
  const rows = await db
    .selectDistinct({ providerId: accounts.providerId })
    .from(accounts)
    .where(eq(accounts.userId, session.user.id));
  return rows.map((r) => r.providerId);
});

/**
 * 한 회원 = 아이디 하나: 로그인했지만 아이디·비밀번호(credential)가 없는 회원인가 (소셜로 처음 들어온 회원).
 * 그런 회원은 다른 화면보다 먼저 /account-setup에서 아이디를 만들거나 기존 아이디에 합친다.
 * getViewerLoginMethods를 같이 써서 한 요청에 쿼리 한 번이다
 */
export async function needsAccountSetup(): Promise<boolean> {
  if (!(await getSession())) return false;
  return !(await getViewerLoginMethods()).includes("credential");
}

/** 로그인만 확인하고 아이디 만들기는 검사하지 않는다 (/account-setup 화면 전용) */
export async function requireSignedIn() {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  return viewer;
}

/** 로그인 + 아이디·비밀번호 확인 (온보딩 페이지용). 아이디가 없으면 /account-setup으로 */
export async function requireUser() {
  const viewer = await requireSignedIn();
  if (await needsAccountSetup()) redirect("/account-setup");
  return viewer;
}

/** 로그인 + 온보딩 완료 확인. 대부분의 회원 전용 화면에서 사용 */
export async function requireMember() {
  const viewer = await requireUser();
  if (!viewer.profile) redirect("/onboarding");
  return { ...viewer, profile: viewer.profile };
}

/** 관리자만 통과. 아니면 404처럼 보이게 한다 (관리자 페이지가 있다는 것도 숨김) */
export async function requireAdmin() {
  const viewer = await requireMember();
  if (viewer.user.role !== "admin") notFound();
  return viewer;
}
