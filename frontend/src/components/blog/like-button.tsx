"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { blogApi } from "@/lib/blog-api";

export function LikeButton({ postId, count, liked, canLike }: { postId: number; count: number; liked: boolean; canLike: boolean }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  // 서버 응답을 기다리지 않고 바로 하트를 바꿔 보여준다 (실패하면 되돌린다). 다른 글로 넘어가면 그 글의 숫자로
  const [state, setState] = useState({ postId, count, liked });
  if (state.postId !== postId) setState({ postId, count, liked });

  return (
    <button
      type="button"
      disabled={!canLike || pending}
      title={canLike ? undefined : t("로그인하면 공감할 수 있어요")}
      aria-pressed={state.liked}
      onClick={() =>
        startTransition(async () => {
          const before = state;
          setState({ postId, liked: !state.liked, count: state.count + (state.liked ? -1 : 1) });
          try {
            await blogApi.toggleLike(postId);
          } catch {
            setState(before);
          }
        })
      }
      className={`btn border-2 px-6 text-lg ${state.liked ? "border-berry bg-[#ffecec] text-berry" : "border-line bg-paper text-ink"}`}
    >
      {state.liked ? "♥" : "♡"} {t("공감 {n}", { n: state.count })}
    </button>
  );
}
