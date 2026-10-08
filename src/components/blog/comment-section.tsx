"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { addComment, deleteComment, type CommentState } from "@/app/blog/actions";
import { CharacterBadge } from "@/components/character";

// 삭제된 자리(답글이 남은 원댓글)는 작성자·시각·내용 없이 온다 (spec 004 FR-008)
export type CommentData =
  | {
      id: number;
      parentId: number | null;
      deleted: false;
      content: string;
      createdAtText: string;
      authorId: string;
      nickname: string;
      characterAsset: string;
      blogSlug: string;
    }
  | { id: number; parentId: null; deleted: true };

function CommentForm({ postId, parentId, onDone }: { postId: number; parentId?: number; onDone?: () => void }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(addComment, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      onDone?.();
    }
  }, [state.ok, onDone]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        name="content"
        required
        maxLength={1000}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? "답글을 남겨 주세요" : "따뜻한 댓글을 남겨 주세요 💬"}
        className="w-full resize-y rounded-xl border-2 border-line bg-paper px-3 py-2 outline-none focus:border-sun"
      />
      <div className="flex items-center justify-end gap-3">
        {state.error && <span className="text-sm text-berry">{state.error}</span>}
        <button disabled={pending} className="btn bg-ink py-1.5 text-sm text-cream">
          {pending ? "등록 중..." : parentId ? "답글 등록" : "댓글 등록"}
        </button>
      </div>
    </form>
  );
}

function CommentItem({
  c,
  viewerId,
  canModerate,
  postId,
  isReply,
}: {
  c: CommentData;
  viewerId: string | null;
  canModerate: boolean;
  postId: number;
  isReply: boolean;
}) {
  const [replying, setReplying] = useState(false);
  if (c.deleted) {
    return (
      <p data-deleted-comment className="py-3 italic text-ink-soft">
        삭제된 댓글이에요
      </p>
    );
  }
  return (
    <div className={isReply ? "ml-10 border-l-2 border-line pl-4" : ""}>
      <div className="flex gap-3 py-3">
        <CharacterBadge asset={c.characterAsset} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Link href={`/@${c.blogSlug}`} className="font-bold hover:text-leaf-dark">
              {c.nickname}
            </Link>{" "}
            <span className="text-ink-soft">{c.createdAtText}</span>
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
          {viewerId && (
            <div className="mt-1 flex gap-3 text-xs text-ink-soft">
              {!isReply && (
                <button type="button" onClick={() => setReplying((v) => !v)} className="hover:text-ink">
                  {replying ? "답글 취소" : "답글"}
                </button>
              )}
              {/* 내 댓글, 또는 내 블로그 글의 댓글·관리자면 남의 댓글도 지울 수 있다 (spec 004) */}
              {(c.authorId === viewerId || canModerate) && (
                <button
                  type="button"
                  className="hover:text-berry"
                  onClick={() => confirm("댓글을 삭제할까요?") && deleteComment(c.id)}
                >
                  삭제
                </button>
              )}
            </div>
          )}
          {replying && (
            <div className="mt-2">
              <CommentForm postId={postId} parentId={c.id} onDone={() => setReplying(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentSection({
  postId,
  comments,
  viewerId,
  canModerate = false,
}: {
  postId: number;
  comments: CommentData[];
  viewerId: string | null;
  /** 블로그 주인이거나 관리자: 남의 댓글에도 [삭제]가 보인다 */
  canModerate?: boolean;
}) {
  const roots = comments.filter((c) => !c.parentId);
  const replies = (id: number) => comments.filter((c) => c.parentId === id);
  const visibleCount = comments.filter((c) => !c.deleted).length;

  return (
    <section id="comments" className="mt-10 scroll-mt-20" aria-label="댓글">
      <h2 className="mb-2 font-display text-xl">💬 댓글 {visibleCount}</h2>
      <div className="divide-y-2 divide-line/60">
        {roots.map((c) => (
          <div key={c.id}>
            <CommentItem c={c} viewerId={viewerId} canModerate={canModerate} postId={postId} isReply={false} />
            {replies(c.id).map((r) => (
              <CommentItem key={r.id} c={r} viewerId={viewerId} canModerate={canModerate} postId={postId} isReply />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4">
        {viewerId ? (
          <CommentForm postId={postId} />
        ) : (
          <p className="rounded-xl bg-paper p-4 text-center text-ink-soft">
            <Link href="/" className="font-bold text-leaf-dark underline">로그인</Link>하면 댓글을 남길 수 있어요
          </p>
        )}
      </div>
    </section>
  );
}
