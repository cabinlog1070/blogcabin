import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 와이파이의 휴대폰으로 개발 서버를 볼 때 그 주소(예: 192.168.0.10)를 허용한다. 쉼표로 여러 개.
  allowedDevOrigins: ["127.0.0.1", ...(process.env.DEV_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean)],
  // 블로그 주소 /@slug → /blog/[slug] 바꿔 보여주기는 src/proxy.ts에서 한다.
  // 여기 rewrites로 하면 Next.js가 ?category= 같은 쿼리를 빠뜨린 채 브라우저에 알려 줘서,
  // 블로그 홈에서 카테고리를 눌러도 화면이 안 바뀌는 문제가 있었다 (2026-10-13).
  // 서버(backend) 주소 /api/v1/…·/api/auth/… 는 화면의 route handler가 서버 API로 넘긴다 (src/server/backend.ts).
  // 개발 서버도 같다: backend 개발 서버(기본 4000, 바꾸려면 BACKEND_URL)를 같이 켠다
};

export default nextConfig;
