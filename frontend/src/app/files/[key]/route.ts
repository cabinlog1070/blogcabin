// 글 첨부 내려주기 (POST-07, POST-09): 서버 API(GET /api/v1/files/:key, backend/src/routes/files.ts)의 답을 그대로 넘겨준다.
// 글 본문에 /files/키 주소가 들어 있어서 이 주소는 그대로 둔다. 못 여는 파일은 화면 언어의 404 문장으로
import { getT } from "@/server/i18n";
import { serverFetch } from "@/server/api";

export async function GET(_request: Request, ctx: RouteContext<"/files/[key]">) {
  const { key } = await ctx.params;
  // if-none-match: 브라우저가 이미 받은 사진이면 서버 API가 내용 없이 304로 답한다
  const res = await serverFetch(`/files/${encodeURIComponent(key)}`, ["if-none-match"]);
  if (res.ok || res.status === 304) return res;
  const t = await getT();
  return new Response(t("파일을 찾을 수 없어요"), { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
