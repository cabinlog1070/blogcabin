"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Option = { value: string; label: string };

/** 블로그 홈 글 목록 오른쪽 위: 정렬(최신순 등)과 목록형/바둑판형 보기. 둘 다 주소(?sort, ?view)에 남는다 */
export function PostListToolbar({ sort, sorts, view }: { sort: string; sorts: Option[]; view: "list" | "grid" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // 정렬이나 보기를 바꾸면 1쪽부터 다시 본다
  function hrefWith(key: string, value: string, fallback: string) {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    const q = next.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  const viewBtn = (v: "list" | "grid", label: string, icon: string) => (
    <Link
      href={hrefWith("view", v, "list")}
      scroll={false}
      aria-label={label}
      aria-current={view === v ? "true" : undefined}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg text-base ${view === v ? "bg-ink text-cream" : "text-ink-soft hover:bg-cream"}`}
    >
      {icon}
    </Link>
  );

  return (
    <div className="flex items-center gap-2" data-post-toolbar>
      <label className="sr-only" htmlFor="post-sort">
        정렬
      </label>
      <select
        id="post-sort"
        value={sort}
        onChange={(e) => router.push(hrefWith("sort", e.target.value, "latest"), { scroll: false })}
        className="rounded-xl border-2 border-line bg-paper px-2 py-1 text-sm outline-none focus:border-sun"
      >
        {sorts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex rounded-xl border-2 border-line bg-paper p-0.5" role="group" aria-label="보기 방식">
        {viewBtn("list", "목록형으로 보기", "☰")}
        {viewBtn("grid", "바둑판형으로 보기", "▦")}
      </div>
    </div>
  );
}
