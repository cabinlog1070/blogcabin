"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { saveError } from "@/lib/api";
import { blogApi } from "@/lib/blog-api";
import { useAutoClear } from "@/components/use-auto-clear";

/**
 * 남의 블로그 헤더에서 이웃 버튼 왼쪽의 ☆ (TOWN-08). 이웃으로 추가한 블로그에만 보인다.
 * 누르면 ⭐ 즐겨찾기, 다시 누르면 취소. 최대 인원 검사는 서버(즐겨찾기 API)가 한다.
 */
export function FavoriteStar({ followeeId, nickname, favorite }: { followeeId: string; nickname: string; favorite: boolean }) {
  const t = useT();
  const router = useRouter();
  const [on, setOn] = useState(favorite);
  const [message, setMessage] = useState<string | null>(null);
  useAutoClear(message, () => setMessage(null));
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setMessage(null);
    setOn(next);
    start(async () => {
      try {
        await blogApi.setFavorite(followeeId, next);
        // 뒤로 가기로 돌아간 화면(광장 이웃집·내 이웃 칸)은 브라우저가 기억해 둔 옛 화면을 다시 보여 주므로
        // 기억해 둔 화면을 비워서 돌아갈 때 새로 그리게 한다
        router.refresh();
      } catch (err) {
        setOn(!next);
        setMessage(saveError(t, err));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? t("{nickname} 즐겨찾기 취소", { nickname }) : t("{nickname} 즐겨찾기", { nickname })}
        title={on ? t("즐겨찾기 취소") : t("즐겨찾기")}
        className="btn bg-paper px-3 text-lg leading-none text-ink"
        data-favorite-star
      >
        {on ? "⭐" : "☆"}
      </button>
      {/* 안내는 버튼 줄 아래 새 줄에 (예전에는 버튼 위에 띄워서 휴대폰에서 카드 밖으로 잘렸다).
          부모 버튼 줄이 flex-wrap이라 basis-full로 다음 줄, order-last로 이웃 버튼 뒤에 온다 */}
      <p role="status" aria-live="polite" className="order-last basis-full text-sm font-bold text-berry empty:hidden">
        {message}
      </p>
    </>
  );
}
