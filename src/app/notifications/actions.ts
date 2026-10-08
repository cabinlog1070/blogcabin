"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import {
  getNotificationState,
  listNotifications,
  markAllNotificationsRead,
  markLevelUpsSeen,
  markNotificationRead,
  NOTIFICATION_PANEL_SIZE,
} from "@/server/notifications";

/** 쪽지를 열 때: 최신 알림 20개와 안 읽은 개수 (GAME-08) */
export async function loadNotificationPanel() {
  const viewer = await requireMember();
  const [list, state] = await Promise.all([
    listNotifications(viewer.userId, 1, NOTIFICATION_PANEL_SIZE),
    getNotificationState(viewer.userId),
  ]);
  return {
    unread: state.unread,
    rows: list.rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total: list.total,
  };
}

/** 화면을 옮길 때 헤더의 안 읽은 개수·레벨업 팝업을 새로 읽는다 (루트 레이아웃은 이동만으로 다시 그려지지 않는다) */
export async function refreshNotificationState() {
  const viewer = await requireMember();
  return getNotificationState(viewer.userId);
}

/** 알림 하나를 읽음으로 (누르고 관련 화면으로 갈 때) */
export async function readNotification(id: number) {
  const viewer = await requireMember();
  if (parseId(id) === null) return;
  await markNotificationRead(viewer.userId, id);
  revalidatePath("/", "layout");
}

export async function readAllNotifications() {
  const viewer = await requireMember();
  await markAllNotificationsRead(viewer.userId);
  revalidatePath("/", "layout");
}

/** 레벨업 팝업 [확인]·[상점 가기]: 안 본 레벨업 알림을 모두 봤음으로 (GAME-06) */
export async function seeLevelUps() {
  const viewer = await requireMember();
  await markLevelUpsSeen(viewer.userId);
  revalidatePath("/", "layout");
}
