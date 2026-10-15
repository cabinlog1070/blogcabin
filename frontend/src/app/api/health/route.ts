// 배포 확인용 (deploy/deploy.sh). 로그인 없이 열린다. 화면은 DB를 모르니 화면이 떴는지만 본다.
// 서버 API(DB 포함)까지 닿는지는 같은 주소의 /api/v1/health 가 본다 (화면이 서버 API로 넘긴다)
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "frontend" }, { headers: { "Cache-Control": "no-store" } });
}
