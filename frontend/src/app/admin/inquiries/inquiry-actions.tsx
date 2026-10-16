"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { errorText } from "@/lib/api";
import { INQUIRY_CONTENT_MAX } from "@/lib/inquiry";
import { adminApi } from "../admin-api";

/** 회원 문의에 답하기 (이미 답했으면 고쳐 쓰기). 답하면 회원에게 알림이 간다 */
export function InquiryAnswerForm({ id, answer, answeredAt }: { id: number; answer: string | null; answeredAt: string | null }) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState(answer ?? "");
  const [editing, setEditing] = useState(!answer);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!editing && answer) {
    return (
      <div className="mt-3 rounded-lg bg-cream p-3 text-sm" data-inquiry-answer>
        <p className="mb-1 flex items-center justify-between text-xs font-bold text-leaf-dark">
          <span>
            {t("보낸 답")} · {answeredAt}
          </span>
          <button type="button" className="text-ink-soft underline" onClick={() => setEditing(true)}>
            {t("고쳐 쓰기")}
          </button>
        </p>
        <p className="whitespace-pre-wrap break-words">{answer}</p>
      </div>
    );
  }

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          try {
            await adminApi.answerInquiry(id, text);
          } catch (err) {
            setError(errorText(t, err));
            return;
          }
          setEditing(false);
          router.refresh();
        });
      }}
      data-inquiry-answer-form
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        maxLength={INQUIRY_CONTENT_MAX}
        rows={3}
        placeholder={t("답을 적으면 회원에게 알림이 가요.")}
        className="w-full resize-y rounded-xl border-2 border-line bg-paper px-3 py-2 text-sm outline-none focus:border-leaf"
      />
      <div className="flex items-center justify-end gap-3">
        {error && (
          <span role="alert" className="text-sm font-bold text-berry">
            {error}
          </span>
        )}
        <button type="submit" disabled={pending} className="btn bg-leaf text-sm text-white">
          {pending ? t("보내는 중...") : t("답하기")}
        </button>
      </div>
    </form>
  );
}

/** 처리 완료로 두기 / 다시 열기 */
export function InquiryStatusButton({ id, closed }: { id: number; closed: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-basic text-sm"
      onClick={() =>
        start(async () => {
          await adminApi.setInquiryStatus(id, closed ? "waiting" : "closed").catch(() => {});
          router.refresh();
        })
      }
      data-inquiry-status
    >
      {closed ? t("다시 열기") : t("처리 완료")}
    </button>
  );
}
