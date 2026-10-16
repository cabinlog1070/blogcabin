// 문의함 (2026-10-16): 문의하기 화면에서 보낸 문의를 저장하고, 관리자 문의함에서 답한다.
// - 회원: 로그인한 채로 보내고, 내 문의와 관리자 답을 문의하기 화면에서 본다. 답이 달리면 알림(inquiry_answer)
// - 로그인할 수 없는 사람(비밀번호를 잊음 등): 아이디(선택)와 답받을 이메일을 적어 보낸다. 관리자는 그 이메일로 직접 답하고 처리 완료로 둔다
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  INQUIRY_ANSWER_MAX,
  INQUIRY_CONTENT_MAX,
  INQUIRY_STATUSES,
  INQUIRY_TOPICS,
  inquiries,
  notifications,
  users,
} from "../db/schema";

/** 화면이 t()로 바꿔 보여 줄 한국어 문장 (test:i18n이 일본어 사전에 있는지 확인한다) */
const msg = <S extends string>(text: S): S => text;

export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

/** 로그인 없이 보내는 문의: 같은 이메일로 하루 이만큼까지 */
export const GUEST_DAILY_PER_EMAIL = 3;
/** 로그인 없이 보내는 문의: 사이트 전체에서 하루 이만큼까지 (장난 글로 문의함이 넘치지 않게) */
export const GUEST_DAILY_TOTAL = 50;
/** 회원 한 명이 하루에 보낼 수 있는 문의 */
export const MEMBER_DAILY = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewInquiry = { topic?: unknown; content?: unknown; guestUsername?: unknown; contactEmail?: unknown };

/** 문의 하나를 저장한다. userId가 없으면 로그인 없이 보낸 문의. 틀리면 { error: 한국어 문장 } */
export async function createInquiry(userId: string | null, input: NewInquiry): Promise<{ id: number } | { error: string }> {
  const topic = INQUIRY_TOPICS.includes(input.topic as InquiryTopic) ? (input.topic as InquiryTopic) : null;
  if (!topic) return { error: msg("문의 종류를 골라 주세요") };
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!content) return { error: msg("문의 내용을 적어 주세요") };
  if (content.length > INQUIRY_CONTENT_MAX) return { error: msg("문의는 2000자까지 쓸 수 있어요") };
  const dayAgo = sql`now() - interval '1 day'`;

  if (userId) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(inquiries)
      .where(and(eq(inquiries.userId, userId), gte(inquiries.createdAt, dayAgo)));
    if (n >= MEMBER_DAILY) return { error: msg("오늘은 문의를 더 보낼 수 없어요. 내일 다시 보내 주세요") };
    const [row] = await db.insert(inquiries).values({ userId, topic, content }).returning({ id: inquiries.id });
    return row;
  }

  const email = typeof input.contactEmail === "string" ? input.contactEmail.trim().toLowerCase() : "";
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) return { error: msg("답받을 이메일을 바르게 적어 주세요") };
  const guestUsername = typeof input.guestUsername === "string" ? input.guestUsername.trim().toLowerCase().slice(0, 40) || null : null;
  const [[{ sameEmail }], [{ total }]] = await Promise.all([
    db
      .select({ sameEmail: count() })
      .from(inquiries)
      .where(and(isNull(inquiries.userId), eq(inquiries.contactEmail, email), gte(inquiries.createdAt, dayAgo))),
    db
      .select({ total: count() })
      .from(inquiries)
      .where(and(isNull(inquiries.userId), gte(inquiries.createdAt, dayAgo))),
  ]);
  if (sameEmail >= GUEST_DAILY_PER_EMAIL || total >= GUEST_DAILY_TOTAL) {
    return { error: msg("지금은 문의를 더 받을 수 없어요. 내일 다시 보내 주세요") };
  }
  const [row] = await db.insert(inquiries).values({ topic, content, guestUsername, contactEmail: email }).returning({ id: inquiries.id });
  return row;
}

/** 내가 보낸 문의 최신순 (답 포함) */
export async function myInquiries(userId: string) {
  return db
    .select({
      id: inquiries.id,
      topic: inquiries.topic,
      content: inquiries.content,
      answer: inquiries.answer,
      answeredAt: inquiries.answeredAt,
      status: inquiries.status,
      createdAt: inquiries.createdAt,
    })
    .from(inquiries)
    .where(eq(inquiries.userId, userId))
    .orderBy(desc(inquiries.createdAt), desc(inquiries.id))
    .limit(30);
}

