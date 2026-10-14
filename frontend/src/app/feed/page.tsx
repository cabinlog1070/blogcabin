import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, listFeed } from "@/server/blog";
import { feedFrom } from "@/lib/feed-from";
import { getViewer } from "@/server/dal";
import { getT } from "@/server/i18n";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("마을 소식") };
}

export default async function FeedPage(props: PageProps<"/feed">) {
  const t = await getT();
  const page = parsePage((await props.searchParams).page);
  const [viewer, list, tags] = await Promise.all([getViewer(), listFeed({ page }), getAllTags()]);
  return (
    <FeedView
      title={t("📋 마을 소식")}
      tab="all"
      list={list}
      tags={tags}
      showFollowingTab={Boolean(viewer?.profile)}
      myBlogHref={viewer?.profile ? `/@${viewer.profile.blogSlug}` : undefined}
      hrefFor={(n) => `/feed?page=${n}`}
      from={feedFrom({ tab: "all" })}
      empty={<>{t("아직 마을에 글이 없어요. 첫 글의 주인공이 되어 보세요! ✏️")}</>}
    />
  );
}
