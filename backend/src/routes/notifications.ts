// 알림함 (GAME-08), 레벨업 팝업 (GAME-06), 선물 팝업: /api/v1/notifications/…
// 알림 문장은 화면이 보는 사람의 언어로 만든다 (서버는 재료만)
import { Hono } from "hono";
import { requireViewer, type GuardEnv } from "../http/guard";
import { parseId } from "../lib/ids";
import {
  getNotificationState,
  listNotificationRows,
  markAllNotificationsRead,
  markGiftSeen,
  markLevelUpsSeen,
  markNotificationRead,
  NOTIFICATION_PANEL_SIZE,
} from "../notifications";

export const notificationRoutes = new Hono<GuardEnv>()
  .use(requireViewer("member"))
  /** 쪽지를 열 때: 최신 알림 20개와 안 읽은 개수 */
  .get("/panel", async (c) => {
    const { userId } = c.get("viewer");
    const [list, state] = await Promise.all([listNotificationRows(userId, 1, NOTIFICATION_PANEL_SIZE), getNotificationState(userId)]);
    return c.json({ unread: state.unread, rows: list.rows, total: list.total });
  })
  /** 화면을 옮길 때 헤더의 안 읽은 개수·레벨업 팝업·안 본 선물 */
  .get("/state", async (c) => c.json(await getNotificationState(c.get("viewer").userId)))
  /** 모두 읽음 */
  .post("/read-all", async (c) => {
    await markAllNotificationsRead(c.get("viewer").userId);
    return c.json({ ok: true });
  })
  /** 레벨업 팝업 [확인]·[상점 가기]: 안 본 레벨업 알림을 모두 봤음으로 */
  .post("/level-ups/seen", async (c) => {
    await markLevelUpsSeen(c.get("viewer").userId);
    return c.json({ ok: true });
  })
  /** 알림 하나를 읽음으로 (누르고 관련 화면으로 갈 때) */
  .post("/:id/read", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id !== null) await markNotificationRead(c.get("viewer").userId, id);
    return c.json({ ok: true });
  })
  /** 선물 팝업 [확인]·[받은 선물 보기]: 그 선물 알림을 읽음으로 */
  .post("/:id/gift-seen", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id !== null) await markGiftSeen(c.get("viewer").userId, id);
    return c.json({ ok: true });
  });
