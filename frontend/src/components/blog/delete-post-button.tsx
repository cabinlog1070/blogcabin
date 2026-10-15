"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { api } from "@/lib/api";

/** 내 글 지우기: 지운 뒤 내 블로그 홈으로 간다 */
export function DeletePostButton({ postId }: { postId: number }) {
  const t = useT();
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-ink-soft hover:text-berry"
      onClick={async () => {
        if (!confirm(t("이 글을 삭제할까요? 댓글과 공감도 함께 지워져요."))) return;
        try {
          const { blogSlug } = await api<{ blogSlug: string }>(`/posts/${postId}`, { method: "DELETE" });
          router.push(`/@${blogSlug}`);
          router.refresh();
        } catch {
          router.refresh(); // 이미 지워졌거나 실패하면 지금 상태로 다시 그린다
        }
      }}
    >
      {t("삭제")}
    </button>
  );
}
