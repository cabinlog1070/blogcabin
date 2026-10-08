import { iconDataUri, type IconName } from "@/lib/art/icons";

/** 코드로 그린 UI 아이콘 (이모지 대신). title을 주면 스크린 리더가 읽고, 없으면 꾸밈 그림으로 숨긴다 */
export function Icon({ name, size = 20, className = "", title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 최적화가 필요 없다
    <img
      src={iconDataUri(name, size * 2)}
      alt={title ?? ""}
      title={title}
      width={size}
      height={size}
      draggable={false}
      className={`inline-block shrink-0 select-none align-middle ${className}`}
      aria-hidden={title ? undefined : true}
    />
  );
}
