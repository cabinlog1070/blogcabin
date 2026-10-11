"use client";

import { useActionState } from "react";
import { adminWithdrawMember, type WithdrawMemberState } from "../actions";

/** 관리자 강제 탈퇴 버튼: 확인 창을 한 번 거친 뒤 회원을 지운다 */
export function AdminWithdrawButton({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState<WithdrawMemberState, FormData>(adminWithdrawMember, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`${name}님을 강제 탈퇴시킬까요? 블로그·글·코인 기록·로그인 정보가 모두 지워지고 되돌릴 수 없어요.`)) e.preventDefault();
      }}
      data-admin-withdraw
    >
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className="btn bg-berry text-white">
        {pending ? "탈퇴시키는 중..." : "강제 탈퇴"}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-berry">
          {state.error}
        </p>
      )}
    </form>
  );
}
