"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AttendResult } from "@backend/routes/attendance";
import { useT } from "@/components/i18n";
import { api, ApiError } from "@/lib/api";

type AttendState = { status: "idle" } | { status: "error"; error: string } | AttendResult;

export function AttendButton({ attended }: { attended: boolean }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<AttendState>({ status: "idle" });
  const [pending, start] = useTransition();

  const attend = () =>
    start(async () => {
      try {
        setState(await api<AttendResult>("/attendance", { method: "POST" }));
        router.refresh(); // 헤더의 코인·레벨을 새로 그린다
      } catch (e) {
        if (e instanceof ApiError && e.redirect) return router.push(e.redirect);
        setState({ status: "error", error: e instanceof Error ? e.message : "" });
      }
    });

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
    <div>
      <button type="button" onClick={attend} disabled={pending} className="btn bg-berry px-10 py-4 text-xl text-white">
        {pending ? t("편지 여는 중...") : t("📮 출석하고 보상 받기")}
      </button>
      {state.status === "error" && <p className="mt-2 text-sm font-bold text-berry">{t(state.error)}</p>}
    </div>
  );
}
