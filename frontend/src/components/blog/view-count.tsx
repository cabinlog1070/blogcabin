"use client";

import { startTransition, useEffect, useState } from "react";
import { blogApi } from "@/lib/blog-api";

/**
 * 글 조회수 `👀 N` (POST-06). 같은 사람은 한국 시간 하루 1번만 센다(spec 003 FR-048).
 * 세는 일은 화면 렌더링이 아니라 브라우저에 열린 뒤 서버 API로 한다: 미리 불러오기나
 * 공감·댓글 뒤 다시 그리기로는 세지 않는다. 작성자 본인이면 부르지 않는다.
 */
export function ViewCount({ postId, initial, isOwner }: { postId: number; initial: number; isOwner: boolean }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    if (isOwner) return;
    startTransition(async () => {
      try {
        const { viewCount } = await blogApi.recordPostView(postId);
        setCount(viewCount);
      } catch {
        // 실패해도 글은 그대로 보인다
      }
    });
  }, [postId, isOwner]);

  return <span data-view-count>👀 {count}</span>;
}
