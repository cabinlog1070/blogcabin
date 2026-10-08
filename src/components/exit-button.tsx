"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// 광장이 메인이라 다른 곳으로 가는 메뉴는 두지 않는다. 광장 밖에서는 "나가기"로 광장에 돌아온다.
const HIDDEN_ON = new Set(["/", "/town", "/onboarding"]);
const NAV_KEY = "bc_nav_count";
const LAST_KEY = "bc_nav_last";

export function ExitButton() {
  const pathname = usePathname();
  const router = useRouter();
  // 이 탭에서 사이트 안 화면을 몇 번 옮겨 다녔는지 센다 (헤더는 모든 화면에 있어서 여기서 센다)
  useEffect(() => {
    try {
      // 같은 화면을 두 번 세지 않는다 (개발 모드는 효과를 두 번 부른다)
      if (sessionStorage.getItem(LAST_KEY) === pathname) return;
      sessionStorage.setItem(LAST_KEY, pathname);
      sessionStorage.setItem(NAV_KEY, String(Number(sessionStorage.getItem(NAV_KEY) ?? "0") + 1));
    } catch {}
  }, [pathname]);
  if (HIDDEN_ON.has(pathname)) return null;
  // 바로 전 화면으로. 이 탭에서 처음 연 화면이면(주소를 바로 열었을 때) 광장으로 간다.
  const goBack = () => {
    let moves = 0;
    try {
      moves = Number(sessionStorage.getItem(NAV_KEY) ?? "0");
    } catch {}
    if (moves > 1 && window.history.length > 1) router.back();
    else router.push("/town");
  };
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={goBack} aria-label="뒤로 가기" title="뒤로 가기" className="btn shrink-0 whitespace-nowrap bg-paper py-1.5 text-sm text-ink max-sm:px-2.5" data-back-button>
        <span aria-hidden>← <span className="hidden sm:inline">뒤로</span></span>
      </button>
      <Link href="/town" aria-label="광장으로 나가기" title="광장으로 나가기" className="btn shrink-0 whitespace-nowrap bg-paper py-1.5 text-sm text-ink max-sm:px-2.5">
        {/* 좁은 화면은 쪽지·레벨·코인·상태창 자리가 모자라 그림만 보인다 */}
        <span aria-hidden>🏕<span className="hidden sm:inline"> 광장으로 나가기</span></span>
      </Link>
    </div>
  );
}

/**
 * 헤더 로고. 좁은 화면에서 나가기 버튼이 보일 때는 숨긴다.
 * 둘 다 광장으로 가는데, 자리가 모자라 나가기 버튼이 코인과 겹쳐 보였다 (이슈 #5)
 */
export function HomeLogo({ href }: { href: string }) {
  const pathname = usePathname();
  const exitShown = !HIDDEN_ON.has(pathname);
  return (
    <Link href={href} className={`shrink-0 font-display text-lg text-bark hover:text-bark-dark sm:text-2xl ${exitShown ? "max-sm:hidden" : ""}`}>
      BlogCabin
    </Link>
  );
}
