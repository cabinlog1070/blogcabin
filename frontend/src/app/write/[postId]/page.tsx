import { notFound } from "next/navigation";
import { PostForm } from "@/components/editor/post-form";
import { parseId } from "@/lib/ids";
import { toKstInput } from "@/lib/schedule";
import { requireMember } from "@/server/dal";
import { getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("글 고치기") };
}

export default async function EditPostPage(props: PageProps<"/write/[postId]">) {
  const viewer = await requireMember();
  const { postId } = await props.params;
  const id = parseId(postId);
  if (id === null) notFound();

  // 내 블로그의 글만 고칠 수 있다
  const data = await readApi.write(id);
  if (!data?.post) notFound();
  const { post, categories: cats, tags: tagNames } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PostForm
        categories={cats}
        initial={{
          postId: post.id,
          title: post.title,
          contentHtml: post.contentHtml,
          categoryId: post.categoryId,
          tags: tagNames,
          visibility: post.visibility,
          publishAt: post.scheduled ? toKstInput(post.createdAt) : undefined, // 아직 안 올라간 예약 글 (POST-11)
          pinHours: post.pinHours,
        }}
        isAdmin={viewer.user.role === "admin"}
      />
    </div>
  );
}
