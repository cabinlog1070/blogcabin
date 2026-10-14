"use client";
// 언어 고르기: 한국어 | 日本語. 내 정보 메뉴와 아래쪽 푸터에 있다
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/locale-actions";
import { useLocale } from "@/components/i18n";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const current = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label="Language" className={`inline-flex rounded-full border border-line bg-paper p-0.5 text-xs font-bold ${className}`} data-language-switcher>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === current}
          disabled={pending}
          onClick={() => {
            if (l === current) return;
            start(async () => {
              await setLocale(l);
              router.refresh();
            });
          }}
          className={`rounded-full px-2.5 py-1 ${l === current ? "bg-leaf text-white" : "text-ink-soft hover:text-ink"}`}
          data-locale={l}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
