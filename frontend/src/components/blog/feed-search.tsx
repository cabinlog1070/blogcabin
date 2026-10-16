"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useT } from "@/components/i18n";
import { SEARCH_MAX_LENGTH } from "@/lib/search";

/**
 * 마을 소식 탭 줄 오른쪽의 작은 검색창 (BLOG-07). 결과는 마을 검색 화면(/search)에서 본다.
 * 휴대폰에서는 탭 아래 한 줄을 다 쓴다
 */
export function FeedSearch() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState(false);

  return (
    <form
      role="search"
      action="/search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        if (!q) {
          setError(true); // 공백만 넣으면 검색하지 않는다
          return;
        }
        setError(false);
        router.push(`/search?${new URLSearchParams({ q, from: "feed" })}`);
      }}
      className="relative ml-auto w-64 phone:ml-0 phone:w-full phone:basis-full"
      data-feed-search
    >
      <label className="flex items-center gap-1.5 rounded-full border-2 border-line bg-paper py-1 pr-1 pl-3 focus-within:border-sun">
        <Icon name="search" size={18} />
        <input
          name="q"
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          placeholder={t("글·블로그 찾기")}
          aria-label={t("마을 검색")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          onChange={() => error && setError(false)}
        />
        <button type="submit" className="shrink-0 rounded-full bg-ink px-3 py-1 text-sm text-cream">
          {t("검색")}
        </button>
      </label>
      {error && <p className="absolute top-full left-3 mt-0.5 text-xs text-berry">{t("검색어를 입력해 주세요")}</p>}
    </form>
  );
}
