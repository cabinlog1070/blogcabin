import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { formatDate } from "@/lib/format";
import { getLocale, getT } from "@/server/i18n";
import { categoryLabel } from "@/lib/i18n";

export type PostCardData = {
  id: number;
  title: string;
  excerpt: string;
  visibility: "public" | "private";
  createdAt: Date;
  categoryName: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  blogSlug: string;
  blogTitle: string;
  nickname: string;
  characterAsset: string;
};

/** 글 목록 한 칸. showAuthor: 마을 소식처럼 여러 블로그 글이 섞일 때 작성자 표시. compact: 바둑판형 보기(요약을 짧게) */
export async function PostCard({ post, showAuthor = false, compact = false }: { post: PostCardData; showAuthor?: boolean; compact?: boolean }) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return (
    <article className="card flex flex-col p-5 transition hover:-translate-y-0.5">
      {showAuthor && (
        <Link href={`/@${post.blogSlug}`} className="mb-2 flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
          <CharacterBadge asset={post.characterAsset} size={26} />
          <b className="text-ink">{post.nickname}</b>
          <span className="truncate">· {post.blogTitle}</span>
        </Link>
      )}
      <Link href={`/@${post.blogSlug}/${post.id}`} className="flex flex-1 flex-col">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold">
          {post.categoryName && <span className="rounded-full bg-honey px-2 py-0.5 text-sun-dark">{categoryLabel(t, post.categoryName)}</span>}
          {post.visibility === "private" && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-ink-soft">{t("🔒 서로 이웃 공개")}</span>}
        </div>
        <h3 className={`font-display leading-snug ${compact ? "line-clamp-2 text-lg" : "text-xl"}`}>{post.title}</h3>
        <p className={`mt-1.5 text-sm ${compact ? "line-clamp-3" : "line-clamp-2"} leading-relaxed text-ink-soft`}>{post.excerpt}</p>
        <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs text-ink-soft">
          <span>{formatDate(post.createdAt, locale)}</span>
          <span>♥ {post.likeCount}</span>
          <span>💬 {post.commentCount}</span>
          <span>👀 {post.viewCount}</span>
        </p>
      </Link>
    </article>
  );
}
