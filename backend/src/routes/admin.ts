// 관리자 (users.role = 'admin'): /api/v1/admin/…
// 글·댓글 지우기(ADMIN), 강제 탈퇴, 비밀번호 초기화, 문의함, 코인·경험치 지급, 선물 보내기. 관리자가 아니면 없는 주소(404)로 답한다.
// 실패 문구는 한국어 문장과 그 안에 넣을 값(vars)으로 돌려주고, 화면이 보는 사람의 언어로 바꾼다
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { deleteMember } from "../account/delete-member";
import { makeTempPassword, setMemberPassword } from "../account/password";
import { adminInquiries, answerInquiry, setInquiryStatus, type InquiryStatus } from "../inquiries";
import { adminContent, adminMember, adminMembers, adminOverview } from "../admin/read";
import { db } from "../db";
import { animalSpecies, comments, GIFT_MESSAGE_MAX, items, notifications, pointLedger, posts, profiles, users } from "../db/schema";
import { sendGifts } from "../gifts/send";
import { getWallet, lockUser } from "../game/points";
import { ADMIN_MAX_COINS, expForLevel, levelFromExp, MAX_LEVEL } from "../game/rules";
import { BAD_REQUEST, readJson, requireViewer, type GuardEnv } from "../http/guard";
import { parseId } from "../lib/ids";
import { isForSale } from "../shop/rules";

const msg = <S extends string>(text: S): S => text;
type Vars = Record<string, string | number>;
const fail = (error: string, vars?: Vars) => ({ ok: false as const, error, vars });

/** 한 번에 줄 수 있는 코인·경험치 */
const GRANT_MAX = 10_000_000;
/** 선물 한 번에 보낼 수 있는 코인 (관리자 지급의 [코인 최대]와 같은 상한) */
const GIFT_MAX_COINS = ADMIN_MAX_COINS;

/** 숫자 칸: 비었으면 0, 정수가 아니면 NaN */
function count(v: unknown): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) ? n : NaN;
}

/** 숫자 ID 목록 (겹친 것과 잘못된 값은 뺀다) */
function idList(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(parseId))].filter((id): id is number => id !== null);
}

