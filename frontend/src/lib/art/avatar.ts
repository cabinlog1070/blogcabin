// 아바타 꾸미기 (SHOP-06). 헤어·모자·상의·하의·신발 5부위 (헤어는 2026-10-13). 그림은 crayon-people.ts (2026-10-11 크레용 그림체).
// 캐릭터 그림(characters.ts)이 입은 꾸미기를 모습(앞·뒤·옆)에 맞게 몸 위에 그린다.
// DB에는 asset_key("avatar.hat.straw" 등)만 저장한다.
import { isHairColor, type HairColor } from "@backend/shop/colors";
import { msg } from "@/lib/i18n";
import { WEAR_PIECES, type BottomWear, type HairWear, type HatWear, type ShoesWear, type TopWear } from "./crayon-people";

export type AvatarSlot = "hair" | "top" | "bottom" | "hat" | "shoes";

/** 그리는 순서: 헤어 → 하의 → 상의 → 신발 → 모자 (위에 오는 것이 나중) */
export const SLOT_ORDER: AvatarSlot[] = ["hair", "bottom", "top", "shoes", "hat"];

export const SLOT_LABEL: Record<AvatarSlot, string> = { hair: msg("헤어"), top: msg("상의"), bottom: msg("하의"), hat: msg("모자"), shoes: msg("신발") };

export type AvatarPiece =
  | { slot: "top"; top: TopWear }
  | { slot: "bottom"; bottom: BottomWear }
  | { slot: "shoes"; shoes: ShoesWear }
  | { slot: "hat"; hat: HatWear }
  | { slot: "hair"; hair: HairWear };

export const AVATAR_PIECES: Record<string, AvatarPiece> = WEAR_PIECES;

/** 머리 색 (2026-10-13, 무료). 고르지 않으면 헤어마다 그린 그대로의 색. DB profiles.hair_color CHECK와 같은 목록 */
export const HAIR_COLORS = {
  black: { label: msg("검정"), hex: "#2f2622" },
  brown: { label: msg("갈색"), hex: "#7a4a2a" },
  caramel: { label: msg("밝은 갈색"), hex: "#b8804a" },
  blonde: { label: msg("금발"), hex: "#e8c46a" },
  red: { label: msg("빨강"), hex: "#d0583e" },
  pink: { label: msg("분홍"), hex: "#ef9ab8" },
  blue: { label: msg("파랑"), hex: "#6f9be0" },
  purple: { label: msg("보라"), hex: "#a283d8" },
  mint: { label: msg("민트"), hex: "#7fd4c0" },
} as const satisfies Record<HairColor, { label: string; hex: string }>;
/** "기본 색" 동그라미: 짧은 머리와 긴 머리의 원래 색을 반반 */
export const HAIR_DEFAULT_SWATCH = `linear-gradient(135deg, ${WEAR_PIECES["avatar.hair.short"].hair.c} 50%, ${WEAR_PIECES["avatar.hair.long"].hair.c} 50%)`;
// 고를 수 있는 색인지는 서버 저장과 같은 검사를 쓴다
export { isHairColor, type HairColor };
export const HAIR_COLOR_KEYS = Object.keys(HAIR_COLORS) as HairColor[];

/** 헤어 키에 머리 색을 붙인다 ("avatar.hair.long@blonde"). 모습 키 안에서 그대로 쓴다 */
export const paintedHairKey = (assetKey: string, color: string | null | undefined) =>
  color && isHairColor(color) && AVATAR_PIECES[assetKey]?.slot === "hair" ? `${assetKey}@${color}` : assetKey;

/** 상의 빼 입기 표시 ("avatar.top.hoodie@out"). 모습 키 안에서 그대로 쓴다 */
export const TOP_OUT = "out";
export const outTopKey = (assetKey: string, out: boolean | null | undefined) => (out && AVATAR_PIECES[assetKey]?.slot === "top" ? `${assetKey}@${TOP_OUT}` : assetKey);

/** 꾸미기 키들 → 그릴 조각 (부위 순서대로, 같은 부위는 처음 것 하나만) */
export function piecesInOrder(assetKeys: string[]): AvatarPiece[] {
  const pieces = assetKeys
    .map((key): AvatarPiece | undefined => {
      // 머리 색은 헤어 키 뒤에 @색으로, 상의 빼 입기는 상의 키 뒤에 @out으로 붙는다
      const [k, color] = key.split("@");
      const p = AVATAR_PIECES[k];
      if (p?.slot === "top" && color === TOP_OUT) return { slot: "top", top: { ...p.top, out: true } };
      return p?.slot === "hair" && isHairColor(color) ? { slot: "hair", hair: { ...p.hair, c: HAIR_COLORS[color].hex } } : p;
    })
    .filter((p): p is AvatarPiece => Boolean(p));
  const bySlot = new Map<AvatarSlot, AvatarPiece>();
  for (const p of pieces) if (!bySlot.has(p.slot)) bySlot.set(p.slot, p);
  return SLOT_ORDER.map((s) => bySlot.get(s)).filter((p): p is AvatarPiece => Boolean(p));
}
