// 운영용 DB 마이그레이션 (deploy/deploy.sh가 컨테이너에서 실행).
// drizzle/의 SQL을 차례로 적용하고, 적용한 기록은 drizzle-kit과 같은 형식(__drizzle_migrations: hash, created_at)으로 남긴다.
//
// DB_SCHEMA를 주면(예: 공용 DB에서 내 스키마만 쓸 수 있을 때) 그 스키마 안에서만 만든다.
//  - 마이그레이션 SQL의 "public". 을 그 스키마로 바꾸고, 기록 테이블도 그 스키마에 둔다
//  - CREATE SCHEMA를 하지 않는다 (DB 전체에 대한 CREATE 권한이 없어도 된다)
// DB_SCHEMA가 없으면 로컬 개발과 같다: public 스키마, 기록은 drizzle 스키마 (npm run db:migrate와 호환)
//
// 실행: npm run db:migrate:prod   (DATABASE_URL 필요. 비밀번호는 출력하지 않는다)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";

config({ path: ".env.local", quiet: true });

type PgError = Error & { code?: string; errno?: string; cause?: unknown };
type JournalEntry = { idx: number; when: number; tag: string };

const MIGRATIONS = path.resolve("drizzle");
const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;

function describe(err: unknown): string {
  const e = err as PgError;
  const parts = [e.code ?? e.errno, e.message].filter(Boolean);
  if (e.cause) parts.push(`(원인: ${describe(e.cause)})`);
  return parts.join(" ");
}

function hint(err: unknown): string {
  const text = describe(err);
  if (text.includes("권한도 없어요")) return ""; // 이미 안내가 들어 있음
  if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|timeout/i.test(text))
    return "DB 서버에 접속하지 못했어요. DB_ADDRESS·DB_PORT가 맞는지, 컨테이너(서버)에서 그 주소로 갈 수 있는지(방화벽, PostgreSQL listen_addresses·pg_hba.conf) 확인해 주세요.";
  if (/28P01|password authentication/i.test(text)) return "DB 아이디나 비밀번호가 맞지 않아요 (DB_USERNAME, DB_PASSWORD).";
  if (/3D000/.test(text)) return "DB가 없어요. DB_NAME을 확인하거나 DB를 먼저 만들어 주세요.";
  if (/42P07|42710|already exists/i.test(text))
    return "같은 이름의 테이블·타입이 이미 있어요. 그 스키마에 예전에 만든 테이블이 남아 있는지 확인해 주세요.";
  if (/28000|pg_hba|no encryption|SSL/i.test(text)) return "DB가 이 접속을 허용하지 않아요. SSL이 필요하면 DB_SSLMODE 시크릿(예: require)을, 아니면 pg_hba.conf를 확인해 주세요.";
  if (/42501|permission denied/i.test(text))
    return "DB 사용자에게 만들 권한이 없어요. 내 스키마에서만 만들 수 있는 DB라면 DB_SCHEMA 시크릿에 그 스키마 이름을 넣어 주세요.";
  return "";
}

// DB_NAME의 데이터베이스가 아직 없으면 만든다 (첫 배포). 만들 권한이 없으면 안내와 함께 멈춘다
async function ensureDatabase(url: URL) {
  const name = decodeURIComponent(url.pathname.slice(1));
  const probe = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 10_000 });
  try {
    await probe.query("select 1");
    return;
  } catch (err) {
    if ((err as PgError).code !== "3D000") throw err;
  } finally {
    await probe.end();
  }
  console.log(`DB ${name}가 없어서 새로 만들어요`);
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  const pool = new Pool({ connectionString: admin.toString(), connectionTimeoutMillis: 10_000 });
  try {
    await pool.query(`CREATE DATABASE ${quote(name)}`);
    console.log(`✔ DB ${name} 만들었어요`);
  } catch (err) {
    const code = (err as PgError).code;
    if (code === "42P04") return; // 그새 다른 곳에서 만들어짐
    if (code === "42501")
      throw Object.assign(new Error(`DB ${name}가 없고, 이 사용자에게 DB를 만들 권한도 없어요. DB 관리자에게 ${name} DB를 만들어 달라고 하거나 DB_NAME을 있는 DB로 바꿔 주세요`), { code });
    throw err;
  } finally {
    await pool.end();
  }
}

async function applyMigrations(client: PoolClient, schema: string | null) {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf8")) as { entries: JournalEntry[] };
  const logSchema = schema ?? "drizzle";
  const table = `${quote(logSchema)}.${quote("__drizzle_migrations")}`;

  if (schema) {
    await client.query(`SET search_path TO ${quote(schema)}`);
  } else {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quote(logSchema)}`);
  }
  await client.query(`CREATE TABLE IF NOT EXISTS ${table} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const { rows } = await client.query<{ created_at: string }>(`SELECT created_at FROM ${table} ORDER BY created_at DESC LIMIT 1`);
  const last = rows[0] ? Number(rows[0].created_at) : 0;

  const pending = journal.entries.filter((e) => e.when > last).sort((a, b) => a.idx - b.idx);
  if (pending.length === 0) {
    console.log("적용할 마이그레이션이 없어요 (최신)");
    return;
  }
  for (const entry of pending) {
    const file = readFileSync(path.join(MIGRATIONS, `${entry.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(file).digest("hex"); // drizzle과 같은 방식
    const sql = schema ? file.replace(/"public"\./g, `${quote(schema)}.`) : file;
    const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    await client.query("BEGIN");
    try {
      for (const statement of statements) await client.query(statement);
      await client.query(`INSERT INTO ${table} (hash, created_at) VALUES ($1, $2)`, [hash, entry.when]);
      await client.query("COMMIT");
      console.log(`  ✔ ${entry.tag}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw Object.assign(new Error(`${entry.tag} 적용 중 실패: ${describe(err)}`), { code: (err as PgError).code });
    }
  }
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL이 없어요");
  const schema = process.env.DB_SCHEMA?.trim() || null;
  const url = new URL(raw);
  console.log(
    `DB 접속: ${url.hostname}:${url.port || 5432}/${decodeURIComponent(url.pathname.slice(1))} (사용자 ${decodeURIComponent(url.username)}${schema ? `, 스키마 ${schema}` : ""})`,
  );

  await ensureDatabase(url);

  const pool = new Pool({ connectionString: raw, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ version: string }>("select version()");
    console.log(`✔ DB 연결 성공: ${rows[0].version.split(",")[0]}`);
    await applyMigrations(client, schema);
    console.log("✔ 마이그레이션 완료");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`✗ 마이그레이션 실패: ${describe(err)}`);
  const h = hint(err);
  if (h) console.error(`  → ${h}`);
  process.exit(1);
});
