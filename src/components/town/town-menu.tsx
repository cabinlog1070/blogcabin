import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { josa } from "@/lib/farm";
import type { TownData } from "./types";
import { WelcomeOnce } from "./welcome-once";

type Place = { emoji: string; label: string; sub?: string; href: string };

/**
 * 휴대폰용 간단 메뉴. 휴대폰에서는 광장(게임) 아래에
 * 블로그·출석·상점·농장 같은 주요 화면으로 가는 큰 버튼을 보여준다 (2026-10-08부터 광장도 함께 보인다).
 * 어느 화면에서 보일지는 쓰는 쪽이 className(`hidden phone:block`)으로 정한다.
 */
export function TownMenu({ data, welcome, className = "" }: { data: TownData; welcome: boolean; className?: string }) {
  const member = data.player;
  const places: Place[] = member
    ? [
        ...(data.myHouse ? [{ emoji: "🏠", label: "내 블로그", sub: data.myHouse.title, href: `/@${data.myHouse.slug}` }] : []),
        { emoji: "✏️", label: "글쓰기", sub: "새 글 쓰기", href: "/write" },
        {
          emoji: "📮",
          label: "출석 체크",
          sub: `${data.attendedToday ? "오늘 완료 ✅" : "보상 받기 🎁"}${data.quests ? ` · 퀘스트 ${data.quests.done}/${data.quests.total}` : ""}`,
          href: "/attendance",
        },
        { emoji: "📋", label: "마을 소식", sub: "새 글 · 이웃 새 글", href: "/feed" },
        { emoji: "🏪", label: "상점", sub: "꾸미기·가구·배경", href: "/shop" },
        { emoji: "🐮", label: "동물 농장", sub: member.pet ? `🐾 ${josa(member.pet.name, "과", "와")} 산책 중` : "펫 키우기 · 카드 도감", href: "/farm" },
      ]
    : [
        { emoji: "📋", label: "마을 소식", sub: "새 글 구경하기", href: "/feed" },
        { emoji: "🔑", label: "시작하기", sub: "로그인하고 내 집 만들기", href: "/" },
      ];

  return (
    <nav aria-label="마을 메뉴" data-town-menu className={`mx-auto w-full max-w-md px-4 py-5 ${className}`}>
      {welcome && member && (
        <WelcomeOnce className="card mb-4 flex items-start gap-3 border-sun bg-honey p-4">
          <span className="text-2xl">🎉</span>
          <p className="flex-1 text-sm">
            <b>{member.nickname}</b>님, BlogCabin에 오신 걸 환영해요! 가입 선물로 🪙 100 코인을 드렸어요.
            아래 <b>내 블로그</b>에서 첫 글을 써 보세요. <b>출석 체크</b>로 보상을 받고, <b>동물 농장</b>에서 첫 알도 받아 보세요.
          </p>
        </WelcomeOnce>
      )}

      <div className="mb-4 flex items-center gap-3">
        {member ? <CharacterBadge asset={member.characterAsset} size={44} /> : <span className="text-4xl" aria-hidden>🏘</span>}
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl">{member ? `${member.nickname}님, 어디로 갈까요?` : "BlogCabin 마을 구경"}</h2>
          <p className="text-sm text-ink-soft">{member ? "가고 싶은 곳을 눌러 주세요." : "로그인하면 내 블로그 집이 생겨요."}</p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {places.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="card flex h-full min-h-24 flex-col items-center justify-center gap-0.5 p-3 text-center active:translate-y-0.5"
            >
              <span className="text-3xl" aria-hidden>
                {p.emoji}
              </span>
              <span className="font-bold">{p.label}</span>
              {p.sub && <span className="line-clamp-1 text-xs text-ink-soft">{p.sub}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {/* 이웃집: 데스크톱의 🏘 이웃집 패널과 같은 목록 (TOWN-04·08). 패널(section)과 헷갈리지 않게 div로 둔다 */}
      {(data.panel.length > 0 || data.noFavorites) && (
        <div className="mt-6">
          <h2 className="mb-2 font-display text-lg">
            🏘 이웃집 <span className="text-sm text-ink-soft">{data.panel.length}</span>
          </h2>
          {data.noFavorites && (
            <p className="mb-2 rounded-xl bg-honey px-3 py-2 text-sm">마음에 드는 블로그를 즐겨찾기하면 광장에 집이 생겨요</p>
          )}
          {data.panel.length > 0 && (
            <ul className="card divide-y-2 divide-line overflow-hidden">
              {data.panel.map((h) => (
                <li key={h.slug}>
                  <Link href={`/@${h.slug}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-cream">
                    <CharacterBadge asset={h.characterAsset} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {h.favorite && "⭐ "}
                        {h.title}
                      </span>
                      <span className="block truncate text-xs text-ink-soft">{h.nickname}</span>
                    </span>
                    <span className="text-ink-soft" aria-hidden>
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </nav>
  );
}
