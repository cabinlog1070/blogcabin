import Link from "next/link";
import { houseStageForLevel } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { petShowcaseName } from "@/server/farm";
import { CLOSET_TABS, type ClosetTab } from "@/lib/shop";
import { ClosetView } from "./closet-view";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("꾸미기") };
}

export default async function ClosetPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireMember();
  const t = await getT();
  // 블로그 홈의 [미니룸 꾸미기 >]는 ?tab=room으로 미니룸 꾸미기 탭을 바로 연다
  const { tab } = await searchParams;
  const initialTab = CLOSET_TABS.includes(tab as ClosetTab) ? (tab as ClosetTab) : "char";
  // 가진 아이템, 지금 입은 것, 미니룸 자리, 미니룸에 놓을 수 있는 펫(데리고 다니는 펫)
  const closet = await readApi.closet();
  const { equipped, wallet } = closet;
  const [moreBefore, moreAfter = ""] = t("더 많은 옷과 가구, 배경은 {link}에서 만날 수 있어요.").split("{link}");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">🎨 {t("꾸미기")}</h1>
          <p className="mt-1 text-ink-soft">{t("고른 뒤 저장하기를 누르면 내 블로그 미니룸과 광장 캐릭터에 적용돼요.")}</p>
        </div>
        <div className="card w-full p-3 sm:w-72">
          <div className="flex justify-between text-sm">
            <b>Lv.{wallet.level}</b>
            <span className="text-ink-soft">
              {wallet.isMax ? "MAX" : `${wallet.current} / ${wallet.needed} EXP`}
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuenow={wallet.isMax ? 1 : wallet.current} aria-valuemax={wallet.isMax ? 1 : wallet.needed} aria-label={t("다음 레벨까지")}>
            <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.round(wallet.ratio * 100)}%` }} />
          </div>
          <Link href="/wallet" className="mt-1.5 inline-block text-xs text-ink-soft underline hover:text-ink">
            {t("경험치·코인 내역 보기")}
          </Link>
        </div>
      </div>

      <ClosetView
        items={closet.items}
        equipped={equipped}
        nickname={viewer.profile.nickname}
        roofColor={closet.roofColor}
        houseStage={houseStageForLevel(wallet.level)}
        pet={petShowcaseName(t, closet.pet)}
        characterSpot={closet.characterSpot}
        petSpot={closet.petSpot}
        hairColor={closet.hairColor}
        topOut={closet.topOut}
        initialTab={initialTab}
      />

      <p className="mt-10 text-center text-ink-soft">
        {moreBefore}
        <Link href="/shop" className="font-bold text-leaf-dark underline">
          {t("상점")}
        </Link>
        {moreAfter}
      </p>
    </div>
  );
}
