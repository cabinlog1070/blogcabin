"use client";

import { deletePost } from "@/app/write/actions";
import { useT } from "@/components/i18n";

export function DeletePostButton({ postId }: { postId: number }) {
  const t = useT();
  return (
    <button
      type="button"
      className="text-sm text-ink-soft hover:text-berry"
      onClick={() => confirm(t("이 글을 삭제할까요? 댓글과 공감도 함께 지워져요.")) && deletePost(postId)}
    >
      {t("삭제")}
    </button>
  );
}
