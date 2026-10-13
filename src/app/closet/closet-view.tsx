"use client";

import { useEffect, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { FurnitureArt, MiniRoom, type RoomFurniture, type RoomPet } from "@/components/character";
import { useT } from "@/components/i18n";
import { IconEmoji } from "@/components/icon-emoji";
import { ItemArt } from "@/components/item-art";
import { PetArt } from "@/components/pet-art";
import {
  canWear,
  composeLook,
  FURNITURE_COLOR_KEYS,
  FURNITURE_COLORS,
  furnitureInfo,
  isFurnitureColor,
  MANNEQUIN,
  paintedFurnitureKey,
  SLOT_LABEL,
  SLOT_ORDER,
  type AvatarSlot,
  type FurnitureColor,
} from "@/lib/assets";
import { HOUSE_STAGES, houseSvg, ROOF_COLORS, roofHex, type HouseStage, type RoofColor } from "@/lib/art/town";
import { msg } from "@/lib/i18n";
import { clampCharacterSpot, clampPct, clampPetSpot, ROOM_CHARACTER_SPOT, type ItemType, type RoomSpot } from "@/lib/shop";
import { equipItem, moveRoomCharacter, placeFurniture, placeRoomPet, removeFurniture, setAvatarWear, setFurnitureColor, setRoofColor } from "./actions";

type OwnedItem = { id: number; type: ItemType; slot: AvatarSlot | null; name: string; assetKey: string; color?: string | null };
type Message = { ok: boolean; text: string } | null;
type Worn = Partial<Record<AvatarSlot, number>>;

/** 꾸미기 화면의 미니룸 영역 (화면에 하나뿐). 끌기가 끝날 때 이 안에 놓였는지 본다 */
const roomRect = () => document.querySelector("[data-mini-room]")?.getBoundingClientRect();

/** 끌고 있는 가구: 화면 좌표(px)와 미니룸에서 보일 크기 */
type Drag = {
  item: OwnedItem;
  fromRoom: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  height: number;
};

/** 미니룸 안에서 바로 끌어 옮기는 캐릭터·펫: 누른 곳과 발 자리의 차이(%)를 지켜서 손가락을 따라간다 */
type LiveDrag = { kind: "character" | "pet"; from: RoomSpot; startX: number; startY: number; dx: number; dy: number; moved: boolean };
/** 펫 카드를 끌어 미니룸에 넣는 중 (화면 좌표 px) */
type PetCardDrag = { startX: number; startY: number; x: number; y: number; moved: boolean };
/** 펫 카드를 눌러 놓을 때의 자리 */
const PET_DEFAULT_SPOT: RoomSpot = { x: 30, y: 90 };

/** 화면 좌표(px)를 미니룸 기준 %로 */
const toRoomPct = (rect: DOMRect, clientX: number, clientY: number) => ({
  x: ((clientX - rect.left) / rect.width) * 100,
  y: ((clientY - rect.top) / rect.height) * 100,
});
const insideRect = (rect: DOMRect | undefined, x: number, y: number) => !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

const FAIL = msg("장착하지 못했어요. 잠시 뒤 다시 시도해 주세요");
const FAIL_PLACE = msg("가구를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요");

export function ClosetView({
  items,
  equipped,
  nickname,
  roofColor,
  houseStage,
  pet = null,
  characterSpot = null,
  petSpot = null,
}: {
  items: OwnedItem[];
  equipped: {
    characterItemId: number;
    backgroundItemId: number;
    worn: { slot: AvatarSlot; itemId: number }[];
    furniture: { itemId: number; assetKey: string; x: number; y: number }[];
  };
  nickname: string;
  roofColor: string | null; // 고른 지붕 색 (TOWN-07). null = 배경 색 따라가기
  houseStage: HouseStage; // 내 레벨로 정한 집 단계 (TOWN-11), 미리 보기도 같은 단계로
  pet?: RoomPet | null; // 데리고 다니는 펫 (미니룸에 놓을 수 있다)
  characterSpot?: RoomSpot | null; // 미니룸 안 캐릭터 발 자리 (null = 가운데 아래)
  petSpot?: RoomSpot | null; // 미니룸에 놓은 펫 자리 (null = 캐릭터 옆)
}) {
  const t = useT();
  const [current, setCurrent] = useState({ characterItemId: equipped.characterItemId, backgroundItemId: equipped.backgroundItemId });
  const [worn, setWorn] = useState<Worn>(() => Object.fromEntries(equipped.worn.map((w) => [w.slot, w.itemId])));
  const [placed, setPlaced] = useState<RoomFurniture[]>(() =>
    equipped.furniture.map((f) => ({ id: f.itemId, assetKey: f.assetKey, x: f.x, y: f.y })),
  );
  const [drag, setDrag] = useState<Drag | null>(null);
  const [charAt, setCharAt] = useState<RoomSpot>(characterSpot ?? ROOM_CHARACTER_SPOT);
  const [petAt, setPetAt] = useState<RoomSpot | null>(petSpot);
  const [live, setLive] = useState<LiveDrag | null>(null);
  const [petCardDrag, setPetCardDrag] = useState<PetCardDrag | null>(null);
  const [roof, setRoof] = useState<string | null>(roofColor);
  // 가구 색 (SHOP-05): 가구 id → 고른 색 (없으면 기본 색)
  const [colors, setColors] = useState<Record<number, FurnitureColor | null>>(() =>
    Object.fromEntries(items.filter((i) => i.type === "furniture").map((i) => [i.id, isFurnitureColor(i.color) ? i.color : null])),
  );
  const [paintId, setPaintId] = useState<number | null>(() => items.find((i) => i.type === "furniture")?.id ?? null);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  // "저장했어요"는 2초 뒤에 사라진다
  useEffect(() => {
    if (!message?.ok) return;
    const timer = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [message]);

  const byId = (id: number | undefined) => items.find((i) => i.id === id);
  const character = byId(current.characterItemId);
  const background = byId(current.backgroundItemId);
  const look = composeLook(
    character?.assetKey ?? "",
    SLOT_ORDER.map((s) => byId(worn[s])?.assetKey ?? "").filter(Boolean),
  );
  // 꾸미기 카드 그림: 내 캐릭터(남자·여자 주민)에 입혀서, 아니면 마네킹에
  const wearer = character && canWear(character.assetKey) ? character.assetKey : MANNEQUIN;

  /** 미리 화면을 바꾸고 저장한다. 실패하면 되돌린다 (SHOP-04와 같은 방식) */
  function save(undo: () => void, call: () => Promise<{ ok: boolean; error?: string }>, okText: string, failText: string = FAIL) {
    setMessage(null);
    start(async () => {
      try {
        const r = await call();
        if (r.ok) {
          setMessage({ ok: true, text: okText });
          return;
        }
        undo();
        setMessage({ ok: false, text: r.error ?? t(failText) });
      } catch {
        // 서버 오류(네트워크, DB 등)도 오류 화면 대신 되돌리고 알려준다
        undo();
        setMessage({ ok: false, text: t(failText) });
      }
    });
  }

  function equip(item: OwnedItem) {
    const key = item.type === "character" ? "characterItemId" : "backgroundItemId";
    const before = current;
    setCurrent({ ...current, [key]: item.id });
    save(() => setCurrent(before), () => equipItem(item.id), t("{name} 장착을 저장했어요 ✓", { name: t(item.name) }));
  }

  // 부위마다 하나. 입은 것을 다시 누르면 벗는다 (SHOP-06)
  function wear(item: OwnedItem) {
    if (!item.slot) return;
    const slot = item.slot;
    const before = worn;
    const on = worn[slot] === item.id;
    setWorn({ ...worn, [slot]: on ? undefined : item.id });
    save(
      () => setWorn(before),
      () => setAvatarWear(item.id, !on),
      on ? t("{name}을(를) 벗었어요 ✓", { name: t(item.name) }) : t("{name} 장착을 저장했어요 ✓", { name: t(item.name) }),
    );
  }

  // ===== 지붕 색 (TOWN-07, 무료) =====
  function pickRoof(color: RoofColor | null) {
    const before = roof;
    setRoof(color);
    save(
      () => setRoof(before),
      () => setRoofColor(color),
      color ? t("지붕 색을 {color}(으)로 바꿨어요 ✓", { color: t(ROOF_COLORS[color].name) }) : t("지붕 색이 배경 색을 따라가요 ✓"),
    );
  }

  // ===== 가구 (SHOP-05) =====
  /** 고른 색을 붙인 가구 키 */
  const painted = (item: OwnedItem) => (item.type === "furniture" ? paintedFurnitureKey(item.assetKey, colors[item.id]) : item.assetKey);

  function paint(item: OwnedItem, color: FurnitureColor | null) {
    const before = { colors, placed };
    const key = paintedFurnitureKey(item.assetKey, color);
    setColors({ ...colors, [item.id]: color });
    setPlaced(placed.map((f) => (f.id === item.id ? { ...f, assetKey: key } : f)));
    save(
      () => {
        setColors(before.colors);
        setPlaced(before.placed);
      },
      () => setFurnitureColor(item.id, color),
      color
        ? t("{name} 색을 {color}(으)로 바꿨어요 ✓", { name: t(item.name), color: t(FURNITURE_COLORS[color].name) })
        : t("{name}을(를) 기본 색으로 되돌렸어요 ✓", { name: t(item.name) }),
    );
  }

  function place(item: OwnedItem, x: number, y: number) {
    const before = placed;
    const already = placed.some((f) => f.id === item.id);
    const spot = { id: item.id, assetKey: painted(item), x: clampPct(x), y: clampPct(y) };
    setPlaced(already ? placed.map((f) => (f.id === item.id ? spot : f)) : [...placed, spot]);
    save(() => setPlaced(before), () => placeFurniture(item.id, spot.x, spot.y), t("{name} 배치를 저장했어요 ✓", { name: t(item.name) }), FAIL_PLACE);
  }

  function remove(item: OwnedItem) {
    const before = placed;
    setPlaced(placed.filter((f) => f.id !== item.id));
    save(() => setPlaced(before), () => removeFurniture(item.id), t("{name}을(를) 미니룸에서 뺐어요 ✓", { name: t(item.name) }), FAIL_PLACE);
  }

  /** 카드를 누르면(끌지 않고) 빈 자리에 놓거나, 놓여 있으면 뺀다. 키보드로도 쓸 수 있다 */
  function toggleFurniture(item: OwnedItem) {
    if (placed.some((f) => f.id === item.id)) remove(item);
    else place(item, 18 + ((placed.length * 16) % 64), 80);
  }

  // ===== 미니룸 안 캐릭터·펫 (SHOP-05, 2026-10-13) =====
  function saveCharacter(to: RoomSpot, before: RoomSpot) {
    save(() => setCharAt(before), () => moveRoomCharacter(to.x, to.y), t("캐릭터 자리를 저장했어요 ✓"), FAIL_PLACE);
  }

  function savePet(to: RoomSpot | null, before: RoomSpot | null) {
    if (!pet) return;
    save(
      () => setPetAt(before),
      () => placeRoomPet(to),
      to ? t("{name}을(를) 미니룸에 놓았어요. 방 안을 돌아다녀요 ✓", { name: pet.name }) : t("{name}이(가) 다시 캐릭터 옆으로 왔어요 ✓", { name: pet.name }),
      FAIL_PLACE,
    );
  }

  /** 펫 카드를 누르면(끌지 않고) 미니룸에 놓거나, 놓여 있으면 캐릭터 옆으로 되돌린다 */
  function togglePet() {
    const before = petAt;
    const to = petAt ? null : PET_DEFAULT_SPOT;
    setPetAt(to);
    savePet(to, before);
  }

  /** 미니룸 안의 캐릭터·놓은 펫을 끌어 옮긴다. 펫은 미니룸 밖으로 끌어내면 캐릭터 옆으로 돌아간다 */
  function liveProps(kind: "character" | "pet") {
    const spotOf = () => (kind === "character" ? charAt : petAt);
    return {
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        const rect = roomRect();
        const spot = spotOf();
        if (e.button !== 0 || !rect || !spot) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = toRoomPct(rect, e.clientX, e.clientY);
        setLive({ kind, from: spot, startX: e.clientX, startY: e.clientY, dx: spot.x - p.x, dy: spot.y - p.y, moved: false });
      },
      onPointerMove(e: ReactPointerEvent<HTMLElement>) {
        const rect = roomRect();
        if (!live || live.kind !== kind || !rect) return;
        const moved = live.moved || Math.hypot(e.clientX - live.startX, e.clientY - live.startY) > 6;
        if (!moved) return;
        const p = toRoomPct(rect, e.clientX, e.clientY);
        const to = { x: p.x + live.dx, y: p.y + live.dy };
        if (kind === "character") setCharAt(clampCharacterSpot(to));
        else setPetAt(clampPetSpot(to));
        if (!live.moved) setLive({ ...live, moved });
      },
      onPointerUp(e: ReactPointerEvent<HTMLElement>) {
        if (!live || live.kind !== kind) return;
        setLive(null);
        if (!live.moved) return;
        if (kind === "character") saveCharacter(charAt, live.from);
        else if (!insideRect(roomRect(), e.clientX, e.clientY)) {
          setPetAt(null);
          savePet(null, live.from);
        } else if (petAt) savePet(petAt, live.from);
      },
      onPointerCancel() {
        setLive(null);
      },
    };
  }

  /** 펫 카드 끌기: 미니룸 안에 놓으면 그 자리에 놓인다. 끌지 않고 누르면 togglePet */
  const petCardProps = {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setPetCardDrag({ startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, moved: false });
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      if (!petCardDrag) return;
      const moved = petCardDrag.moved || Math.hypot(e.clientX - petCardDrag.startX, e.clientY - petCardDrag.startY) > 6;
      setPetCardDrag({ ...petCardDrag, x: e.clientX, y: e.clientY, moved });
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      if (!petCardDrag) return;
      setPetCardDrag(null);
      if (!petCardDrag.moved) return togglePet();
      const rect = roomRect();
      if (!rect || !insideRect(rect, e.clientX, e.clientY)) return;
      const before = petAt;
      const to = clampPetSpot(toRoomPct(rect, e.clientX, e.clientY));
      setPetAt(to);
      savePet(to, before);
    },
    onPointerCancel() {
      setPetCardDrag(null);
    },
  };

  /** 포인터(마우스·터치·펜)로 끌기. 포인터 캡처로 미니룸 밖으로 나가도 계속 따라온다 */
  function dragProps(item: OwnedItem, fromRoom: boolean) {
    return {
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const roomHeight = roomRect()?.height ?? 240;
        setDrag({
          item,
          fromRoom,
          startX: e.clientX,
          startY: e.clientY,
          x: e.clientX,
          y: e.clientY,
          moved: false,
          height: (roomHeight * furnitureInfo(item.assetKey).heightPct) / 100,
        });
      },
      onPointerMove(e: ReactPointerEvent<HTMLElement>) {
        if (!drag || drag.item.id !== item.id) return;
        const moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6;
        setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
      },
      onPointerUp(e: ReactPointerEvent<HTMLElement>) {
        if (!drag || drag.item.id !== item.id) return;
        setDrag(null);
        if (!drag.moved) {
          if (!fromRoom) toggleFurniture(item); // 끌지 않고 눌렀다 떼면 카드 누르기
          return;
        }
        const rect = roomRect();
        const inside =
          rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (inside) place(item, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
        else if (fromRoom) remove(item); // 미니룸 밖으로 끌어내면 빠진다
      },
      onPointerCancel() {
        setDrag(null);
      },
    };
  }

  const grid = (list: OwnedItem[], render: (item: OwnedItem) => ReactNode, empty: string) =>
    list.length ? (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">{list.map(render)}</div>
    ) : (
      <p className="card p-4 text-center text-sm text-ink-soft">{empty}</p>
    );

  const card = (item: OwnedItem, on: boolean, onClick: (e?: { detail: number }) => void, extra: object = {}, sub?: string) => (
    <button
      key={item.id}
      type="button"
      disabled={pending && item.type !== "furniture"}
      aria-pressed={on}
      onClick={onClick}
      {...extra}
      className={`card p-2 text-center transition hover:-translate-y-0.5 ${on ? "border-sun! bg-honey" : ""} ${item.type === "furniture" ? "touch-none select-none" : ""}`}
    >
      <ItemArt type={item.type} assetKey={painted(item)} className="pointer-events-none h-20" characterSize={70} wearer={wearer} />
      <span className="mt-1 block text-sm font-bold">
        {on && "✓ "}
        {t(item.name)}
      </span>
      {sub && <span className="block text-xs text-ink-soft">{sub}</span>}
    </button>
  );

  const avatars = items
    .filter((i) => i.type === "avatar")
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot!) - SLOT_ORDER.indexOf(b.slot!) || a.id - b.id);
  const furniture = items.filter((i) => i.type === "furniture");
  const characters = items.filter((i) => i.type === "character");
  const paintItem = furniture.find((i) => i.id === paintId) ?? furniture[0];

  return (
    <>
      <MiniRoom
        characterAsset={look}
        backgroundAsset={background?.assetKey ?? ""}
        nickname={nickname}
        furniture={placed}
        hiddenFurnitureId={drag?.fromRoom && drag.moved ? drag.item.id : null}
        furnitureProps={(f) => {
          const item = byId(f.id);
          return item ? { ...dragProps(item, true), title: t("{name} (끌어서 옮기기, 밖으로 끌어내면 빠져요)", { name: t(item.name) }) } : {};
        }}
        pet={pet}
        characterSpot={charAt}
        petSpot={petAt}
        petWander={false}
        characterProps={{ ...liveProps("character"), title: t("끌어서 캐릭터 자리 옮기기") }}
        petProps={pet ? { ...liveProps("pet"), title: t("{name} (끌어서 옮기기, 밖으로 끌어내면 캐릭터 옆으로 돌아와요)", { name: pet.name }) } : undefined}
        // 블로그 머리 카드의 미니룸과 같은 크기(가로 최대 520px)로 보여 준다
        className="mx-auto w-full max-w-[520px] rounded-2xl border-2 border-line shadow-[0_4px_0_0_var(--color-line)]"
      />
      <p role="status" aria-live="polite" className={`mt-3 min-h-6 text-center font-bold ${message?.ok ? "text-leaf-dark" : "text-berry"}`}>
        {message?.text}
      </p>

      {/* 끌고 있는 펫 카드 */}
      {pet && petCardDrag?.moved && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-lg" style={{ left: petCardDrag.x, top: petCardDrag.y }}>
          <PetArt assetKey={pet.assetKey} stage={pet.stage} accessory={pet.accessory} color={pet.color} size={64} />
        </div>
      )}

      {/* 끌고 있는 가구 (손가락·마우스를 따라다닌다) */}
      {drag?.moved && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-lg"
          style={{ left: drag.x, top: drag.y, height: drag.height, aspectRatio: String(furnitureInfo(drag.item.assetKey).aspect) }}
        >
          <FurnitureArt assetKey={painted(drag.item)} className="h-full w-full" />
        </div>
      )}

      <section className="mt-6">
        {/* 구역 제목: 화면에는 그린 아이콘, 글자로는 예전 이모지 그대로 (e2e가 "👕 아바타 꾸미기"로 찾는다) */}
        <h2 className="mb-3 font-display text-2xl">
          <IconEmoji name="clothes" emoji="👕" size={30} className="-mt-1" /> {t("아바타 꾸미기")}
        </h2>
        {grid(
          avatars,
          (item) => card(item, worn[item.slot!] === item.id, () => wear(item), {}, t(SLOT_LABEL[item.slot!])),
          t("아직 꾸미기 아이템이 없어요. 상점에서 옷과 모자를 사 보세요."),
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-2xl">
          <IconEmoji name="background" emoji="🖼" size={30} className="-mt-1" /> {t("내 배경")}
        </h2>
        {grid(
          items.filter((i) => i.type === "background"),
          (item) => card(item, item.id === current.backgroundItemId, () => equip(item)),
          "",
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 font-display text-2xl">
          <IconEmoji name="furniture" emoji="🪑" size={30} className="-mt-1" /> {t("가구")}
        </h2>
        <p className="mb-3 text-sm text-ink-soft">
          {t("가구를 위 미니룸으로 끌어다 놓으세요. 미니룸 밖으로 끌어내면 빠져요. (지금 {n}개)", { n: placed.length })}
        </p>
        {grid(
          furniture,
          (item) => {
            const on = placed.some((f) => f.id === item.id);
            // 마우스·터치는 dragProps의 onPointerUp이 처리하고, onClick은 키보드(Enter·Space, detail 0)만 처리한다
            const onKey = (e?: { detail: number }) => e?.detail === 0 && toggleFurniture(item);
            return card(item, on, onKey, dragProps(item, false), on ? t("미니룸에 있음") : undefined);
          },
          t("아직 가구가 없어요. 상점에서 가구를 사 보세요."),
        )}
      </section>

      {/* 미니룸 펫 (SHOP-05, 2026-10-13): 데리고 다니는 펫을 미니룸에 놓으면 방 안을 돌아다닌다 */}
      <section className="mt-8" data-room-pet-section>
        <h2 className="mb-1 font-display text-2xl">
          <IconEmoji name="pet" emoji="🐾" size={30} className="-mt-1" /> {t("미니룸 펫")}
        </h2>
        {pet ? (
          <>
            <p className="mb-3 text-sm text-ink-soft">
              {t("데리고 다니는 펫을 미니룸으로 끌어다 놓으면 방 안을 돌아다녀요. 미니룸 밖으로 끌어내면 다시 캐릭터 옆으로 와요. 캐릭터도 끌어서 자리를 옮길 수 있어요.")}
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <button
                type="button"
                aria-pressed={petAt !== null}
                {...petCardProps}
                // 마우스·터치는 petCardProps가 처리하고, onClick은 키보드(Enter·Space, detail 0)만 처리한다
                onClick={(e) => e.detail === 0 && togglePet()}
                className={`card touch-none select-none p-2 text-center transition hover:-translate-y-0.5 ${petAt ? "border-sun! bg-honey" : ""}`}
                data-room-pet-card
              >
                <span className="pointer-events-none flex h-20 items-center justify-center rounded-xl bg-cream">
                  <PetArt assetKey={pet.assetKey} stage={pet.stage} accessory={pet.accessory} color={pet.color} size={64} />
                </span>
                <span className="mt-1 block text-sm font-bold">
                  {petAt && "✓ "}
                  {pet.name}
                </span>
                <span className="block text-xs text-ink-soft">{petAt ? t("미니룸에서 노는 중") : t("캐릭터 옆")}</span>
              </button>
            </div>
          </>
        ) : (
          <p className="card p-4 text-center text-sm text-ink-soft">
            {t("동물 농장에서 데리고 다닐 펫을 고르면 미니룸에 놓을 수 있어요. 캐릭터는 미니룸에서 끌어서 자리를 옮길 수 있어요.")}
          </p>
        )}
      </section>

      {/* 가구 색 (SHOP-05, 2026-10-13): 가진 가구마다 방 테마에 맞춰 색을 고른다. 무료 */}
      {paintItem && (
        <section className="mt-8" data-furniture-color-section>
          <h2 className="mb-1 font-display text-2xl">
            <IconEmoji name="furniture" emoji="🎨" size={30} className="-mt-1" /> {t("가구 색")}
          </h2>
          <p className="mb-3 text-sm text-ink-soft">{t("방 테마에 맞춰 가구 색을 골라요. 무료이고 언제든 바꿀 수 있어요.")}</p>
          <div className="card flex flex-wrap items-center gap-4 p-4">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-cream p-3" data-furniture-color-preview={colors[paintItem.id] ?? "default"}>
              <FurnitureArt assetKey={painted(paintItem)} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("색을 바꿀 가구")}>
                {furniture.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={item.id === paintItem.id}
                    onClick={() => setPaintId(item.id)}
                    className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition ${item.id === paintItem.id ? "border-ink bg-honey" : "border-line bg-paper"}`}
                  >
                    {t(item.name)}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("{name} 색", { name: t(paintItem.name) })}>
                {FURNITURE_COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={colors[paintItem.id] === key}
                    aria-label={t(FURNITURE_COLORS[key].name)}
                    title={t(FURNITURE_COLORS[key].name)}
                    disabled={pending}
                    onClick={() => paint(paintItem, key)}
                    className={`h-10 w-10 rounded-full border-4 transition hover:-translate-y-0.5 ${colors[paintItem.id] === key ? "border-ink" : "border-white shadow-[0_0_0_2px_var(--color-line)]"}`}
                    style={{ background: FURNITURE_COLORS[key].main }}
                  />
                ))}
              </div>
              <button
                type="button"
                disabled={pending || !colors[paintItem.id]}
                onClick={() => paint(paintItem, null)}
                aria-pressed={!colors[paintItem.id]}
                className="btn mt-3 bg-paper py-1.5 text-sm text-ink"
              >
                {t("기본 색")}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 광장 내 집 지붕 색 (TOWN-07): 무료, 배경과 상관없이. 미리 보기는 내 레벨의 집 단계로 (TOWN-11) */}
      <section className="mt-8" data-roof-section>
        <h2 className="mb-1 font-display text-2xl">
          <IconEmoji name="home" emoji="🏠" size={30} className="-mt-1" /> {t("지붕 색")}
        </h2>
        <p className="mb-3 text-sm text-ink-soft">{t("광장의 내 집 지붕 색을 골라요. 무료이고 언제든 바꿀 수 있어요.")}</p>
        <div className="card flex flex-wrap items-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 그린 SVG */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(houseSvg(houseStage, roofHex(roof, background?.assetKey ?? "")))}`}
            alt={t("내 집 미리 보기 ({stage})", { stage: t(HOUSE_STAGES[houseStage].name) })}
            data-roof-preview={roofHex(roof, background?.assetKey ?? "")}
            className="h-28 w-auto"
          />
          <div className="flex-1">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("지붕 색")}>
              {(Object.keys(ROOF_COLORS) as RoofColor[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={roof === key}
                  aria-label={t(ROOF_COLORS[key].name)}
                  title={t(ROOF_COLORS[key].name)}
                  disabled={pending}
                  onClick={() => pickRoof(key)}
                  className={`h-10 w-10 rounded-full border-4 transition hover:-translate-y-0.5 ${roof === key ? "border-ink" : "border-white shadow-[0_0_0_2px_var(--color-line)]"}`}
                  style={{ background: ROOF_COLORS[key].hex }}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={pending || roof === null}
              onClick={() => pickRoof(null)}
              aria-pressed={roof === null}
              className="btn mt-3 bg-paper py-1.5 text-sm text-ink"
            >
              {t("배경 색 따라가기")}
            </button>
          </div>
        </div>
      </section>

      {/* 예전에 상점에서 캐릭터를 산 회원만: 가진 캐릭터 중에서 바꿀 수 있다 (spec 006 FR-021) */}
      {characters.length > 1 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-2xl">
            <IconEmoji name="pet" emoji="🐾" size={30} className="-mt-1" /> {t("내 캐릭터")}
          </h2>
          {grid(characters, (item) => card(item, item.id === current.characterItemId, () => equip(item)), "")}
        </section>
      )}
    </>
  );
}
