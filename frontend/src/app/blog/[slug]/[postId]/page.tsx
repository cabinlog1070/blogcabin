import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/blog/comment-section";
import { DeletePostButton } from "@/components/blog/delete-post-button";
import { LikeButton } from "@/components/blog/like-button";
import { PostBody, PostTitle, PostTranslateProvider, TranslateBar } from "@/components/blog/post-translate";
import { ViewCount } from "@/components/blog/view-count";
import { ClearDraft } from "@/components/editor/clear-draft";
import { CharacterBadge } from "@/components/character";
import { formatDateTime } from "@/lib/format";
import { POST_REWARD_MIN_LENGTH, REWARD_RULES } from "@/lib/game";
import { parseId } from "@/lib/ids";
import { getLocale, getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { categoryLabel } from "@/lib/i18n";
import { feedFrom } from "@/lib/feed-from";
import { detectPostLanguage } from "@/lib/translate";

/** 글 읽기. 볼 수 없는 글(비공개·예약)은 서버가 없는 글처럼 404로 답한다. 이전·다음 글 목록(from·tag)도 넘긴다 */
async function load(props: PageProps<"/blog/[slug]/[postId]">) {
  const { slug, postId } = await props.params;
  const id = parseId(postId);
  if (id === null) return null;
  const sp = await props.searchParams;
  const query: Record<string, string> = {};
  for (const key of ["from", "tag"]) if (typeof sp[key] === "string") query[key] = sp[key];
  return readApi.post(slug, id, query);
}

export async function generateMetadata(props: PageProps<"/blog/[slug]/[postId]">) {
  const data = await load(props);
  if (!data || data.post.visibility === "private" || data.post.scheduled) {
    const t = await getT();
    return { title: t("글") };
  }
  return { title: data.post.title, description: data.post.contentText.slice(0, 120) };
}

export default async function PostPage(props: PageProps<"/blog/[slug]/[postId]">) {
  const data = await load(props);
  if (!data) notFound();
  const { blog, post } = data;
  const sp = await props.searchParams;

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const { viewerId, isOwner, canModerate, tags: tagNames, like, comments } = data;
  // 마을 소식에서 열었으면 이전·다음 글 링크에도 그 목록을 붙인다
  const adjacent = { ...data.adjacent, query: data.adjacent.source ? `?${feedFrom(data.adjacent.source)}` : "" };
  const hrefOf = (p: { id: number; blogSlug?: string }) => `/@${p.blogSlug ?? blog.slug}/${p.id}${adjacent.query}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 새 글 발행에 성공했으면 이 브라우저의 임시 글을 지운다 (POST-08) */}
      {sp.new && isOwner && viewerId && <ClearDraft userId={viewerId} />}
      {sp.new && (
        <div className="card mb-6 border-sun bg-honey p-4 text-center">
          {/* 첫 줄은 발행 알림, 다음 줄에 보상 결과 */}
          <p className="font-bold">
            {post.scheduled
              ? t("⏰ 글을 예약했어요! {time}에 올라가요", { time: formatDateTime(post.createdAt, locale) })
              : t("🎉 글을 발행했어요!")}
          </p>
          {sp.new === "reward" ? (
            <b className="mt-1 block">
              {t("✨ 경험치 {exp} · 🪙 {coins} 코인을 받았어요", { exp: REWARD_RULES.post.exp, coins: REWARD_RULES.post.coins })}
            </b>
          ) : (
            <span className="mt-1 block text-ink-soft">
              {/* 보상을 못 받은 실제 이유 하나만 말한다 (savePost가 new=private|short|limit로 넘긴다) */}
              {sp.new === "private"
                ? t("(서로 이웃만 보는 비공개 글이라 보상은 없어요)")
                : sp.new === "limit"
                  ? t("(오늘 받을 수 있는 글쓰기 보상 {n}번을 이미 다 받아서 보상은 없어요)", { n: REWARD_RULES.post.dailyLimit })
                  : t("(본문이 {n}자보다 짧아서 보상은 없어요. 지금 {len}자예요)", {
                      n: POST_REWARD_MIN_LENGTH,
                      len: post.contentText.length,
                    })}
            </span>
          )}
        </div>
      )}

      {/* 예약 글: 올라가기 전까지 주인만 보고 있다는 것을 알린다 (POST-11). 방금 예약한 화면은 위 안내가 대신한다 */}
      {post.scheduled && !sp.new && (
        <p className="card mb-6 border-leaf bg-leaf/10 p-4 text-center text-sm font-bold">
          {t("⏰ {time}에 올라가는 예약 글이에요. 그때까지는 나만 볼 수 있어요.", { time: formatDateTime(post.createdAt, locale) })}
        </p>
      )}

      <Link href={`/@${blog.slug}`} className="mb-4 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
        <CharacterBadge asset={blog.characterAsset} size={28} />
        <b className="text-ink">{blog.title}</b>
        <span>· {blog.nickname}</span>
      </Link>

      {/* 다른 말로 쓴 글이면 제목·본문을 번역해 보여 줄 수 있게 감싼다 (POST-10). 안쪽은 다른 PR과 겹치지 않게 들여쓰기를 그대로 둔다 */}
      <PostTranslateProvider
        from={detectPostLanguage(`${post.title}\n${post.contentText}`)}
        title={post.title}
        html={post.contentHtml}
        text={post.contentText}
      >
      <article className="card p-6 sm:p-10">
        <header className="border-b-2 border-dashed border-line pb-5">
          <div className="mb-2 flex flex-wrap gap-2 text-xs font-bold">
            {post.categoryName && (
              <Link href={`/@${blog.slug}?category=${post.categoryId}`} className="rounded-full bg-honey px-2 py-0.5 text-sun-dark">
                {categoryLabel(t, post.categoryName)}
              </Link>
            )}
            {post.visibility === "private" && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-ink-soft">{t("🔒 서로 이웃 공개")}</span>}
          </div>
          <PostTitle title={post.title} />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span>{formatDateTime(post.createdAt, locale)}</span>
            <ViewCount postId={post.id} initial={post.viewCount} isOwner={isOwner} />
            {isOwner && (
              <span className="ml-auto flex gap-3">
                <Link href={`/write/${post.id}`} className="hover:text-ink">{t("수정")}</Link>
                <DeletePostButton postId={post.id} />
              </span>
            )}
          </div>
        </header>

        {/* 다른 말로 쓴 글이면 번역 버튼 (POST-10) */}
        <TranslateBar />
        {/* 저장할 때 sanitize-html로 정화한 HTML만 넣는다 (서버가 nbsp도 풀어서 준다) */}
        <PostBody html={post.contentHtml} />

        {tagNames.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-2">
            {tagNames.map((tag) => (
              <li key={tag}>
                <Link href={`/tags/${encodeURIComponent(tag)}`} className="rounded-full bg-cream px-3 py-1 text-sm text-ink-soft hover:text-ink">
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex justify-center">
          <LikeButton postId={post.id} count={like.count} liked={like.liked} canLike={Boolean(viewerId)} />
        </div>

        <CommentSection
          postId={post.id}
          viewerId={viewerId}
          canModerate={canModerate}
          comments={comments.map((c) =>
            c.deleted
              ? c
              : {
                  id: c.id,
                  parentId: c.parentId,
                  deleted: false,
                  content: c.content,
                  createdAtText: formatDateTime(c.createdAt, locale),
                  edited: Boolean(c.editedAt),
                  authorId: c.authorId,
                  nickname: c.nickname,
                  characterAsset: c.characterAsset,
                  blogSlug: c.blogSlug,
                  mentions: c.mentions,
                },
          )}
        />
      </article>
      </PostTranslateProvider>

      <nav className="mt-6 grid gap-3 sm:grid-cols-2" aria-label={t("이전 글, 다음 글")}>
        {adjacent.prev ? (
          <Link href={hrefOf(adjacent.prev)} className="card p-4 hover:-translate-y-0.5">
            <span className="text-xs text-ink-soft">{t("← 이전 글")}</span>
            <span className="block truncate font-bold">{adjacent.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {adjacent.next && (
          <Link href={hrefOf(adjacent.next)} className="card p-4 text-right hover:-translate-y-0.5">
            <span className="text-xs text-ink-soft">{t("다음 글 →")}</span>
            <span className="block truncate font-bold">{adjacent.next.title}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
