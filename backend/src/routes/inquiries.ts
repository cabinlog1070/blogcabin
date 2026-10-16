// 문의함: /api/v1/inquiries/… (backend/src/inquiries)
// 보내기는 로그인하지 않아도 된다(비밀번호를 잊은 사람도 문의할 수 있게): 로그인했으면 그 회원의 문의, 아니면 답받을 이메일이 꼭 있어야 한다
import { Hono } from "hono";
import { auth } from "../auth";
import { BAD_REQUEST, isSameOrigin, readJson, requireViewer, type GuardEnv } from "../http/guard";
import { createInquiry, myInquiries } from "../inquiries";

export const inquiryRoutes = new Hono<GuardEnv>()
  /** 문의 보내기 { topic, content, guestUsername?, contactEmail? } */
  .post("/", async (c) => {
    if (!isSameOrigin(c.req.raw.headers)) return c.json({ ok: false, error: BAD_REQUEST }, 403);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const created = await createInquiry(session?.user.id ?? null, await readJson(c));
    if ("error" in created) return c.json({ ok: false, error: created.error }, 400);
    return c.json({ ok: true, id: created.id, signedIn: Boolean(session) });
  })
  /** 내가 보낸 문의와 관리자 답 */
  .get("/mine", requireViewer("signedIn"), async (c) => c.json({ rows: await myInquiries(c.get("viewer").userId) }));
