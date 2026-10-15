"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useT } from "@/components/i18n";
import { Icon } from "@/components/icon";
import { errorText } from "@/lib/api";
import { adminApi } from "./admin-api";

type GrantState = { error?: string; ok?: string };

type Member = { userId: string; label: string };

/** 관리자 지급: 코인·경험치를 회원에게 준다. [최대]를 고르면 숫자 칸은 쓰지 않는다 */
export function AdminGrantForm({ members, defaultUserId }: { members: Member[]; defaultUserId?: string }) {
  const t = useT();
  const router = useRouter();
  const [state, action, pending] = useActionState<GrantState, FormData>(async (_prev, form) => {
    try {
      const done = await adminApi.grant({
        userId: String(form.get("userId") ?? ""),
        coins: String(form.get("coins") ?? ""),
        exp: String(form.get("exp") ?? ""),
        maxCoins: form.get("maxCoins") === "on",
        maxExp: form.get("maxExp") === "on",
      });
      router.refresh(); // 나에게 줬으면 헤더의 코인·레벨도 바뀐다
      const parts = [done.coins ? `🪙 ${done.coins.toLocaleString()}` : "", done.exp ? t("경험치 {n}", { n: done.exp.toLocaleString() }) : ""].filter(Boolean);
      return {
        ok: t("{nickname}님에게 {rewards}을 줬어요 (Lv.{level}, 🪙 {coins})", {
          nickname: done.nickname,
          rewards: parts.join(", "),
          level: done.level,
          coins: done.balance.toLocaleString(),
        }),
      };
    } catch (e) {
      return { error: errorText(t, e) };
    }
  }, {});
  const input = "w-full rounded-xl border border-line bg-paper px-3 py-2 outline-none focus:border-sun";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end" data-admin-grant>
      <label className="block">
        <span className="mb-1 block text-sm font-bold">{t("받을 주민")}</span>
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
          <span className="mb-1 block text-sm font-bold">
            <Icon name="coin" size={18} /> {t("코인")}
          </span>
          <input name="coins" type="number" min={0} step={1} placeholder="0" className={input} />
        </label>
        <label className="mt-1 flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="maxCoins" /> {t("최대 (999,999까지)")}
        </label>
      </div>
      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">
            <Icon name="exp" size={18} /> {t("경험치")}
          </span>
          <input name="exp" type="number" min={0} step={1} placeholder="0" className={input} />
        </label>
        <label className="mt-1 flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="maxExp" /> {t("최대 (Lv.99까지)")}
        </label>
      </div>
      <button disabled={pending} className="btn btn-accent sm:mb-7">
        {pending ? (
          t("주는 중...")
        ) : (
          <>
            <Icon name="achievement" size={18} /> {t("지급")}
          </>
        )}
      </button>
      {(state.error || state.ok) && (
        <p className={`text-sm sm:col-span-4 ${state.error ? "text-berry" : "text-leaf-dark"}`} data-grant-result>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}
