import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/blog/blog-header";
import { InviteCard } from "@/components/blog/invite-card";
import { NeighborList } from "@/components/blog/neighbor-list";
import { SearchBox } from "@/components/blog/search-box";
import { PostCard } from "@/components/blog/post-card";
import { PostListToolbar } from "@/components/blog/post-list-toolbar";
import { Pagination } from "@/components/pagination";
import { petShowcaseName } from "@/server/farm";
import { getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { categoryLabel } from "@/lib/i18n";

/** 블로그 홈 읽기 (주소의 page·category·sort만 서버로 넘긴다. 메타데이터와 페이지가 같은 답을 한 번만 읽는다) */
async function load(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const query: Record<string, string> = {};
  for (const key of ["page", "category", "sort"]) if (typeof sp[key] === "string") query[key] = sp[key];
  return readApi.blogHome(slug, query);
}

export async function generateMetadata(props: PageProps<"/blog/[slug]">) {
  const [data, t] = await Promise.all([load(props), getT()]);
  return { title: data ? data.blog.title : t("블로그를 찾을 수 없어요") };
}

export default async function BlogHomePage(props: PageProps<"/blog/[slug]">) {
  const data = await load(props);
  if (!data) notFound();
  const sp = await props.searchParams;
  const t = await getT();
  const { blog, viewerId, isOwner, sort, sorts, cats, list, follow, furniture, visits, neighbors, followers, inviteCode } = data;
  const categoryId = data.categoryId ?? undefined;
  const view = sp.view === "grid" ? "grid" : "list";
  // 미니룸 펫·전시 카드 이름은 화면 언어로 (이름을 안 바꾼 펫)
  const pet = petShowcaseName(t, data.pet);
  const card = petShowcaseName(t, data.card);
  const currentCat = cats.find((c) => c.id === categoryId);
  const base = `/@${blog.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <BlogHeader blog={blog} furniture={furniture} viewerId={viewerId} following={follow !== null} favorite={follow?.favorite ?? false} pet={pet} card={card} visits={visits} />

      <div className="mt-6 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* 768px 미만에서는 aside를 풀어(contents) 친구 초대 카드를 글 목록 아래로 보낸다 */}
        <aside className="space-y-4 max-md:contents max-md:space-y-0 md:sticky md:top-20 md:self-start">
          {/* 마을 검색은 내 집(내 블로그 홈)에서만 (BLOG-07, spec 002 FR-042) */}
          {isOwner && (
            <div className="max-md:order-1">
              <SearchBox />
            </div>
          )}
          <nav className="card p-4 max-md:order-3" aria-label={t("카테고리")}>
            <h2 className="mb-2 font-display text-lg">{t("카테고리")}</h2>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link href={base} className={`block rounded-lg px-2 py-1 ${!categoryId ? "bg-honey font-bold" : "hover:bg-cream"}`}>
                  {t("전체 글")} <span className="text-ink-soft">({blog.postCount})</span>
                </Link>
              </li>
              {cats.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`${base}?category=${c.id}`}
                    className={`block rounded-lg px-2 py-1 ${c.id === categoryId ? "bg-honey font-bold" : "hover:bg-cream"}`}
                  >
                    └ {categoryLabel(t, c.name)} <span className="text-ink-soft">({c.postCount})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {/* 휴대폰 순서: 마을 검색 → 내 이웃 → 카테고리 → 글 목록 → 친구 초대 (컴퓨터는 적힌 순서 그대로) */}
          {neighbors && followers && (
            <div className="max-md:order-2">
              <NeighborList neighbors={neighbors} followers={followers} />
            </div>
          )}
          {inviteCode && (
            <div className="max-md:order-5">
              <InviteCard code={inviteCode} />
            </div>
          )}
        </aside>

        <section className="max-md:order-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl">
              {currentCat ? categoryLabel(t, currentCat.name) : t("전체 글")} <span className="text-base text-ink-soft">{t("{n}개", { n: list.total })}</span>
            </h2>
            <PostListToolbar sort={sort} view={view} sorts={Object.entries(sorts).map(([value, label]) => ({ value, label }))} />
          </div>
          {list.items.length ? (
            <div className={`grid gap-4 ${view === "grid" ? "md:grid-cols-2" : ""}`} data-post-view={view}>
              {list.items.map((p) => (
                <PostCard key={p.id} post={p} compact={view === "grid"} />
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center text-ink-soft">
              <p className="text-4xl">🌱</p>
              <p className="mt-2">{t("아직 글이 없어요.")}</p>
              {isOwner && (
                <Link href="/write" className="btn mt-4 bg-leaf text-white">
                  {t("첫 글 쓰기")}
                </Link>
              )}
            </div>
          )}
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            hrefFor={(n) =>
              `${base}?${new URLSearchParams({
                ...(categoryId && { category: String(categoryId) }),
                ...(sort !== "latest" && { sort }),
                ...(view === "grid" && { view }),
                page: String(n),
              })}`
            }
          />
        </section>
      </div>
    </div>
  );
}
