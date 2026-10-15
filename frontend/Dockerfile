# BlogCabin 화면(frontend) 운영 이미지 (Node 24). GitHub Actions(.github/workflows/deploy.yml)가 빌드하고
# 서버의 deploy/deploy.sh가 실행한다. 포트는 PORT(기본 8440), 서버 API 주소는 BACKEND_URL.
# 화면은 DB 접속 정보·로그인 비밀키를 받지 않는다 (DB·로그인은 서버 API 이미지 backend/Dockerfile).
# 규칙 숫자 같은 서버 코드 일부(backend/src)를 같이 읽어서 저장소 맨 위에서 빌드한다 (npm 설치도 맨 위 package-lock.json 하나).
#
# 직접 빌드·실행 (저장소 맨 위에서):
#   docker build -f frontend/Dockerfile -t blogcabin-web .
#   docker run -e BACKEND_URL=http://127.0.0.1:8442 -p 8440:8440 blogcabin-web

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
# 빌드에 개발용 패키지(TypeScript, Tailwind)가 필요하다
RUN npm ci --include=dev --no-audit --no-fund

FROM deps AS build
COPY frontend frontend
COPY backend backend
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM node:24-bookworm-slim AS run
WORKDIR /app/frontend
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8440
# deploy/deploy.sh가 되돌릴 때 이 표시를 보고 화면에 DB 접속 정보를 넘기지 않는다 (서버 API와 따로 도는 화면)
LABEL blogcabin.backend="separate"
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 8440
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
