"use client";

// 헤더 레벨 배지 옆 쪽지(✉) 알림함 (GAME-08)과 레벨업 팝업 (GAME-06)
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PopoverPanel, useHeaderPopover } from "@/components/header-popover";
import {
  loadNotificationPanel,
  readAllNotifications,
  readNotification,
  refreshNotificationState,
  seeLevelUps,
} from "@/app/notifications/actions";
import { ItemArt } from "@/components/item-art";
import { timeAgo } from "@/lib/game";
import type { LevelUpPopup, NotificationView } from "@/server/notifications";

type PanelRow = Omit<NotificationView, "createdAt"> & { createdAt: string };

/** 쪽지 모양 그림 (작은 편지 봉투) */
function EnvelopeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" width="20" height="15" className={className} aria-hidden>
      <rect x="1.5" y="1.5" width="25" height="17" rx="3" fill="#fffdf5" stroke="#4a3426" strokeWidth="2" />
      <path d="M2.5 3L14 11.5L25.5 3" fill="none" stroke="#4a3426" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M2.5 17.5L10.5 9.5M25.5 17.5L17.5 9.5" stroke="#d9b98a" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="12" r="2.6" fill="#e5484d" stroke="#4a3426" strokeWidth="1" />
    </svg>
  );
}

export function NotificationBell({ unread: initialUnread, popup: initialPopup }: { unread: number; popup: LevelUpPopup | null }) {
  const [unread, setUnread] = useState(initialUnread);
  const [popup, setPopup] = useState(initialPopup);
  // 쪽지 바로 아래, 화면 양옆 12px 안에 들어오게 (휴대폰에서 왼쪽으로 잘리던 문제)
  const { open, box, setAnchor, setPanel, toggle: togglePanel, close } = useHeaderPopover(352); // 22rem
  const [rows, setRows] = useState<PanelRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  // 서버가 헤더를 다시 그리면(revalidatePath) 그 값으로 맞춘다 (렌더 중에 이전 값과 비교)
  const [prevProps, setPrevProps] = useState({ initialUnread, initialPopup });
  if (prevProps.initialUnread !== initialUnread || prevProps.initialPopup !== initialPopup) {
    setPrevProps({ initialUnread, initialPopup });
    setUnread(initialUnread);
    setPopup(initialPopup);
  }
  // 화면을 옮길 때마다 개수·레벨업 팝업을 새로 읽는다 (남이 공감해서 오른 레벨도 다음 화면에서 뜨게)
  useEffect(() => {
    if (firstPath.current === pathname) return;
    firstPath.current = pathname;
    refreshNotificationState()
      .then((s) => {
        setUnread(s.unread);
        setPopup(s.popup);
      })
      .catch(() => {});
  }, [pathname]);

  // 바깥을 누르거나 Esc를 누르거나 화면을 옮기면 닫힌다 (useHeaderPopover)
  const toggle = () => {
    if (togglePanel()) {
      startTransition(async () => {
        const data = await loadNotificationPanel();
        setRows(data.rows);
        setTotal(data.total);
        setUnread(data.unread);
      });
    }
  };

  const openRow = (r: PanelRow) => {
    close();
    if (!r.read) setUnread((n) => Math.max(0, n - 1));
    startTransition(async () => {
      if (!r.read) await readNotification(r.id);
      router.push(r.href);
    });
  };

  const readAll = () => {
    setUnread(0);
    setRows((list) => list?.map((r) => ({ ...r, read: true })) ?? null);
    startTransition(() => readAllNotifications());
  };

  const badge = unread > 9 ? "9+" : String(unread);
  const now = new Date();

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `알림함, 안 읽은 알림 ${unread}개` : "알림함"}
        title="알림함"
        data-notification-button
        className="relative flex items-center rounded-full bg-paper px-1.5 py-1 shadow-sm hover:text-leaf-dark sm:px-2.5"
      >
        <EnvelopeIcon />
        {unread > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-berry px-1 text-center text-[10px] font-bold leading-[18px] text-white"
            data-unread-count
          >
            {badge}
          </span>
        )}
      </button>

      <PopoverPanel open={open} box={box} panelRef={setPanel} label="알림함" className="flex max-h-[70dvh] flex-col overflow-hidden" data-notification-panel>
        <div className="flex items-center gap-2 border-b-2 border-line px-4 py-2.5">
          <h2 className="font-display text-lg">✉️ 알림함</h2>
          {unread > 0 && <span className="text-xs text-ink-soft">안 읽은 알림 {unread}개</span>}
          <button
            type="button"
            onClick={readAll}
            disabled={!unread}
            className="ml-auto text-sm font-bold text-leaf-dark hover:underline disabled:text-ink-soft disabled:no-underline"
          >
            모두 읽음
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows === null ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">불러오는 중...</p>
          ) : rows.length ? (
            <ul className="divide-y divide-line/70">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openRow(r)}
                    data-read={r.read ? "true" : "false"}
                    className={`flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm hover:bg-cream ${r.read ? "" : "bg-honey"}`}
                  >
                    <span className="min-w-0 flex-1 break-words">{r.text}</span>
                    <span className="shrink-0 text-xs text-ink-soft">{timeAgo(new Date(r.createdAt), now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">아직 알림이 없어요</p>
          )}
        </div>
        <Link
          href="/notifications"
          onClick={close}
          className="border-t-2 border-line px-4 py-2 text-center text-sm font-bold text-ink-soft hover:bg-cream hover:text-ink"
        >
          알림 모두 보기{total > (rows?.length ?? 0) ? ` (${total})` : ""} →
        </Link>
        {pending && <span className="sr-only">처리 중</span>}
      </PopoverPanel>

      {popup && <LevelUpModal popup={popup} onClose={() => setPopup(null)} />}
    </>
  );
}

