"use client"; // 오류 화면(Error Boundary)은 클라이언트 컴포넌트여야 한다

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, makeT, type Locale } from "@/lib/i18n";
import "./globals.css";

// 루트 레이아웃(LocaleProvider)이 없으므로 언어는 브라우저의 lang 쿠키에서 읽는다 (서버에서 그릴 때는 한국어)
const cookieLocale = (): Locale => {
  const v = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))?.[1];
  return isLocale(v) ? v : DEFAULT_LOCALE;
};
const noSubscribe = () => () => {};

/**
 * 루트 레이아웃(헤더 포함)에서 오류가 나면 레이아웃 전체를 대신한다 (NF-19).
 * 레이아웃이 없으므로 <html>·<body>와 스타일을 직접 넣는다. 글꼴은 기기 기본 글꼴로 보인다
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useSyncExternalStore(noSubscribe, cookieLocale, () => DEFAULT_LOCALE);
  const t = makeT(locale);
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center px-4 text-center">
        <title>{t("문제가 생겼어요 | BlogCabin")}</title>
        <p className="text-7xl">🚧</p>
        <h1 className="mt-4 text-3xl font-bold">{t("잠깐 문제가 생겼어요")}</h1>
        <p className="mt-2 max-w-md text-ink-soft">
          {t("마을에 예상하지 못한 문제가 생겼어요. [다시 시도]를 눌러 보고, 계속되면 잠시 뒤에 다시 들러 주세요.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="btn bg-leaf text-white">
            {t("다시 시도")}
          </button>
          {/* 레이아웃이 망가진 상태라 Link 대신 페이지를 새로 연다 */}
          <a href="/town" className="btn bg-paper text-ink">
            {t("광장으로 돌아가기")}
          </a>
        </div>
        {error.digest && <p className="mt-6 text-xs text-ink-soft">{t("오류 번호: {digest}", { digest: error.digest })}</p>}
      </body>
    </html>
  );
}
