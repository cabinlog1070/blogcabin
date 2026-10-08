// 운영용 DB 마이그레이션 (deploy/deploy.sh가 컨테이너에서 실행).
// drizzle-kit migrate와 같은 기록 테이블(drizzle.__drizzle_migrations)을 쓰지만, 실패하면 원인을 그대로 보여 준다.
// 실행: npm run db:migrate:prod   (DATABASE_URL 필요. 비밀번호는 출력하지 않는다)
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

type PgError = Error & { code?: string; errno?: string; address?: string; port?: number; cause?: unknown };

function describe(err: unknown): string {
  const e = err as PgError;
  const parts = [e.code ?? e.errno, e.message].filter(Boolean);
  if (e.cause) parts.push(`(원인: ${describe(e.cause)})`);
  return parts.join(" ");
}

function hint(err: unknown): string {
  const text = describe(err);
  if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|timeout/i.test(text))
    return "DB 서버에 접속하지 못했어요. DB_ADDRESS·DB_PORT가 맞는지, 컨테이너(서버)에서 그 주소로 갈 수 있는지(방화벽, PostgreSQL listen_addresses·pg_hba.conf) 확인해 주세요.";
  if (/28P01|password authentication/i.test(text)) return "DB 아이디나 비밀번호가 맞지 않아요 (DB_USERNAME, DB_PASSWORD).";
  if (/3D000|does not exist/i.test(text)) return "DB가 없어요. DB_NAME을 확인하거나 DB를 먼저 만들어 주세요.";
  if (/28000|pg_hba|no encryption|SSL/i.test(text)) return "DB가 이 접속을 허용하지 않아요. SSL이 필요하면 DB_SSLMODE 시크릿(예: require)을, 아니면 pg_hba.conf를 확인해 주세요.";
  if (/42501|permission denied/i.test(text)) return "DB 사용자에게 테이블을 만들 권한이 없어요. DB 소유자나 CREATE 권한을 주세요.";
  return "";
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL이 없어요");
  const url = new URL(raw);
  console.log(`DB 접속: ${url.hostname}:${url.port || 5432}/${decodeURIComponent(url.pathname.slice(1))} (사용자 ${decodeURIComponent(url.username)})`);

  const pool = new Pool({ connectionString: raw, connectionTimeoutMillis: 10_000 });
  try {
    const { rows } = await pool.query<{ version: string }>("select version()");
    console.log(`✔ DB 연결 성공: ${rows[0].version.split(",")[0]}`);
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    console.log("✔ 마이그레이션 완료");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`✗ 마이그레이션 실패: ${describe(err)}`);
  const h = hint(err);
  if (h) console.error(`  → ${h}`);
  process.exit(1);
});
