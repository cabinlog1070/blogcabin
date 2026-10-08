"use client";

import { useActionState } from "react";
import { withdraw, type WithdrawState } from "./actions";

/** 회원 탈퇴 (AUTH-06): 아이디 회원은 비밀번호 다시 입력 + 확인 창, 소셜 회원은 확인 창 */
export function WithdrawForm({ needsPassword }: { needsPassword: boolean }) {
  const [state, action, pending] = useActionState<WithdrawState, FormData>(withdraw, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("정말 탈퇴할까요? 블로그·글·코인 기록이 모두 지워지고 되돌릴 수 없어요.")) e.preventDefault();
      }}
      className="space-y-3"
      data-withdraw-form
    >
      {needsPassword && (
        <label className="block">
          <span className="mb-1 block text-sm font-bold">비밀번호 확인</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-xl border-2 border-line bg-paper px-3 py-2 outline-none focus:border-berry"
          />
        </label>
      )}
      <div className="flex items-center justify-end gap-3">
        {state.error && <span className="text-sm font-bold text-berry">{state.error}</span>}
        <button type="submit" disabled={pending} className="btn bg-berry text-white">
          {pending ? "탈퇴하는 중..." : "회원 탈퇴"}
        </button>
      </div>
    </form>
  );
}
