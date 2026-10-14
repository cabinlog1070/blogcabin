import { getT } from "@/server/i18n";

/** 상점에 고정으로 보이는 안내: 헤어를 바꾸는 것이 곧 캐릭터 모습을 바꾸는 것 (2026-10-13). 서버 컴포넌트 */
export async function CharacterNotice({ className = "" }: { className?: string }) {
  const t = await getT();
  return (
    <p className={`rounded-xl border-2 border-dashed border-line bg-white/70 px-4 py-2 text-sm text-ink-soft ${className}`}>
      <span aria-hidden>ℹ️ </span>
      {t("헤어와 옷, 소품을 입어 보고 [저장하기]를 누르면 내 캐릭터가 그 모습이 돼요.")}
    </p>
  );
}
