import { EGG_LEVEL_EVERY, EGG_PRICE, MAX_ACTIVE_ANIMALS, POST_GROWTH, POTION_GROWTH, POTION_PRICE } from "@/lib/farm";
import { requireMember } from "@/server/dal";
import { getFarm } from "@/server/farm";
import { getWallet } from "@/server/points";
import { FarmView } from "./farm-view";

export const metadata = { title: "동물 농장" };

// 동물 농장 (TOWN-09): 울타리 친 풀밭에 펫이 돌아다닌다. 펫을 누르면 상태창, 가운데 아래 펫 꾸미기,
// 아래에 알 받기 · 농장 가게(물약) · 내 동물 · 카드 도감
export default async function FarmPage() {
  const viewer = await requireMember();
  const wallet = await getWallet(viewer.userId);
  const farm = await getFarm(viewer.userId, wallet.level);

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl">🐮 동물 농장</h1>
          <p className="text-xs text-ink-soft sm:text-sm">
            펫을 누르면 상태창이 열려요. 🥕 밥 · 🤲 쓰다듬기는 하루 한 번, 🧪 물약은 +{POTION_GROWTH}, 공개 글을 쓰면 모두 +{POST_GROWTH}.
          </p>
        </div>
        <p className="rounded-full bg-paper px-3 py-1 text-sm shadow-sm">
          키우는 중 <b>{MAX_ACTIVE_ANIMALS - farm.slotsLeft}</b> / {MAX_ACTIVE_ANIMALS}
        </p>
      </div>
      <FarmView
        active={farm.active}
        grown={farm.grown}
        freeEggs={farm.freeEggs}
        slotsLeft={farm.slotsLeft}
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
