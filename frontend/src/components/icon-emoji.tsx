import { Icon } from "@/components/icon";
import type { IconName } from "@/lib/art/icons";

/**
 * 그림 아이콘 + 원래 이모지를 크기 0인 글자로 남긴다.
 * 화면에는 그림만 보이고, 글자로 읽는 곳(스크린 리더, e2e의 innerText·접근 이름 검사)은 예전처럼 "🪑 가구"를 읽는다.
 * sr-only(position:absolute)는 innerText에 줄바꿈을 끼워 넣어서, 크기 0인 inline-block으로 숨긴다.
 */
export function IconEmoji({ name, emoji, size, className }: { name: IconName; emoji: string; size?: number; className?: string }) {
  return (
    <>
      <Icon name={name} size={size} className={className} />
      <span className="inline-block h-0 w-0 overflow-hidden">{emoji}</span>
    </>
  );
}
