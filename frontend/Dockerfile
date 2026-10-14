# BlogCabin 화면(frontend) 운영 이미지 (Node 24). GitHub Actions(.github/workflows/deploy.yml)가 빌드하고
# 서버의 deploy/deploy.sh가 실행한다. 포트는 PORT(기본 8440), 첨부 파일은 /data/uploads (볼륨).
# 화면은 아직 DB 코드(backend/src/db)를 같이 쓰므로 저장소 맨 위에서 빌드한다 (npm 설치도 맨 위 package-lock.json 하나).
#
# 직접 빌드·실행 (저장소 맨 위에서):
#   docker build -f frontend/Dockerfile -t blogcabin-web .
#   docker run --env-file app.env -p 8440:8440 -v $PWD/uploads:/data/uploads blogcabin-web
# 시드 등 npm 스크립트 한 번 실행:
#   docker run --rm --env-file app.env --entrypoint npm blogcabin-web run db:seed

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
# 시드·관리자 스크립트(tsx)를 컨테이너에서 돌리므로 개발용 패키지도 넣는다
RUN npm ci --include=dev --no-audit --no-fund

FROM deps AS build
COPY frontend frontend
COPY backend backend
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
# 빌드 중에는 DB에 연결하지 않는다. 아래 값은 빌드에만 쓰는 자리 표시용이고 이미지에 남지 않는다
RUN BETTER_AUTH_SECRET=build-only-placeholder-not-used-at-runtime-000 \
    BETTER_AUTH_URL=http://localhost:8440 \
    DATABASE_URL=postgres://build:build@127.0.0.1:1/build \
    npx next build

FROM node:24-bookworm-slim AS run
WORKDIR /app/frontend
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8440 \
    UPLOAD_DIR=/data/uploads
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 8440
VOLUME ["/data/uploads"]
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
