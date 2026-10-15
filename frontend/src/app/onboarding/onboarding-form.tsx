"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { CharacterArt } from "@/components/character";
import { useT } from "@/components/i18n";
import { api, ApiError, errorText } from "@/lib/api";

type Field = "nickname" | "blogTitle" | "slug" | "characterId" | "inviteCode";
type OnboardingState = {
  errors?: Partial<Record<Field, string>>;
  message?: string;
  values?: Record<string, string>;
};
const FIELDS: Field[] = ["nickname", "blogTitle", "slug", "characterId", "inviteCode"];

type Starter = { id: number; name: string; description: string | null; assetKey: string };

function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-berry">{error}</span> : hint && <span className="mt-1 block text-sm text-ink-soft">{hint}</span>}
    </label>
  );
}

const inputClass = "w-full rounded-xl border-2 border-line bg-paper px-3 py-2.5 outline-none focus:border-sun";

export function OnboardingForm({
  starters,
  defaultNickname,
  defaultInviteCode,
}: {
  starters: Starter[];
  defaultNickname: string;
  defaultInviteCode: string;
}) {
  const t = useT();
  const router = useRouter();
  // 주민 등록 API (POST /api/v1/onboarding). 틀린 칸은 칸 아래에, 적은 값은 그대로 다시 채운다
  const [state, action, pending] = useActionState<OnboardingState, FormData>(async (_prev, form) => {
    const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "")]));
    try {
      await api("/onboarding", { method: "POST", body: values });
      router.push("/town?welcome=1");
      router.refresh(); // 헤더에 코인·캐릭터가 바로 보이도록
      return { values };
    } catch (e) {
      if (e instanceof ApiError && e.redirect) {
        router.push(e.redirect);
        return { values };
      }
      if (e instanceof ApiError && e.fields) {
        const errors = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, t(v)]));
        return { errors, values };
      }
      return { message: errorText(t, e), values };
    }
  }, {});
  const v = state.values ?? {};
  // 블로그 이름 예시는 닉네임 칸에 적는 이름을 따라간다 (비우면 "나")
  const [nickname, setNickname] = useState(v.nickname ?? defaultNickname);
  const exampleName = nickname.trim() || t("나");

  return (
    <form action={action} className="card mt-6 space-y-6 p-6">
      <Field label={t("닉네임")} error={state.errors?.nickname} hint={t("마을에서 불릴 이름 (2~12자)")}>
        <input
          name="nickname"
          defaultValue={v.nickname ?? defaultNickname}
          onChange={(e) => setNickname(e.target.value)}
          className={inputClass}
          maxLength={12}
          required
        />
      </Field>

      <Field label={t("블로그 이름")} error={state.errors?.blogTitle} hint={t("12자까지 쓸 수 있어요")}>
        <input name="blogTitle" defaultValue={v.blogTitle ?? ""} placeholder={t("예: {name}의 블로그", { name: exampleName })} className={inputClass} maxLength={12} required />
      </Field>

      <Field label={t("블로그 주소")} error={state.errors?.slug} hint={t("영문 소문자, 숫자, _ 로 3~12자까지 쓸 수 있어요")}>
        <div className="flex items-center rounded-xl border-2 border-line bg-paper focus-within:border-sun">
          <span className="pl-3 text-ink-soft">blogcabin/@</span>
          <input name="slug" defaultValue={v.slug ?? ""} placeholder="myblog" className="w-full bg-transparent px-1 py-2.5 outline-none" maxLength={12} required />
        </div>
      </Field>

      <fieldset>
        <legend className="mb-1 font-bold">{t("내 캐릭터")}</legend>
        <p className="mb-2 text-sm text-ink-soft">{t("시작할 캐릭터를 골라 주세요. 동물 농장에서 동물을 키우며 레벨을 올려 보세요.")}</p>
        <p className="mb-2 text-sm font-bold text-leaf-dark">{t("나중에 다시 정할 수 있어요")}</p>
        <div className="grid grid-cols-2 gap-3">
          {starters.map((c, i) => (
            <label key={c.id} className="cursor-pointer">
              <input
                type="radio"
                name="characterId"
                value={c.id}
                defaultChecked={v.characterId ? Number(v.characterId) === c.id : i === 0}
                className="peer sr-only"
              />
              <span className="flex flex-col items-center rounded-2xl border-2 border-line bg-paper p-4 text-center transition peer-checked:border-sun peer-checked:bg-honey peer-checked:shadow-[0_4px_0_0_var(--color-sun-dark)] peer-focus-visible:ring-2 peer-focus-visible:ring-sky">
                <CharacterArt asset={c.assetKey} size={96} />
                <span className="mt-2 font-display text-lg">{t(c.name)}</span>
                <span className="text-xs text-ink-soft">{c.description && t(c.description)}</span>
              </span>
            </label>
          ))}
        </div>
        {state.errors?.characterId && <p className="mt-1 text-sm text-berry">{state.errors.characterId}</p>}
      </fieldset>

      {/* 친구 초대 (GAME-09): 초대 링크로 왔으면 채워져 있다. 비우면 초대 없이 가입 */}
      <Field label={t("초대 코드 (선택)")} error={state.errors?.inviteCode} hint={t("친구에게 받은 6자리 코드가 있으면 적어 주세요")}>
        <input
          name="inviteCode"
          defaultValue={v.inviteCode ?? defaultInviteCode}
          placeholder={t("예: ABC234")}
          className={`${inputClass} uppercase tracking-widest`}
          maxLength={6}
          autoComplete="off"
        />
      </Field>

      {state.message && (
        <p role="alert" className="text-sm font-bold text-berry">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn w-full bg-leaf py-3 text-lg text-white">
        {pending ? t("등록하는 중...") : t("광장으로 출발! 🚀")}
      </button>
      <p className="text-center text-sm text-ink-soft">{t("가입 축하 선물로 🪙 100 코인을 드려요")}</p>
    </form>
  );
}
