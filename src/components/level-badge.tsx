"use client";

// 헤더 레벨 배지 (GAME-02). 누르면 이번 레벨 경험치와 다음 레벨까지 남은 경험치를 작은 창으로 보여준다
import Link from "next/link";
import { PopoverPanel, useHeaderPopover } from "@/components/header-popover";

/** getWallet()의 레벨 부분 (levelProgress) + 누적 경험치 */
export type LevelInfo = { level: number; exp: number; current: number; needed: number; ratio: number; isMax: boolean };

export function LevelBadge({ level, exp, current, needed, ratio, isMax }: LevelInfo) {
  const { open, box, setAnchor, setPanel, toggle, close } = useHeaderPopover(256); // 16rem
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="레벨"
        data-level-button
        // 좁은 화면에서도 레벨이 보이게 글씨와 여백만 줄인다 (GAME-02, 이슈 #5)
        className="whitespace-nowrap rounded-full bg-paper px-1.5 py-1 text-xs font-bold shadow-sm hover:text-leaf-dark sm:px-2.5 sm:text-sm"
      >
        Lv.{level}
      </button>

      <PopoverPanel open={open} box={box} panelRef={setPanel} label="경험치" className="p-4" data-level-popover>
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-2xl">Lv.{level}</p>
          {isMax ? (
            <span className="rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-ink">🏆 최고 레벨</span>
          ) : (
            <span className="text-xs text-ink-soft">다음은 Lv.{level + 1}</span>
          )}
        </div>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-cream"
          role="progressbar"
          aria-label={isMax ? "최고 레벨" : "다음 레벨까지"}
          aria-valuemin={0}
          aria-valuemax={isMax ? 1 : needed}
          aria-valuenow={isMax ? 1 : current}
        >
          <div className="h-full rounded-full bg-leaf" style={{ width: `${pct}%` }} />
        </div>
        {isMax ? (
          <p className="mt-2 break-keep text-sm font-bold">최고 레벨이에요! 경험치는 계속 쌓여요</p>
        ) : (
          <>
            <p className="mt-2 text-sm font-bold" data-level-exp>
              {current.toLocaleString()} / {needed.toLocaleString()} EXP
            </p>
            <p className="text-xs text-ink-soft">다음 레벨까지 {(needed - current).toLocaleString()} EXP 남았어요</p>
          </>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-line pt-2 text-xs">
          <span className="text-ink-soft">누적 경험치 ✨ {exp.toLocaleString()}</span>
          <Link href="/wallet" onClick={close} className="font-bold text-leaf-dark hover:underline">
            내역 보기 →
          </Link>
        </div>
      </PopoverPanel>
    </>
  );
}