export const adminRoutes = new Hono<GuardEnv>()
  .use(requireViewer("admin"))
  /** 관리자 첫 화면 읽기 */
  .get("/overview", async (c) => c.json(await adminOverview()))
  /** 글·댓글 관리 읽기: ?tab=posts|comments&q=&page= */
  .get("/content", async (c) => {
    const tab = c.req.query("tab") === "comments" ? "comments" : "posts";
    const q = (c.req.query("q") ?? "").trim().slice(0, 50);
    return c.json(await adminContent(tab, q, parseId(c.req.query("page")) ?? 1));
  })
  /** 문의함 읽기: ?status=waiting|answered|closed (없으면 전체) */
  .get("/inquiries", async (c) => {
    const s = c.req.query("status");
    return c.json(await adminInquiries(s === "waiting" || s === "answered" || s === "closed" ? (s as InquiryStatus) : null));
  })
  /** 문의에 답한다 { answer }: 회원에게 알림이 간다 */
  .post("/inquiries/:id/answer", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null) return c.json(fail(BAD_REQUEST), 400);
    const done = await answerInquiry(c.get("viewer").userId, id, (await readJson(c)).answer);
    return "error" in done ? c.json(fail(done.error), done.status) : c.json({ ok: true });
  })
  /** 문의 상태 바꾸기 { status: closed | waiting } */
  .post("/inquiries/:id/status", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null || !(await setInquiryStatus(id, (await readJson(c)).status))) return c.json(fail(BAD_REQUEST), 400);
    return c.json({ ok: true });
  })
  /** 회원 목록 읽기: ?q= */
  .get("/members", async (c) => c.json({ rows: await adminMembers((c.req.query("q") ?? "").trim().slice(0, 50)) }))
  /** 회원 한 명 읽기 */
  .get("/members/:id", async (c) => {
    const id = c.req.param("id");
    const data = id.length > 100 ? null : await adminMember(id);
    return data ? c.json(data) : c.json({ ok: false, error: msg("찾을 수 없어요") }, 404);
  })
  /** 어느 블로그의 글이든 지운다 (댓글·공감도 함께 지워진다) */
  .delete("/posts/:id", async (c) => {
    const postId = parseId(c.req.param("id"));
    if (postId === null) return c.json(fail(BAD_REQUEST), 400);
    await db.delete(posts).where(eq(posts.id, postId));
    return c.json({ ok: true });
  })
  /** 누구의 댓글이든 지운다 (회원이 지울 때와 같은 규칙, 답글이 남으면 "삭제된 댓글" 자리로 남는다) */
  .delete("/comments/:id", async (c) => {
    const commentId = parseId(c.req.param("id"));
    if (commentId === null) return c.json(fail(BAD_REQUEST), 400);
    await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
    return c.json({ ok: true });
  })
  /**
   * 강제 탈퇴: 회원이 스스로 탈퇴할 때와 똑같이 지운다 (deleteMember, AUTH-06).
   * 세션도 함께 지워져서 그 회원은 바로 로그아웃된다. 관리자 계정과 나 자신은 강제 탈퇴할 수 없다.
   * 돌려주는 name(닉네임, 없으면 아이디)은 화면이 "…님을 탈퇴시켰어요" 안내에 쓴다
   */
  .post("/members/:userId/withdraw", async (c) => {
    const userId = c.req.param("userId");
    if (userId === c.get("viewer").userId) return c.json(fail(msg("내 계정은 여기서 탈퇴할 수 없어요")), 400);
    const [target] = await db
      .select({ role: users.role, username: users.username, nickname: profiles.nickname })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, userId));
    if (!target) return c.json(fail(msg("이미 탈퇴한 회원이에요")), 404);
    if (target.role === "admin") return c.json(fail(msg("관리자 계정은 강제 탈퇴할 수 없어요")), 400);

    await deleteMember(userId);
    return c.json({ ok: true, name: target.nickname ?? target.username ?? null });
  })
  /**
   * 비밀번호 초기화: 비밀번호를 잊고 소셜도 연동하지 않은 회원이 문의했을 때, 임시 비밀번호를 만들어 돌려준다.
   * 관리자가 회원에게 알려 주고, 회원은 로그인한 뒤 블로그 관리에서 새 비밀번호로 바꾼다.
   * 그 회원의 모든 기기는 로그아웃되고 로그인 실패 잠금도 풀린다. 관리자 계정과 나 자신은 여기서 바꿀 수 없다
   */
  .post("/members/:userId/password-reset", async (c) => {
    const userId = c.req.param("userId");
    if (userId === c.get("viewer").userId) return c.json(fail(msg("내 비밀번호는 환경 설정에서 바꿔 주세요")), 400);
    const [target] = await db.select({ role: users.role, username: users.username }).from(users).where(eq(users.id, userId));
    if (!target) return c.json(fail(msg("이미 탈퇴한 회원이에요")), 404);
    if (target.role === "admin") return c.json(fail(msg("관리자 계정의 비밀번호는 초기화할 수 없어요")), 400);

    const tempPassword = makeTempPassword();
    if (!(await setMemberPassword(userId, tempPassword))) return c.json(fail(msg("아이디가 없는 회원이에요")), 400);
    return c.json({ ok: true, username: target.username, tempPassword });
  })
  /**
   * 지급: 회원에게 코인·경험치를 준다 (원장 사유 admin_grant, ref_id = 준 관리자).
   * { userId, coins, exp, maxCoins, maxExp }. [코인 최대]는 잔액을 ADMIN_MAX_COINS까지, [경험치 최대]는 최고 레벨(Lv.99)이 되는 경험치까지 채운다.
   * 레벨이 오르면 마지막 레벨의 레벨업 알림 하나만 남긴다 (한 번에 여러 레벨이 올라도 알림함이 넘치지 않게)
   */
  .post("/grant", async (c) => {
    const adminId = c.get("viewer").userId;
    const body = await readJson(c);
    const userId = typeof body.userId === "string" ? body.userId : "";
    const coins = count(body.coins);
    const exp = count(body.exp);
    const maxCoins = body.maxCoins === true;
    const maxExp = body.maxExp === true;
    if (!userId) return c.json(fail(msg("회원을 골라 주세요")), 400);
    if (Number.isNaN(coins) || coins > GRANT_MAX) return c.json(fail(Number.isNaN(coins) ? msg("코인은 0 이상") : msg("코인은 한 번에 1,000만까지")), 400);
    if (Number.isNaN(exp) || exp > GRANT_MAX) return c.json(fail(Number.isNaN(exp) ? msg("경험치는 0 이상") : msg("경험치는 한 번에 1,000만까지")), 400);

    const result = await db.transaction(async (tx) => {
      const [member] = await tx.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, userId));
      if (!member) return fail(msg("주민을 찾지 못했어요"));
      await lockUser(tx, userId);
      const before = await getWallet(userId, tx);
      const coinDelta = maxCoins ? Math.max(0, ADMIN_MAX_COINS - before.coins) : coins;
      const expDelta = maxExp ? Math.max(0, expForLevel(MAX_LEVEL) - before.exp) : exp;
      if (coinDelta === 0 && expDelta === 0) return fail(msg("줄 코인·경험치가 없어요 (이미 최대일 수 있어요)"));

      await tx.insert(pointLedger).values({ userId, reason: "admin_grant", coinDelta, expDelta, refId: adminId });
      const level = levelFromExp(before.exp + expDelta);
      if (level > before.level) {
        await tx.insert(notifications).values({ userId, kind: "level_up", level }).onConflictDoNothing();
      }
      return { ok: true as const, nickname: member.nickname, coins: coinDelta, exp: expDelta, level, balance: before.coins + coinDelta };
    });
    return c.json(result, result.ok ? 200 : 400);
  })
  /**
   * 선물 보내기: 고른 주민(한 명 이상, 또는 모든 주민)에게 코인·아이템·펫 알과 함께 보낼 말을 보낸다.
   * { message, coins, itemIds, speciesIds, userIds, everyone }. 주민마다 선물 하나가 생기고,
   * 받은 주민은 알림과 선물 팝업으로 받는다 (src/gifts/send.ts). 돌려주는 sent·skipped는 주민 닉네임 목록
   */
  .post("/gifts", async (c) => {
    const adminId = c.get("viewer").userId;
    const body = await readJson(c);
    const message = (typeof body.message === "string" ? body.message : "").trim().replace(/\r\n/g, "\n");
    const coins = count(body.coins);
    const itemIds = idList(body.itemIds);
    const speciesIds = idList(body.speciesIds);
    const everyone = body.everyone === true;

    if (!message) return c.json(fail(msg("함께 보낼 말을 적어 주세요")), 400);
    if ([...message].length > GIFT_MESSAGE_MAX) return c.json(fail(msg("함께 보낼 말은 {n}자까지 쓸 수 있어요"), { n: GIFT_MESSAGE_MAX }), 400);
    if (Number.isNaN(coins) || coins > GIFT_MAX_COINS) {
      return c.json(fail(msg("코인은 0부터 {n}까지 보낼 수 있어요"), { n: GIFT_MAX_COINS.toLocaleString() }), 400);
    }
    if (coins === 0 && itemIds.length === 0 && speciesIds.length === 0) return c.json(fail(msg("보낼 코인이나 아이템, 펫을 골라 주세요")), 400);

    // 상점에서 파는 아이템만 (가입 때 받는 기본 아이템과 판매를 멈춘 예전 캐릭터는 보내지 않는다)
    const known = itemIds.length
      ? (await db.select({ id: items.id, type: items.type, isStarter: items.isStarter }).from(items).where(inArray(items.id, itemIds))).filter(isForSale)
      : [];
    if (known.length !== itemIds.length) return c.json(fail(msg("없는 아이템이 있어요. 화면을 새로 고쳐 주세요")), 400);
    const knownSpecies = speciesIds.length ? await db.select({ id: animalSpecies.id }).from(animalSpecies).where(inArray(animalSpecies.id, speciesIds)) : [];
    if (knownSpecies.length !== speciesIds.length) return c.json(fail(msg("없는 펫이 있어요. 화면을 새로 고쳐 주세요")), 400);

    // 모든 주민: 보내는 관리자 자신은 뺀다
    const userIds = Array.isArray(body.userIds) ? body.userIds.filter((v): v is string => typeof v === "string" && v !== "").slice(0, 10_000) : [];
    const picked = everyone
      ? (await db.select({ userId: profiles.userId }).from(profiles)).filter((p) => p.userId !== adminId)
      : userIds.length
        ? await db.select({ userId: profiles.userId }).from(profiles).where(inArray(profiles.userId, userIds))
        : [];
    if (!picked.length) return c.json(fail(msg("받을 주민을 골라 주세요")), 400);

    const result = await sendGifts({ senderId: adminId, recipientIds: picked.map((p) => p.userId), message, coins, itemIds, speciesIds });
    if (!result.sent.length) return c.json(fail(msg("고른 주민이 아이템을 이미 모두 갖고 있어서 보낼 선물이 없어요")), 409);
    return c.json({ ok: true, sent: result.sent.map((r) => r.nickname), skipped: result.skipped.map((r) => r.nickname) });
  });
