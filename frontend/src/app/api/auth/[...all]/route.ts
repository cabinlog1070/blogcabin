// 로그인·가입·로그아웃·소셜 로그인(콜백 포함)·소셜 연동 (Better Auth). 설정과 실행은 서버(backend/src/auth)에 있고
// 화면은 그대로 넘긴다 (src/server/backend.ts). 콜백 주소가 카카오·구글·네이버에 사이트 주소로 등록돼 있어 주소는 그대로 둔다
import { proxyToBackend } from "@/server/backend";

export const dynamic = "force-dynamic";

const handle = (request: Request) => proxyToBackend(request);

export { handle as GET, handle as POST };
