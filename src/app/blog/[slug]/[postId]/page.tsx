import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/blog/comment-section";
import { DeletePostButton } from "@/components/blog/delete-post-button";
import { LikeButton } from "@/components/blog/like-button";
import { PostSliders } from "@/components/blog/post-sliders";
import { ViewCount } from "@/components/blog/view-count";
import { ClearDraft } from "@/components/editor/clear-draft";
import { CharacterBadge } from "@/components/character";
import { formatDateTime } from "@/lib/format";
import { POST_REWARD_MIN_LENGTH, REWARD_RULES } from "@/lib/game";
import { parseId } from "@/lib/ids";
import {
  canSeePrivatePosts,
  getAdjacentPosts,
  getBlogBySlug,
  getComments,
  getLikeState,
  getPost,
  getPostTags,
} from "@/server/blog";
import { getViewer } from "@/server/dal";
import { getLocale, getT } from "@/server/i18n";
import { categoryLabel } from "@/lib/i18n";

async function load(props: PageProps<"/blog/[slug]/[postId]">) {
  const { slug, postId } = await props.params;
  const id = parseId(postId);
  if (id === null) return null;
  const blog = await getBlogBySlug(slug);
  if (!blog) return null;
  const post = await getPost(blog.id, id);
  if (!post) return null;
  return { blog, post };
}

export async function generateMetadata(props: PageProps<"/blog/[slug]/[postId]">) {
  const data = await load(props);
  if (!data || data.post.visibility === "private") {
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

  const viewer = await getViewer();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const viewerId = viewer?.profile ? viewer.userId : null;
  const isOwner = viewerId === blog.ownerId;
  const includePrivate = await canSeePrivatePosts(viewerId, blog.ownerId); // 비공개 글은 주인, 서로 이웃, 관리자만
  if (post.visibility === "private" && !includePrivate) notFound();

  const [tagNames, like, comments, adjacent] = await Promise.all([
    getPostTags(post.id),
    getLikeState(post.id, viewerId),
    getComments(post.id),
    getAdjacentPosts(blog.id, post, includePrivate),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 새 글 발행에 성공했으면 이 브라우저의 임시 글을 지운다 (POST-08) */}
      {sp.new && isOwner && viewerId && <ClearDraft userId={viewerId} />}
      {sp.new && (
        <div className="card mb-6 border-sun bg-honey p-4 text-center">
          {/* 첫 줄은 발행 알림, 다음 줄에 보상 결과 */}
          <p className="font-bold">{t("🎉 글을 발행했어요!")}</p>
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

      <Link href={`/@${blog.slug}`} className="mb-4 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
        <CharacterBadge asset={blog.characterAsset} size={28} />
        <b className="text-ink">{blog.title}</b>
        <span>· {blog.nickname}</span>
      </Link>

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
          <h1 className="font-display text-3xl leading-snug sm:text-4xl">{post.title}</h1>
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

        {/* 저장할 때 sanitize-html로 정화한 HTML만 넣는다 */}
        <div className="prose-blog mt-6" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        <PostSliders />

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
          canModerate={Boolean(viewerId) && (isOwner || viewer?.user.role === "admin")}
          comments={comments.map((c) =>
            c.deleted
              ? c
              : {
                  id: c.id,
                  parentId: c.parentId,
                  deleted: false,
                  content: c.content,
                  createdAtText: formatDateTime(c.createdAt, locale),
                  authorId: c.authorId,
                  nickname: c.nickname,
                  characterAsset: c.characterAsset,
                  blogSlug: c.blogSlug,
                },
          )}
        />
      </article>

      <nav className="mt-6 grid gap-3 sm:grid-cols-2" aria-label={t("이전 글, 다음 글")}>
        {adjacent.prev ? (
          <Link href={`/@${blog.slug}/${adjacent.prev.id}`} className="card p-4 hover:-translate-y-0.5">
            <span className="text-xs text-ink-soft">{t("← 이전 글")}</span>
            <span className="block truncate font-bold">{adjacent.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {adjacent.next && (
          <Link href={`/@${blog.slug}/${adjacent.next.id}`} className="card p-4 text-right hover:-translate-y-0.5">
            <span className="text-xs text-ink-soft">{t("다음 글 →")}</span>
            <span className="block truncate font-bold">{adjacent.next.title}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
