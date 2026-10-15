// 알림 한 줄을 보는 사람의 언어로 바꾼다 (GAME-08 알림 종류 표). 서버는 재료만 주고 문장은 여기서 만든다.
// 서버 화면(알림 페이지)과 헤더 쪽지(브라우저) 둘 다 쓴다. 회원 이름·글 제목·선물에 적은 말은 쓴 그대로
import type { NotificationKind, NotificationRow } from "@backend/notifications";
import { petDisplayName, withJosa } from "@/lib/farm";
import type { Locale, T } from "@/lib/i18n";

export type NotificationView = {
  id: number;
  kind: NotificationKind;
  text: string;
  href: string;
  createdAt: Date;
  read: boolean;
};

/** API(JSON)로 받은 알림 재료: 날짜가 문자열로 온다 */
export type NotificationRowJson = Omit<NotificationRow, "createdAt" | "readAt"> & { createdAt: string; readAt: string | null };

const clip = (s: string, n = 20) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 화면에 보일 문구와 누르면 갈 곳 */
export function presentNotification(
  t: T,
  locale: Locale,
  r: Omit<NotificationRow, "createdAt" | "readAt"> & { createdAt: Date | string; readAt: Date | string | null },
): NotificationView {
  const who = r.actorName ?? t("알 수 없는 회원");
  const postHref = r.blogSlug && r.postId ? `/@${r.blogSlug}/${r.postId}` : "/notifications";
  const title = `「${clip(r.postTitle ?? t("삭제된 글"))}」`;
  const base = { id: r.id, kind: r.kind, createdAt: new Date(r.createdAt), read: r.readAt !== null };
  switch (r.kind) {
    case "level_up":
      return { ...base, text: r.level === 99 ? t("🎉 최고 레벨 Lv.99가 되었어요!") : t("🎉 Lv.{level}이 되었어요!", { level: String(r.level) }), href: "/shop" };
    case "pet_level_up":
      return {
        ...base,
        text: t("🐣 {subject} Lv.{level}이 되었어요!", {
          subject: withJosa(locale, r.petName ? petDisplayName(t, r.petName, r.speciesName) : t("내 동물"), "이", "가"),
          level: String(r.level),
        }),
        href: "/farm",
      };
    case "like":
      return { ...base, text: t("❤️ {who}님이 {title}에 공감했어요", { who, title }), href: postHref };
    case "comment":
      return { ...base, text: t("💬 {who}님이 {title}에 댓글을 달았어요", { who, title }), href: `${postHref}#comments` };
    case "reply":
      return { ...base, text: t("💬 {who}님이 내 댓글에 답글을 달았어요", { who }), href: `${postHref}#comments` };
    case "gift":
      // 관리자가 함께 보낸 말은 쓴 그대로 (번역하지 않는다)
      return {
        ...base,
        text: r.giftMessage
          ? t("🎁 {who}님이 선물을 보냈어요: {message}", { who: r.actorName ?? t("관리자"), message: `「${clip(r.giftMessage, 30)}」` })
          : t("🎁 {who}님이 선물을 보냈어요", { who: r.actorName ?? t("관리자") }),
        href: "/gifts",
      };
  }
}
