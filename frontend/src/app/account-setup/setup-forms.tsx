"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { useT } from "@/components/i18n";
import { api, errorText } from "@/lib/api";

type SetupState = { error?: string; values?: { username: string } };

/**
 * 아이디 만들기(/setup/new)·합치기(/setup/link) API를 부르고, 끝나면 서버가 알려 준 곳으로 간다.
 * 로그인 쿠키는 서버 응답이 바꿔 두므로 화면은 새로 그리기만 한다
 */
function useSetupAction(path: "/account/setup/new" | "/account/setup/link", fields: string[]) {
  const t = useT();
  const router = useRouter();
  return useActionState<SetupState, FormData>(async (_prev, form) => {
    const body = Object.fromEntries(fields.map((k) => [k, String(form.get(k) ?? "")]));
    const values = { username: body.username };
    try {
      const done = await api<{ ok: true; redirect: string }>(path, { method: "POST", body });
      router.push(done.redirect);
      router.refresh();
      return { values };
    } catch (e) {
      return { error: errorText(t, e), values };
    }
  }, {});
}

const input = "w-full rounded-xl border-2 border-line bg-paper px-3 py-2.5 outline-none focus:border-sun";

function NewLoginForm() {
  const [state, action, pending] = useSetupAction("/account/setup/new", ["username", "password", "passwordConfirm"]);
  const t = useT();
  return (
    <form action={action} className="space-y-3">
      <div>
        <input name="username" defaultValue={state.values?.username} placeholder={t("아이디")} autoComplete="username" required minLength={4} maxLength={20} className={input} aria-label={t("아이디")} />
        <p className="mt-1 text-xs text-ink-soft">{t("영문 소문자, 숫자, _ 로 4~20자")}</p>
      </div>
      <input name="password" type="password" placeholder={t("비밀번호 (8자 이상)")} autoComplete="new-password" required minLength={8} maxLength={64} className={input} aria-label={t("비밀번호")} />
      <input name="passwordConfirm" type="password" placeholder={t("비밀번호 확인")} autoComplete="new-password" required className={input} aria-label={t("비밀번호 확인")} />
      {state.error && <p role="alert" className="text-sm font-bold text-berry">{state.error}</p>}
      <button disabled={pending} className="btn w-full bg-sun py-3 text-ink">
        {pending ? t("만드는 중...") : t("아이디 만들기")}
      </button>
    </form>
  );
}

function ExistingLoginForm({ providerLabel }: { providerLabel: string }) {
  const [state, action, pending] = useSetupAction("/account/setup/link", ["username", "password"]);
  const t = useT();
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-soft">{t("쓰던 아이디로 확인하면 {provider} 로그인을 그 아이디에 이어 붙여요.", { provider: providerLabel })}</p>
      <input name="username" defaultValue={state.values?.username} placeholder={t("아이디")} autoComplete="username" required className={input} aria-label={t("아이디")} />
      <input name="password" type="password" placeholder={t("비밀번호")} autoComplete="current-password" required className={input} aria-label={t("비밀번호")} />
      {state.error && <p role="alert" className="text-sm font-bold text-berry">{state.error}</p>}
      <button disabled={pending} className="btn w-full bg-leaf py-3 text-white">
        {pending ? t("확인하는 중...") : t("내 아이디에 합치기")}
      </button>
    </form>
  );
}

/** [새로 시작해요] / [이미 아이디가 있어요] 두 갈래. 주민 등록을 마친 회원은 합치기 없이 아이디 만들기만 */
export function SetupForms({ providerLabel, canMerge }: { providerLabel: string; canMerge: boolean }) {
  const [tab, setTab] = useState<"new" | "existing">("new");
  const t = useT();
  if (!canMerge) return <NewLoginForm />;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-cream p-1" role="tablist">
        {(["new", "existing"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-lg py-2 font-bold ${tab === k ? "bg-paper text-ink shadow-sm" : "text-ink-soft"}`}
          >
            {k === "new" ? t("새로 시작해요") : t("이미 아이디가 있어요")}
          </button>
        ))}
      </div>
      {tab === "new" ? <NewLoginForm /> : <ExistingLoginForm providerLabel={providerLabel} />}
    </div>
  );
}
