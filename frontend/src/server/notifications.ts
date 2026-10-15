// 알림함 (GAME-08)과 레벨업 팝업 (GAME-06). 알림 코드는 서버(backend/src/notifications)에 있고,
// 화면 서버 컴포넌트(알림 페이지·헤더)와 아직 서버로 옮기지 않은 동작(공감·댓글…)이 같은 것을 쓴다
import "server-only";
import type { listNotificationRows } from "@backend/notifications";
import { presentNotification } from "@/lib/notification-text";
import { getLocale, getT } from "@/server/i18n";

export {
  countUnread,
  getLevelUpPopup,
  getNotificationState,
  hasLikeNotification,
  markAllNotificationsRead,
  markGiftSeen,
  markLevelUpsSeen,
  markNotificationRead,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_PANEL_SIZE,
  notifySocial,
  recordLevelUps,
  type LevelUpPopup,
} from "@backend/notifications";
export type { NotificationView } from "@/lib/notification-text";

/** 서버(알림함 읽기 API)가 준 알림을 화면 언어의 문장으로 */
export async function presentNotifications(list: Awaited<ReturnType<typeof listNotificationRows>>) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return { ...list, rows: list.rows.map((r) => presentNotification(t, locale, r)) };
}
