import { CharacterNotice } from "@/components/character-notice";
import { Icon } from "@/components/icon";
import { requireMember } from "@/server/dal";
import { getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { ShopView } from "./shop-view";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("상점") };
}

export default async function ShopPage() {
  const viewer = await requireMember();
  const t = await getT();
  // 파는 아이템만(기본 아이템·캐릭터 빼고, SHOP-01), 미리 입어 보기는 지금 입은 모습에서 시작한다
  const { items: forSale, wallet, wornAssets, hairColor } = await readApi.shop();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">
            <Icon name="shop" size={34} className="-mt-1" /> {t("마을 상점")}
          </h1>
          <p className="mt-1 text-ink-soft">{t("글을 쓰고 출석해서 모은 코인으로 옷과 가구, 배경을 사 보세요.")}</p>
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
        hairColor={hairColor}
      />
    </div>
  );
}
