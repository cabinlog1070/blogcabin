"use client";

import { useState } from "react";
import { CharacterArt } from "@/components/character";
import { Icon } from "@/components/icon";
import { IconEmoji } from "@/components/icon-emoji";
import { canWear, composeLook, MANNEQUIN, SLOT_LABEL, SLOT_ORDER, type AvatarSlot } from "@/lib/assets";
import { SORTS, sortItems, type ItemType, type SortKey } from "@/lib/shop";
import { ShopGrid, type ShopItem } from "./shop-grid";

/** 상점 본문: 정렬 고르기 + 세 구역 (SHOP-01). 정렬은 기억하지 않는다 (열 때마다 레벨순) */
export function ShopView({
  items,
  level,
  coins,
  character,
  wornAssets,
}: {
  items: ShopItem[];
  level: number;
  coins: number;
  character: string;
  wornAssets: string[];
}) {
  const [sort, setSort] = useState<SortKey>("level");
  const of = (type: ItemType) => sortItems(items.filter((i) => i.type === type), sort);

  return (
    <>
      <div className="mt-6 flex justify-end">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-bold">정렬</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border-2 border-line bg-paper px-2 py-1">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 구역 제목: 화면에는 그린 아이콘, 글자로는 예전 이모지 그대로 (e2e가 "👕 아바타 꾸미기"로 찾는다) */}
      <section aria-labelledby="shop-avatar">
        <h2 id="shop-avatar" className="mb-3 mt-4 font-display text-2xl">
          <IconEmoji name="clothes" emoji="👕" size={30} className="-mt-1" /> 아바타 꾸미기
        </h2>
        <AvatarSection items={of("avatar")} level={level} coins={coins} character={character} wornAssets={wornAssets} />
      </section>
      <section aria-labelledby="shop-furniture">
        <h2 id="shop-furniture" className="mb-3 mt-10 font-display text-2xl">
          <IconEmoji name="furniture" emoji="🪑" size={30} className="-mt-1" /> 가구
        </h2>
        <ShopGrid items={of("furniture")} level={level} coins={coins} />
      </section>
      <section aria-labelledby="shop-background">
        <h2 id="shop-background" className="mb-3 mt-10 font-display text-2xl">
          <IconEmoji name="background" emoji="🖼" size={30} className="-mt-1" /> 배경
        </h2>
        <ShopGrid items={of("background")} level={level} coins={coins} />
      </section>
    </>
  );
}

/** 👕 아바타 꾸미기 구역: 카드를 누르면 사지 않고 내 캐릭터에 입혀 본다 */
function AvatarSection({
  items,
  level,
  coins,
  character,
  wornAssets,
}: {
  items: ShopItem[];
  level: number;
  coins: number;
  character: string;
  wornAssets: string[];
}) {
  // 남자·여자 주민이 아니면(예전에 산 캐릭터) 마네킹에 입혀 본다
  const wearer = canWear(character) ? character : MANNEQUIN;
  const [tried, setTried] = useState<Partial<Record<AvatarSlot, ShopItem>>>({});

  const slotOf = (assetKey: string) => items.find((i) => i.assetKey === assetKey)?.slot;
  // 지금 입은 것에서 입어 본 부위만 바꾼다
  const looks = SLOT_ORDER.map((slot) => tried[slot]?.assetKey ?? wornAssets.find((a) => slotOf(a) === slot)).filter(
    (a): a is string => Boolean(a),
  );
  const triedList = SLOT_ORDER.map((s) => tried[s]).filter((i): i is ShopItem => Boolean(i));

  function tryOn(item: ShopItem) {
    if (!item.slot) return;
    const slot = item.slot;
    setTried((t) => ({ ...t, [slot]: t[slot]?.id === item.id ? undefined : item }));
  }

  return (
    <>
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-4" aria-live="polite" data-try-on>
        <div className="grid h-36 w-36 shrink-0 place-items-center rounded-xl bg-cream">
          <CharacterArt asset={composeLook(wearer, looks)} size={128} />
        </div>
        <div className="min-w-[10rem] flex-1">
          <h3 className="font-display text-lg">미리 입어 보기</h3>
          {triedList.length ? (
            <p className="text-sm">
              입어 보는 중: <b>{triedList.map((i) => `${SLOT_LABEL[i.slot!]} ${i.name}`).join(", ")}</b>
            </p>
          ) : (
            <p className="text-sm text-ink-soft">아이템 그림을 누르면 사기 전에 내 캐릭터에 입혀 볼 수 있어요.</p>
          )}
          <p className="mt-1 text-xs text-ink-soft">
            <Icon name="lock" size={14} /> 잠긴 옷은 그 레벨이 되어야 사고 입을 수 있어요.
          </p>
        </div>
        <button type="button" onClick={() => setTried({})} disabled={!triedList.length} className="btn bg-paper text-sm text-ink">
          원래대로
        </button>
      </div>
      <ShopGrid items={items} level={level} coins={coins} onTry={tryOn} triedIds={triedList.map((i) => i.id)} />
    </>
  );
}
