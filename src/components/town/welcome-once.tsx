"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * 온보딩 직후 환영 문구는 한 번만 보여준다 (TOWN-01 결정).
 * 보여준 직후 주소에서 ?welcome=1을 지워서, 새로고침하거나 다시 와도 나오지 않게 한다.
 * router.replace 대신 history.replaceState를 쓴다: 서버에 다시 요청하지 않아 지금 보이는 문구와 광장 게임이 그대로 남는다
 * (Next.js가 replaceState를 라우터와 맞춰 준다, node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md)
 */
export function WelcomeOnce({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("welcome")) return;
    url.searchParams.delete("welcome");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  if (!open) return null;
  return (
    <div className={className} data-welcome>
      {children}
      <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-lg px-2 py-1 text-ink-soft hover:bg-paper" aria-label="환영 문구 닫기">
        ✕
      </button>
    </div>
  );
}
