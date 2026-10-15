import Link from "next/link";
import { WithdrawForm } from "@/app/settings/account/withdraw-form";
import { ADMIN_BLOG_TITLE } from "@/lib/nickname";
import { requireMember } from "@/server/dal";
import { getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { BlogInfoForm, CategoryManager } from "./settings-forms";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("블로그 관리") };
}

export default async function BlogSettingsPage() {
  const viewer = await requireMember();
  const t = await getT();
  const data = await readApi.blogSettings();
  if (!data) return null;
  const { blog, categories: cats, statusMessage, hasPassword } = data;
  const isAdmin = viewer.user.role === "admin";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-3xl">{t("⚙️ 블로그 관리")}</h1>
        <Link href={`/@${blog.slug}`} className="text-sm text-ink-soft hover:text-ink">{t("내 블로그로 →")}</Link>
      </div>

      <section className="card mt-6 p-6">
        <h2 className="mb-4 font-display text-xl">{t("기본 정보")}</h2>
        <BlogInfoForm
          nickname={viewer.profile.nickname}
          title={isAdmin ? ADMIN_BLOG_TITLE : blog.title}
          titleLocked={isAdmin}
          description={blog.description}
          statusMessage={statusMessage}
        />
        <p className="mt-3 text-sm text-ink-soft">{t("블로그 주소: {address} (주소는 바꿀 수 없어요)", { address: `/@${blog.slug}` })}</p>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="mb-2 font-display text-xl">{t("카테고리")}</h2>
        <CategoryManager categories={cats} />
      </section>

      <section className="card mt-10 border-berry/40 p-6" aria-label={t("회원 탈퇴")}>
        <h2 className="mb-2 font-display text-xl">{t("회원 탈퇴")}</h2>
        <p className="mb-4 text-sm text-ink-soft">
          {t("탈퇴하면 프로필·블로그·글·코인 기록·로그인 정보가 바로 지워지고 되돌릴 수 없어요. 남의 글에 남긴 댓글은 답글이 달려 있으면 '삭제된 댓글이에요'로 자리만 남고, 아니면 지워져요.")}
        </p>
        <WithdrawForm needsPassword={hasPassword} />
      </section>
    </div>
  );
}
