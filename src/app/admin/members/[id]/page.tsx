import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { db } from "@/db";
import { blogs, comments, pointLedger, posts, profiles, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { levelFromExp } from "@/lib/game";
import { requireAdmin } from "@/server/dal";
import { AdminDeleteCommentButton, AdminDeletePostButton } from "../../delete-button";
import { AdminWithdrawButton } from "../withdraw-button";

export const metadata = { title: "회원 관리" };

const postBlog = alias(blogs, "post_blog");

/** 관리자: 회원 한 명의 정보, 쓴 글·댓글 (하나씩 삭제), 강제 탈퇴 */
export default async function AdminMemberPage(props: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  if (id.length > 100) notFound();

  const [member] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      nickname: profiles.nickname,
      blogId: blogs.id,
      slug: blogs.slug,
      provider: sql<string>`(SELECT string_agg(provider_id, ', ') FROM accounts WHERE accounts.user_id = ${users.id})`,
      coins: sql<number>`(SELECT COALESCE(SUM(${pointLedger.coinDelta}), 0)::int FROM ${pointLedger} WHERE ${pointLedger.userId} = ${users.id})`,
      exp: sql<number>`(SELECT COALESCE(SUM(${pointLedger.expDelta}), 0)::int FROM ${pointLedger} WHERE ${pointLedger.userId} = ${users.id})`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(blogs, eq(blogs.ownerId, users.id))
    .where(eq(users.id, id));
  if (!member) notFound();

  const [memberPosts, memberComments] = await Promise.all([
    member.blogId
      ? db
          .select({ id: posts.id, title: posts.title, visibility: posts.visibility, createdAt: posts.createdAt })
          .from(posts)
          .where(eq(posts.blogId, member.blogId))
          .orderBy(desc(posts.createdAt))
      : [],
    db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        postId: posts.id,
        postTitle: posts.title,
        slug: postBlog.slug,
      })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .innerJoin(postBlog, eq(postBlog.id, posts.blogId))
      .where(and(eq(comments.authorId, member.id), isNull(comments.deletedAt)))
      .orderBy(desc(comments.createdAt)),
  ]);

  const name = member.nickname ?? member.username ?? "이 회원";
  const canWithdraw = member.role !== "admin" && member.id !== admin.userId;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm">
        <Link href="/admin" className="text-sky underline">관리자</Link> ›{" "}
        <Link href="/admin/members" className="text-sky underline">회원 관리</Link> › {name}
      </p>
      <h1 className="mt-1 font-display text-3xl">{name}</h1>

      <section className="card mt-6 p-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-ink-soft">아이디</dt><dd>{member.username ?? "-"} <span className="text-ink-soft">({member.provider ?? "없음"})</span></dd>
          <dt className="text-ink-soft">이메일</dt><dd>{member.email.endsWith(".invalid") ? "-" : member.email}</dd>
          <dt className="text-ink-soft">블로그</dt><dd>{member.slug ? <Link href={`/@${member.slug}`} className="text-sky underline">@{member.slug}</Link> : "온보딩 전"}</dd>
          <dt className="text-ink-soft">권한</dt><dd>{member.role === "admin" ? "관리자" : "회원"}</dd>
          <dt className="text-ink-soft">레벨 · 코인</dt><dd>Lv.{levelFromExp(member.exp)} · <Icon name="coin" size={16} /> {member.coins.toLocaleString()}</dd>
          <dt className="text-ink-soft">가입</dt><dd>{formatDateTime(member.createdAt)}</dd>
        </dl>
      </section>

      <section className="card mt-8 overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-xl">쓴 글 ({memberPosts.length})</h2>
        {memberPosts.length ? (
          <table className="w-full text-left text-sm" data-admin-member-posts>
            <thead className="text-ink-soft">
              <tr><th className="py-2">제목</th><th>공개</th><th>작성</th><th /></tr>
            </thead>
            <tbody className="divide-y-2 divide-line/60">
              {memberPosts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2"><Link href={`/@${member.slug}/${p.id}`} className="hover:underline">{p.title}</Link></td>
                  <td>{p.visibility === "public" ? "공개" : <Icon name="lock" size={18} title="비공개" />}</td>
                  <td className="whitespace-nowrap text-ink-soft">{formatDateTime(p.createdAt)}</td>
                  <td className="text-right"><AdminDeletePostButton postId={p.id} title={p.title} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-soft">쓴 글이 없어요</p>
        )}
      </section>

      <section className="card mt-8 overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-xl">쓴 댓글 ({memberComments.length})</h2>
        {memberComments.length ? (
          <table className="w-full text-left text-sm" data-admin-member-comments>
            <thead className="text-ink-soft">
              <tr><th className="py-2">댓글</th><th>달린 글</th><th>작성</th><th /></tr>
            </thead>
            <tbody className="divide-y-2 divide-line/60">
              {memberComments.map((c) => (
                <tr key={c.id}>
                  <td className="max-w-md py-2 break-words">
                    {/* 누르면 그 글의 이 댓글 자리로 가서 댓글이 노랗게 표시된다 (:target은 새로 불러올 때만 잡혀서 Link 대신 a) */}
                    <a href={`/@${c.slug}/${c.postId}#comment-${c.id}`} className="hover:underline">{c.content}</a>
                  </td>
                  <td><Link href={`/@${c.slug}/${c.postId}`} className="hover:underline">{c.postTitle}</Link></td>
                  <td className="whitespace-nowrap text-ink-soft">{formatDateTime(c.createdAt)}</td>
                  <td className="text-right"><AdminDeleteCommentButton commentId={c.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-soft">쓴 댓글이 없어요</p>
        )}
      </section>

      <section className="card mt-10 border-berry/40 p-6" aria-label="강제 탈퇴">
        <h2 className="mb-2 font-display text-xl">강제 탈퇴</h2>
        {canWithdraw ? (
          <>
            <p className="mb-4 text-sm text-ink-soft">
              회원이 스스로 탈퇴할 때와 똑같이 프로필·블로그·글·코인 기록·로그인 정보가 바로 지워지고 되돌릴 수 없어요. 그 회원은 바로 로그아웃돼요.
            </p>
            <AdminWithdrawButton userId={member.id} name={name} />
          </>
        ) : (
          <p className="text-sm text-ink-soft">관리자 계정은 강제 탈퇴할 수 없어요.</p>
        )}
      </section>
    </div>
  );
}
