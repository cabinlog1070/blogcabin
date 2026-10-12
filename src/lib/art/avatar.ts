// 아바타 꾸미기 (SHOP-06). 상의·하의·모자·신발 4부위. 그림은 crayon-people.ts (2026-10-11 크레용 그림체).
// 캐릭터 그림(characters.ts)이 입은 꾸미기를 모습(앞·뒤·옆)에 맞게 몸 위에 그린다.
// DB에는 asset_key("avatar.hat.straw" 등)만 저장한다.
import { msg } from "@/lib/i18n";
import { WEAR_PIECES, type BottomWear, type HatWear, type ShoesWear, type TopWear } from "./crayon-people";

export type AvatarSlot = "top" | "bottom" | "hat" | "shoes";

/** 그리는 순서: 하의 → 상의 → 신발 → 모자 (위에 오는 것이 나중) */
export const SLOT_ORDER: AvatarSlot[] = ["bottom", "top", "shoes", "hat"];

export const SLOT_LABEL: Record<AvatarSlot, string> = { top: msg("상의"), bottom: msg("하의"), hat: msg("모자"), shoes: msg("신발") };

export type AvatarPiece =
  | { slot: "top"; top: TopWear }
  | { slot: "bottom"; bottom: BottomWear }
  | { slot: "shoes"; shoes: ShoesWear }
  | { slot: "hat"; hat: HatWear };

export const AVATAR_PIECES: Record<string, AvatarPiece> = WEAR_PIECES;

/** 꾸미기 키들 → 그릴 조각 (부위 순서대로, 같은 부위는 처음 것 하나만) */
export function piecesInOrder(assetKeys: string[]): AvatarPiece[] {
  const pieces = assetKeys.map((k) => AVATAR_PIECES[k]).filter((p): p is AvatarPiece => Boolean(p));
  const bySlot = new Map<AvatarSlot, AvatarPiece>();
  for (const p of pieces) if (!bySlot.has(p.slot)) bySlot.set(p.slot, p);
  return SLOT_ORDER.map((s) => bySlot.get(s)).filter((p): p is AvatarPiece => Boolean(p));
}
