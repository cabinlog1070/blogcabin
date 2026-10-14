import { CharacterArt, FurnitureArt } from "@/components/character";
import { backgroundDataUri, composeLook, MANNEQUIN } from "@/lib/assets";

/** 아이템 미리보기 그림 (상점, 꾸미기)
 *  아바타 꾸미기는 마네킹(또는 wearer로 준 내 캐릭터)에 입혀서, 가구는 가구만 보여준다 */
export function ItemArt({
  type,
  assetKey,
  className = "h-28",
  characterSize = 92,
  wearer = MANNEQUIN,
}: {
  type: string;
  assetKey: string;
  className?: string;
  characterSize?: number;
  wearer?: string;
}) {
  if (type === "character" || type === "avatar") {
    return (
      <div className={`grid place-items-center rounded-xl bg-cream ${className}`} aria-hidden>
        <CharacterArt asset={type === "avatar" ? composeLook(wearer, [assetKey]) : assetKey} size={characterSize} />
      </div>
    );
  }
  if (type === "furniture") {
    return (
      <div className={`flex items-center justify-center overflow-hidden rounded-xl bg-cream p-3 ${className}`} aria-hidden>
        <FurnitureArt assetKey={assetKey} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl border-2 border-line bg-cover bg-bottom ${className}`}
      style={{ backgroundImage: `url("${backgroundDataUri(assetKey)}")` }}
      aria-hidden
    />
  );
}
