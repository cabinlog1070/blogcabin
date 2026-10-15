import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { uploadAttachment } from "./attachments/upload";
import { auth } from "./auth";
import { db } from "./db";
import { accountRoutes } from "./routes/account";
import { adminRoutes } from "./routes/admin";
import { blogRoutes } from "./routes/blog";
import { attendance } from "./routes/attendance";
import { closetRoutes } from "./routes/closet";
import { farmRoutes } from "./routes/farm";
import { feedRoutes, searchRoutes } from "./routes/feed";
import { localeRoutes } from "./routes/locale";
import { myBlogRoutes } from "./routes/my-blog";
import { notificationRoutes } from "./routes/notifications";
import { onboardingRoutes } from "./routes/onboarding";
import { postRoutes } from "./routes/posts";
import { shopRoutes } from "./routes/shop";
import { townRoutes } from "./routes/town";
import { walletRoutes } from "./routes/wallet";

// 서버(backend) API. 새 주소는 모두 /api/v1/… 로 시작한다.
// 예외: 로그인(/api/auth/…)은 소셜 로그인 콜백 주소가 카카오·구글 개발자 센터에 이 주소로 등록돼 있어 그대로 둔다.
// 운영에서는 화면(frontend)이 /api/v1/… 요청을 이 앱에 그대로 넘긴다 (frontend/src/app/api/v1/[...path]/route.ts).
// 화면이 하던 일을 영역별로 하나씩 옮겨 온다 (순서는 CLAUDE.md의 "폴더").
export const app = new Hono();

const v1 = new Hono();
const noStore = { "Cache-Control": "no-store" };

// 회원마다 다른 답이라 브라우저·중간 서버가 저장해 두지 않게 한다
v1.use(async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "no-store");
});

// 배포 확인용 (deploy/deploy.sh). 로그인 없이 열리고, DB가 응답하면 200, 아니면 503.
// 내부 정보(오류 내용, 주소)는 돌려주지 않는다.
v1.get("/health", async (c) => {
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return c.json({ ok: true, service: "backend" }, 200, noStore);
  } catch {
    return c.json({ ok: false, service: "backend", failed: ["db"] }, 503, noStore);
  }
});

// 글 첨부 올리기 (사진·파일, 로그인한 주민만)
v1.post("/uploads", uploadAttachment);

// 출석 체크, 알림함·레벨업·선물 팝업, 화면 언어, 아이디 만들기·합치기·회원 탈퇴
v1.route("/attendance", attendance);
v1.route("/notifications", notificationRoutes);
v1.route("/locale", localeRoutes);
v1.route("/account", accountRoutes);

// 상점(사기·입어 본 모습 저장), 꾸미기 저장
v1.route("/shop", shopRoutes);
v1.route("/closet", closetRoutes);

// 농장 (알·부화·돌보기·물약·펫 꾸미기)
v1.route("/farm", farmRoutes);

// 블로그: 공감·댓글·이웃·방문 수, 내 블로그 관리(기본 정보·카테고리), 글쓰기
v1.route("/blog", blogRoutes);
v1.route("/my-blog", myBlogRoutes);
v1.route("/posts", postRoutes);

// 마을 주민 등록(온보딩), 관리자(글·댓글 지우기, 강제 탈퇴, 지급, 선물 보내기)
v1.route("/onboarding", onboardingRoutes);
v1.route("/admin", adminRoutes);

// 읽기: 마을 소식·이웃 새 글·태그, 검색, 광장, 경험치·코인 내역 (화면의 서버 쪽 페이지가 부른다)
v1.route("/feed", feedRoutes);
v1.route("/search", searchRoutes);
v1.route("/town", townRoutes);
v1.route("/wallet", walletRoutes);

app.route("/api/v1", v1);

// 로그인·가입·로그아웃·소셜 로그인(콜백 포함)·소셜 연동 (Better Auth, 설정은 src/auth)
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.notFound((c) => c.json({ error: "not found" }, 404));
