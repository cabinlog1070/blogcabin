"use client";

import { useState, useTransition } from "react";
import { setFavorite } from "@/app/blog/actions";

/**
 * 남의 블로그 헤더에서 이웃 버튼 왼쪽의 ☆ (TOWN-08). 이웃으로 추가한 블로그에만 보인다.
 * 누르면 ⭐ 즐겨찾기, 다시 누르면 취소. 최대 인원 검사는 서버(setFavorite)가 한다.
 */
export function FavoriteStar({ followeeId, nickname, favorite }: { followeeId: string; nickname: string; favorite: boolean }) {
  const [on, setOn] = useState(favorite);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setMessage(null);
    setOn(next);
    start(async () => {
      try {
        const r = await setFavorite(followeeId, next);
        if (!r.ok) {
          setOn(!next);
          setMessage(r.error ?? "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요");
        }
      } catch {
        setOn(!next);
        setMessage("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요");
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? `${nickname} 즐겨찾기 취소` : `${nickname} 즐겨찾기`}
        title={on ? "즐겨찾기 취소" : "즐겨찾기"}
        className="btn bg-paper px-3 text-lg leading-none text-ink"
        data-favorite-star
      >
        {on ? "⭐" : "☆"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className="absolute right-0 top-full z-30 mt-1 w-max max-w-[16rem] text-right text-sm font-bold text-berry"
      >
        {message}
      </p>
    </div>
  );
}
