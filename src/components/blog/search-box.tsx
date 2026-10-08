"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SEARCH_MAX_LENGTH } from "@/lib/search";

/** 마을 검색창 (BLOG-07): 내 블로그 홈(주인)과 검색 결과 화면에만. 마을 전체의 공개 글과 블로그를 찾는다 */
export function SearchBox({ defaultValue = "", initialError = false }: { defaultValue?: string; initialError?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);

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
        router.push(`/search?${new URLSearchParams({ q })}`);
      }}
      className="card p-3"
    >
      <label htmlFor="village-search" className="mb-1.5 block font-display text-lg">
        🔍 마을 검색
      </label>
      <div className="flex gap-2">
        <input
          id="village-search"
          name="q"
          type="search"
          defaultValue={defaultValue}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="글·블로그 찾기"
          className="min-w-0 flex-1 rounded-xl border-2 border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-sun"
          onChange={() => error && setError(false)}
        />
        <button type="submit" className="btn shrink-0 bg-ink px-3 py-1.5 text-sm text-cream">
          검색
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-berry">검색어를 입력해 주세요</p>}
    </form>
  );
}