/** 레벨업 팝업 (GAME-06): 화면 가운데, 뒤는 어둡게. 가장 높은 레벨 하나만 */
function LevelUpModal({ popup, onClose }: { popup: LevelUpPopup; onClose: () => void }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);
  // 헤더(backdrop-filter)는 fixed 요소를 가두므로 body에 붙인다. 서버 렌더 때는 그리지 않는다
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 포털을 만든다
  useEffect(() => setMounted(true), []);
  useEffect(() => okRef.current?.focus(), [mounted]);

  const close = (goShop: boolean) => {
    onClose();
    void seeLevelUps();
    if (goShop) router.push("/shop");
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" data-levelup-modal>
      <div role="dialog" aria-modal="true" aria-labelledby="levelup-title" className="card w-full max-w-sm p-6 text-center">
        <p className="text-5xl" aria-hidden>🎉</p>
        <h2 id="levelup-title" className="mt-2 font-display text-3xl">
          {popup.level >= 99 ? "최고 레벨 Lv.99가 되었어요!" : `Lv.${popup.level}이 되었어요!`}
        </h2>
        {popup.houseStage && (
          <p className="mt-3 rounded-xl bg-moss px-3 py-2 font-bold text-leaf-dark" data-house-grown>
            🏠 집이 커졌어요! ({popup.houseStage}단계)
          </p>
        )}
        {popup.items.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-bold text-ink-soft">이제 이런 아이템을 쓸 수 있어요</p>
            <ul className="mt-2 flex justify-center gap-2" data-unlocked-items>
              {popup.items.map((it) => (
                <li key={it.id} className="w-20">
                  <ItemArt type={it.type} assetKey={it.assetKey} className="h-16" characterSize={60} />
                  <span className="mt-1 block truncate text-xs font-bold">{it.name}</span>
                </li>
              ))}
            </ul>
            {popup.moreItems > 0 && <p className="mt-1 text-xs text-ink-soft">외 {popup.moreItems}개</p>}
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={() => close(true)} className="btn bg-sun text-ink">
            상점 가기
          </button>
          <button ref={okRef} type="button" onClick={() => close(false)} className="btn bg-ink text-cream">
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 알림함 화면의 한 줄: 누르면 읽음으로 바꾸고 관련 화면으로 */
export function NotificationLink({
  id,
  href,
  read,
  className,
  children,
}: {
  id: number;
  href: string;
  read: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <a
      href={href}
      data-read={read ? "true" : "false"}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        startTransition(async () => {
          if (!read) await readNotification(id);
          router.push(href);
        });
      }}
    >
      {children}
    </a>
  );
}

export function MarkAllReadButton({ className = "" }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => readAllNotifications())}
      className={`btn bg-paper py-1.5 text-sm ${className}`}
    >
      모두 읽음
    </button>
  );
}
