// 브라우저에서 서버 API(/api/v1/…)를 부르는 작은 도우미.
// 같은 주소(사이트)라 로그인 쿠키가 그대로 간다. 실패하면 서버가 준 한국어 문구로 ApiError를 던진다
// (화면은 t(error.message)로 보는 사람의 언어로 바꿔 보여 준다)
import { msg } from "@/lib/i18n";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** 로그인·아이디 만들기·주민 등록이 먼저 필요하면 갈 곳 */
    readonly redirect?: string,
  ) {
    super(message);
  }
}

const FAILED = msg("잠시 뒤 다시 시도해 주세요");

export async function api<T = unknown>(path: string, init: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(FAILED, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(typeof data.error === "string" ? data.error : FAILED, res.status, data.redirect);
  return data as T;
}