/** 관리자 문의함: 상태별(없으면 전체) 최신순. 로그인 없이 보낸 문의는 적어 준 아이디의 회원이 있으면 그 회원도 찾아 준다 */
export async function adminInquiries(status: InquiryStatus | null) {
  const sender = sql<string | null>`(SELECT p.nickname FROM profiles p WHERE p.user_id = ${inquiries.userId})`;
  const rows = await db
    .select({
      id: inquiries.id,
      topic: inquiries.topic,
      content: inquiries.content,
      answer: inquiries.answer,
      answeredAt: inquiries.answeredAt,
      status: inquiries.status,
      createdAt: inquiries.createdAt,
      userId: inquiries.userId,
      username: users.username,
      nickname: sender,
      guestUsername: inquiries.guestUsername,
      contactEmail: inquiries.contactEmail,
      // 로그인 없이 적어 준 아이디와 같은 회원 (비밀번호 초기화하러 회원 화면으로 갈 때)
      guestMatchId: sql<string | null>`(SELECT u.id FROM users u WHERE ${inquiries.guestUsername} IS NOT NULL AND u.username = ${inquiries.guestUsername})`,
    })
    .from(inquiries)
    .leftJoin(users, eq(users.id, inquiries.userId))
    .where(status ? eq(inquiries.status, status) : undefined)
    .orderBy(desc(inquiries.createdAt), desc(inquiries.id))
    .limit(100);
  const counts = await db.select({ status: inquiries.status, n: count() }).from(inquiries).groupBy(inquiries.status);
  const byStatus = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s, counts.find((c) => c.status === s)?.n ?? 0])) as Record<InquiryStatus, number>;
  return { rows, counts: byStatus };
}

/** 관리자 첫 화면에 보일 기다리는 문의 수 */
export async function waitingInquiryCount() {
  const [{ n }] = await db.select({ n: count() }).from(inquiries).where(eq(inquiries.status, "waiting"));
  return n;
}

/**
 * 관리자가 답한다. 회원이 보낸 문의면 그 회원에게 알림(inquiry_answer)을 남긴다.
 * 로그인 없이 보낸 문의는 사이트에서 답을 볼 수 없어서 막는다 (이메일로 답하고 처리 완료로 둔다)
 */
export async function answerInquiry(adminId: string, id: number, rawAnswer: unknown): Promise<{ ok: true } | { error: string; status: 400 | 404 }> {
  const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";
  if (!answer) return { error: msg("답을 적어 주세요"), status: 400 };
  if (answer.length > INQUIRY_ANSWER_MAX) return { error: msg("답은 2000자까지 쓸 수 있어요"), status: 400 };
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ userId: inquiries.userId }).from(inquiries).where(eq(inquiries.id, id)).for("update");
    if (!row) return { error: msg("찾을 수 없어요"), status: 404 as const };
    if (!row.userId) return { error: msg("로그인 없이 보낸 문의는 적어 준 이메일로 답해 주세요"), status: 400 as const };
    await tx.update(inquiries).set({ answer, answeredBy: adminId, answeredAt: new Date(), status: "answered" }).where(eq(inquiries.id, id));
    // 답을 고쳐 쓰면 안 읽은 알림은 하나만 남긴다
    await tx
      .delete(notifications)
      .where(and(eq(notifications.userId, row.userId), eq(notifications.kind, "inquiry_answer"), eq(notifications.refId, String(id)), isNull(notifications.readAt)));
    if (row.userId !== adminId) {
      await tx.insert(notifications).values({ userId: row.userId, kind: "inquiry_answer", actorId: adminId, refId: String(id) });
    }
    return { ok: true as const };
  });
}

/** 관리자가 상태를 바꾼다 (처리 완료로 두거나 다시 대기로). 답이 있는 문의를 대기로 돌리면 답변함으로 둔다 */
export async function setInquiryStatus(id: number, rawStatus: unknown): Promise<boolean> {
  const status = rawStatus === "closed" ? "closed" : rawStatus === "waiting" ? "waiting" : null;
  if (!status) return false;
  const next = status === "waiting" ? sql`CASE WHEN ${inquiries.answer} IS NOT NULL THEN 'answered' ELSE 'waiting' END` : sql`'closed'`;
  const updated = await db.update(inquiries).set({ status: next as never }).where(eq(inquiries.id, id)).returning({ id: inquiries.id });
  return updated.length > 0;
}
