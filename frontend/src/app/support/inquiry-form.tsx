"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { api, errorText } from "@/lib/api";
import { INQUIRY_CONTENT_MAX, INQUIRY_TOPIC_LABELS, type InquiryTopic } from "@/lib/inquiry";

const input = "w-full rounded-xl border-2 border-line bg-paper px-3 py-2 outline-none focus:border-leaf";

/**
 * 문의 남기기 (문의하기 화면). 서버: POST /api/v1/inquiries (backend/src/inquiries)
 * signedIn이 아니면 아이디(선택)·답받을 이메일(필수)을 같이 받는다 (비밀번호를 잊어 로그인할 수 없는 사람)
 */
export function InquiryForm({ signedIn, initialTopic }: { signedIn: boolean; initialTopic: InquiryTopic }) {
  const t = useT();
  const router = useRouter();
  const [topic, setTopic] = useState<InquiryTopic>(initialTopic);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  // 알림은 3초 뒤에 사라진다
  useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => setSent(false), 3000);
    return () => clearTimeout(id);
  }, [sent]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        const body = {
          topic,
          content,
          guestUsername: String(f.get("guestUsername") ?? ""),
          contactEmail: String(f.get("contactEmail") ?? ""),
        };
        setError("");
        setSent(false);
        start(async () => {
          try {
            await api("/inquiries", { method: "POST", body });
          } catch (err) {
            setError(errorText(t, err));
            return;
          }
          setContent("");
          form.reset();
          setSent(true);
          router.refresh();
        });
      }}
      className="space-y-3"
      data-inquiry-form
    >
      <fieldset>
        <legend className="mb-1 text-sm font-bold">{t("어떤 문의인가요?")}</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(INQUIRY_TOPIC_LABELS) as InquiryTopic[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={topic === k}
              onClick={() => setTopic(k)}
              className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${topic === k ? "border-leaf bg-leaf text-white" : "border-line bg-paper text-ink-soft"}`}
            >
              {t(INQUIRY_TOPIC_LABELS[k])}
            </button>
          ))}
        </div>
      </fieldset>

      {!signedIn && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">{t("아이디 (알면)")}</span>
            <input name="guestUsername" autoComplete="username" maxLength={40} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">{t("답받을 이메일")}</span>
            <input name="contactEmail" type="email" autoComplete="email" required maxLength={200} className={input} />
          </label>
          <p className="break-keep text-xs text-ink-soft sm:col-span-2">
            {t("로그인하지 않고 보내면 사이트에서 답을 볼 수 없어서, 적어 준 이메일로 답해 드려요.")}
          </p>
        </div>
      )}

      <label className="block">
        <span className="mb-1 flex items-end justify-between text-sm font-bold">
          {t("문의 내용")}
          <span className="text-xs font-normal text-ink-soft">
            {content.length}/{INQUIRY_CONTENT_MAX}
          </span>
        </span>
        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={INQUIRY_CONTENT_MAX}
          rows={5}
          placeholder={
            topic === "password"
              ? t("본인인지 확인할 수 있게 닉네임, 블로그 이름, 최근에 쓴 글 제목을 적어 주세요.")
              : t("궁금한 점이나 불편한 점을 적어 주세요.")
          }
          className={`${input} resize-y`}
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && (
          <span role="alert" className="text-sm font-bold text-berry">
            {error}
          </span>
        )}
        {sent && (
          <span role="status" className="text-sm font-bold text-leaf-dark">
            {signedIn ? t("문의를 보냈어요. 답이 오면 알림으로 알려 드려요.") : t("문의를 보냈어요. 적어 준 이메일로 답해 드려요.")}
          </span>
        )}
        <button type="submit" disabled={pending} className="btn bg-leaf text-white">
          {pending ? t("보내는 중...") : t("문의 보내기")}
        </button>
      </div>
    </form>
  );
}
