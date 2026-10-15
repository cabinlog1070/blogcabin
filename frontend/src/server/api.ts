// 화면의 서버 쪽 페이지가 서버 API(/api/v1/…)를 읽는 도우미.
// 서버 API 컨테이너(src/server/backend.ts의 BACKEND_URL)를 부른다.
// 브라우저가 보낸 로그인 쿠키·주소를 그대로 넘겨서, 브라우저가 직접 부른 것과 같은 답을 받는다
import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { BACKEND_URL } from "./backend";

export class ServerApiError extends Error {
  constructor(readonly status: number, readonly path: string) {
    super(`서버 API ${path}가 ${status}로 답했어요`);
  }
}

/** JSON의 날짜 글자("2026-10-15T…Z")를 Date로 되돌린다 (이름이 …At인 값만) */
function reviveDates(_key: string, value: unknown) {
  return typeof value === "string" && /At$/.test(_key) && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : value;
}

/** 서버 API를 부른 답 그대로 (첨부 파일처럼 JSON이 아닌 것도) */
export async function serverFetch(path: string, extraHeaders: string[] = []): Promise<Response> {
  const incoming = await headers();
  const forwarded = new Headers();
  for (const name of ["cookie", "x-forwarded-for", "x-forwarded-proto", "accept-language", "user-agent", ...extraHeaders]) {
    const value = incoming.get(name);
    if (value) forwarded.set(name, value);
  }
  const host = incoming.get("x-forwarded-host") || incoming.get("host");
  if (host) forwarded.set("x-forwarded-host", host);
  return fetch(`${BACKEND_URL}/api/v1${path}`, { headers: forwarded, cache: "no-store" });
}

/** 한 요청 안에서 같은 주소는 한 번만 부른다 (generateMetadata와 페이지가 같은 것을 읽을 때) */
const readJson = cache(async (path: string): Promise<{ status: number; body: unknown }> => {
  const res = await serverFetch(path);
  return { status: res.status, body: res.ok ? JSON.parse(await res.text(), reviveDates) : null };
});

export async function serverApi<T>(path: string): Promise<T> {
  const { status, body } = await readJson(path);
  if (status >= 400) throw new ServerApiError(status, path);
  return body as T;
}

/** 없는 것(404)이면 null */
export async function serverApiOrNull<T>(path: string): Promise<T | null> {
  const { status, body } = await readJson(path);
  if (status === 404) return null;
  if (status >= 400) throw new ServerApiError(status, path);
  return body as T;
}
