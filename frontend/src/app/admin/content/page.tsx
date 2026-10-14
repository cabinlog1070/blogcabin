import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Pagination, parsePage } from "@/components/pagination";
import { db } from "@/db";
import { blogs, comments, posts, profiles } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/dal";
import { getLocale, getT } from "@/server/i18n";
import { AdminDeleteCommentButton, AdminDeletePostButton } from "../delete-button";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("글 관리") };
}

const PAGE_SIZE = 30;
const postBlog = alias(blogs, "post_blog");

type Tab = "posts" | "comments";

/**
 * 관리자 글 관리: 기간 제한 없이 모든 글(비공개 포함)과 댓글(지운 댓글 제외)을 최신순으로 탭을 나눠 본다.
 * 제목·내용·닉네임·블로그 주소로 찾고, 한 줄씩 삭제한다.
 */
export default async function AdminContentPage(props: { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const t = await getT();
  const locale = await getLocale();
  const sp = await props.searchParams;
  const tab: Tab = sp.tab === "comments" ? "comments" : "posts";
  const q = (sp.q ?? "").trim().slice(0, 50);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const page = parsePage(sp.page);
  const offset = (page - 1) * PAGE_SIZE;

  const hrefFor = (next: { tab?: Tab; page?: number }) => {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    if (nextTab !== "posts") params.set("tab", nextTab);
    if (q && !next.tab) params.set("q", q);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const s = params.toString();
    return `/admin/content${s ? `?${s}` : ""}`;
  };

  const postWhere = q ? or(ilike(posts.title, like), ilike(profiles.nickname, like), ilike(blogs.slug, like)) : undefined;
  const commentWhere = and(isNull(comments.deletedAt), q ? or(ilike(comments.content, like), ilike(profiles.nickname, like)) : undefined);

  const [[postCount], [commentCount], postRows, commentRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .where(postWhere),
    db.select({ n: count() }).from(comments).leftJoin(profiles, eq(profiles.userId, comments.authorId)).where(commentWhere),
    tab === "posts"
      ? db
          .select({
            id: posts.id,
            title: posts.title,
            visibility: posts.visibility,
            createdAt: posts.createdAt,
            slug: blogs.slug,
            authorId: profiles.userId,
            nickname: profiles.nickname,
            commentCount: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.deletedAt} IS NULL)`,
          })
          .from(posts)
          .innerJoin(blogs, eq(blogs.id, posts.blogId))
          .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
          .where(postWhere)
          .orderBy(desc(posts.createdAt), desc(posts.id))
          .limit(PAGE_SIZE)
          .offset(offset)
      : [],
    tab === "comments"
      ? db
          .select({
            id: comments.id,
            content: comments.content,
            createdAt: comments.createdAt,
            authorId: comments.authorId,
            nickname: profiles.nickname,
            postId: posts.id,
            postTitle: posts.title,
            slug: postBlog.slug,
          })
          .from(comments)
          .innerJoin(posts, eq(posts.id, comments.postId))
          .innerJoin(postBlog, eq(postBlog.id, posts.blogId))
          .leftJoin(profiles, eq(profiles.userId, comments.authorId))
          .where(commentWhere)
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(PAGE_SIZE)
          .offset(offset)
      : [],
  ]);

  const total = tab === "posts" ? postCount.n : commentCount.n;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "posts", label: t("작성한 글"), count: postCount.n },
    { key: "comments", label: t("작성한 댓글"), count: commentCount.n },
  ];
  const authorLink = (authorId: string | null, nickname: string | null) =>
    authorId ? (
      <Link href={`/admin/members/${authorId}`} className="text-sky underline">
        {nickname ?? t("온보딩 전")}
      </Link>
    ) : (
      <span className="text-ink-soft">{t("탈퇴한 회원")}</span>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm">
        <Link href="/admin" className="text-sky underline">
          {t("관리자")}
        </Link>{" "}
        › {t("글 관리")}
      </p>
      <h1 className="mt-1 font-display text-3xl">
        <Icon name="write" size={34} className="-mt-1" /> {t("글 관리")}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">{t("모든 주민이 쓴 글(비공개 포함)과 댓글을 기간 제한 없이 최신순으로 보여요.")}</p>

      <nav className="mt-6 flex gap-2" aria-label={t("글 관리")} data-admin-content-tabs>
        {tabs.map((x) => (
          <Link
            key={x.key}
            href={hrefFor({ tab: x.key })}
            aria-current={x.key === tab ? "page" : undefined}
            className={`rounded-xl border-2 px-4 py-2 font-bold ${x.key === tab ? "border-ink bg-ink text-cream" : "border-line bg-paper hover:border-sun"}`}
          >
            {x.label} <span className="tabular-nums opacity-80">{x.count.toLocaleString()}</span>
          </Link>
        ))}
      </nav>

      <form className="mt-4 flex gap-2" role="search">
        {tab !== "posts" && <input type="hidden" name="tab" value={tab} />}
        <input
          name="q"
          defaultValue={q}
          placeholder={tab === "posts" ? t("제목, 닉네임, 블로그 주소") : t("댓글 내용, 닉네임")}
          aria-label={tab === "posts" ? t("글 검색") : t("댓글 검색")}
          className="w-full rounded-xl border border-line bg-paper px-3 py-2 outline-none focus:border-sun"
        />
        <button className="btn btn-basic shrink-0">{t("검색")}</button>
      </form>

      <section className="card mt-6 overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-xl">
          {q ? t("'{q}' 검색 결과", { q }) : tab === "posts" ? t("작성한 글") : t("작성한 댓글")}{" "}
          <span className="text-base text-ink-soft">({t("{n}개", { n: total.toLocaleString() })})</span>
        </h2>

        {tab === "posts" &&
          (postRows.length ? (
            <>
              {/* 휴대폰·좁은 창: 글마다 카드 한 장 */}
              <ul className="divide-y-2 divide-line/60 lg:hidden" data-admin-content-post-list>
                {postRows.map((p) => (
                  <li key={p.id} className="py-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/@${p.slug}/${p.id}`} className="min-w-0 break-words text-base font-bold hover:underline">
                        {p.visibility !== "public" && <Icon name="lock" size={16} title={t("비공개")} />} {p.title}
                      </Link>
                      <AdminDeletePostButton postId={p.id} title={p.title} />
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-ink-soft">
                      {authorLink(p.authorId, p.nickname)}
                      <span>@{p.slug}</span>
                      <span>{t("댓글")} {p.commentCount}</span>
                      <span className="whitespace-nowrap">{formatDateTime(p.createdAt, locale)}</span>
                    </p>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full min-w-[48rem] text-left text-sm lg:table" data-admin-content-posts>
                <thead className="whitespace-nowrap text-ink-soft">
                  <tr><th className="py-2 pr-3">{t("제목")}</th><th className="pr-3">{t("작성자")}</th><th className="pr-3">{t("블로그")}</th><th className="pr-3">{t("공개")}</th><th className="pr-3 text-right">{t("댓글")}</th><th className="pr-3">{t("작성")}</th><th /></tr>
                </thead>
                <tbody className="divide-y-2 divide-line/60">
                  {postRows.map((p) => (
                    <tr key={p.id}>
                      <td className="max-w-md break-words py-2 pr-3"><Link href={`/@${p.slug}/${p.id}`} className="hover:underline">{p.title}</Link></td>
                      <td className="pr-3">{authorLink(p.authorId, p.nickname)}</td>
                      <td className="pr-3"><Link href={`/@${p.slug}`} className="text-sky underline">@{p.slug}</Link></td>
                      <td className="pr-3">{p.visibility === "public" ? t("공개") : <Icon name="lock" size={18} title={t("비공개")} />}</td>
                      <td className="pr-3 text-right tabular-nums">{p.commentCount}</td>
                      <td className="whitespace-nowrap pr-3 text-ink-soft">{formatDateTime(p.createdAt, locale)}</td>
                      <td className="text-right"><AdminDeletePostButton postId={p.id} title={p.title} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-ink-soft">{t("글이 없어요")}</p>
          ))}

        {tab === "comments" &&
          (commentRows.length ? (
            <>
              <ul className="divide-y-2 divide-line/60 lg:hidden" data-admin-content-comment-list>
                {commentRows.map((c) => (
                  <li key={c.id} className="py-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <a href={`/@${c.slug}/${c.postId}#comment-${c.id}`} className="min-w-0 break-words hover:underline">{c.content}</a>
                      <AdminDeleteCommentButton commentId={c.id} />
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-ink-soft">
                      {authorLink(c.authorId, c.nickname)}
                      <Link href={`/@${c.slug}/${c.postId}`} className="min-w-0 break-words hover:underline">{c.postTitle}</Link>
                      <span className="whitespace-nowrap">{formatDateTime(c.createdAt, locale)}</span>
                    </p>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full min-w-[48rem] text-left text-sm lg:table" data-admin-content-comments>
                <thead className="whitespace-nowrap text-ink-soft">
                  <tr><th className="py-2 pr-3">{t("댓글")}</th><th className="pr-3">{t("작성자")}</th><th className="pr-3">{t("달린 글")}</th><th className="pr-3">{t("작성")}</th><th /></tr>
                </thead>
                <tbody className="divide-y-2 divide-line/60">
                  {commentRows.map((c) => (
                    <tr key={c.id}>
                      <td className="max-w-md break-words py-2 pr-3">
                        {/* 누르면 그 글의 이 댓글 자리로 간다 (:target은 새로 불러올 때만 잡혀서 Link 대신 a) */}
                        <a href={`/@${c.slug}/${c.postId}#comment-${c.id}`} className="hover:underline">{c.content}</a>
                      </td>
                      <td className="pr-3">{authorLink(c.authorId, c.nickname)}</td>
                      <td className="max-w-xs break-words pr-3"><Link href={`/@${c.slug}/${c.postId}`} className="hover:underline">{c.postTitle}</Link></td>
                      <td className="whitespace-nowrap pr-3 text-ink-soft">{formatDateTime(c.createdAt, locale)}</td>
                      <td className="text-right"><AdminDeleteCommentButton commentId={c.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-ink-soft">{t("댓글이 없어요")}</p>
          ))}

        <Pagination page={page} pageCount={pageCount} hrefFor={(n) => hrefFor({ page: n })} />
      </section>
    </div>
  );
}
