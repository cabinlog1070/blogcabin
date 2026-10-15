import Link from "next/link";
import { Icon } from "@/components/icon";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/dal";
import { getLocale, getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";

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

  const { rows } = await readApi.admin.members(q);

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
          <>
            {/* 휴대폰·좁은 창: 회원마다 카드 한 장. 표는 칸이 좁아져 글자가 한 자씩 쪼개진다 */}
            <ul className="divide-y-2 divide-line/60 lg:hidden" data-admin-members-list>
              {rows.map((u) => (
                <li key={u.id} className="py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/admin/members/${u.id}`} className="min-w-0 truncate text-base font-bold text-sky underline">
                      {u.nickname ?? t("온보딩 전")}
                    </Link>
                    <span className="shrink-0 text-xs text-ink-soft">{formatDateTime(u.createdAt, locale)}</span>
                  </div>
                  <p className="mt-1 break-all">
                    {u.username ?? "-"} <span className="text-ink-soft">({u.provider ?? t("없음")})</span>
                    {u.role === "admin" && <span className="ml-2 rounded-full bg-honey px-2 py-0.5 text-xs font-bold">{t("관리자")}</span>}
                  </p>
                  {!u.email.endsWith(".invalid") && <p className="mt-0.5 break-all text-ink-soft">{u.email}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {u.slug ? <Link href={`/@${u.slug}`} className="break-all text-sky underline">@{u.slug}</Link> : <span className="text-ink-soft">-</span>}
                    <span className="whitespace-nowrap text-ink-soft">{t("글")} {u.postCount} · {t("댓글")} {u.commentCount}</span>
                  </p>
                </li>
              ))}
            </ul>
            <table className="hidden w-full min-w-[52rem] text-left text-sm lg:table" data-admin-members>
              <thead className="whitespace-nowrap text-ink-soft">
                <tr><th className="py-2 pr-3">{t("닉네임")}</th><th className="pr-3">{t("아이디 / 로그인 방식")}</th><th className="pr-3">{t("이메일")}</th><th className="pr-3">{t("블로그")}</th><th className="pr-3 text-right">{t("글")}</th><th className="pr-3 text-right">{t("댓글")}</th><th className="pr-3">{t("권한")}</th><th>{t("가입")}</th></tr>
              </thead>
              <tbody className="divide-y-2 divide-line/60">
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/members/${u.id}`} className="font-bold text-sky underline">
                        {u.nickname ?? t("온보딩 전")}
                      </Link>
                    </td>
                    <td className="pr-3">{u.username ?? "-"} <span className="text-ink-soft">({u.provider ?? t("없음")})</span></td>
                    <td className="break-all pr-3 text-ink-soft">{u.email.endsWith(".invalid") ? "-" : u.email}</td>
                    <td className="pr-3">{u.slug ? <Link href={`/@${u.slug}`} className="text-sky underline">@{u.slug}</Link> : "-"}</td>
                    <td className="pr-3 text-right tabular-nums">{u.postCount}</td>
                    <td className="pr-3 text-right tabular-nums">{u.commentCount}</td>
                    <td className="whitespace-nowrap pr-3">{u.role === "admin" ? t("관리자") : t("회원")}</td>
                    <td className="whitespace-nowrap text-ink-soft">{formatDateTime(u.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-ink-soft">{t("찾는 회원이 없어요")}</p>
        )}
      </section>
    </div>
  );
}
