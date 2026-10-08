import { CharacterNotice } from "@/components/character-notice";
import { Icon } from "@/components/icon";
import { isForSale } from "@/lib/shop";
import { requireMember } from "@/server/dal";
import { getEquipped, listItemsWithOwnership } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { ShopView } from "./shop-view";

export const metadata = { title: "상점" };

export default async function ShopPage() {
  const viewer = await requireMember();
  const [all, wallet, equipped] = await Promise.all([
    listItemsWithOwnership(viewer.userId),
    getWallet(viewer.userId),
    getEquipped(viewer.userId),
  ]);
  // 기본 아이템과 캐릭터(2026-10-06부터 판매 중단)는 상점에 나오지 않는다 (SHOP-01)
  const forSale = all.filter(isForSale);
  // 미리 입어 보기는 지금 입고 있는 모습에서 시작한다 (부위별 asset_key)
  const wornAssets = equipped.worn.map((w) => all.find((i) => i.id === w.itemId)?.assetKey ?? "").filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">
            <Icon name="shop" size={34} className="-mt-1" /> 마을 상점
          </h1>
          <p className="mt-1 text-ink-soft">글을 쓰고 출석해서 모은 코인으로 옷과 가구, 배경을 사 보세요.</p>
        </div>
        <div className="card flex gap-4 px-4 py-2 text-sm">
          <span>
            Lv.<b>{wallet.level}</b>
          </span>
          <span>
            <Icon name="coin" size={18} /> <b>{wallet.coins.toLocaleString()}</b>
          </span>
        </div>
      </div>
      <CharacterNotice className="mt-4" />

      <ShopView
        items={forSale}
        level={wallet.level}
        coins={wallet.coins}
        character={viewer.profile.baseCharacterAsset}
        wornAssets={wornAssets}
      />
    </div>
  );
}
