import type { HTMLAttributes } from "react";
import { PetArt } from "@/components/pet-art";
import { faceFrame } from "@/lib/art/characters";
import { backgroundDataUri, characterDataUri, furnitureDataUri, furnitureInfo, parseFurnitureKey } from "@/lib/assets";
import type { AnimalStage, PetAccessory, PetColor } from "@/lib/farm";
import { makeT, type Locale } from "@/lib/i18n";

/** 미니룸에서 캐릭터 옆에 서 있는 펫 (데리고 다니는 펫, TOWN-09) */
export type RoomPet = { name: string; assetKey: string; stage: AnimalStage; accessory: PetAccessory; color?: PetColor };

/** 동그란 캐릭터 얼굴 (헤더, 댓글, 글 목록). 전신 그림에서 얼굴 부분만 확대해 담는다 (faceFrame) */
export function CharacterBadge({ asset, size = 36 }: { asset: string; size?: number }) {
  const inner = size - 4; // 테두리(2px) 안쪽
  const frame = faceFrame(asset);
  const w = inner / frame.span;
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full border-2 border-line bg-cream"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 최적화가 필요 없다 */}
      <img
        src={characterDataUri(asset, 96)}
        alt=""
        width={w}
        height={w}
        className="absolute max-w-none"
        style={{ left: inner / 2 - w * frame.cx, top: inner / 2 - w * frame.cy }}
      />
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
  locale = "ko",
}: {
  characterAsset: string;
  backgroundAsset: string;
  nickname?: string;
  furniture?: RoomFurniture[];
  className?: string;
  furnitureProps?: (f: RoomFurniture) => HTMLAttributes<HTMLDivElement>;
  hiddenFurnitureId?: number | null;
  pet?: RoomPet | null;
  /** 화면 언어 (서버·브라우저 어디서나 그리므로 받아서 쓴다) */
  locale?: Locale;
}) {
  const t = makeT(locale);
  return (
    <div
      // isolate: 가구 z-index(최대 120)가 이 방 안에서만 겨루게 한다. 없으면 body에 뜨는 헤더 메뉴(z-40)를 덮는다
      // 미니룸은 어디서든(블로그·꾸미기, 휴대폰·컴퓨터) 같은 2:1 비율로 그리고, 캐릭터·펫도 방 크기에 비례(cqw)시켜
      // 화면마다 가구 위치와 캐릭터 크기가 똑같이 보이게 한다
      className={`relative isolate aspect-[2/1] overflow-hidden bg-cover bg-bottom [container-type:inline-size] ${className}`}
      // 미니룸은 넓은 배너로 쓰이므로 넓게 그린 장면을 쓴다 (확대돼서 흐려지지 않게)
      style={{ backgroundImage: `url("${backgroundDataUri(bgKey, 760)}")` }}
      data-mini-room
    >
      {furniture.map((f) => {
        const info = furnitureInfo(f.assetKey);
        return (
          <div
            key={f.id}
            data-furniture={parseFurnitureKey(f.assetKey).assetKey}
            data-furniture-color={parseFurnitureKey(f.assetKey).color ?? undefined}
            {...furnitureProps?.(f)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 drop-shadow ${furnitureProps ? "cursor-grab touch-none select-none" : ""} ${hiddenFurnitureId === f.id ? "opacity-0" : ""}`}
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              height: `${info.heightPct}%`,
              aspectRatio: String(info.aspect),
              zIndex: info.flat ? 0 : f.y > CHARACTER_DEPTH ? 20 + Math.round(f.y) : 1 + Math.round(f.y / 10),
            }}
          >
            <FurnitureArt assetKey={f.assetKey} className="pointer-events-none h-full w-full" />
          </div>
        );
      })}
      <div className="pointer-events-none absolute inset-x-0 bottom-[6%] z-[15] flex flex-col items-center">
        <div className="flex items-end">
          {/* 펫이 있으면 캐릭터가 가운데에 그대로 서 있도록 반대쪽에 같은 폭의 빈 자리를 둔다 */}
          {pet && <span className="w-[8cqw]" aria-hidden />}
          <CharacterArt asset={characterAsset} size={128} className="h-[16.5cqw] w-[16.5cqw] drop-shadow-md" />
          {pet && (
            <span className="-ml-2 mb-1 drop-shadow" data-room-pet={pet.name} title={t("{name} (함께 다니는 펫)", { name: pet.name })}>
              <PetArt assetKey={pet.assetKey} stage={pet.stage} accessory={pet.accessory} color={pet.color} size={72} className="h-[9.5cqw] w-[9.5cqw]" style={{ transform: "scaleX(-1)" }} />
            </span>
          )}
        </div>
        {nickname && (
          <span className="-mt-1 rounded-full bg-white/90 px-[2.4cqw] py-0.5 text-[clamp(10px,2.8cqw,14px)] font-bold text-ink shadow">{nickname}</span>
        )}
      </div>
    </div>
  );
}
