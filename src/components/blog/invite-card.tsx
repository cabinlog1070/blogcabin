"use client";

import { useEffect, useState } from "react";
import { INVITE_REWARD_COINS, inviteLink } from "@/lib/invite";

/** 🎁 친구 초대 카드 (GAME-09): 내 블로그 홈에서 주인에게만. 코드와 [초대 링크 복사] */
export function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    const link = inviteLink(window.location.origin, code);
    try {
      await navigator.clipboard.writeText(link);
      setCopied("ok");
    } catch {
      // 클립보드를 쓸 수 없는 환경 (권한 없음 등): 링크를 직접 보여 준다
      window.prompt("초대 링크를 복사해 주세요", link);
      setCopied("fail");
    }
  }

  return (
    <section className="card border-sun bg-honey p-4" aria-label="친구 초대" data-invite-card>
      <h2 className="font-display text-lg">🎁 친구 초대</h2>
      <p className="mt-1 text-sm">
        내 초대 코드: <b className="font-mono text-base tracking-widest" data-invite-code>{code}</b>
      </p>
      <button type="button" onClick={copy} className="btn mt-2 w-full bg-sun py-1.5 text-sm text-ink">
        초대 링크 복사
      </button>
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-center text-sm font-bold text-leaf-dark">
        {copied === "ok" ? "초대 링크를 복사했어요" : null}
      </p>
      <p className="text-xs text-ink-soft">
        친구가 이 코드로 가입해 100자 이상 공개 글을 처음 쓰면 둘 다 🪙 {INVITE_REWARD_COINS}을 받아요
      </p>
    </section>
  );
}
