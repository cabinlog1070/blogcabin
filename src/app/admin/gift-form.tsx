"use client";

import { useActionState, useEffect, useState } from "react";
import { useT } from "@/components/i18n";
import { Icon } from "@/components/icon";
import { ItemArt } from "@/components/item-art";
import { adminSendGift, type GiftState } from "./actions";

type Member = { userId: string; label: string; search: string };
type GiftItem = { id: number; type: string; name: string; assetKey: string };

const TYPE_TABS = [
  { key: "all", label: "전체" },
  { key: "avatar", label: "옷" },
  { key: "furniture", label: "가구" },
  { key: "background", label: "배경" },
] as const;

/**
 * 관리자 선물 보내기: 받을 주민(여러 명 또는 모든 주민), 코인·아이템, 함께 보낼 말.
 * 보내고 나면 고른 것과 적은 말을 비운다 (다음 선물은 새로 고른다)
 */
export function AdminGiftForm({ members, items, messageMax }: { members: Member[]; items: GiftItem[]; messageMax: number }) {
  const [state, action, pending] = useActionState<GiftState, FormData>(adminSendGift, {});
  const t = useT();
  const [query, setQuery] = useState("");
  const [everyone, setEveryone] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<(typeof TYPE_TABS)[number]["key"]>("all");
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [coins, setCoins] = useState("");

  // 보내기에 성공하면 비운다
  useEffect(() => {
    if (!state.sentAt) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 서버 응답을 받은 뒤 한 번 비운다 */
    setPicked(new Set());
    setChosen(new Set());
    setMessage("");
    setCoins("");
    setEveryone(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state.sentAt]);

  const q = query.trim().toLowerCase();
  const shownMembers = q ? members.filter((m) => m.search.includes(q)) : members;
  const shownItems = tab === "all" ? items : items.filter((it) => it.type === tab);
  const toggle = <V,>(set: Set<V>, v: V) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };
  const input = "w-full rounded-xl border border-line bg-paper px-3 py-2 outline-none focus:border-sun";
  const length = [...message].length;

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2" data-admin-gift>
      {/* 받을 주민 */}
      <fieldset className="min-w-0">
        <legend className="mb-1 text-sm font-bold">
          {t("받을 주민")} <span className="font-normal text-ink-soft">{everyone ? t("모든 주민") : t("{n}명 고름", { n: picked.size })}</span>
        </legend>
        <label className="mb-2 flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="everyone" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} data-gift-everyone />
          {t("모든 주민에게 보내기 (나는 빼고)")}
        </label>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("닉네임이나 아이디로 찾기")}
          disabled={everyone}
          className={input}
          data-gift-member-search
        />
        <ul className={`mt-2 max-h-56 overflow-y-auto rounded-xl border border-line bg-paper ${everyone ? "opacity-50" : ""}`}>
          {shownMembers.map((m) => (
            <li key={m.userId}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-cream">
                <input
                  type="checkbox"
                  name="userId"
                  value={m.userId}
                  checked={picked.has(m.userId)}
                  disabled={everyone}
                  onChange={() => setPicked((s) => toggle(s, m.userId))}
                />
                <span className="min-w-0 truncate">{m.label}</span>
              </label>
            </li>
          ))}
          {!shownMembers.length && <li className="px-3 py-4 text-center text-sm text-ink-soft">{t("찾는 주민이 없어요")}</li>}
        </ul>
      </fieldset>

      {/* 함께 보낼 말 */}
      <div className="min-w-0">
        <label className="block">
          <span className="mb-1 flex text-sm font-bold">
            {t("함께 보낼 말")}
            <span className={`ml-auto font-normal ${length > messageMax ? "text-berry" : "text-ink-soft"}`}>
              {length}/{messageMax}
            </span>
          </span>
          <textarea
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            placeholder={t("예) 이벤트에 참여해 주셔서 고마워요! 작은 선물을 보내요 🎁")}
            className={`${input} resize-y`}
            data-gift-message-input
          />
        </label>
        <p className="mt-1 text-xs text-ink-soft">{t("받은 주민에게 알림과 선물 팝업으로 이 말이 보여요. 번역하지 않고 적은 그대로 보여요.")}</p>
        <label className="mt-4 block max-w-xs">
          <span className="mb-1 block text-sm font-bold">
            <Icon name="coin" size={18} /> {t("코인 (안 보내면 비워 두기)")}
          </span>
          <input name="coins" type="number" min={0} max={999_999} step={1} placeholder="0" value={coins} onChange={(e) => setCoins(e.target.value)} className={input} data-gift-coins-input />
        </label>
      </div>

      {/* 아이템 */}
      <fieldset className="min-w-0 lg:col-span-2">
        <legend className="mb-1 text-sm font-bold">
          {t("아이템")} <span className="font-normal text-ink-soft">{t("{n}개 고름", { n: chosen.size })}</span>
        </legend>
        <p className="mb-2 text-xs text-ink-soft">{t("받는 주민이 이미 가진 아이템은 빼고 보내요. 레벨이 모자라도 받을 수 있어요.")}</p>
        <div className="mb-2 flex flex-wrap gap-1.5" role="tablist">
          {TYPE_TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => setTab(tb.key)}
              className={`rounded-full border px-3 py-1 text-sm font-bold ${tab === tb.key ? "border-ink bg-ink text-cream" : "border-line bg-paper"}`}
            >
              {t(tb.label)}
            </button>
          ))}
        </div>
        <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-line bg-paper p-2 sm:grid-cols-5 lg:grid-cols-8">
          {shownItems.map((it) => {
            const on = chosen.has(it.id);
            return (
              <li key={it.id}>
                <label
                  className={`block cursor-pointer rounded-xl border-2 p-1 text-center ${on ? "border-sun bg-honey" : "border-transparent hover:bg-cream"}`}
                  data-gift-item={it.id}
                >
                  <input type="checkbox" name="itemId" value={it.id} checked={on} onChange={() => setChosen((s) => toggle(s, it.id))} className="sr-only" />
                  <ItemArt type={it.type} assetKey={it.assetKey} className="h-16" characterSize={56} />
                  <span className="mt-1 block truncate text-xs font-bold">
                    {on && "✓ "}
                    {t(it.name)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <button disabled={pending || length > messageMax} className="btn btn-accent" data-gift-send>
          {pending ? (
            t("보내는 중...")
          ) : (
            <>
              <Icon name="gift" size={18} /> {t("선물 보내기")}
            </>
          )}
        </button>
        {(state.error || state.ok) && (
          <p className={`text-sm ${state.error ? "text-berry" : "text-leaf-dark"}`} data-gift-result>
            {state.error ?? state.ok}
          </p>
        )}
        {state.skipped && <p className="w-full text-sm text-ink-soft">{state.skipped}</p>}
      </div>
    </form>
  );
}
