// 아이템 그림: DB에는 asset_key만 저장하고, 실제 모양은 src/lib/art/ 의 SVG로 그린다.
// 그림을 바꿀 때는 art/ 파일만 고치면 된다.
export { canWear, characterDataUri, characterSvg, composeLook, MANNEQUIN, parseLook, VISITOR_CHARACTER } from "./art/characters";
export { backgroundAccent, backgroundDataUri, backgroundSvg } from "./art/backgrounds";
export { AVATAR_PIECES, SLOT_LABEL, SLOT_ORDER, type AvatarSlot } from "./art/avatar";
export { furnitureDataUri, furnitureInfo, furnitureSvg } from "./art/furniture";
