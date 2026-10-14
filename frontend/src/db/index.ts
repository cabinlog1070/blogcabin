import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// 개발 중 파일이 바뀔 때마다 연결 풀이 새로 생기지 않도록 전역에 보관한다
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  // DB가 응답하지 않으면 5초 뒤 오류로 끝낸다 (기본값은 끝없이 기다림)
  new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
// 쉬고 있던 연결이 DB 쪽에서 끊겨도 서버 전체가 죽지 않게 한다
if (!globalForDb.pool) pool.on("error", (err) => console.error("[db] idle client error:", err.message));
globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
