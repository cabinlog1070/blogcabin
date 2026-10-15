// 운영에서 서버(backend) API /api/v1/… 를 화면(Next.js) 안에서 그대로 돌린다 (2026-10-14).
// 수업 서버의 nginx(~/nginx/blogcabin.java21.net.conf)가 포트 두 개(8440, 8441)에 번갈아 보내는데,
// 한 포트에 화면과 서버가 같이 있어야 해서 backend의 Hono 앱(backend/src/app.ts)을 여기서 불러 요청을 넘긴다.
// 서버 코드는 backend/ 폴더에 그대로 있고, 새 /api/v1 주소를 backend에 더하면 여기서도 바로 열린다.
// 개발 서버에서는 next.config.ts의 rewrites가 먼저 받아 backend 개발 서버(4000)로 넘겨서 이 파일까지 오지 않는다.
import { app } from "@backend/app";

export const dynamic = "force-dynamic";

const handle = (request: Request) => app.fetch(request);

export { handle as DELETE, handle as GET, handle as HEAD, handle as OPTIONS, handle as PATCH, handle as POST, handle as PUT };
