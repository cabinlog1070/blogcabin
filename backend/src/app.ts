import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { uploadAttachment } from "./attachments/upload";
import { auth } from "./auth";
import { db } from "./db";
import { accountRoutes } from "./routes/account";
import { attendance } from "./routes/attendance";
import { closetRoutes } from "./routes/closet";
import { localeRoutes } from "./routes/locale";
import { notificationRoutes } from "./routes/notifications";
import { shopRoutes } from "./routes/shop";

// 서버(backend) API. 새 주소는 모두 /api/v1/… 로 시작한다.
// 예외: 로그인(/api/auth/…)은 소셜 로그인 콜백 주소가 카카오·구글 개발자 센터에 이 주소로 등록돼 있어 그대로 둔다.
// 운영에서는 우리 nginx가 /api/v1/·/api/auth/ 로 오는 요청만 이 서버로 보내고, 나머지는 화면(frontend)으로 보낸다.
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

// 출석 체크, 알림함·레벨업·선물 팝업, 화면 언어, 회원 탈퇴
v1.route("/attendance", attendance);
v1.route("/notifications", notificationRoutes);
v1.route("/locale", localeRoutes);
v1.route("/account", accountRoutes);

// 상점(사기·입어 본 모습 저장), 꾸미기 저장
v1.route("/shop", shopRoutes);
v1.route("/closet", closetRoutes);

app.route("/api/v1", v1);

// 로그인·가입·로그아웃·소셜 로그인(콜백 포함)·소셜 연동 (Better Auth, 설정은 src/auth)
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.notFound((c) => c.json({ error: "not found" }, 404));
