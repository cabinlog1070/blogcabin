"use client";

import { useActionState, useState } from "react";
import { useT } from "@/components/i18n";
import { errorText } from "@/lib/api";
import { adminApi } from "../admin-api";

type State = { error?: string; username?: string | null; tempPassword?: string };

/**
 * 관리자 비밀번호 초기화: 확인 창을 거쳐 임시 비밀번호를 만들고 화면에 한 번 보여 준다
 * (관리자가 회원에게 알려 줘야 해서 3초 뒤에 사라지지 않는다. 다시 들어오면 다시 볼 수 없다)
 */
export function AdminPasswordReset({ userId, name }: { userId: string; name: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<State, FormData>(async () => {
    try {
      const done = await adminApi.resetPassword(userId);
      setCopied(false);
      return { username: done.username, tempPassword: done.tempPassword };
    } catch (e) {
      return { error: errorText(t, e) };
    }
  }, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t("{name}님의 비밀번호를 임시 비밀번호로 바꿀까요? 지금 비밀번호로는 더 로그인할 수 없어요.", { name }))) e.preventDefault();
      }}
      data-admin-password-reset
    >
      <button type="submit" disabled={pending} className="btn bg-sun text-ink">
        {pending ? t("만드는 중...") : t("임시 비밀번호 만들기")}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-berry">
          {state.error}
        </p>
      )}
      {state.tempPassword && (
        <div className="mt-4 rounded-xl border-2 border-line bg-cream p-4 text-sm" data-temp-password>
          <p>{t("아이디: {username}", { username: state.username ?? "-" })}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            {t("임시 비밀번호:")}
            <code className="rounded bg-paper px-2 py-1 font-mono text-base font-bold tracking-wider">{state.tempPassword}</code>
            <button
              type="button"
              className="btn bg-paper px-3 py-1 text-xs"
              onClick={() => {
                navigator.clipboard?.writeText(state.tempPassword ?? "").then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                }, () => {});
              }}
            >
              {copied ? t("복사했어요") : t("복사")}
            </button>
          </p>
          <p className="mt-2 text-ink-soft">{t("이 화면을 벗어나면 다시 볼 수 없어요. 회원에게 알려 주고 로그인한 뒤 바로 바꾸라고 해 주세요.")}</p>
        </div>
      )}
    </form>
  );
}
