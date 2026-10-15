"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useT } from "@/components/i18n";
import { errorText } from "@/lib/api";
import { adminApi } from "../admin-api";

/** 관리자 강제 탈퇴 버튼: 확인 창을 한 번 거친 뒤 회원을 지운다 */
export function AdminWithdrawButton({ userId, name }: { userId: string; name: string }) {
  const t = useT();
  const router = useRouter();
  const [state, action, pending] = useActionState<{ error?: string }, FormData>(async () => {
    try {
      const done = await adminApi.withdrawMember(userId);
      router.push(`/admin/members?withdrawn=${encodeURIComponent(done.name ?? t("회원"))}`);
      router.refresh();
      return {};
    } catch (e) {
      return { error: errorText(t, e) };
    }
  }, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t("{name}님을 강제 탈퇴시킬까요? 블로그·글·코인 기록·로그인 정보가 모두 지워지고 되돌릴 수 없어요.", { name }))) e.preventDefault();
      }}
      data-admin-withdraw
    >
      <button type="submit" disabled={pending} className="btn bg-berry text-white">
        {pending ? t("탈퇴시키는 중...") : t("강제 탈퇴")}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-berry">
          {state.error}
        </p>
      )}
    </form>
  );
}
