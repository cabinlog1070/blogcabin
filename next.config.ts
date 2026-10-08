import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 와이파이의 휴대폰으로 개발 서버를 볼 때 그 주소(예: 192.168.0.10)를 허용한다. 쉼표로 여러 개.
  allowedDevOrigins: ["127.0.0.1", ...(process.env.DEV_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean)],
  // 블로그 주소는 /@slug 형식. `@`로 시작하는 폴더는 Next.js에서 특별한 의미(parallel route)라서
  // 실제 페이지는 /blog/[slug]에 두고 주소만 바꿔 보여준다.
  async rewrites() {
    return [
      { source: "/@:slug", destination: "/blog/:slug" },
      { source: "/@:slug/:postId", destination: "/blog/:slug/:postId" },
    ];
  },
};

export default nextConfig;
