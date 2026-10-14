import type { CSSProperties } from "react";
import { animalSvg, eggSvg, toAnimalDataUri } from "@/lib/art/animals";
import { formatMetDate, type AnimalStage, type PetAccessory, type PetColor } from "@/lib/farm";
import { makeT, type Locale } from "@/lib/i18n";

/** 농장 펫 그림 (코드로 그린 SVG). 꾸미기(리본·꽃·스카프)와 고른 색을 함께 그린다 */
export function PetArt({
  assetKey,
  stage,
  accessory = "none",
  color = "default",
  size = 64,
  className = "",
  style,
}: {
  assetKey: string;
  stage: AnimalStage;
  accessory?: PetAccessory;
  color?: PetColor;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 최적화가 필요 없다
    <img
      src={toAnimalDataUri(animalSvg(assetKey, stage, size * 2, accessory, color))}
      alt=""
      width={size}
      height={size}
      draggable={false}
      data-color={color}
      className={className}
      style={style}
      aria-hidden
    />
  );
}

/** 다 키운 동물 카드 (카드 도감, 블로그 프로필 전시). 서버·브라우저 어디서나 그리므로 화면 언어는 locale로 받는다 */
export function PetCard({
  pet,
  speciesName,
  grownAt,
  size = "md",
  className = "",
  locale = "ko",
}: {
  pet: { name: string; assetKey: string; accessory: PetAccessory; color?: PetColor; level: number };
  speciesName?: string;
  grownAt?: Date | null;
  size?: "sm" | "md";
  className?: string;
  locale?: Locale;
}) {
  const t = makeT(locale);
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
        <PetArt assetKey={pet.assetKey} stage="adult" accessory={pet.accessory} color={pet.color} size={art} />
      </div>
      <span className="mt-1 max-w-full truncate font-display text-sm">{pet.name}</span>
      {speciesName && <span className="text-[11px] text-ink-soft">{speciesName}</span>}
      {grownAt && <span className="whitespace-nowrap text-[10px] text-ink-soft">{formatMetDate(grownAt, locale)}{size === "md" && ` ${t("다 자람")}`}</span>}
    </div>
  );
}

/** 선물로 받은 펫 알: 알 옆에 태어날 아기 펫을 작게 그린다 */
export function GiftPetEgg({ assetKey }: { assetKey: string }) {
  return (
    <span className="relative mx-auto block h-16 w-16">
      {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
      <img src={toAnimalDataUri(eggSvg(128))} alt="" width={52} height={52} draggable={false} className="absolute left-0 top-0" />
      <PetArt assetKey={assetKey} stage="baby" size={40} className="absolute bottom-0 right-0" />
    </span>
  );
}
