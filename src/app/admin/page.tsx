import { desc, eq, gte, sql } from "drizzle-orm";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { db } from "@/db";
import { attendances, blogs, comments, pointLedger, posts, profiles, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { levelFromExp, todayKST } from "@/lib/game";
import { requireAdmin } from "@/server/dal";
import { startOfTodayKST } from "@/server/points";
import { AdminDeletePostButton } from "./delete-button";
import { AdminGrantForm } from "./grant-form";

export const metadata = { title: "관리자" };

export default async function AdminPage() {
  const admin = await requireAdmin();

  const [[stats], recentUsers, recentPosts, residents] = await Promise.all([
    db.select({
      users: sql<number>`(SELECT COUNT(*)::int FROM ${users})`,
      residents: sql<number>`(SELECT COUNT(*)::int FROM ${profiles})`,
      posts: sql<number>`(SELECT COUNT(*)::int FROM ${posts})`,
      comments: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.deletedAt} IS NULL)`,
      postsToday: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.createdAt} >= ${startOfTodayKST})`,
      attendToday: sql<number>`(SELECT COUNT(*)::int FROM ${attendances} WHERE ${attendances.date} = ${todayKST()})`,
    }).from(sql`(SELECT 1) AS one`),
    db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
        nickname: profiles.nickname,
        slug: blogs.slug,
        provider: sql<string>`(SELECT string_agg(provider_id, ', ') FROM accounts WHERE accounts.user_id = ${users.id})`,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(blogs, eq(blogs.ownerId, users.id))
      .orderBy(desc(users.createdAt))
      .limit(20),
    db
      .select({ id: posts.id, title: posts.title, visibility: posts.visibility, createdAt: posts.createdAt, slug: blogs.slug, nickname: profiles.nickname })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .where(gte(posts.createdAt, sql`now() - interval '30 days'`))
      .orderBy(desc(posts.createdAt))
      .limit(30),
    // 관리자 지급 대상: 온보딩을 마친 주민 전부와 지금 코인·경험치
    db
      .select({
        userId: profiles.userId,
        nickname: profiles.nickname,
        username: users.username,
        coins: sql<number>`COALESCE(SUM(${pointLedger.coinDelta}), 0)::int`,
        exp: sql<number>`COALESCE(SUM(${pointLedger.expDelta}), 0)::int`,
      })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .leftJoin(pointLedger, eq(pointLedger.userId, profiles.userId))
      .groupBy(profiles.userId, profiles.nickname, users.username)
      .orderBy(profiles.nickname),
  ]);
  const members = residents.map((r) => ({
    userId: r.userId,
    label: `${r.nickname} (${r.username ?? "소셜"}) · Lv.${levelFromExp(r.exp)} · 🪙 ${r.coins.toLocaleString()}`,
  }));

  const cards = [
    { label: "가입 계정", value: stats.users },
    { label: "주민 (온보딩 완료)", value: stats.residents },
    { label: "전체 글", value: stats.posts },
    { label: "댓글", value: stats.comments },
    { label: "오늘 새 글", value: stats.postsToday },
    { label: "오늘 출석", value: stats.attendToday },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl">
        <Icon name="level" size={34} className="-mt-1" /> 관리자
      </h1>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-sm text-ink-soft">{c.label}</p>
            <p className="font-display text-3xl">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className="card mt-8 p-5">
        <h2 className="mb-1 font-display text-xl">
          <Icon name="achievement" size={26} className="-mt-1" /> 관리자 지급
        </h2>
        <p className="mb-3 text-sm text-ink-soft">
          주민에게 코인·경험치를 줘요. 받은 사람의 내역에는 &quot;
          <Icon name="achievement" size={16} /> 관리자 지급&quot;으로 보여요.
        </p>
        <AdminGrantForm members={members} defaultUserId={admin.userId} />
      </section>

      <section className="card mt-8 overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-xl">최근 가입 (20명)</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-ink-soft">
            <tr><th className="py-2">아이디 / 로그인 방식</th><th>닉네임</th><th>블로그</th><th>권한</th><th>가입</th></tr>
          </thead>
          <tbody className="divide-y-2 divide-line/60">
            {recentUsers.map((u) => (
              <tr key={u.id}>
                <td className="py-2">{u.username ?? "-"} <span className="text-ink-soft">({u.provider ?? "없음"})</span></td>
                <td>{u.nickname ?? <span className="text-ink-soft">온보딩 전</span>}</td>
                <td>{u.slug ? <Link href={`/@${u.slug}`} className="text-sky underline">@{u.slug}</Link> : "-"}</td>
                <td>
                  {u.role === "admin" ? (
                    <>
                      <Icon name="level" size={16} /> 관리자
                    </>
                  ) : (
                    "회원"
                  )}
                </td>
                <td className="whitespace-nowrap text-ink-soft">{formatDateTime(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card mt-8 overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-xl">최근 30일 글</h2>
        {recentPosts.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-ink-soft">
              <tr><th className="py-2">제목</th><th>작성자</th><th>공개</th><th>작성</th><th /></tr>
            </thead>
            <tbody className="divide-y-2 divide-line/60">
              {recentPosts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2"><Link href={`/@${p.slug}/${p.id}`} className="hover:underline">{p.title}</Link></td>
                  <td>{p.nickname}</td>
                  <td>{p.visibility === "public" ? "공개" : <Icon name="lock" size={18} title="비공개" />}</td>
                  <td className="whitespace-nowrap text-ink-soft">{formatDateTime(p.createdAt)}</td>
                  <td className="text-right"><AdminDeletePostButton postId={p.id} title={p.title} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-soft">글이 없어요</p>
        )}
      </section>
    </div>
  );
}
