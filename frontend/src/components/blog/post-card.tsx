import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { formatDate, formatDateTime } from "@/lib/format";
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
  /** 아직 올라가지 않은 예약 글 (주인의 블로그 홈에만 나온다, POST-11) */
  scheduled?: boolean;
  /** 관리자(공지사항 블로그)가 쓴 글 */
  isNotice?: boolean;
};

/**
 * 글 목록 한 칸. showAuthor: 마을 소식처럼 여러 블로그 글이 섞일 때 작성자 표시. compact: 바둑판형 보기(요약을 짧게)
 * 여러 블로그 글이 섞인 목록(showAuthor)에서 관리자 공지는 진한 나무색 카드에 `📢 공지` 배지로 구분한다
 * from: 글 주소에 붙일 목록 표시 (`from=feed` 등). 글 화면의 이전·다음 글이 그 목록 순서를 따른다
 */
export async function PostCard({
  post,
  showAuthor = false,
  compact = false,
  from,
}: {
  post: PostCardData;
  showAuthor?: boolean;
  compact?: boolean;
  from?: string;
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const notice = showAuthor && post.isNotice;
  const soft = notice ? "text-cream/85" : "text-ink-soft";
  return (
    <article className={`card flex flex-col p-5 transition hover:-translate-y-0.5 ${notice ? "border-bark-dark bg-bark text-cream" : ""}`}>
      {showAuthor && (
        <Link href={`/@${post.blogSlug}`} className={`mb-2 flex items-center gap-2 text-sm ${notice ? "text-cream/85 hover:text-white" : "text-ink-soft hover:text-ink"}`}>
          <CharacterBadge asset={post.characterAsset} size={26} />
          <b className={notice ? "text-white" : "text-ink"}>{post.nickname}</b>
          <span className="truncate">· {post.blogTitle}</span>
        </Link>
      )}
      <Link href={`/@${post.blogSlug}/${post.id}${from ? `?${from}` : ""}`} className="flex flex-1 flex-col">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold">
          {notice && <span className="rounded-full bg-sun px-2 py-0.5 text-ink">{t("📢 공지")}</span>}
          {post.categoryName && <span className="rounded-full bg-honey px-2 py-0.5 text-sun-dark">{categoryLabel(t, post.categoryName)}</span>}
          {post.visibility === "private" && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-ink-soft">{t("🔒 서로 이웃 공개")}</span>}
          {post.scheduled && (
            <span className="rounded-full bg-leaf/15 px-2 py-0.5 text-leaf-dark">
              {t("⏰ {time} 예약", { time: formatDateTime(post.createdAt, locale) })}
            </span>
          )}
        </div>
        <h3 className={`font-display leading-snug ${notice ? "text-white" : ""} ${compact ? "line-clamp-2 text-lg" : "text-xl"}`}>{post.title}</h3>
        <p className={`mt-1.5 text-sm ${compact ? "line-clamp-3" : "line-clamp-2"} leading-relaxed ${soft}`}>{post.excerpt}</p>
        <p className={`mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs ${soft}`}>
          <span>{formatDate(post.createdAt, locale)}</span>
          <span>♥ {post.likeCount}</span>
          <span>💬 {post.commentCount}</span>
          <span>👀 {post.viewCount}</span>
        </p>
      </Link>
    </article>
  );
}
