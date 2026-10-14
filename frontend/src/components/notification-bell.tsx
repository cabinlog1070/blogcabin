"use client";

// 헤더 레벨 배지 옆 쪽지 알림함 (GAME-08)과 레벨업 팝업 (GAME-06)
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PopoverPanel, useHeaderPopover } from "@/components/header-popover";
import { useLocale, useT } from "@/components/i18n";
import { Icon } from "@/components/icon";
import { ItemArt } from "@/components/item-art";
import { GiftPetEgg } from "@/components/pet-art";
import type { GiftView } from "@backend/gifts/views";
import type { LevelUpPopup } from "@backend/notifications";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/game";
import { presentNotification, type NotificationRowJson, type NotificationView } from "@/lib/notification-text";

type PanelRow = NotificationView;
type GiftJson = Omit<GiftView, "createdAt"> & { createdAt: string };

// 알림 API (서버 backend/src/routes/notifications.ts). 날짜는 JSON에서 문자열로 온다
const fromJson = (g: GiftJson): GiftView => ({ ...g, createdAt: new Date(g.createdAt) });
const refreshNotificationState = () =>
  api<{ unread: number; popup: LevelUpPopup | null; gifts: GiftJson[] }>("/notifications/state").then((s) => ({ ...s, gifts: s.gifts.map(fromJson) }));
const loadNotificationPanel = () => api<{ unread: number; rows: NotificationRowJson[]; total: number }>("/notifications/panel");
const readNotification = (id: number) => api(`/notifications/${id}/read`, { method: "POST" }).catch(() => {});
const readAllNotifications = () => api("/notifications/read-all", { method: "POST" }).catch(() => {});
const seeLevelUps = () => api("/notifications/level-ups/seen", { method: "POST" }).catch(() => {});
const seeGift = (notificationId: number) => api(`/notifications/${notificationId}/gift-seen`, { method: "POST" }).catch(() => {});

