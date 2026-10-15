import { serve } from "@hono/node-server";
import { app } from "./app";

// 서버 시작. 포트는 PORT(개발 기본 4000). 운영에서는 따로 띄우지 않고 화면이 이 앱을 안에서 같이 돌린다.
// 0.0.0.0에서 들어야 컨테이너 밖에서 닿는다.
const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`BlogCabin backend: http://localhost:${info.port}/api/v1/health`);
});
