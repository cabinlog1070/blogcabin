"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { api } from "@/lib/api";

/** 회원 탈퇴 (AUTH-06): 아이디 회원은 비밀번호 다시 입력 + 확인 창, 소셜 회원은 확인 창 */
export function WithdrawForm({
  needsPassword,
  confirmMessage,
  label,
}: {
  needsPassword: boolean;
  confirmMessage?: string;
  label?: string;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();
  const confirmText = confirmMessage ?? t("정말 탈퇴할까요? 블로그·글·코인 기록이 모두 지워지고 되돌릴 수 없어요.");
  const buttonLabel = label ?? t("회원 탈퇴");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm(confirmText)) return;
        const password = String(new FormData(e.currentTarget).get("password") ?? "");
        start(async () => {
          try {
            await api("/account/withdraw", { method: "POST", body: { password } });
          } catch (err) {
            setError(err instanceof Error ? err.message : "");
            return;
          }
          // 로그인 쿠키가 지워졌으니 첫 화면으로 가서 헤더까지 새로 그린다
          router.replace("/?withdrawn=1");
          router.refresh();
        });
      }}
      className="space-y-3"
      data-withdraw-form
    >
      {needsPassword && (
        <label className="block">
          <span className="mb-1 block text-sm font-bold">{t("비밀번호 확인")}</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-xl border-2 border-line bg-paper px-3 py-2 outline-none focus:border-berry"
          />
        </label>
      )}
      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-sm font-bold text-berry">{t(error)}</span>}
        <button type="submit" disabled={pending} className="btn bg-berry text-white">
          {pending ? t("지우는 중...") : buttonLabel}
        </button>
      </div>
    </form>
  );
}
