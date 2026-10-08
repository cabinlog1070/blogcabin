"use client";

import { useActionState, useState } from "react";
import { CharacterArt } from "@/components/character";
import { completeOnboarding, type OnboardingState } from "./actions";

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
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const v = state.values ?? {};
  // 블로그 이름 예시는 닉네임 칸에 적는 이름을 따라간다 (비우면 "나")
  const [nickname, setNickname] = useState(v.nickname ?? defaultNickname);
  const exampleName = nickname.trim() || "나";

  return (
    <form action={action} className="card mt-6 space-y-6 p-6">
      <Field label="닉네임" error={state.errors?.nickname} hint="마을에서 불릴 이름 (2~12자)">
        <input
          name="nickname"
          defaultValue={v.nickname ?? defaultNickname}
          onChange={(e) => setNickname(e.target.value)}
          className={inputClass}
          maxLength={12}
          required
        />
      </Field>

      <Field label="블로그 이름" error={state.errors?.blogTitle}>
        <input name="blogTitle" defaultValue={v.blogTitle ?? ""} placeholder={`예: ${exampleName}의 블로그`} className={inputClass} maxLength={40} required />
      </Field>

      <Field label="블로그 주소" error={state.errors?.slug} hint="영문 소문자, 숫자, _ (3~20자)">
        <div className="flex items-center rounded-xl border-2 border-line bg-paper focus-within:border-sun">
          <span className="pl-3 text-ink-soft">blogcabin/@</span>
          <input name="slug" defaultValue={v.slug ?? ""} placeholder="myblog" className="w-full bg-transparent px-1 py-2.5 outline-none" maxLength={20} required />
        </div>
      </Field>

      <fieldset>
        <legend className="mb-1 font-bold">내 캐릭터</legend>
        <p className="mb-2 text-sm text-ink-soft">남자·여자 중 하나를 골라 주세요. 동물 농장에서 동물을 키우며 레벨을 올려 보세요.</p>
        <p className="mb-2 text-sm font-bold text-berry">⚠️ 한 번 고르면 바꿀 수 없어요</p>
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
                <span className="mt-2 font-display text-lg">{c.name}</span>
                <span className="text-xs text-ink-soft">{c.description}</span>
              </span>
            </label>
          ))}
        </div>
        {state.errors?.characterId && <p className="mt-1 text-sm text-berry">{state.errors.characterId}</p>}
      </fieldset>

      {/* 친구 초대 (GAME-09): 초대 링크로 왔으면 채워져 있다. 비우면 초대 없이 가입 */}
      <Field label="초대 코드 (선택)" error={state.errors?.inviteCode} hint="친구에게 받은 6자리 코드가 있으면 적어 주세요">
        <input
          name="inviteCode"
          defaultValue={v.inviteCode ?? defaultInviteCode}
          placeholder="예: ABC234"
          className={`${inputClass} uppercase tracking-widest`}
          maxLength={6}
          autoComplete="off"
        />
      </Field>

      <button type="submit" disabled={pending} className="btn w-full bg-leaf py-3 text-lg text-white">
        {pending ? "등록하는 중..." : "광장으로 출발! 🚀"}
      </button>
      <p className="text-center text-sm text-ink-soft">가입 축하 선물로 🪙 100 코인을 드려요</p>
    </form>
  );
}