export function NotificationBell({
  unread: initialUnread,
  popup: initialPopup,
  gifts: initialGifts,
}: {
  unread: number;
  popup: LevelUpPopup | null;
  gifts: GiftView[];
}) {
  const t = useT();
  const locale = useLocale();
  const [unread, setUnread] = useState(initialUnread);
  const [popup, setPopup] = useState(initialPopup);
  // 아직 안 본 관리자 선물: 하나씩 팝업으로 (레벨업 팝업을 먼저 닫은 뒤)
  const [gifts, setGifts] = useState(initialGifts);
  // 쪽지 바로 아래, 화면 양옆 12px 안에 들어오게 (휴대폰에서 왼쪽으로 잘리던 문제)
  const { open, box, setAnchor, setPanel, toggle: togglePanel, close } = useHeaderPopover(352); // 22rem
  const [rows, setRows] = useState<PanelRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  // 서버가 헤더를 다시 그리면(revalidatePath) 그 값으로 맞춘다 (렌더 중에 이전 값과 비교)
  const [prevProps, setPrevProps] = useState({ initialUnread, initialPopup, initialGifts });
  if (prevProps.initialUnread !== initialUnread || prevProps.initialPopup !== initialPopup || prevProps.initialGifts !== initialGifts) {
    setPrevProps({ initialUnread, initialPopup, initialGifts });
    setUnread(initialUnread);
    setPopup(initialPopup);
    setGifts(initialGifts);
  }
  // 화면을 옮길 때마다 개수·레벨업 팝업을 새로 읽는다 (남이 공감해서 오른 레벨도 다음 화면에서 뜨게)
  useEffect(() => {
    if (firstPath.current === pathname) return;
    firstPath.current = pathname;
    refreshNotificationState()
      .then((s) => {
        setUnread(s.unread);
        setPopup(s.popup);
        setGifts(s.gifts);
      })
      .catch(() => {});
  }, [pathname]);

  // 바깥을 누르거나 Esc를 누르거나 화면을 옮기면 닫힌다 (useHeaderPopover)
  const toggle = () => {
    if (togglePanel()) {
      startTransition(async () => {
        const data = await loadNotificationPanel().catch(() => null);
        if (!data) return setRows([]);
        setRows(data.rows.map((r) => presentNotification(t, locale, r)));
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
    startTransition(async () => {
      await readAllNotifications();
      router.refresh(); // 알림 화면을 보고 있었으면 그 목록도 읽음으로
    });
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
        aria-label={unread ? t("알림함, 안 읽은 알림 {n}개", { n: unread }) : t("알림함")}
        title={t("알림함")}
        data-notification-button
        className="relative flex items-center rounded-full border border-line bg-paper px-1.5 py-1 shadow-sm hover:text-leaf-dark sm:px-2.5"
      >
        {/* 쪽지 모양 그림 (하트 편지 봉투) */}
        <Icon name="mail" size={24} className="size-5 sm:size-6" />
        {unread > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-berry px-1 text-center text-[10px] font-bold leading-[18px] text-white"
            data-unread-count
          >
            {badge}
          </span>
        )}
      </button>

      <PopoverPanel open={open} box={box} panelRef={setPanel} label={t("알림함")} className="flex max-h-[70dvh] flex-col overflow-hidden" data-notification-panel>
        <div className="flex items-center gap-2 border-b-2 border-line px-4 py-2.5">
          <h2 className="flex items-center gap-1.5 font-display text-lg">
            <Icon name="mail" size={22} /> {t("알림함")}
          </h2>
          {unread > 0 && <span className="text-xs text-ink-soft">{t("안 읽은 알림 {n}개", { n: unread })}</span>}
          <button
            type="button"
            onClick={readAll}
            disabled={!unread}
            className="ml-auto text-sm font-bold text-leaf-dark hover:underline disabled:text-ink-soft disabled:no-underline"
          >
            {t("모두 읽음")}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows === null ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">{t("불러오는 중...")}</p>
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
                    <span className="shrink-0 text-xs text-ink-soft">{timeAgo(r.createdAt, now, locale, t)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">{t("아직 알림이 없어요")}</p>
          )}
        </div>
        <Link
          href="/notifications"
          onClick={close}
          className="border-t-2 border-line px-4 py-2 text-center text-sm font-bold text-ink-soft hover:bg-cream hover:text-ink"
        >
          {t("알림 모두 보기")}
          {total > (rows?.length ?? 0) ? ` (${total})` : ""} →
        </Link>
        {pending && <span className="sr-only">{t("처리 중")}</span>}
      </PopoverPanel>

      {popup ? (
        <LevelUpModal popup={popup} onClose={() => setPopup(null)} />
      ) : (
        gifts[0] && (
          <GiftModal
            key={gifts[0].id}
            gift={gifts[0]}
            onClose={() => {
              setGifts((list) => list.slice(1));
              setUnread((n) => Math.max(0, n - 1));
            }}
          />
        )
      )}
    </>
  );
}

/** 레벨업 팝업 (GAME-06): 화면 가운데, 뒤는 어둡게. 가장 높은 레벨 하나만 */
function LevelUpModal({ popup, onClose }: { popup: LevelUpPopup; onClose: () => void }) {
  const t = useT();
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
        <Icon name="level" size={64} className="mx-auto block" />
        <h2 id="levelup-title" className="mt-2 font-display text-3xl">
          {popup.level >= 99 ? t("최고 레벨 Lv.99가 되었어요!") : t("Lv.{level}이 되었어요!", { level: popup.level })}
        </h2>
        {popup.houseStage && (
          <p className="mt-3 rounded-xl bg-moss px-3 py-2 font-bold text-leaf-dark" data-house-grown>
            <Icon name="home" size={22} /> {t("집이 커졌어요! ({stage}단계)", { stage: popup.houseStage })}
          </p>
        )}
        {popup.items.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-bold text-ink-soft">{t("이제 이런 아이템을 쓸 수 있어요")}</p>
            <ul className="mt-2 flex justify-center gap-2" data-unlocked-items>
              {popup.items.map((it) => (
                <li key={it.id} className="w-20">
                  <ItemArt type={it.type} assetKey={it.assetKey} className="h-16" characterSize={60} />
                  <span className="mt-1 block truncate text-xs font-bold">{t(it.name)}</span>
                </li>
              ))}
            </ul>
            {popup.moreItems > 0 && <p className="mt-1 text-xs text-ink-soft">{t("외 {n}개", { n: popup.moreItems })}</p>}
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={() => close(true)} className="btn bg-sun text-ink">
            {t("상점 가기")}
          </button>
          <button ref={okRef} type="button" onClick={() => close(false)} className="btn bg-ink text-cream">
            {t("확인")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 관리자 선물 팝업: 보낸 사람, 함께 보낸 말, 받은 코인·아이템. 닫으면 그 선물 알림을 읽음으로 */
function GiftModal({ gift, onClose }: { gift: GiftView; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 포털을 만든다
  useEffect(() => setMounted(true), []);
  useEffect(() => okRef.current?.focus(), [mounted]);

  /** 닫고 읽음으로 바꾼다. href가 있으면 그 화면으로 (받은 선물·동물 농장) */
  const close = (href?: string) => {
    onClose();
    if (gift.notificationId) void seeGift(gift.notificationId);
    if (href) router.push(href);
  };

  if (!mounted) return null;
  const shown = gift.items.slice(0, 4);
  const shownPets = gift.pets.slice(0, Math.max(0, 4 - shown.length));
  const more = gift.items.length + gift.pets.length - shown.length - shownPets.length;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" data-gift-modal>
      <div role="dialog" aria-modal="true" aria-labelledby="gift-title" className="card w-full max-w-sm p-6 text-center">
        <Icon name="gift" size={64} className="mx-auto block" />
        <h2 id="gift-title" className="mt-2 font-display text-2xl">
          {t("{who}님이 선물을 보냈어요!", { who: gift.senderName ?? t("관리자") })}
        </h2>
        <p className="mt-3 whitespace-pre-line break-words rounded-xl bg-honey px-4 py-3 text-left" data-gift-message>
          {gift.message}
        </p>
        {gift.coins > 0 && (
          <p className="mt-3 font-bold" data-gift-coins>
            <Icon name="coin" size={22} /> {t("{n}코인", { n: gift.coins.toLocaleString() })}
          </p>
        )}
        {shown.length + shownPets.length > 0 && (
          <ul className="mt-3 flex flex-wrap justify-center gap-2" data-gift-items>
            {shown.map((it) => (
              <li key={it.id} className="w-20">
                <ItemArt type={it.type} assetKey={it.assetKey} className="h-16" characterSize={60} />
                <span className="mt-1 block truncate text-xs font-bold">{t(it.name)}</span>
              </li>
            ))}
            {shownPets.map((p) => (
              <li key={`pet-${p.id}`} className="w-20" data-gift-pet>
                <button
                  type="button"
                  onClick={() => close("/farm")}
                  className="block w-full rounded-xl pb-1 hover:bg-cream focus-visible:bg-cream"
                  aria-label={t("{name} 알 · 동물 농장으로 가기", { name: t(p.name) })}
                >
                  <GiftPetEgg assetKey={p.assetKey} />
                  <span className="mt-1 block truncate text-xs font-bold">{t("{name} 알", { name: t(p.name) })}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {more > 0 && <p className="mt-1 text-xs text-ink-soft">{t("외 {n}개", { n: more })}</p>}
        {gift.pets.length > 0 && <p className="mt-2 text-xs text-ink-soft">{t("펫 알은 동물 농장 둥지에서 부화시켜요.")}</p>}
        {/* 펫 알이 있으면 버튼이 셋이라 한 줄에 들어가게 조금 줄인다 */}
        <div className={`mt-6 flex justify-center gap-2 ${gift.pets.length > 0 ? "[&>.btn]:px-3 [&>.btn]:text-sm" : ""}`}>
          {gift.pets.length > 0 && (
            <button type="button" onClick={() => close("/farm")} className="btn bg-leaf text-white" data-gift-go-farm>
              {t("농장으로 가기")}
            </button>
          )}
          <button type="button" onClick={() => close("/gifts")} className="btn bg-sun text-ink">
            {t("받은 선물 보기")}
          </button>
          <button ref={okRef} type="button" onClick={() => close()} className="btn bg-ink text-cream">
            {t("확인")}
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
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await readAllNotifications();
          router.refresh(); // 알림 목록과 헤더의 안 읽은 개수를 새로 그린다
        })
      }
      className={`btn bg-paper py-1.5 text-sm ${className}`}
    >
      {t("모두 읽음")}
    </button>
  );
}
