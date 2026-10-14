import { serve } from "@hono/node-server";
import { app } from "./app";

// 서버 시작. 포트는 PORT(개발 기본 4000, 운영은 deploy/deploy.sh가 8443·8444로 준다).
// 0.0.0.0에서 들어야 컨테이너 밖(우리 nginx)에서 닿는다.
const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`BlogCabin backend: http://localhost:${info.port}/api/v1/health`);
});
