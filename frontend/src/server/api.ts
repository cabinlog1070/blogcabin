// 화면의 서버 쪽 페이지가 서버 API(/api/v1/…)를 읽는 도우미.
// 운영에서는 서버 앱이 화면 안에서 같이 돌기 때문에(app/api/v1/[...path]/route.ts) 네트워크를 거치지 않고 그 앱을 바로 부른다.
// 브라우저가 보낸 로그인 쿠키·주소를 그대로 넘겨서, 브라우저가 직접 부른 것과 같은 답을 받는다
import "server-only";
import { headers } from "next/headers";
import { app } from "@backend/app";

export class ServerApiError extends Error {
  constructor(readonly status: number, readonly path: string) {
    super(`서버 API ${path}가 ${status}로 답했어요`);
  }
}

/** JSON의 날짜 글자("2026-10-15T…Z")를 Date로 되돌린다 (이름이 …At인 값만) */
function reviveDates(_key: string, value: unknown) {
  return typeof value === "string" && /At$/.test(_key) && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : value;
}

export async function serverApi<T>(path: string): Promise<T> {
  const incoming = await headers();
  const forwarded = new Headers();
  for (const name of ["cookie", "host", "x-forwarded-host", "x-forwarded-proto", "accept-language", "user-agent"]) {
    const value = incoming.get(name);
    if (value) forwarded.set(name, value);
  }
  const res = await app.fetch(new Request(`http://${incoming.get("host") ?? "localhost"}/api/v1${path}`, { headers: forwarded }));
  if (!res.ok) throw new ServerApiError(res.status, path);
  return JSON.parse(await res.text(), reviveDates) as T;
}
