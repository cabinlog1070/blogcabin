"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CharacterBadge } from "@/components/character";
import { useT } from "@/components/i18n";
import { saveError } from "@/lib/api";
import { blogApi } from "@/lib/blog-api";
import { MAX_FAVORITES } from "@/lib/game";
import { useAutoClear } from "@/components/use-auto-clear";

const PREVIEW_COUNT = 3;
const OTHER_PREVIEW_COUNT = 5;

type Person = { ownerId: string; slug: string; title: string; nickname: string; characterAsset: string; mutual: boolean };
type Neighbor = Person & { favorite: boolean };
type Tab = "following" | "mutual" | "followers";

/**
 * 내 블로그 홈의 이웃 칸 (주인에게만 보인다). 세 탭:
 * - 내 이웃 (TOWN-08): 내가 이웃 추가한 사람. 즐겨찾기한 이웃이 위에 오고(서버 정렬), 접혀 있을 때는 그들만 보인다.
 *   ☆을 누르면 ⭐ 즐겨찾기(최대 10명), 다시 누르면 취소. 즐겨찾기한 블로그의 집만 광장에 나타난다 (TOWN-04).
 * - 서로 이웃: 내 이웃 중 나도 이웃 추가한 사람 (서로의 비공개 글을 본다). ☆은 내 이웃과 같다.
 * - 나를 이웃한 사람: 나를 이웃 추가한 사람. 내가 아직 이웃 추가하지 않았으면 "+ 이웃 추가"로 바로 서로 이웃이 된다.
 */
export function NeighborList({ neighbors, followers: initialFollowers }: { neighbors: Neighbor[]; followers: Person[] }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("following");
  const [list, setList] = useState(neighbors);
  const [followers, setFollowers] = useState(initialFollowers);
  const [message, setMessage] = useState<string | null>(null);
  useAutoClear(message, () => setMessage(null));
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const favCount = list.filter((n) => n.favorite).length;
  const mutualList = list.filter((n) => n.mutual);
  // 내 이웃 탭이 접혀 있을 때는 처음 불러올 때 즐겨찾기였던 이웃만(없으면 앞의 몇 명), "이웃 더보기"를 누르면 전체.
  // 화면에서 ☆을 눌러도 줄이 사라지거나 끼어들지 않게 처음 개수로 고정한다
  const [collapsedCount] = useState(() => neighbors.filter((n) => n.favorite).length || Math.min(neighbors.length, PREVIEW_COUNT));
  const current: (Neighbor | Person)[] = tab === "following" ? list : tab === "mutual" ? mutualList : followers;
  const previewCount = tab === "following" ? collapsedCount : Math.min(current.length, OTHER_PREVIEW_COUNT);
  const shown = expanded ? current : current.slice(0, previewCount);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "following", label: t("내 이웃"), count: list.length },
    { key: "mutual", label: t("서로 이웃"), count: mutualList.length },
    { key: "followers", label: t("나를 이웃한 사람"), count: followers.length },
  ];
  const hint =
    tab === "following"
      ? t("☆을 누르면 즐겨찾기({count}/{max}). 즐겨찾기한 이웃의 집이 광장에 생겨요.", { count: favCount, max: MAX_FAVORITES })
      : tab === "mutual"
        ? t("서로 이웃으로 추가한 사이예요. 서로의 🔒 비공개 글을 볼 수 있어요.")
        : t("나를 이웃으로 추가한 주민이에요. 「+ 이웃」을 누르면 서로 이웃이 돼요.");
  const empty =
    tab === "following"
      ? t("아직 이웃이 없어요. 마을 소식에서 마음에 드는 블로그를 이웃으로 추가해 보세요.")
      : tab === "mutual"
        ? t("아직 서로 이웃이 없어요.")
        : t("아직 나를 이웃으로 추가한 주민이 없어요.");

  function selectTab(next: Tab) {
    setTab(next);
    setExpanded(false);
    setMessage(null);
  }

  function follow(p: Person) {
    setMessage(null);
    start(async () => {
      try {
        await blogApi.addNeighbor(p.ownerId);
        setFollowers((fs) => fs.map((f) => (f.ownerId === p.ownerId ? { ...f, mutual: true } : f)));
        setList((ls) => (ls.some((x) => x.ownerId === p.ownerId) ? ls : [...ls, { ...p, mutual: true, favorite: false }]));
      } catch (err) {
        setMessage(saveError(t, err));
      }
    });
  }

  function toggle(n: Neighbor) {
    const next = !n.favorite;
    setMessage(null);
    if (next && favCount >= MAX_FAVORITES) {
      setMessage(t("즐겨찾기할 이웃은 최대 {n}명이에요", { n: MAX_FAVORITES }));
      return;
    }
    const before = list;
    setList(list.map((x) => (x.ownerId === n.ownerId ? { ...x, favorite: next } : x)));
    start(async () => {
      try {
        await blogApi.setFavorite(n.ownerId, next);
      } catch (err) {
        setList(before);
        setMessage(saveError(t, err));
      }
    });
  }

  return (
    <section className="card p-4" aria-label={t("이웃")} data-my-neighbors>
      <h2 className="mb-2 font-display text-lg">{t("💛 이웃")}</h2>
      <div role="tablist" aria-label={t("이웃")} className="mb-2 flex flex-wrap gap-1">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => selectTab(x.key)}
            data-neighbor-tab={x.key}
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${tab === x.key ? "bg-honey text-ink" : "bg-cream text-ink-soft hover:bg-honey/60"}`}
          >
            {x.label} <span className="font-normal">{x.count}</span>
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-ink-soft">{hint}</p>
      {current.length === 0 ? (
        <p className="text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="space-y-1" role="tabpanel">
          {shown.map((n) => (
            <li key={n.ownerId} className="flex items-center gap-2" data-neighbor={n.slug}>
              {"favorite" in n && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(n)}
                  aria-pressed={n.favorite}
                  aria-label={n.favorite ? t("{nickname} 즐겨찾기 취소", { nickname: n.nickname }) : t("{nickname} 즐겨찾기", { nickname: n.nickname })}
                  className="shrink-0 rounded-lg px-1 text-lg leading-none hover:bg-cream"
                >
                  {n.favorite ? "⭐" : "☆"}
                </button>
              )}
              <Link href={`/@${n.slug}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-cream">
                <CharacterBadge asset={n.characterAsset} size={24} />
                <span className="min-w-0 truncate">
                  <b>{n.title}</b> <span className="text-ink-soft">· {n.nickname}</span>
                </span>
              </Link>
              {tab === "followers" &&
                (n.mutual ? (
                  <span className="shrink-0 text-xs text-ink-soft">{t("서로 이웃")}</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => follow(n)}
                    aria-label={t("{nickname} 이웃 추가", { nickname: n.nickname })}
                    className="shrink-0 rounded-full bg-leaf px-2 py-0.5 text-xs font-bold text-white hover:bg-moss disabled:opacity-60"
                  >
                    {t("+ 이웃")}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {current.length > previewCount && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-2 w-full rounded-xl bg-honey/60 px-3 py-1.5 text-center text-sm font-bold text-ink-soft hover:bg-honey hover:text-ink"
        >
          {expanded ? t("접기 ⌃") : t("이웃 더보기 ({n}) >", { n: current.length - previewCount })}
        </button>
      )}
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-sm font-bold text-berry">
        {message}
      </p>
    </section>
  );
}
