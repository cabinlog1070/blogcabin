"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n";
import { NOTICE_MS, useAutoClear } from "@/components/use-auto-clear";

// 삼성 인터넷의 다크 모드는 사이트가 막을 수 없어서(color-scheme도 무시한다) 크레용 그림과 색이 어둡게 바뀐다 (2026-10-14).
// 다크 모드가 켜져 있는지는 알 수 없으니, 삼성 인터넷으로 처음 온 주민에게 한 번만 안내를 띄운다. 다른 알림처럼 3초 뒤 사라진다
const SEEN_KEY = "samsung-dark-hint-seen";

export function SamsungDarkHint() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!/SamsungBrowser/i.test(navigator.userAgent)) return;
    try {
      if (window.localStorage.getItem(SEEN_KEY)) return;
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 이름과 저장소는 화면이 열린 뒤에만 읽을 수 있다
    setShow(true);
  }, []);
  useAutoClear(show, () => setShow(false), NOTICE_MS);

  if (!show) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl border-2 border-sun bg-honey px-4 py-3 text-sm font-bold text-ink shadow-lg"
      data-samsung-dark-hint
    >
      <span aria-hidden>🌙 </span>
      {t("화면이 어둡게 보이면 삼성 인터넷 ≡ 메뉴에서 다크 모드를 꺼 주세요.")}
    </p>
  );
}
