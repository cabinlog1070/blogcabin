// 브라우저에서 서버 API(/api/v1/…)를 부르는 작은 도우미.
// 같은 주소(사이트)라 로그인 쿠키가 그대로 간다. 실패하면 서버가 준 한국어 문구로 ApiError를 던진다
// (화면은 errorText(t, err)로 보는 사람의 언어로 바꿔 보여 준다)
import { msg, type T, type TVars } from "@/lib/i18n";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** 로그인·아이디 만들기·주민 등록이 먼저 필요하면 갈 곳 */
    readonly redirect?: string,
    /** 문구의 {이름} 자리에 넣을 값 (예: { level: 3 }) */
    readonly vars?: TVars,
  ) {
    super(message);
  }
}

const FAILED = msg("잠시 뒤 다시 시도해 주세요");

export async function api<R = unknown>(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}): Promise<R> {
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
  if (!res.ok) throw new ApiError(typeof data.error === "string" ? data.error : FAILED, res.status, data.redirect, data.vars);
  return data as R;
}

/**
 * 실패를 보는 사람의 언어로: 문구와 그 안에 넣는 글자 값(아이템 이름 등, DB에는 한국어)을 t()로 바꾼다.
 * API가 아닌 오류(네트워크 등)는 "잠시 뒤 다시 시도해 주세요"
 */
export function errorText(t: T, err: unknown): string {
  if (!(err instanceof ApiError)) return t(FAILED);
  const vars = err.vars && Object.fromEntries(Object.entries(err.vars).map(([k, v]) => [k, typeof v === "string" ? t(v) : v]));
  return t(err.message, vars);
}

const SAVE_FAILED = msg("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요");

/** 저장 버튼의 실패 문구: 서버가 이유를 알려 줬으면(400대) 그 문구, 아니면(네트워크·서버 오류) "저장하지 못했어요…" */
export function saveError(t: T, err: unknown): string {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 ? errorText(t, err) : t(SAVE_FAILED);
}
