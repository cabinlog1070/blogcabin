import Link from "next/link";
import { PostCard, type PostCardData } from "@/components/blog/post-card";
import { Icon } from "@/components/icon";
import { Pagination } from "@/components/pagination";
import { getT } from "@/server/i18n";

type Tag = { name: string; count: number };

export async function FeedView({
  title,
  tab,
  list,
  tags,
  showFollowingTab,
  myBlogHref,
  hrefFor,
  from,
  empty,
}: {
  title: React.ReactNode;
  tab?: "all" | "following";
  list: { items: PostCardData[]; page: number; pageCount: number; total: number };
  tags: Tag[];
  showFollowingTab: boolean;
  /** 회원이면 내 블로그 주소 (/@slug). 탭 오른쪽에 "내 블로그로 가기"를 보여 준다 */
  myBlogHref?: string;
  hrefFor: (n: number) => string;
  /** 글 주소에 붙일 목록 표시. 글 화면의 이전·다음 글이 이 목록 순서를 따른다 (feedFrom) */
  from: string;
  empty: React.ReactNode;
}) {
  const t = await getT();
  // 휴대폰에서는 "내 블로그"까지만, 넓은 화면은 뒤에 "로 가기"까지 (언어마다 붙는 말이 달라서 전체 문장에서 잘라 낸다)
  const myBlog = t("내 블로그");
  const goToMyBlog = t("내 블로그로 가기");
  const myBlogRest = goToMyBlog.startsWith(myBlog) ? goToMyBlog.slice(myBlog.length) : "";
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_260px]">
      <section>
        <h1 className="font-display text-3xl">{title}</h1>
        {tab && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href="/feed" className={`btn py-1.5 text-sm phone:px-3 ${tab === "all" ? "bg-ink text-cream" : "bg-paper text-ink"}`}>
              <Icon name="news" size={18} /> {t("마을 전체")}
            </Link>
            {showFollowingTab && (
              <Link href="/feed/following" className={`btn py-1.5 text-sm phone:px-3 ${tab === "following" ? "bg-ink text-cream" : "bg-paper text-ink"}`}>
                <Icon name="heart" size={18} /> {t("이웃 새 글")}
              </Link>
            )}
            {myBlogHref && (
              // 휴대폰에서는 탭 세 개가 한 줄에 들어가도록 "내 블로그"로 줄여 보여 준다
              <Link href={myBlogHref} aria-label={goToMyBlog} className="btn bg-leaf py-1.5 text-sm text-white phone:px-3">
                <span>
                  <Icon name="home" size={18} /> {myBlog}
                  {myBlogRest && <span className="phone:hidden">{myBlogRest}</span>}
                </span>
              </Link>
            )}
          </div>
        )}
        <div className="mt-5 grid gap-4">
          {list.items.length ? list.items.map((p) => <PostCard key={p.id} post={p} showAuthor from={from} />) : <div className="card p-10 text-center text-ink-soft">{empty}</div>}
        </div>
        <Pagination page={list.page} pageCount={list.pageCount} hrefFor={hrefFor} />
      </section>

      <aside className="md:sticky md:top-20 md:self-start">
        <div className="card p-4">
          <h2 className="mb-3 font-display text-lg">
            <Icon name="category" size={22} className="-mt-0.5" /> {t("인기 태그")}
          </h2>
          {tags.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag.name}>
                  <Link href={`/tags/${encodeURIComponent(tag.name)}`} className="inline-block rounded-full bg-cream px-2.5 py-1 text-sm hover:text-leaf-dark">
                    #{tag.name} <span className="text-ink-soft">{tag.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">{t("아직 태그가 없어요")}</p>
          )}
        </div>
      </aside>
    </div>
  );
}
