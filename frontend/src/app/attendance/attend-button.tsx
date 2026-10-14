"use client";

import { useActionState } from "react";
import { useT } from "@/components/i18n";
import { attend, type AttendState } from "./actions";

export function AttendButton({ attended }: { attended: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<AttendState>(attend, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="text-center">
        <p className="animate-bounce text-6xl">🎁</p>
        <p className="mt-2 font-display text-2xl">{t("출석 완료! {n}일 연속", { n: state.streak })}</p>
        <p className="mt-1 font-bold text-leaf-dark">
          {t("✨ 경험치 {exp} · 🪙 {coins}", { exp: state.exp, coins: state.coins })} {state.bonus && t("(7일 연속 보너스 포함!)")}
        </p>
      </div>
    );
  }
  if (attended || state.status === "already") {
    return <p className="font-display text-2xl text-ink-soft">{t("✅ 오늘은 이미 출석했어요. 내일 또 만나요!")}</p>;
  }
  return (
    <form action={action}>
      <button disabled={pending} className="btn bg-berry px-10 py-4 text-xl text-white">
        {pending ? t("편지 여는 중...") : t("📮 출석하고 보상 받기")}
      </button>
    </form>
  );
}
