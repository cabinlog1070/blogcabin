"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { CharacterBadge } from "@/components/character";
import { useT } from "@/components/i18n";
import { splitMentions } from "@backend/blog/mention-text";
import { saveError } from "@/lib/api";
import { blogApi } from "@/lib/blog-api";

type CommentState = { error?: string; ok?: number };

// 삭제된 자리(답글이 남은 원댓글)는 작성자·시각·내용 없이 온다 (spec 004 FR-008)
export type CommentData =
  | {
      id: number;
      parentId: number | null;
      deleted: false;
      content: string;
      createdAtText: string;
      /** 작성자가 내용을 고친 적이 있다 */
      edited: boolean;
      authorId: string;
      nickname: string;
      characterAsset: string;
      blogSlug: string;
      /** 내용 속 @주소 가운데 있는 블로그 (이것만 링크로) */
      mentions: string[];
    }
  | { id: number; parentId: null; deleted: true };

/** 댓글 내용: @주소 언급은 그 블로그로 가는 링크로 (없는 주소는 글자 그대로) */
function CommentText({ content, mentions }: { content: string; mentions: string[] }) {
  const known = new Set(mentions);
  return (
    <p className="mt-0.5 whitespace-pre-wrap break-words">
      {splitMentions(content).map((part, i) =>
        i % 2 === 0 ? (
          part
        ) : known.has(part) ? (
          <Link key={i} href={`/@${part}`} data-mention className="font-bold text-leaf-dark hover:underline">
            @{part}
          </Link>
        ) : (
          `@${part}`
        ),
      )}
    </p>
  );
}

function CommentForm({ postId, parentId, onDone }: { postId: number; parentId?: number; onDone?: () => void }) {
  const t = useT();
  const router = useRouter();
  const [state, action, pending] = useActionState<CommentState, FormData>(async (_prev, form) => {
    try {
      await blogApi.addComment(postId, String(form.get("content") ?? ""), parentId);
      router.refresh(); // 새 댓글과 헤더 코인(댓글 보상)을 다시 그린다
      return { ok: Date.now() };
    } catch (err) {
      return { error: saveError(t, err) };
    }
  }, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      onDone?.();
    }
  }, [state.ok, onDone]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <textarea
        name="content"
        required
        maxLength={1000}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? t("답글을 남겨 주세요") : t("따뜻한 댓글을 남겨 주세요 💬")}
        className="w-full resize-y rounded-xl border-2 border-line bg-paper px-3 py-2 outline-none focus:border-sun"
      />
      <div className="flex items-center justify-end gap-3">
        {state.error && <span className="text-sm text-berry">{state.error}</span>}
        <button disabled={pending} className="btn bg-ink py-1.5 text-sm text-cream">
          {pending ? t("등록 중...") : parentId ? t("답글 등록") : t("댓글 등록")}
        </button>
      </div>
    </form>
  );
}

/** 내 댓글 고치기. 저장하면 닫힌다 */
function EditCommentForm({ commentId, content, onDone }: { commentId: number; content: string; onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const [state, action, pending] = useActionState<CommentState, FormData>(async (_prev, form) => {
    try {
      await blogApi.editComment(commentId, String(form.get("content") ?? ""));
      router.refresh();
      return { ok: Date.now() };
    } catch (err) {
      return { error: saveError(t, err) };
    }
  }, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="mt-1 flex flex-col gap-2">
      <textarea
        name="content"
        required
        maxLength={1000}
        rows={3}
        defaultValue={content}
        autoFocus
        aria-label={t("댓글 수정")}
        className="w-full resize-y rounded-xl border-2 border-line bg-paper px-3 py-2 outline-none focus:border-sun"
      />
      <div className="flex items-center justify-end gap-3">
        {state.error && <span className="text-sm text-berry">{state.error}</span>}
        <button type="button" onClick={onDone} className="text-sm text-ink-soft hover:text-ink">
          {t("취소")}
        </button>
        <button disabled={pending} className="btn bg-ink py-1.5 text-sm text-cream">
          {pending ? t("저장 중...") : t("수정 완료")}
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
  const t = useT();
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);
  if (c.deleted) {
    return (
      <p data-deleted-comment className="py-3 italic text-ink-soft">
        {t("삭제된 댓글이에요")}
      </p>
    );
  }
  return (
    <div id={`comment-${c.id}`} className={`scroll-mt-20 rounded-xl target:bg-honey/40 target:ring-2 target:ring-honey ${isReply ? "ml-10 border-l-2 border-line pl-4" : ""}`}>
      <div className="flex gap-3 py-3">
        <CharacterBadge asset={c.characterAsset} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Link href={`/@${c.blogSlug}`} className="font-bold hover:text-leaf-dark">
              {c.nickname}
            </Link>{" "}
            <span className="text-ink-soft">{c.createdAtText}</span>
            {c.edited && <span data-edited className="text-xs text-ink-soft"> · {t("수정됨")}</span>}
          </p>
          {editing ? (
            <EditCommentForm commentId={c.id} content={c.content} onDone={stopEditing} />
          ) : (
            <CommentText content={c.content} mentions={c.mentions} />
          )}
          {viewerId && !editing && (
            <div className="mt-1 flex gap-3 text-xs text-ink-soft">
              {!isReply && (
                <button type="button" onClick={() => setReplying((v) => !v)} className="hover:text-ink">
                  {replying ? t("답글 취소") : t("답글")}
                </button>
              )}
              {/* 고치기는 작성자만 */}
              {c.authorId === viewerId && (
                <button type="button" onClick={() => { setEditing(true); setReplying(false); }} className="hover:text-ink">
                  {t("수정")}
                </button>
              )}
              {/* 내 댓글, 또는 내 블로그 글의 댓글·관리자면 남의 댓글도 지울 수 있다 (spec 004) */}
              {(c.authorId === viewerId || canModerate) && (
                <button
                  type="button"
                  className="hover:text-berry"
                  onClick={async () => {
                    if (!confirm(t("댓글을 삭제할까요?"))) return;
                    // 이미 지워졌거나 실패해도 지금 상태로 다시 그린다
                    await blogApi.deleteComment(c.id).catch(() => {});
                    router.refresh();
                  }}
                >
                  {t("삭제")}
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
  const t = useT();
  // 링크 자리({link})를 기준으로 문장을 나눠 링크 앞뒤 글자를 얻는다 (언어마다 어순이 달라서)
  const [loginBefore, loginAfter = ""] = t("{link}하면 댓글을 남길 수 있어요").split("{link}");
  const roots = comments.filter((c) => !c.parentId);
  const replies = (id: number) => comments.filter((c) => c.parentId === id);
  const visibleCount = comments.filter((c) => !c.deleted).length;

  return (
    <section id="comments" className="mt-10 scroll-mt-20" aria-label={t("댓글")}>
      <h2 className="mb-2 font-display text-xl">{t("💬 댓글 {n}", { n: visibleCount })}</h2>
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
            {loginBefore}
            <Link href="/" className="font-bold text-leaf-dark underline">{t("로그인")}</Link>
            {loginAfter}
          </p>
        )}
      </div>
    </section>
  );
}
