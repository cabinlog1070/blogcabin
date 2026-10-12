import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/blog/blog-header";
import { InviteCard } from "@/components/blog/invite-card";
import { NeighborList } from "@/components/blog/neighbor-list";
import { SearchBox } from "@/components/blog/search-box";
import { PostCard } from "@/components/blog/post-card";
import { PostListToolbar } from "@/components/blog/post-list-toolbar";
import { Pagination, parsePage } from "@/components/pagination";
import { parseId } from "@/lib/ids";
import { getRoomFurniture } from "@/server/look";
import { canSeePrivatePosts, getBlogBySlug, getCategories, getFollow, getInviteCode, listBlogPosts, POST_SORTS, type PostSort, listMyNeighbors } from "@/server/blog";
import { getViewer } from "@/server/dal";
import { getCarriedPet, getDisplayedCard } from "@/server/farm";
import { getT } from "@/server/i18n";
import { getBlogVisitStats } from "@/server/visits";

export async function generateMetadata(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const [blog, t] = await Promise.all([getBlogBySlug(slug), getT()]);
  return { title: blog ? blog.title : t("블로그를 찾을 수 없어요") };
}

export default async function BlogHomePage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const blog = await getBlogBySlug(slug);
  if (!blog) notFound();

  const viewer = await getViewer();
  const t = await getT();
  const viewerId = viewer?.profile ? viewer.userId : null;
  const isOwner = viewerId === blog.ownerId;
  const includePrivate = await canSeePrivatePosts(viewerId, blog.ownerId); // 비공개 글은 주인과 서로 이웃만
  const page = parsePage(sp.page);
  const categoryId = parseId(sp.category) ?? undefined; // 이상한 값이면 전체 글
  const sort: PostSort = typeof sp.sort === "string" && sp.sort in POST_SORTS ? (sp.sort as PostSort) : "latest";
  const view = sp.view === "grid" ? "grid" : "list";

  const [cats, list, follow, furniture, pet, card, visits, neighbors, inviteCode] = await Promise.all([
    getCategories(blog.id, includePrivate),
    listBlogPosts({ blogId: blog.id, includePrivate, categoryId, page, sort }),
    viewerId && !isOwner ? getFollow(viewerId, blog.ownerId) : null,
    getRoomFurniture(blog.ownerId), // 미니룸 가구 (SHOP-05)
    getCarriedPet(blog.ownerId), // 미니룸 펫 (TOWN-09)
    getDisplayedCard(blog.ownerId), // 프로필 전시 카드 (TOWN-09)
    getBlogVisitStats(blog.id), // 방문자 수 (BLOG-06)
    isOwner ? listMyNeighbors(blog.ownerId) : null, // 내 이웃 목록 (TOWN-08, 주인에게만)
    isOwner ? getInviteCode(blog.ownerId) : null, // 친구 초대 (GAME-09, 주인에게만)
  ]);
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
                    └ {c.name} <span className="text-ink-soft">({c.postCount})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {/* 휴대폰 순서: 마을 검색 → 내 이웃 → 카테고리 → 글 목록 → 친구 초대 (컴퓨터는 적힌 순서 그대로) */}
          {neighbors && (
            <div className="max-md:order-2">
              <NeighborList neighbors={neighbors} />
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
              {currentCat ? currentCat.name : t("전체 글")} <span className="text-base text-ink-soft">{t("{n}개", { n: list.total })}</span>
            </h2>
            <PostListToolbar sort={sort} view={view} sorts={Object.entries(POST_SORTS).map(([value, label]) => ({ value, label }))} />
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
