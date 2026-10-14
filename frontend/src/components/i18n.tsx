"use client";
// 클라이언트 컴포넌트에서 쓰는 번역: 루트 레이아웃이 LocaleProvider로 지금 언어를 내려 준다
import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, makeT, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}
