"use client";

import { useTransition } from "react";
import { adminDeleteComment, adminDeletePost } from "./actions";

export function AdminDeletePostButton({ postId, title }: { postId: number; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-berry hover:underline disabled:opacity-50"
      onClick={() => confirm(`'${title}' 글을 삭제할까요?`) && start(() => adminDeletePost(postId))}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}

export function AdminDeleteCommentButton({ commentId }: { commentId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-berry hover:underline disabled:opacity-50"
      onClick={() => confirm("이 댓글을 삭제할까요?") && start(() => adminDeleteComment(commentId))}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
