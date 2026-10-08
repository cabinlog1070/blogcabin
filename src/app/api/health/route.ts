import { sql } from "drizzle-orm";
import { db } from "@/db";

// 배포 확인용 (deploy/deploy.sh, 호스팅 헬스 체크). 로그인 없이 열리고, DB가 응답하면 200, 아니면 503.
// 내부 정보(오류 내용, 주소)는 돌려주지 않는다.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ ok: false, failed: ["db"] }, { status: 503, headers });
  }
}
