"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/components/i18n";
import { errorText } from "@/lib/api";
import { adminApi } from "./admin-api";

/** 지우고 목록을 새로 그린다. 실패하면 그 이유를 알림 창으로 */
function useAdminDelete() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();
  const run = (remove: () => Promise<unknown>) =>
    start(async () => {
      try {
        await remove();
        router.refresh();
      } catch (e) {
        alert(errorText(t, e));
      }
    });
  return { pending, run, t };
}

export function AdminDeletePostButton({ postId, title }: { postId: number; title: string }) {
  const { pending, run, t } = useAdminDelete();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-berry hover:underline disabled:opacity-50"
      onClick={() => confirm(t("'{title}' 글을 삭제할까요?", { title })) && run(() => adminApi.deletePost(postId))}
    >
      {pending ? t("삭제 중") : t("삭제")}
    </button>
  );
}

export function AdminDeleteCommentButton({ commentId }: { commentId: number }) {
  const { pending, run, t } = useAdminDelete();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-berry hover:underline disabled:opacity-50"
      onClick={() => confirm(t("이 댓글을 삭제할까요?")) && run(() => adminApi.deleteComment(commentId))}
    >
      {pending ? t("삭제 중") : t("삭제")}
    </button>
  );
}
