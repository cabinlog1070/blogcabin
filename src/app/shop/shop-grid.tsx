"use client";

import { useState, useTransition } from "react";
import { ItemArt } from "@/components/item-art";
import { SLOT_LABEL, type AvatarSlot } from "@/lib/assets";
import type { ItemType } from "@/lib/shop";
import { buyItem } from "./actions";

export type ShopItem = {
  id: number;
  type: ItemType;
  slot: AvatarSlot | null;
  name: string;
  description: string | null;
  price: number;
  requiredLevel: number;
  assetKey: string;
  owned: boolean;
  ownerCount: number;
};

/** 한 구역의 아이템 카드들. 구매 결과 문구는 이 구역 위에 나온다 (SHOP-01)
 *  onTry가 있으면(👕 아바타 꾸미기) 그림을 눌러 입어 볼 수 있다 */
export function ShopGrid({
  items,
  level,
  coins,
  onTry,
  triedIds = [],
}: {
  items: ShopItem[];
  level: number;
  coins: number;
  onTry?: (item: ShopItem) => void;
  triedIds?: number[];
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <>
      {message && (
        <p role="status" className={`card mb-4 p-3 text-center font-bold ${message.ok ? "text-leaf-dark" : "text-berry"}`}>
          {message.text}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const locked = level < item.requiredLevel;
          const short = coins < item.price;
          const tried = triedIds.includes(item.id);
          const art = (
            <div className="relative">
              <ItemArt type={item.type} assetKey={item.assetKey} className={`h-28 ${locked ? "opacity-60 grayscale" : ""}`} />
              {locked && (
                // 잠금을 크게 보여준다: 레벨이 오르면 풀린다 (SHOP-02)
                <span className="absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-cream shadow">
                  🔒 Lv.{item.requiredLevel}부터
                </span>
              )}
              {item.slot && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                  {SLOT_LABEL[item.slot]}
                </span>
              )}
            </div>
          );
          return (
            <article
              key={item.id}
              className={`card flex flex-col p-3 ${item.owned ? "opacity-70" : ""} ${tried ? "border-sky! ring-2 ring-sky/40" : ""}`}
            >
              {onTry ? (
                <button
                  type="button"
                  onClick={() => onTry(item)}
                  aria-pressed={tried}
                  aria-label={`${item.name} 입어 보기`}
                  className="rounded-xl text-left transition hover:-translate-y-0.5"
                >
                  {art}
                </button>
              ) : (
                art
              )}
              <h3 className="mt-2 font-display text-lg">{item.name}</h3>
              <p className="line-clamp-2 min-h-10 text-xs text-ink-soft">{item.description}</p>
              <p className="mt-2 text-sm">
                🪙 <b>{item.price.toLocaleString()}</b>
                {item.requiredLevel > 1 && <span className="ml-2 text-xs text-ink-soft">Lv.{item.requiredLevel}+</span>}
              </p>
              <button
                type="button"
                disabled={item.owned || locked || short || pending}
                onClick={() =>
                  start(async () => {
                    const r = await buyItem(item.id);
                    setMessage(r.ok ? { ok: true, text: `🎉 ${r.name}을(를) 샀어요! 꾸미기에서 장착해 보세요.` } : { ok: false, text: r.error });
                  })
                }
                className="btn mt-3 bg-sun py-1.5 text-sm text-ink"
              >
                {item.owned ? "보유 중" : locked ? `🔒 Lv.${item.requiredLevel}` : short ? "코인 부족" : "사기"}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
