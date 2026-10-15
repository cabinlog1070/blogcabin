import { EGG_LEVEL_EVERY, EGG_PRICE, MAX_ACTIVE_ANIMALS, MAX_NEST_EGGS, POST_GROWTH, POTION_GROWTH, POTION_PRICE } from "@/lib/farm";
import { requireMember } from "@/server/dal";
import { getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { FarmView } from "./farm-view";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("동물 농장") };
}

// 동물 농장 (TOWN-09): 울타리 친 풀밭에 펫이 돌아다닌다. 펫을 누르면 상태창, 가운데 아래 펫 꾸미기,
// 아래에 알 받기 · 농장 가게(물약) · 내 동물 · 카드 도감
export default async function FarmPage() {
  await requireMember();
  const t = await getT();
  const { wallet, farm } = await readApi.farm();
  const [growingBefore, growingAfter = ""] = t("키우는 중 {n} / {max}", { max: MAX_ACTIVE_ANIMALS }).split("{n}");

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl">🐮 {t("동물 농장")}</h1>
          <p className="text-xs text-ink-soft sm:text-sm">
            {t("펫을 누르면 상태창이 열려요. 🥕 밥 · 🤲 쓰다듬기는 하루 한 번, 🧪 물약은 +{potion}, 공개 글을 쓰면 모두 +{post}.", { potion: POTION_GROWTH, post: POST_GROWTH })}
          </p>
        </div>
        <p className="rounded-full bg-paper px-3 py-1 text-sm shadow-sm">
          {growingBefore}
          <b>{MAX_ACTIVE_ANIMALS - farm.fieldLeft}</b>
          {growingAfter}
        </p>
      </div>
      <FarmView
        active={farm.active}
        grown={farm.grown}
        freeEggs={farm.freeEggs}
        nestLeft={farm.nestLeft}
        fieldLeft={farm.fieldLeft}
        maxEggs={MAX_NEST_EGGS}
        coins={wallet.coins}
        potions={farm.potions}
        species={farm.species}
        displayedId={farm.displayedId}
        eggPrice={EGG_PRICE}
        potionPrice={POTION_PRICE}
        eggEvery={EGG_LEVEL_EVERY}
      />
    </div>
  );
}
