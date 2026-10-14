import pg from "pg";

// DB 연결 풀. 접속 주소는 화면(frontend)과 같은 DATABASE_URL을 쓴다.
// DB가 응답하지 않으면 5초 뒤 오류로 끝낸다 (기본값은 끝없이 기다림)
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
// 쉬고 있던 연결이 DB 쪽에서 끊겨도 서버 전체가 죽지 않게 한다
pool.on("error", (err) => console.error("[db] idle client error:", err.message));
