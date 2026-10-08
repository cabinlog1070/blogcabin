import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { WithdrawForm } from "@/app/settings/account/withdraw-form";
import { getBlogByOwner, getCategories } from "@/server/blog";
import { requireMember } from "@/server/dal";
import { BlogInfoForm, CategoryManager } from "./settings-forms";

export const metadata = { title: "블로그 관리" };

export default async function BlogSettingsPage() {
  const viewer = await requireMember();
  const blog = await getBlogByOwner(viewer.userId);
  if (!blog) return null;
  const cats = await getCategories(blog.id, true);
  // 아이디로 가입한 회원은 탈퇴할 때 비밀번호를 다시 입력한다 (AUTH-06)
  const [credential] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, viewer.userId), eq(accounts.providerId, "credential")));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-3xl">⚙️ 블로그 관리</h1>
        <Link href={`/@${blog.slug}`} className="text-sm text-ink-soft hover:text-ink">내 블로그로 →</Link>
      </div>

      <section className="card mt-6 p-6">
        <h2 className="mb-4 font-display text-xl">기본 정보</h2>
        <BlogInfoForm title={blog.title} description={blog.description} />
        <p className="mt-3 text-sm text-ink-soft">블로그 주소: /@{blog.slug} (주소는 바꿀 수 없어요)</p>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="mb-2 font-display text-xl">카테고리</h2>
        <CategoryManager categories={cats} />
      </section>

      <section className="card mt-10 border-berry/40 p-6" aria-label="회원 탈퇴">
        <h2 className="mb-2 font-display text-xl">회원 탈퇴</h2>
        <p className="mb-4 text-sm text-ink-soft">
          탈퇴하면 프로필·블로그·글·코인 기록·로그인 정보가 바로 지워지고 되돌릴 수 없어요. 남의 글에 남긴 댓글은 답글이 달려 있으면
          &apos;삭제된 댓글이에요&apos;로 자리만 남고, 아니면 지워져요.
        </p>
        <WithdrawForm needsPassword={Boolean(credential)} />
      </section>
    </div>
  );
}
