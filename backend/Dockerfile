# BlogCabin 서버(backend) 운영 이미지 (Node 24). GitHub Actions(.github/workflows/deploy.yml)가 backend/ 폴더에서 빌드하고
# 서버의 deploy/deploy.sh가 실행한다. 포트는 PORT(운영 8443·8444).
#
# 직접 빌드·실행:
#   cd backend && docker build -t blogcabin-api .
#   docker run --env-file app.env -e PORT=4000 -p 4000:4000 blogcabin-api

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
