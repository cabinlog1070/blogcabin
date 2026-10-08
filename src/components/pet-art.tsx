import type { CSSProperties } from "react";
import { animalSvg, toAnimalDataUri } from "@/lib/art/animals";
import { formatMetDate, type AnimalStage, type PetAccessory } from "@/lib/farm";

/** 농장 펫 그림 (코드로 그린 SVG). 꾸미기(리본·꽃·스카프)를 함께 그린다 */
export function PetArt({
  assetKey,
  stage,
  accessory = "none",
  size = 64,
  className = "",
  style,
}: {
  assetKey: string;
  stage: AnimalStage;
  accessory?: PetAccessory;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 최적화가 필요 없다
    <img
      src={toAnimalDataUri(animalSvg(assetKey, stage, size * 2, accessory))}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={style}
      aria-hidden
    />
  );
}

/** 다 키운 동물 카드 (카드 도감, 블로그 프로필 전시) */
export function PetCard({
  pet,
  speciesName,
  grownAt,
  size = "md",
  className = "",
}: {
  pet: { name: string; assetKey: string; accessory: PetAccessory; level: number };
  speciesName?: string;
  grownAt?: Date | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const art = size === "sm" ? 60 : 84;
  return (
    <div
      className={`relative flex flex-col items-center rounded-2xl border-2 border-sun bg-gradient-to-b from-[#fff8e1] to-[#ffe9b0] p-2 text-center shadow-sm ${size === "sm" ? "w-24" : "w-32"} ${className}`}
    >
      <span className="absolute left-1.5 top-1 rounded-full bg-white/80 px-1.5 text-[10px] font-bold text-leaf-dark">Lv.{pet.level}</span>
      <span className="absolute right-1.5 top-1 text-xs" aria-hidden>
        ✨
      </span>
      <div className="mt-2 grid place-items-center rounded-xl bg-white/70" style={{ width: art + 8, height: art + 8 }}>
        <PetArt assetKey={pet.assetKey} stage="adult" accessory={pet.accessory} size={art} />
      </div>
      <span className="mt-1 max-w-full truncate font-display text-sm">{pet.name}</span>
      {speciesName && <span className="text-[11px] text-ink-soft">{speciesName}</span>}
      {grownAt && <span className="whitespace-nowrap text-[10px] text-ink-soft">{formatMetDate(grownAt)}{size === "md" && " 다 자람"}</span>}
    </div>
  );
}
