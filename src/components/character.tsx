import type { HTMLAttributes } from "react";
import { PetArt } from "@/components/pet-art";
import { backgroundDataUri, characterDataUri, furnitureDataUri, furnitureInfo } from "@/lib/assets";
import type { AnimalStage, PetAccessory } from "@/lib/farm";

/** 미니룸에서 캐릭터 옆에 서 있는 펫 (데리고 다니는 펫, TOWN-09) */
export type RoomPet = { name: string; assetKey: string; stage: AnimalStage; accessory: PetAccessory };

/** 동그란 캐릭터 얼굴 (헤더, 댓글, 글 목록) */
export function CharacterBadge({ asset, size = 36 }: { asset: string; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-line bg-cream"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 최적화가 필요 없다 */}
      <img src={characterDataUri(asset, 96)} alt="" width={size * 1.15} height={size * 1.15} style={{ marginTop: size * 0.2 }} />
    </span>
  );
}

/** 캐릭터 전신 그림 */
export function CharacterArt({ asset, size = 96, className = "" }: { asset: string; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
  return <img src={characterDataUri(asset, size * 2)} alt="" width={size} height={size} className={className} aria-hidden />;
}

/** 미니룸에 놓인 가구 하나. x·y는 미니룸 기준 비율(0~100%)로 본 가구의 가운데 (SHOP-05) */
export type RoomFurniture = { id: number; assetKey: string; x: number; y: number };

/** 캐릭터가 서 있는 깊이(%). 가구의 가운데가 이보다 아래면 캐릭터 앞에 그린다 */
const CHARACTER_DEPTH = 72;

/** 가구 그림 (미니룸 안 위치, 높이는 미니룸 높이에 대한 비율) */
export function FurnitureArt({ assetKey, className = "" }: { assetKey: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
  return <img src={furnitureDataUri(assetKey, 160)} alt="" draggable={false} className={className} aria-hidden />;
}

/** 미니룸: 장착한 배경 장면 위에 캐릭터가 서 있는 작은 방. 가구는 아래쪽에 있는 것이 앞에 보인다.
 *  테두리·둥근 모서리는 쓰는 쪽이 className으로 정한다. 기본에 넣으면 클래스 순서 때문에 덮어쓰지 못한다 (#23)
 *  꾸미기 화면에서는 furnitureProps(포인터 이벤트)로 가구를 끌어 옮긴다 */
export function MiniRoom({
  characterAsset,
  backgroundAsset: bgKey,
  nickname,
  furniture = [],
  className = "",
  furnitureProps,
  hiddenFurnitureId,
  pet,
}: {
  characterAsset: string;
  backgroundAsset: string;
  nickname?: string;
  furniture?: RoomFurniture[];
  className?: string;
  furnitureProps?: (f: RoomFurniture) => HTMLAttributes<HTMLDivElement>;
  hiddenFurnitureId?: number | null;
  pet?: RoomPet | null;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-cover bg-bottom ${className}`}
      // 미니룸은 넓은 배너로 쓰이므로 넓게 그린 장면을 쓴다 (확대돼서 흐려지지 않게)
      style={{ backgroundImage: `url("${backgroundDataUri(bgKey, 760)}")` }}
      data-mini-room
    >
      {furniture.map((f) => {
        const info = furnitureInfo(f.assetKey);
        return (
          <div
            key={f.id}
            data-furniture={f.assetKey}
            {...furnitureProps?.(f)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 drop-shadow ${furnitureProps ? "cursor-grab touch-none select-none" : ""} ${hiddenFurnitureId === f.id ? "opacity-0" : ""}`}
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              height: `${info.heightPct}%`,
              aspectRatio: String(info.aspect),
              zIndex: f.y > CHARACTER_DEPTH ? 20 + Math.round(f.y) : 1 + Math.round(f.y / 10),
            }}
          >
            <FurnitureArt assetKey={f.assetKey} className="pointer-events-none h-full w-full" />
          </div>
        );
      })}
      <div className="pointer-events-none absolute inset-x-0 bottom-[6%] z-[15] flex flex-col items-center">
        <div className="flex items-end">
          {/* 펫이 있으면 캐릭터가 가운데에 그대로 서 있도록 반대쪽에 같은 폭의 빈 자리를 둔다 */}
          {pet && <span className="w-14" aria-hidden />}
          <CharacterArt asset={characterAsset} size={112} className="animate-bounce drop-shadow-md [animation-duration:2s]" />
          {pet && (
            <span className="-ml-2 mb-1 drop-shadow" data-room-pet={pet.name} title={`${pet.name} (함께 다니는 펫)`}>
              <PetArt assetKey={pet.assetKey} stage={pet.stage} accessory={pet.accessory} size={64} style={{ transform: "scaleX(-1)" }} />
            </span>
          )}
        </div>
        {nickname && (
          <span className="-mt-1 rounded-full bg-white/90 px-3 py-0.5 text-sm font-bold text-ink shadow">{nickname}</span>
        )}
      </div>
    </div>
  );
}
