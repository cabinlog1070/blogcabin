/** 상점·꾸미기 화면에 고정으로 보이는 안내 (캐릭터는 가입할 때 정해진다) */
export function CharacterNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-xl border-2 border-dashed border-line bg-white/70 px-4 py-2 text-sm text-ink-soft ${className}`}>
      <span aria-hidden>ℹ️ </span>캐릭터는 가입할 때 고른 남자·여자 주민으로 정해지고, 바꿀 수 없어요. 옷과 소품으로 꾸며 보세요.
    </p>
  );
}
