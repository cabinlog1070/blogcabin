"use client";

import { startTransition, useEffect, useState } from "react";
import { recordBlogVisit } from "@/app/blog/actions";

const fmt = (n: number) => n.toLocaleString("ko-KR"); // 서버와 브라우저가 같은 모양이 되게 locale을 정해 둔다

/**
 * 블로그 방문자 수 `오늘 방문 N · 전체 방문 N` (BLOG-06).
 * 서버가 그린 숫자로 시작하고, 화면이 열리면 방문을 기록한 뒤 돌려받은 숫자로 바꾼다. 실패하면 처음 숫자 그대로(문구 없음).
 */
export function VisitCount({ blogId, today, total, isOwner }: { blogId: number; today: number; total: number; isOwner: boolean }) {
  const [stats, setStats] = useState({ today, total });

  useEffect(() => {
    if (isOwner) return; // 주인은 세지 않는다 (서버도 다시 확인)
    startTransition(async () => {
      try {
        const next = await recordBlogVisit(blogId);
        if (next) setStats(next);
      } catch {
        // 기록이 실패해도 블로그는 그대로 보인다
      }
    });
    // 쿠키를 새로 만든 첫 방문에는 화면이 서버에서 한 번 더 그려지므로, blogId가 바뀔 때만 부른다
  }, [blogId, isOwner]);

  return (
    <span data-visit-count>
      오늘 방문 <span data-visit-today>{fmt(stats.today)}</span> · 전체 방문 <span data-visit-total>{fmt(stats.total)}</span>
    </span>
  );
}
