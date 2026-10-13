// 초대 링크(/?invite=코드)로 들어온 사람의 초대 코드를 쿠키에 기억한다 (GAME-09, spec 005 FR-051).
// 회원가입이나 소셜 로그인(다른 사이트를 다녀옴)을 거쳐 온보딩에 와도 초대 코드 칸이 채워져 있게 한다.
// 서버 컴포넌트는 쿠키를 쓸 수 없어서(읽기만 가능) 여기서 남긴다. 코드가 맞는지는 온보딩 Server Action이 다시 확인한다.
import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, normalizeInviteCode } from "@/lib/invite";

// 블로그 주소는 /@slug, /@slug/글ID. `@`로 시작하는 폴더는 Next.js에서 parallel route라서
// 실제 페이지는 src/app/blog/[slug]에 두고 여기서 주소만 바꿔 보여준다 (주소창에는 /@slug가 남는다).
// next.config.ts의 rewrites로 하면 브라우저에 "쿼리 없이 그렸다"고 잘못 알려 줘서
// ?category=1, ?category=2 화면이 같은 것으로 기억돼 카테고리를 눌러도 화면이 안 바뀌었다. 여기서는 쿼리를 그대로 넘긴다.
const BLOG_PATH = /^\/@([^/]+)(\/[^/]+)?\/?$/;

export function proxy(request: NextRequest) {
  const blog = BLOG_PATH.exec(request.nextUrl.pathname);
  if (blog) {
    const url = request.nextUrl.clone();
    url.pathname = `/blog/${blog[1]}${blog[2] ?? ""}`;
    return NextResponse.rewrite(url);
  }

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

export const config = { matcher: ["/", "/@:slug", "/@:slug/:postId"] };
