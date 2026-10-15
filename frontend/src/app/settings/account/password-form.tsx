"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { api, errorText } from "@/lib/api";

const input = "w-full rounded-xl border-2 border-line bg-paper px-3 py-2 outline-none focus:border-leaf";

/**
 * 비밀번호 바꾸기 (블로그 관리). 서버: POST /api/v1/account/password (backend/src/account/password.ts)
 * skipCurrent: 연동한 소셜로 방금 로그인해서 지금 비밀번호 칸을 비워도 되는지 (비밀번호를 잊은 회원)
 */
export function PasswordForm({ skipCurrent }: { skipCurrent: boolean }) {
  const t = useT();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  // 알림은 3초 뒤에 사라진다
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 3000);
    return () => clearTimeout(id);
  }, [done]);

  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = {
          currentPassword: String(f.get("currentPassword") ?? ""),
          newPassword: String(f.get("newPassword") ?? ""),
          newPasswordConfirm: String(f.get("newPasswordConfirm") ?? ""),
        };
        setError("");
        setDone(false);
        start(async () => {
          try {
            await api("/account/password", { method: "POST", body });
          } catch (err) {
            setError(errorText(t, err));
            return;
          }
          form.current?.reset();
          setDone(true);
        });
      }}
      className="space-y-3"
      data-password-form
    >
      <label className="block">
        <span className="mb-1 block text-sm font-bold">{t("지금 비밀번호")}</span>
        <input name="currentPassword" type="password" autoComplete="current-password" required={!skipCurrent} className={input} />
        {skipCurrent && (
          <span className="mt-1 block text-xs text-leaf-dark" data-skip-current>
            {t("소셜 로그인으로 방금 들어와서 지금 비밀번호를 몰라도 바꿀 수 있어요.")}
          </span>
        )}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold">{t("새 비밀번호 (8자 이상)")}</span>
        <input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={64} className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold">{t("새 비밀번호 확인")}</span>
        <input name="newPasswordConfirm" type="password" autoComplete="new-password" required className={input} />
      </label>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && <span role="alert" className="text-sm font-bold text-berry">{error}</span>}
        {done && <span role="status" className="text-sm font-bold text-leaf-dark">{t("비밀번호를 바꿨어요. 다른 기기에서는 로그아웃됐어요.")}</span>}
        <button type="submit" disabled={pending} className="btn bg-leaf text-white">
          {pending ? t("바꾸는 중...") : t("비밀번호 바꾸기")}
        </button>
      </div>
    </form>
  );
}
