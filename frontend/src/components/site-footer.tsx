"use client";

import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

// 광장은 화면 전체를 쓰므로 푸터를 숨긴다 (광장에서는 내 정보 메뉴에서 언어를 고른다)
export function SiteFooter() {
  const t = useT();
  if (usePathname() === "/town") return null;
  return (
    <footer className="flex flex-wrap items-center justify-center gap-3 border-t-2 border-line py-6 text-center text-sm text-ink-soft">
      <span>BlogCabin · {t("AI응용프로젝트")}</span>
      <LanguageSwitcher />
    </footer>
  );
}
