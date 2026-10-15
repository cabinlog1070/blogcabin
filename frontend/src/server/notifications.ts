// 알림함 (GAME-08). 알림 읽기·쓰기는 서버(backend/src/notifications, 알림 API)에 있고,
// 여기엔 서버가 준 알림을 화면 언어의 문장으로 바꾸는 것만 둔다
import "server-only";
import type { listNotificationRows } from "@backend/notifications";
import { presentNotification } from "@/lib/notification-text";
import { getLocale, getT } from "@/server/i18n";

export type { NotificationView } from "@/lib/notification-text";

/** 서버(알림함 읽기 API)가 준 알림을 화면 언어의 문장으로 */
export async function presentNotifications(list: Awaited<ReturnType<typeof listNotificationRows>>) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return { ...list, rows: list.rows.map((r) => presentNotification(t, locale, r)) };
}
