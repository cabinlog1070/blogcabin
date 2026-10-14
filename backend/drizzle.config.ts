import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// 접속 정보: backend/.env, 없으면 화면 쪽 frontend/.env.local (먼저 읽은 값이 남는다)
config({ path: [".env", "../frontend/.env.local"], quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // 마이그레이션 SQL 파일이 쌓이는 곳
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
