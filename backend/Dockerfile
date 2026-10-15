# BlogCabin 서버(backend) 운영 이미지 (Node 24). GitHub Actions(.github/workflows/deploy.yml)가 빌드하고
# 운영에서는 서버의 deploy/deploy.sh가 DB 마이그레이션에만 쓴다 (손님은 화면 이미지 안에서 이 서버 앱을 같이 돌려 받는다).
# 따로 띄울 때 포트는 PORT.
# npm 설치가 맨 위 package-lock.json 하나라서 저장소 맨 위에서 빌드한다.
#
# 직접 빌드·실행 (저장소 맨 위에서):
#   docker build -f backend/Dockerfile -t blogcabin-api .
#   docker run --env-file app.env -e PORT=4000 -p 4000:4000 blogcabin-api
# DB 마이그레이션 한 번 실행:
#   docker run --rm --env-file app.env blogcabin-api node dist/scripts/migrate.mjs

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace backend --no-audit --no-fund
COPY backend backend
RUN npm run build -w backend

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace backend --omit=dev --no-audit --no-fund
WORKDIR /app/backend
COPY --from=build /app/backend/dist ./dist
COPY backend/drizzle ./drizzle
USER node
EXPOSE 4000
# react-server: DB 코드의 import "server-only"(화면에서 브라우저 코드에 섞이지 않게 막는 표시)를 서버에서는 빈 모듈로 읽는다
CMD ["node", "--conditions=react-server", "dist/src/index.mjs"]
