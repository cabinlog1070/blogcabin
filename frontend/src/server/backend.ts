// 서버(backend) API 주소와 넘겨주기 (2026-10-15, 백엔드 나누기 9-4).
// 운영에서 서버 API는 화면과 다른 컨테이너(포트)에서 돈다. DB 비밀번호·로그인 비밀키는 그쪽에만 있고 화면은 모른다.
// 손님(브라우저)은 화면 주소 하나만 알아서, /api/v1/… 과 /api/auth/… 는 화면이 서버 API로 그대로 넘긴다
// (app/api/v1/[...path]/route.ts, app/api/auth/[...all]/route.ts). 개발 서버도 같다 (backend 개발 서버 기본 4000).
import "server-only";

/** 서버 API 주소. 운영은 deploy/deploy.sh가 앱마다 짝이 되는 서버 API 주소를 넣는다 */
export const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");

// 서버 API로 넘기지 않는 머리글 (연결마다 다른 것). host는 아래에서 x-forwarded-host로 넘긴다
const SKIP_REQUEST = new Set(["host", "connection", "keep-alive", "transfer-encoding", "upgrade", "expect"]);
// fetch가 압축을 풀어 주므로 압축·길이 머리글은 돌려주지 않는다 (브라우저가 한 번 더 풀다 깨진다)
const SKIP_RESPONSE = new Set(["content-encoding", "content-length", "connection", "keep-alive", "transfer-encoding"]);

/** 브라우저가 연 사이트 주소를 서버 API도 알게 한다 (같은 사이트에서 온 요청인지, 로그인 쿠키·소셜 로그인 주소) */
export function forwardedHeaders(incoming: Headers, protocol: string) {
  const headers = new Headers();
  incoming.forEach((value, name) => {
    if (!SKIP_REQUEST.has(name)) headers.set(name, value);
  });
  const host = incoming.get("x-forwarded-host") || incoming.get("host");
  if (host) headers.set("x-forwarded-host", host);
  if (!headers.has("x-forwarded-proto")) headers.set("x-forwarded-proto", protocol.replace(/:$/, ""));
  return headers;
}

/** 브라우저 요청을 서버 API에 그대로 넘기고 답을 그대로 돌려준다 (로그인 쿠키·이동(302)·첨부 올리기 포함) */
export async function proxyToBackend(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${url.pathname}${url.search}`, {
      method: request.method,
      headers: forwardedHeaders(request.headers, url.protocol),
      body: hasBody ? request.body : undefined,
      redirect: "manual", // 소셜 로그인의 이동은 브라우저가 직접 따라가야 한다
      cache: "no-store",
      ...(hasBody ? { duplex: "half" } : {}),
    } as RequestInit);
  } catch {
    // 서버 API가 꺼져 있으면 502. 운영 nginx는 502를 받으면 다른 앱으로 다시 보낸다
    return Response.json({ error: "서버에 연결하지 못했어요" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  const headers = new Headers();
  res.headers.forEach((value, name) => {
    if (!SKIP_RESPONSE.has(name) && name !== "set-cookie") headers.set(name, value);
  });
  for (const cookie of res.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
