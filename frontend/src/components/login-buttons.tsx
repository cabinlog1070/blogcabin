"use client";

import { useActionState, useState } from "react";
import { api, errorText } from "@/lib/api";
import { useT } from "@/components/i18n";
import { authClient } from "@/lib/auth-client";
import { msg, type T } from "@/lib/i18n";

type Providers = { google: boolean; kakao: boolean; naver: boolean };

const SOCIAL = [
  { id: "kakao", label: msg("카카오"), className: "bg-[#FEE500] text-[#191919]" },
  { id: "naver", label: msg("네이버"), className: "bg-[#03C75A] text-white" },
  { id: "google", label: "Google", className: "bg-white text-ink border-2 border-line" },
] as const;

type AuthFormState = { error?: string; values?: { username: string } };

/** 가입·로그인 API를 부르고, 되면 그 화면으로 새로 연다 (로그인 쿠키가 바뀌어 헤더까지 다시 그려야 해서) */
async function submitLogin(t: T, path: "/login/sign-in" | "/login/sign-up", formData: FormData): Promise<AuthFormState> {
  const body = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  try {
    const { redirect } = await api<{ redirect: string }>(path, { method: "POST", body });
    window.location.assign(redirect);
    return { values: { username: body.username ?? "" } };
  } catch (err) {
    return { error: errorText(t, err), values: { username: body.username ?? "" } };
  }
}

const input = "w-full rounded-xl border-2 border-line bg-paper px-3 py-2.5 outline-none focus:border-sun";

function SignInForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AuthFormState, FormData>((_prev, formData) => submitLogin(t, "/login/sign-in", formData), {});
  return (
    <form action={action} className="space-y-3">
      <input name="username" defaultValue={state.values?.username} placeholder={t("아이디")} autoComplete="username" required className={input} aria-label={t("아이디")} />
      <input name="password" type="password" placeholder={t("비밀번호")} autoComplete="current-password" required className={input} aria-label={t("비밀번호")} />
      {state.error && <p className="text-sm font-bold text-berry">{state.error}</p>}
      <button disabled={pending} className="btn w-full bg-leaf py-3 text-white">
        {pending ? t("들어가는 중...") : t("로그인")}
      </button>
      {/* 가입할 때 이메일을 받지 않아서 재설정 메일이 없다: 연동한 소셜로 들어가 바꾸거나 관리자에게 문의 (backend/src/account/password.ts) */}
      <details className="text-sm" data-forgot-password>
        <summary className="cursor-pointer text-center text-ink-soft underline">{t("비밀번호를 잊었나요?")}</summary>
        <div className="mt-2 space-y-1 break-keep rounded-xl bg-cream p-3 text-ink-soft">
          <p>{t("카카오·구글을 연동해 두었다면 아래 간편 로그인으로 들어간 뒤, 내 얼굴 메뉴의 [환경 설정] → [비밀번호 바꾸기]에서 새 비밀번호를 정할 수 있어요.")}</p>
          <p>
            {t("연동하지 않았다면 문의하기의 메일로 아이디·닉네임·블로그 이름을 알려 주세요. 관리자가 본인인지 확인한 뒤 임시 비밀번호를 답장해 드려요.")}{" "}
            <a href="/support" className="font-bold text-leaf-dark underline">{t("문의하기")}</a>
          </p>
        </div>
      </details>
    </form>
  );
}

function SignUpForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AuthFormState, FormData>((_prev, formData) => submitLogin(t, "/login/sign-up", formData), {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <input name="username" defaultValue={state.values?.username} placeholder={t("아이디")} autoComplete="username" required minLength={4} maxLength={20} className={input} aria-label={t("아이디")} />
        <p className="mt-1 text-xs text-ink-soft">{t("영문 소문자, 숫자, _ 로 4~20자")}</p>
      </div>
      <input name="password" type="password" placeholder={t("비밀번호 (8자 이상)")} autoComplete="new-password" required minLength={8} maxLength={64} className={input} aria-label={t("비밀번호")} />
      <input name="passwordConfirm" type="password" placeholder={t("비밀번호 확인")} autoComplete="new-password" required className={input} aria-label={t("비밀번호 확인")} />
      {state.error && <p className="text-sm font-bold text-berry">{state.error}</p>}
      <button disabled={pending} className="btn w-full bg-sun py-3 text-ink">
        {pending ? t("가입하는 중...") : t("회원가입")}
      </button>
      {/* 비밀번호를 잊으면 연동한 소셜로만 혼자 되찾을 수 있어서, 가입하는 사람에게 연동을 부탁한다 */}
      <p className="break-keep rounded-xl bg-cream p-3 text-sm text-ink-soft" data-signup-link-hint>
        {t("가입한 뒤 오른쪽 위 내 얼굴 메뉴의 [로그인 수단]에서 카카오나 구글을 꼭 연동해 주세요. 비밀번호를 잊어도 연동한 계정으로 로그인해서 새 비밀번호를 정할 수 있어요. (연동하면 🪙 100도 받아요)")}
      </p>
    </form>
  );
}

export function LoginButtons({ providers }: { providers: Providers }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const t = useT();
  const anySocial = providers.google || providers.kakao || providers.naver;
  const shown = anySocial ? SOCIAL.filter((p) => providers[p.id]) : SOCIAL;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-cream p-1" role="tablist">
        {(["signin", "signup"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-lg py-2 font-bold ${tab === k ? "bg-paper text-ink shadow-sm" : "text-ink-soft"}`}
          >
            {k === "signin" ? t("로그인") : t("회원가입")}
          </button>
        ))}
      </div>

      {tab === "signin" ? <SignInForm /> : <SignUpForm />}

      <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        {t("간편 로그인")}
        <span className="h-px flex-1 bg-line" />
      </div>
      {/* 켜진 소셜만 보인다 (아무것도 안 켜졌으면 세 개를 흐리게 두고 준비 중이라고 알린다) */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!providers[p.id]}
            title={providers[p.id] ? t("{name}로 시작하기", { name: t(p.label) }) : t("아직 연결 준비 중이에요")}
            className={`btn py-2.5 text-sm ${p.className}`}
            onClick={() => authClient.signIn.social({ provider: p.id, callbackURL: "/town" })}
          >
            {t(p.label)}
          </button>
        ))}
      </div>
      {!anySocial && <p className="mt-2 text-center text-xs text-ink-soft">{t("간편 로그인은 준비 중이에요")}</p>}
    </div>
  );
}
