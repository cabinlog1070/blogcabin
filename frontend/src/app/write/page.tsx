import { PostForm } from "@/components/editor/post-form";
import { draftStorageKey } from "@/lib/draft";
import { requireMember } from "@/server/dal";
import { getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("글쓰기") };
}

export default async function WritePage() {
  const viewer = await requireMember();
  const cats = (await readApi.write())?.categories ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PostForm
        categories={cats}
        initial={{ title: "", contentHtml: "", categoryId: null, tags: [], visibility: "public" }}
        draftKey={draftStorageKey(viewer.userId)} // 새 글만 임시 저장 (POST-08). 글 수정 화면은 넘기지 않는다
        isAdmin={viewer.user.role === "admin"} // 관리자 글은 광장 게시판에 걸어 둘 시간을 고른다
      />
    </div>
  );
}
