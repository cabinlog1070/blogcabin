"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CharacterArt } from "@/components/character";
import { useT } from "@/components/i18n";
import { Icon } from "@/components/icon";
import { IconEmoji } from "@/components/icon-emoji";
import { HAIR_COLORS, HAIR_COLOR_KEYS, HAIR_DEFAULT_SWATCH, paintedHairKey, type HairColor } from "@/lib/art/avatar";
import { canWear, composeLook, MANNEQUIN, SLOT_LABEL, SLOT_ORDER, type AvatarSlot } from "@/lib/assets";
import { msg } from "@/lib/i18n";
import { SORTS, sortItems, type ItemType, type SortKey } from "@/lib/shop";
import { saveTriedLook, setHairColor } from "./actions";
import { ShopGrid, type ShopItem } from "./shop-grid";

/** 옷 카테고리 탭 (2026-10-13): 전체 + 헤어·모자·상의·하의·신발. 한 벌로 된 옷(기모노)은 상의에 있다.
 *  헤어 탭 아래에는 머리 색 동그라미가 있다 */
type Category = "all" | AvatarSlot;
const CATEGORIES: Category[] = ["all", "hair", "hat", "top", "bottom", "shoes"];
const CATEGORY_LABEL: Record<Category, string> = { all: msg("전체"), ...SLOT_LABEL };

