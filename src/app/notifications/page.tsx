import { Pagination, parsePage } from "@/components/pagination";
import { MarkAllReadButton, NotificationLink } from "@/components/notification-bell";
import { timeAgo } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { countUnread, listNotifications } from "@/server/notifications";

export const metadata = { title: "알림함" };

/** 알림함 전체 화면 (GAME-08): 내 알림만, 최신순 20개씩 */
export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const viewer = await requireMember();
  const page = parsePage((await props.searchParams).page);
  const [list, unread] = await Promise.all([listNotifications(viewer.userId, page), countUnread(viewer.userId)]);
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">✉️ 알림함</h1>
        <span className="text-ink-soft">안 읽은 알림 {unread}개</span>
        {unread > 0 && <MarkAllReadButton className="ml-auto" />}
      </div>

      <section className="card mt-6 p-2 sm:p-3">
        {list.rows.length ? (
          <ul className="divide-y-2 divide-line/60" data-notification-list>
            {list.rows.map((n) => (
              <li key={n.id}>
                <NotificationLink
                  id={n.id}
                  href={n.href}
                  read={n.read}
                  className={`flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-cream ${n.read ? "" : "bg-honey"}`}
                >
                  <span className="min-w-0 flex-1 break-words">{n.text}</span>
                  <span className="shrink-0 text-xs text-ink-soft">{timeAgo(n.createdAt, now)}</span>
                </NotificationLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-center text-ink-soft">아직 알림이 없어요</p>
        )}
        <Pagination page={list.page} pageCount={list.pageCount} hrefFor={(n) => `/notifications?page=${n}`} />
      </section>
    </div>
  );
}
