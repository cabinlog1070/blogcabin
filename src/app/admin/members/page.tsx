import { desc, eq, ilike, or, sql } from "drizzle-orm";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { db } from "@/db";
import { blogs, comments, posts, profiles, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/dal";
import { getLocale, getT } from "@/server/i18n";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("회원 관리") };
}

const LIMIT = 50;

/** 관리자 회원 관리: 아이디·닉네임·이메일·블로그 주소로 회원을 찾고, 누르면 그 회원의 글·댓글과 강제 탈퇴 화면으로 간다 */
export default async function AdminMembersPage(props: { searchParams: Promise<{ q?: string; withdrawn?: string }> }) {
  await requireAdmin();
  const t = await getT();
  const locale = await getLocale();
  const { q: rawQ, withdrawn } = await props.searchParams;
  const q = (rawQ ?? "").trim().slice(0, 50);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      nickname: profiles.nickname,
      slug: blogs.slug,
      provider: sql<string>`(SELECT string_agg(provider_id, ', ') FROM accounts WHERE accounts.user_id = ${users.id})`,
      postCount: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.blogId} = ${blogs.id})`,
      commentCount: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.authorId} = ${users.id} AND ${comments.deletedAt} IS NULL)`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(blogs, eq(blogs.ownerId, users.id))
    .where(q ? or(ilike(users.username, like), ilike(profiles.nickname, like), ilike(users.email, like), ilike(blogs.slug, like)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(LIMIT);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm">
        <Link href="/admin" className="text-sky underline">
          {t("관리자")}
        </Link>{" "}
        › {t("회원 관리")}
      </p>
      <h1 className="mt-1 font-display text-3xl">
        <Icon name="search" size={34} className="-mt-1" /> {t("회원 관리")}
      </h1>

      {withdrawn && (
        <p role="status" className="card mt-4 border-berry/40 p-4">
          {t("{name}님을 강제 탈퇴시켰어요.", { name: withdrawn })}
        </p>
      )}

      <form className="mt-6 flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("아이디, 닉네임, 이메일, 블로그 주소")}
          aria-label={t("회원 검색")}
          className="w-full rounded-xl border border-line bg-paper px-3 py-2 outline-none focus:border-sun"
        />
        <button className="btn btn-basic shrink-0">{t("검색")}</button>
      </form>

      <section className="card mt-6 overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-xl">
          {q ? t("'{q}' 검색 결과", { q }) : t("전체 회원")}{" "}
          <span className="text-base text-ink-soft">
            ({rows.length === LIMIT ? t("{n}명까지 보여요", { n: rows.length }) : t("{n}명", { n: rows.length })})
          </span>
        </h2>
        {rows.length ? (
          <table className="w-full text-left text-sm" data-admin-members>
            <thead className="text-ink-soft">
              <tr><th className="py-2">{t("닉네임")}</th><th>{t("아이디 / 로그인 방식")}</th><th>{t("이메일")}</th><th>{t("블로그")}</th><th>{t("글")}</th><th>{t("댓글")}</th><th>{t("권한")}</th><th>{t("가입")}</th></tr>
            </thead>
            <tbody className="divide-y-2 divide-line/60">
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="py-2">
                    <Link href={`/admin/members/${u.id}`} className="font-bold text-sky underline">
                      {u.nickname ?? t("온보딩 전")}
                    </Link>
                  </td>
                  <td>{u.username ?? "-"} <span className="text-ink-soft">({u.provider ?? t("없음")})</span></td>
                  <td className="text-ink-soft">{u.email.endsWith(".invalid") ? "-" : u.email}</td>
                  <td>{u.slug ? <Link href={`/@${u.slug}`} className="text-sky underline">@{u.slug}</Link> : "-"}</td>
                  <td>{u.postCount}</td>
                  <td>{u.commentCount}</td>
                  <td>{u.role === "admin" ? t("관리자") : t("회원")}</td>
                  <td className="whitespace-nowrap text-ink-soft">{formatDateTime(u.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-soft">{t("찾는 회원이 없어요")}</p>
        )}
      </section>
    </div>
  );
}
