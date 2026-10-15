// 데이터 접근 계층(DAL): "지금 보고 있는 사람이 누구인가"를 확인하는 유일한 곳
// Next.js 권장: 인증 확인은 레이아웃이 아니라 각 페이지와 Server Action에서 한다
import "server-only";
import { notFound, redirect } from "next/navigation";
import { readApi } from "@/server/read-api";

/**
 * 지금 보는 사람 (서버의 GET /api/v1/me, backend/src/routes/me.ts). 한 요청 안에서는 한 번만 부른다(serverApi).
 * 로그인하지 않았으면 user가 null
 */
export const getMe = () => readApi.me();

/** 로그인한 회원의 프로필과 블로그. 온보딩 전이면 profile이 null */
export async function getViewer() {
  const me = await getMe();
  return me.user ? { userId: me.user.id, user: me.user, profile: me.profile } : null;
}

/**
 * 지금 로그인한 회원에 연결된 로그인 수단 (AUTH-05): accounts.provider_id 목록.
 * credential = 아이디 로그인, 그 밖에는 google·kakao·naver. 헤더 내 정보 메뉴에서 쓴다
 */
export async function getViewerLoginMethods(): Promise<string[]> {
  const me = await getMe();
  return me.user ? me.loginMethods : [];
}

/**
 * 한 회원 = 아이디 하나: 로그인했지만 아이디·비밀번호(credential)가 없는 회원인가 (소셜로 처음 들어온 회원).
 * 그런 회원은 다른 화면보다 먼저 /account-setup에서 아이디를 만들거나 기존 아이디에 합친다
 */
export async function needsAccountSetup(): Promise<boolean> {
  const me = await getMe();
  return Boolean(me.user) && !(await getViewerLoginMethods()).includes("credential");
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
