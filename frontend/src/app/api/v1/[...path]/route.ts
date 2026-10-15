// 서버(backend) API /api/v1/… 는 서버 API 컨테이너로 그대로 넘긴다 (src/server/backend.ts).
// 서버 코드는 backend/ 폴더에 있고, 새 /api/v1 주소를 backend에 더하면 여기서도 바로 열린다.
import { proxyToBackend } from "@/server/backend";

export const dynamic = "force-dynamic";

const handle = (request: Request) => proxyToBackend(request);

export { handle as DELETE, handle as GET, handle as HEAD, handle as OPTIONS, handle as PATCH, handle as POST, handle as PUT };
