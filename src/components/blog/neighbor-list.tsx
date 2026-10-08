"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setFavorite } from "@/app/blog/actions";
import { CharacterBadge } from "@/components/character";
import { MAX_FAVORITES } from "@/lib/game";

type Neighbor = { ownerId: string; slug: string; title: string; nickname: string; characterAsset: string; favorite: boolean };

/**
 * 내 이웃 목록 (TOWN-08): 내 블로그 홈에서 주인에게만 보인다.
 * ☆을 누르면 ⭐ 즐겨찾기(최대 10명), 다시 누르면 취소. 즐겨찾기한 블로그의 집만 광장에 나타난다 (TOWN-04).
 */
export function NeighborList({ neighbors }: { neighbors: Neighbor[] }) {
  const [list, setList] = useState(neighbors);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const favCount = list.filter((n) => n.favorite).length;

  function toggle(n: Neighbor) {
    const next = !n.favorite;
    setMessage(null);
    if (next && favCount >= MAX_FAVORITES) {
      setMessage(`즐겨찾기할 이웃은 최대 ${MAX_FAVORITES}명이에요`);
      return;
    }
    const before = list;
    setList(list.map((x) => (x.ownerId === n.ownerId ? { ...x, favorite: next } : x)));
    start(async () => {
      try {
        const r = await setFavorite(n.ownerId, next);
        if (!r.ok) {
          setList(before);
          setMessage(r.error ?? "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요");
        }
      } catch {
        setList(before);
        setMessage("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요");
      }
    });
  }

  return (
    <section className="card p-4" aria-label="내 이웃" data-my-neighbors>
      <h2 className="font-display text-lg">
        💛 내 이웃 <span className="text-sm text-ink-soft">{list.length}</span>
      </h2>
      <p className="mb-2 text-xs text-ink-soft">
        ☆을 누르면 즐겨찾기({favCount}/{MAX_FAVORITES}). 즐겨찾기한 이웃의 집이 광장에 생겨요.
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-ink-soft">아직 이웃이 없어요. 마을 소식에서 마음에 드는 블로그를 이웃으로 추가해 보세요.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((n) => (
            <li key={n.ownerId} className="flex items-center gap-2" data-neighbor={n.slug}>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(n)}
                aria-pressed={n.favorite}
                aria-label={n.favorite ? `${n.nickname} 즐겨찾기 취소` : `${n.nickname} 즐겨찾기`}
                className="shrink-0 rounded-lg px-1 text-lg leading-none hover:bg-cream"
              >
                {n.favorite ? "⭐" : "☆"}
              </button>
              <Link href={`/@${n.slug}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-cream">
                <CharacterBadge asset={n.characterAsset} size={24} />
                <span className="min-w-0 truncate">
                  <b>{n.title}</b> <span className="text-ink-soft">· {n.nickname}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-sm font-bold text-berry">
        {message}
      </p>
    </section>
  );
}
