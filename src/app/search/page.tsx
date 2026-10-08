import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { PostCard } from "@/components/blog/post-card";
import { SearchBox } from "@/components/blog/search-box";
import { Pagination, parsePage } from "@/components/pagination";
import { parseSearchQuery } from "@/lib/search";
import { searchBlogs, searchPosts } from "@/server/blog";
import { requireMember } from "@/server/dal";

export const metadata = { title: "마을 검색" };

/**
 * 마을 검색 결과 (BLOG-07). 검색창은 내 블로그 홈에만 있고, 결과는 이 화면에서 본다.
 * 온보딩을 마친 회원만 (로그인 안 했으면 첫 화면, 온보딩 전이면 온보딩 화면으로, spec 002 FR-042)
 */
export default async function SearchPage(props: PageProps<"/search">) {
  const viewer = await requireMember();
  const sp = await props.searchParams;
  const query = parseSearchQuery(sp.q);
  const page = parsePage(sp.page);

  const [blogs, posts] =
    query.kind === "ok" ? await Promise.all([searchBlogs(query.q), searchPosts(query.q, page)]) : [null, null];
  const empty = blogs && posts && blogs.length === 0 && posts.total === 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-3xl">🔍 마을 검색</h1>
        <Link href={`/@${viewer.profile.blogSlug}`} className="text-sm text-ink-soft hover:text-ink">
          ← 내 블로그로
        </Link>
      </div>
      <SearchBox key={query.kind === "ok" ? query.q : ""} defaultValue={query.kind === "ok" ? query.q : ""} initialError={query.kind === "empty"} />

      {query.kind === "ok" && (
        <p className="mt-4 text-sm text-ink-soft">
          마을 전체의 공개 글과 블로그에서 <b className="text-ink">&apos;{query.q}&apos;</b>를 찾았어요.
        </p>
      )}

      {empty && (
        <div className="card mt-6 p-10 text-center text-ink-soft" data-search-empty>
          <p className="text-4xl">🔍</p>
          <p className="mt-2">&apos;{query.kind === "ok" ? query.q : ""}&apos;에 맞는 글이나 블로그가 없어요</p>
        </div>
      )}

      {blogs && blogs.length > 0 && (
        <section className="mt-6" aria-label="블로그" data-search-blogs>
          <h2 className="mb-3 font-display text-xl">블로그</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {blogs.map((b) => (
              <li key={b.slug}>
                <Link href={`/@${b.slug}`} className="card flex items-center gap-3 p-3 hover:-translate-y-0.5">
                  <CharacterBadge asset={b.characterAsset} size={36} />
                  <span className="min-w-0">
                    <b className="block truncate">{b.title}</b>
                    <span className="block truncate text-sm text-ink-soft">
                      {b.nickname} · @{b.slug}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {posts && posts.total > 0 && (
        <section className="mt-8" aria-label="글" data-search-posts>
          <h2 className="mb-3 font-display text-xl">
            글 <span className="text-base text-ink-soft">{posts.total}개</span>
          </h2>
          <div className="grid gap-4">
            {posts.items.map((p) => (
              <PostCard key={p.id} post={p} showAuthor />
            ))}
          </div>
          <Pagination
            page={posts.page}
            pageCount={posts.pageCount}
            hrefFor={(n) => `/search?${new URLSearchParams({ q: query.kind === "ok" ? query.q : "", page: String(n) })}`}
          />
        </section>
      )}
    </div>
  );
}
