"use client";
// 언어 고르기: 한국어 | 日本語. 내 정보 메뉴와 아래쪽 푸터에 있다
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale } from "@/components/i18n";
import { api } from "@/lib/api";
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
              // 서버가 언어 쿠키를 바꾸고(로그인했으면 회원 정보에도 기억) 화면을 그 언어로 다시 그린다
              await api("/locale", { method: "PUT", body: { locale: l } }).catch(() => {});
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
