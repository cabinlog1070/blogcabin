import Link from "next/link";
import { Fragment } from "react";
import { redirect } from "next/navigation";
import { TownGame } from "@/components/town/town-game";
import { WelcomeOnce } from "@/components/town/welcome-once";
import type { TownData } from "@/components/town/types";
import { getViewer, needsAccountSetup } from "@/server/dal";
import { getCarriedPet } from "@/server/farm";
import { getDailyQuests, questProgress } from "@/server/quests";
import { getT } from "@/server/i18n";
import { favoriteHouses, getMyHouse, getNeighbors, getPopularHouses, getResidents, hasAttendedToday } from "@/server/town";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("중앙 광장") };
}

/** 번역문의 {이름} 자리에 React 요소(굵은 글자 등)를 끼운다 */
function fill(text: string, nodes: Record<string, React.ReactNode>): React.ReactNode[] {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key && key in nodes ? <Fragment key={i}>{nodes[key]}</Fragment> : part;
  }).filter((part) => part !== "");
}

export default async function TownPage(props: PageProps<"/town">) {
  const viewer = await getViewer();
  const t = await getT();
  if (viewer && (await needsAccountSetup())) redirect("/account-setup"); // 아이디가 없는 소셜 회원은 먼저 아이디부터
  if (viewer && !viewer.profile) redirect("/onboarding");
  const member = viewer?.profile ? viewer : null;
  const { welcome } = await props.searchParams;

  // 회원: 즐겨찾기한 이웃의 집만 (TOWN-04·08), 방문자: 인기 블로그 100곳 중 무작위 10곳
  const [myNeighbors, myHouse, attendedToday, pet, quests, residents] = await Promise.all([
    member ? getNeighbors(member.userId) : getPopularHouses(),
    member ? getMyHouse(member.userId) : null,
    member ? hasAttendedToday(member.userId) : false,
    member ? getCarriedPet(member.userId) : null,
    member ? getDailyQuests(member.userId) : null,
    member ? getResidents(member.userId) : [],
  ]);

  const data: TownData = {
    player: member?.profile
      ? {
          nickname: member.profile.nickname,
          characterAsset: member.profile.characterAsset,
          pet: pet ? { name: pet.name, assetKey: pet.assetKey, stage: pet.stage, accessory: pet.accessory } : null,
        }
      : null,
    myHouse,
    neighbors: member ? favoriteHouses(myNeighbors) : myNeighbors,
    residents,
    panel: myNeighbors,
    noFavorites: Boolean(member) && !myNeighbors.some((h) => h.favorite),
    attendedToday,
    quests: quests ? questProgress(quests) : null,
  };
  const { panel, noFavorites } = data;

  // 광장은 헤더 아래 화면 전체를 쓴다. 안내·환영·이웃집은 게임 위에 띄운다.
  // 휴대폰(`phone:`)도 광장만 보여 준다 (2026-10-08: 아래 바로가기 메뉴와 조이스틱을 뺌, 이웃집 패널은 숨김)
  return (
    <div className="relative h-[calc(100dvh-var(--header-h))] min-h-[420px] w-full overflow-hidden phone:min-h-[360px]">
      <h1 className="sr-only">{t("중앙 광장")}</h1>
      <TownGame data={data} className="h-full w-full" />

      {welcome && member?.profile && (
        <WelcomeOnce className="card absolute inset-x-3 top-3 z-10 mx-auto flex max-w-2xl items-start gap-3 border-sun bg-honey p-4">
          <span className="text-3xl">🎉</span>
          <p className="flex-1 text-sm sm:text-base">
            {fill(
              t("{nickname}님, BlogCabin에 오신 걸 환영해요! 가입 선물로 🪙 100 코인을 드렸어요. 광장 아래쪽 {myHouse}에 들어가서 첫 글을 써 보세요. 위쪽 {stampBoard}에서 출석 도장도 받을 수 있어요. 왼쪽 {farm}에서 첫 알을 받아 동물을 키워 보세요."),
              {
                nickname: <b>{member.profile.nickname}</b>,
                myHouse: <b>{t("내 집")}</b>,
                stampBoard: <b>{t("출석 도장 판")}</b>,
                farm: <b>{t("동물 농장")}</b>,
              },
            )}
          </p>
        </WelcomeOnce>
      )}

      {/* 🏘 이웃집 패널: 광장에 집이 없는 이웃도 여기서 들어갈 수 있다 (TOWN-04, 2026-10-02 결정으로 남김).
          회원은 내 이웃 전부(⭐ 즐겨찾기 먼저), 방문자는 광장의 집과 같은 블로그 */}
      {(panel.length > 0 || noFavorites) && (
        <section data-neighbor-panel className="absolute left-3 top-3 z-[5] max-w-[calc(100%-1.5rem)] sm:max-w-xs phone:hidden">
          <details open className="group rounded-2xl border border-line bg-paper/95 shadow-md backdrop-blur">
            <summary className="cursor-pointer list-none px-3 py-2 font-display text-lg">
              {t("🏘 이웃집")} <span className="text-sm text-ink-soft">{panel.length}</span>
              <span className="float-right text-sm text-ink-soft group-open:rotate-180">▾</span>
            </summary>
            {noFavorites && (
              <p data-no-favorites className="mx-2 mb-2 rounded-lg bg-honey px-2 py-1.5 text-sm">
                {t("마음에 드는 블로그를 즐겨찾기하면 광장에 집이 생겨요")}
              </p>
            )}
            {panel.length > 0 && (
              <ul className="max-h-[40dvh] space-y-1 overflow-y-auto px-2 pb-2">
                {panel.map((h) => (
                  <li key={h.slug}>
                    <Link href={`/@${h.slug}`} className="block truncate rounded-lg px-2 py-1.5 text-sm hover:bg-cream hover:text-leaf-dark">
                      {h.favorite && <span aria-label={t("즐겨찾기")}>⭐ </span>}
                      {h.title} <span className="text-ink-soft">· {h.nickname}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </section>
      )}

      {/* 기기에 맞는 조작 안내: 마우스·키보드 / 터치 (TOWN-02) */}
      <p className="pointer-events-none absolute bottom-3 right-3 z-[5] rounded-full bg-white/85 px-3 py-1.5 text-xs text-ink-soft shadow-sm pointer-coarse:hidden phone:hidden">
        {fill(t("방향키·WASD 또는 클릭으로 이동 · 건물 앞에서 {space}로 들어가기"), {
          space: <kbd className="rounded bg-cream px-1.5">Space</kbd>,
        })}
      </p>
      <p className="pointer-events-none absolute bottom-3 right-3 z-[5] hidden max-w-[55%] rounded-2xl bg-white/85 px-3 py-1.5 text-xs text-ink-soft shadow-sm pointer-coarse:block">
        {t("탭해서 이동 · 건물을 탭해서 들어가기")}
      </p>
    </div>
  );
}