/** 상점 본문: 정렬 고르기 + 세 구역 (SHOP-01). 정렬은 기억하지 않는다 (열 때마다 레벨순) */
export function ShopView({
  items,
  level,
  coins,
  character,
  wornAssets,
  hairColor,
}: {
  items: ShopItem[];
  level: number;
  coins: number;
  character: string;
  wornAssets: string[];
  hairColor: string | null;
}) {
  const t = useT();
  const [sort, setSort] = useState<SortKey>("level");
  const of = (type: ItemType) => sortItems(items.filter((i) => i.type === type), sort);

  return (
    <>
      <div className="mt-6 flex justify-end">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-bold">{t("정렬")}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border-2 border-line bg-paper px-2 py-1">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 구역 제목: 화면에는 그린 아이콘, 글자로는 예전 이모지 그대로 (e2e가 "👕 아바타 꾸미기"로 찾는다) */}
      <section aria-labelledby="shop-avatar">
        <h2 id="shop-avatar" className="mb-3 mt-4 font-display text-2xl">
          <IconEmoji name="clothes" emoji="👕" size={30} className="-mt-1" /> {t("아바타 꾸미기")}
        </h2>
        <AvatarSection items={of("avatar")} level={level} coins={coins} character={character} wornAssets={wornAssets} hairColor={hairColor} />
      </section>
      <section aria-labelledby="shop-furniture">
        <h2 id="shop-furniture" className="mb-3 mt-10 font-display text-2xl">
          <IconEmoji name="furniture" emoji="🪑" size={30} className="-mt-1" /> {t("가구")}
        </h2>
        <ShopGrid items={of("furniture")} level={level} coins={coins} />
      </section>
      <section aria-labelledby="shop-background">
        <h2 id="shop-background" className="mb-3 mt-10 font-display text-2xl">
          <IconEmoji name="background" emoji="🖼" size={30} className="-mt-1" /> {t("배경")}
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
  hairColor: savedHairColor,
}: {
  items: ShopItem[];
  level: number;
  coins: number;
  character: string;
  wornAssets: string[];
  hairColor: string | null;
}) {
  // 남자·여자 주민이 아니면(예전에 산 캐릭터) 마네킹에 입혀 본다
  const t = useT();
  const router = useRouter();
  const wearer = canWear(character) ? character : MANNEQUIN;
  const [tried, setTried] = useState<Partial<Record<AvatarSlot, ShopItem>>>({});
  const [category, setCategory] = useState<Category>("all");
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hairColor, setHairColorState] = useState<string | null>(savedHairColor);
  const [hairSaved, setHairSaved] = useState(false);

  const slotOf = (assetKey: string) => items.find((i) => i.assetKey === assetKey)?.slot;
  // 지금 입은 것에서 입어 본 부위만 바꾼다
  const looks = SLOT_ORDER.map((slot) => tried[slot]?.assetKey ?? wornAssets.find((a) => slotOf(a) === slot))
    .filter((a): a is string => Boolean(a))
    .map((a) => paintedHairKey(a, hairColor));
  const triedList = SLOT_ORDER.map((s) => tried[s]).filter((i): i is ShopItem => Boolean(i));
  const inCategory = (c: Category) => (c === "all" ? items : items.filter((i) => (i.slot as string | null) === c));
  const shown = inCategory(category);

  // 저장하기: 없는 옷은 한꺼번에 사고, 입어 본 그대로 입은 채 광장으로 나간다
  const cost = triedList.filter((i) => !i.owned).reduce((sum, i) => sum + i.price, 0);
  const lockedTried = triedList.find((i) => level < i.requiredLevel);
  const short = cost > coins;
  const blocker = lockedTried
    ? t("{name}은(는) 레벨 {level}부터 입을 수 있어요", { name: t(lockedTried.name), level: lockedTried.requiredLevel })
    : short
      ? t("코인이 {n}개 부족해요", { n: cost - coins })
      : null;

  function tryOn(item: ShopItem) {
    if (!item.slot) return;
    const slot = item.slot;
    setError(null);
    setTried((prev) => ({ ...prev, [slot]: prev[slot]?.id === item.id ? undefined : item }));
  }

  // 머리 색: 누르면 바로 저장한다 (무료). 입어 보는 헤어에도 같은 색으로 보인다
  function pickHairColor(color: HairColor | null) {
    const before = hairColor;
    setHairColorState(color);
    setHairSaved(false);
    startSave(async () => {
      const r = await setHairColor(color);
      if (!r.ok) return (setHairColorState(before), setError(r.error ?? null));
      setHairSaved(true);
    });
  }

  function save() {
    startSave(async () => {
      const r = await saveTriedLook(triedList.map((i) => i.id));
      if (!r.ok) return setError(r.error);
      router.push("/town");
    });
  }

  return (
    <>
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-4" aria-live="polite" data-try-on>
        <div className="grid h-36 w-36 shrink-0 place-items-center rounded-xl bg-cream">
          <CharacterArt asset={composeLook(wearer, looks)} size={128} />
        </div>
        <div className="min-w-[10rem] flex-1">
          <h3 className="font-display text-lg">{t("미리 입어 보기")}</h3>
          {triedList.length ? (
            <p className="text-sm">
              {t("입어 보는 중:")} <b>{triedList.map((i) => `${t(SLOT_LABEL[i.slot!])} ${t(i.name)}`).join(", ")}</b>
            </p>
          ) : (
            <p className="text-sm text-ink-soft">{t("아이템 그림을 누르면 사기 전에 내 캐릭터에 입혀 볼 수 있어요.")}</p>
          )}
          {error || blocker ? (
            <p role="alert" className="mt-1 text-xs font-bold text-berry">
              {error ?? blocker}
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">
              <Icon name="lock" size={14} /> {t("잠긴 옷은 그 레벨이 되어야 사고 입을 수 있어요.")}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <button
            type="button"
            onClick={save}
            disabled={!triedList.length || Boolean(blocker) || saving}
            className="btn bg-leaf text-sm text-white"
            data-save-look
          >
            {cost ? (
              <span>
                {t("사서 입고 저장하기")} (<Icon name="coin" size={16} /> {cost.toLocaleString()})
              </span>
            ) : (
              t("저장하기")
            )}
          </button>
          <button type="button" onClick={() => (setTried({}), setError(null))} disabled={!triedList.length || saving} className="btn bg-paper text-sm text-ink">
            {t("원래대로")}
          </button>
        </div>
      </div>
      <div role="tablist" aria-label={t("옷 종류")} className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:gap-1.5 sm:px-0">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            data-shop-category={c}
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-sm font-bold sm:px-3.5 ${category === c ? "bg-honey text-ink" : "bg-cream text-ink-soft hover:bg-honey/60"}`}
          >
            {t(CATEGORY_LABEL[c])} <span className="font-normal">{inCategory(c).length}</span>
          </button>
        ))}
      </div>
      {category === "hair" && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 sm:gap-2" data-hair-colors>
          <span className="mr-1 text-sm font-bold">{t("머리 색")}</span>
          {[null, ...HAIR_COLOR_KEYS].map((c) => {
            const on = hairColor === c;
            return (
              <button
                key={c ?? "default"}
                type="button"
                onClick={() => pickHairColor(c)}
                aria-pressed={on}
                aria-label={c ? t(HAIR_COLORS[c].label) : t("기본 색")}
                title={c ? t(HAIR_COLORS[c].label) : t("기본 색")}
                className={`grid h-6 w-6 place-items-center rounded-full border-2 sm:h-8 sm:w-8 ${on ? "border-ink ring-2 ring-honey" : "border-line"}`}
                // 색 동그라미는 고를 색 그 자체를 보여 준다 (그림 색이라 테마 토큰이 아니다)
                style={{ background: c ? HAIR_COLORS[c].hex : HAIR_DEFAULT_SWATCH }}
              />
            );
          })}
          {hairSaved && (
            <span role="status" className="text-xs font-bold text-leaf-dark">
              {t("머리 색을 바꿨어요 ✓")}
            </span>
          )}
        </div>
      )}
      <div role="tabpanel">
        {shown.length === 0 && (
          <p className="card p-6 text-center text-sm text-ink-soft" data-shop-empty>
            {t("이 종류의 옷은 아직 없어요.")}
          </p>
        )}
        <ShopGrid items={shown} level={level} coins={coins} onTry={tryOn} triedIds={triedList.map((i) => i.id)} />
      </div>
    </>
  );
}
