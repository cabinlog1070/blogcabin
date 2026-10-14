import Link from "next/link";
import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, listFeed } from "@/server/blog";
import { feedFrom } from "@/lib/feed-from";
import { requireMember } from "@/server/dal";
import { getT } from "@/server/i18n";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("이웃 새 글") };
}

export default async function FollowingFeedPage(props: PageProps<"/feed/following">) {
  const viewer = await requireMember();
  const t = await getT();
  // 링크 자리({link})를 기준으로 문장을 나눈다 (언어마다 어순이 달라서)
  const [linkBefore, linkAfter = ""] = t("{link}에서 마음에 드는 블로그를 이웃으로 추가해 보세요.").split("{link}");
  const page = parsePage((await props.searchParams).page);
  const [list, tags] = await Promise.all([listFeed({ page, followerId: viewer.userId }), getAllTags()]);
  return (
    <FeedView
      title={t("💛 이웃 새 글")}
      tab="following"
      list={list}
      tags={tags}
      showFollowingTab
      myBlogHref={`/@${viewer.profile.blogSlug}`}
      hrefFor={(n) => `/feed/following?page=${n}`}
      from={feedFrom({ tab: "following" })}
      empty={
        <>
          {t("아직 이웃이 없거나 이웃의 새 글이 없어요.")}
          <br />
          {linkBefore}
          <Link href="/feed" className="font-bold text-leaf-dark underline">{t("마을 소식")}</Link>
          {linkAfter}
        </>
      }
    />
  );
}
