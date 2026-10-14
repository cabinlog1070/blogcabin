"use client";

import { useTransition } from "react";
import { useT } from "@/components/i18n";
import { adminDeleteComment, adminDeletePost } from "./actions";

export function AdminDeletePostButton({ postId, title }: { postId: number; title: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-berry hover:underline disabled:opacity-50"
      onClick={() => confirm(t("'{title}' 글을 삭제할까요?", { title })) && start(() => adminDeletePost(postId))}
    >
      {pending ? t("삭제 중") : t("삭제")}
    </button>
  );
}

export function AdminDeleteCommentButton({ commentId }: { commentId: number }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-berry hover:underline disabled:opacity-50"
      onClick={() => confirm(t("이 댓글을 삭제할까요?")) && start(() => adminDeleteComment(commentId))}
    >
      {pending ? t("삭제 중") : t("삭제")}
    </button>
  );
}
