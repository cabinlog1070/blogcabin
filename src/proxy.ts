// 초대 링크(/?invite=코드)로 들어온 사람의 초대 코드를 쿠키에 기억한다 (GAME-09, spec 005 FR-051).
// 회원가입이나 소셜 로그인(다른 사이트를 다녀옴)을 거쳐 온보딩에 와도 초대 코드 칸이 채워져 있게 한다.
// 서버 컴포넌트는 쿠키를 쓸 수 없어서(읽기만 가능) 여기서 남긴다. 코드가 맞는지는 온보딩 Server Action이 다시 확인한다.
import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, normalizeInviteCode } from "@/lib/invite";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const code = normalizeInviteCode(request.nextUrl.searchParams.get("invite"));
  if (code) {
    response.cookies.set(INVITE_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax", // 소셜 로그인에서 돌아오는 이동에도 실린다
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: INVITE_COOKIE_MAX_AGE,
    });
  }
  return response;
}

export const config = { matcher: "/" };
