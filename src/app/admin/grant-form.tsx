"use client";

import { useActionState } from "react";
import { adminGrant, type GrantState } from "./actions";

type Member = { userId: string; label: string };

/** 관리자 지급: 코인·경험치를 회원에게 준다. [최대]를 고르면 숫자 칸은 쓰지 않는다 */
export function AdminGrantForm({ members, defaultUserId }: { members: Member[]; defaultUserId?: string }) {
  const [state, action, pending] = useActionState<GrantState, FormData>(adminGrant, {});
  const input = "w-full rounded-xl border border-line bg-paper px-3 py-2 outline-none focus:border-sun";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end" data-admin-grant>
      <label className="block">
        <span className="mb-1 block text-sm font-bold">받을 주민</span>
        <select name="userId" defaultValue={defaultUserId} required className={input}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">🪙 코인</span>
          <input name="coins" type="number" min={0} step={1} placeholder="0" className={input} />
        </label>
        <label className="mt-1 flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="maxCoins" /> 최대 (999,999까지)
        </label>
      </div>
      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">✨ 경험치</span>
          <input name="exp" type="number" min={0} step={1} placeholder="0" className={input} />
        </label>
        <label className="mt-1 flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="maxExp" /> 최대 (Lv.99까지)
        </label>
      </div>
      <button disabled={pending} className="btn btn-accent sm:mb-7">
        {pending ? "주는 중..." : "🎁 지급"}
      </button>
      {(state.error || state.ok) && (
        <p className={`text-sm sm:col-span-4 ${state.error ? "text-berry" : "text-leaf-dark"}`} data-grant-result>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}
