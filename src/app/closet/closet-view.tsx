"use client";

import { useEffect, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { FurnitureArt, MiniRoom, type RoomFurniture } from "@/components/character";
import { IconEmoji } from "@/components/icon-emoji";
import { ItemArt } from "@/components/item-art";
import { canWear, composeLook, furnitureInfo, MANNEQUIN, SLOT_LABEL, SLOT_ORDER, type AvatarSlot } from "@/lib/assets";
import { HOUSE_STAGES, houseSvg, ROOF_COLORS, roofHex, type HouseStage, type RoofColor } from "@/lib/art/town";
import { clampPct, MAX_FURNITURE, type ItemType } from "@/lib/shop";
import { equipItem, placeFurniture, removeFurniture, setAvatarWear, setRoofColor } from "./actions";

type OwnedItem = { id: number; type: ItemType; slot: AvatarSlot | null; name: string; assetKey: string };
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

const FAIL = "장착하지 못했어요. 잠시 뒤 다시 시도해 주세요";
const FAIL_PLACE = "가구를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요";

export function ClosetView({
  items,
  equipped,
  nickname,
  roofColor,
  houseStage,
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
}) {
  const [current, setCurrent] = useState({ characterItemId: equipped.characterItemId, backgroundItemId: equipped.backgroundItemId });
  const [worn, setWorn] = useState<Worn>(() => Object.fromEntries(equipped.worn.map((w) => [w.slot, w.itemId])));
  const [placed, setPlaced] = useState<RoomFurniture[]>(() =>
    equipped.furniture.map((f) => ({ id: f.itemId, assetKey: f.assetKey, x: f.x, y: f.y })),
  );
  const [drag, setDrag] = useState<Drag | null>(null);
  const [roof, setRoof] = useState<string | null>(roofColor);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  // "저장했어요"는 2초 뒤에 사라진다
  useEffect(() => {
    if (!message?.ok) return;
    const t = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(t);
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
  function save(undo: () => void, call: () => Promise<{ ok: boolean; error?: string }>, okText: string, failText = FAIL) {
    setMessage(null);
    start(async () => {
      try {
        const r = await call();
        if (r.ok) {
          setMessage({ ok: true, text: okText });
          return;
        }
        undo();
        setMessage({ ok: false, text: r.error ?? failText });
      } catch {
        // 서버 오류(네트워크, DB 등)도 오류 화면 대신 되돌리고 알려준다
        undo();
        setMessage({ ok: false, text: failText });
      }
    });
  }

  function equip(item: OwnedItem) {
    const key = item.type === "character" ? "characterItemId" : "backgroundItemId";
    const before = current;
    setCurrent({ ...current, [key]: item.id });
    save(() => setCurrent(before), () => equipItem(item.id), `${item.name} 장착을 저장했어요 ✓`);
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
      on ? `${item.name}을(를) 벗었어요 ✓` : `${item.name} 장착을 저장했어요 ✓`,
    );
  }

  // ===== 지붕 색 (TOWN-07, 무료) =====
  function pickRoof(color: RoofColor | null) {
    const before = roof;
    setRoof(color);
    save(
      () => setRoof(before),
      () => setRoofColor(color),
      color ? `지붕 색을 ${ROOF_COLORS[color].name}(으)로 바꿨어요 ✓` : "지붕 색이 배경 색을 따라가요 ✓",
    );
  }

  // ===== 가구 (SHOP-05) =====
  function place(item: OwnedItem, x: number, y: number) {
    const before = placed;
    const already = placed.some((f) => f.id === item.id);
    if (!already && placed.length >= MAX_FURNITURE) {
      setMessage({ ok: false, text: `가구는 ${MAX_FURNITURE}개까지 놓을 수 있어요` });
      return;
    }
    const spot = { id: item.id, assetKey: item.assetKey, x: clampPct(x), y: clampPct(y) };
    setPlaced(already ? placed.map((f) => (f.id === item.id ? spot : f)) : [...placed, spot]);
    save(() => setPlaced(before), () => placeFurniture(item.id, spot.x, spot.y), `${item.name} 배치를 저장했어요 ✓`, FAIL_PLACE);
  }

  function remove(item: OwnedItem) {
    const before = placed;
    setPlaced(placed.filter((f) => f.id !== item.id));
    save(() => setPlaced(before), () => removeFurniture(item.id), `${item.name}을(를) 미니룸에서 뺐어요 ✓`, FAIL_PLACE);
  }

  /** 카드를 누르면(끌지 않고) 빈 자리에 놓거나, 놓여 있으면 뺀다. 키보드로도 쓸 수 있다 */
  function toggleFurniture(item: OwnedItem) {
    if (placed.some((f) => f.id === item.id)) remove(item);
    else place(item, 18 + ((placed.length * 16) % 64), 80);
  }

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
      <ItemArt type={item.type} assetKey={item.assetKey} className="pointer-events-none h-20" characterSize={70} wearer={wearer} />
      <span className="mt-1 block text-sm font-bold">
        {on && "✓ "}
        {item.name}
      </span>
      {sub && <span className="block text-xs text-ink-soft">{sub}</span>}
    </button>
  );

  const avatars = items
    .filter((i) => i.type === "avatar")
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot!) - SLOT_ORDER.indexOf(b.slot!) || a.id - b.id);
  const furniture = items.filter((i) => i.type === "furniture");
  const characters = items.filter((i) => i.type === "character");

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
          return item ? { ...dragProps(item, true), title: `${item.name} (끌어서 옮기기, 밖으로 끌어내면 빠져요)` } : {};
        }}
        className="h-60 rounded-2xl border-2 border-line shadow-[0_4px_0_0_var(--color-line)]"
      />
      <p role="status" aria-live="polite" className={`mt-3 min-h-6 text-center font-bold ${message?.ok ? "text-leaf-dark" : "text-berry"}`}>
        {message?.text}
      </p>

      {/* 끌고 있는 가구 (손가락·마우스를 따라다닌다) */}
      {drag?.moved && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-lg"
          style={{ left: drag.x, top: drag.y, height: drag.height, aspectRatio: String(furnitureInfo(drag.item.assetKey).aspect) }}
        >
          <FurnitureArt assetKey={drag.item.assetKey} className="h-full w-full" />
        </div>
      )}

      <section className="mt-6">
        {/* 구역 제목: 화면에는 그린 아이콘, 글자로는 예전 이모지 그대로 (e2e가 "👕 아바타 꾸미기"로 찾는다) */}
        <h2 className="mb-3 font-display text-2xl">
          <IconEmoji name="clothes" emoji="👕" size={30} className="-mt-1" /> 아바타 꾸미기
        </h2>
        {grid(
          avatars,
          (item) => card(item, worn[item.slot!] === item.id, () => wear(item), {}, SLOT_LABEL[item.slot!]),
          "아직 꾸미기 아이템이 없어요. 상점에서 옷과 모자를 사 보세요.",
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-2xl">
          <IconEmoji name="background" emoji="🖼" size={30} className="-mt-1" /> 내 배경
        </h2>
        {grid(
          items.filter((i) => i.type === "background"),
          (item) => card(item, item.id === current.backgroundItemId, () => equip(item)),
          "",
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 font-display text-2xl">
          <IconEmoji name="furniture" emoji="🪑" size={30} className="-mt-1" /> 가구
        </h2>
        <p className="mb-3 text-sm text-ink-soft">
          가구를 위 미니룸으로 끌어다 놓으세요. 미니룸 밖으로 끌어내면 빠져요. (최대 {MAX_FURNITURE}개, 지금 {placed.length}개)
        </p>
        {grid(
          furniture,
          (item) => {
            const on = placed.some((f) => f.id === item.id);
            // 마우스·터치는 dragProps의 onPointerUp이 처리하고, onClick은 키보드(Enter·Space, detail 0)만 처리한다
            const onKey = (e?: { detail: number }) => e?.detail === 0 && toggleFurniture(item);
            return card(item, on, onKey, dragProps(item, false), on ? "미니룸에 있음" : undefined);
          },
          "아직 가구가 없어요. 상점에서 가구를 사 보세요.",
        )}
      </section>

      {/* 광장 내 집 지붕 색 (TOWN-07): 무료, 배경과 상관없이. 미리 보기는 내 레벨의 집 단계로 (TOWN-11) */}
      <section className="mt-8" data-roof-section>
        <h2 className="mb-1 font-display text-2xl">
          <IconEmoji name="home" emoji="🏠" size={30} className="-mt-1" /> 지붕 색
        </h2>
        <p className="mb-3 text-sm text-ink-soft">광장의 내 집 지붕 색을 골라요. 무료이고 언제든 바꿀 수 있어요.</p>
        <div className="card flex flex-wrap items-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 그린 SVG */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(houseSvg(houseStage, roofHex(roof, background?.assetKey ?? "")))}`}
            alt={`내 집 미리 보기 (${HOUSE_STAGES[houseStage].name})`}
            data-roof-preview={roofHex(roof, background?.assetKey ?? "")}
            className="h-28 w-auto"
          />
          <div className="flex-1">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="지붕 색">
              {(Object.keys(ROOF_COLORS) as RoofColor[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={roof === key}
                  aria-label={ROOF_COLORS[key].name}
                  title={ROOF_COLORS[key].name}
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
              배경 색 따라가기
            </button>
          </div>
        </div>
      </section>

      {/* 예전에 상점에서 캐릭터를 산 회원만: 가진 캐릭터 중에서 바꿀 수 있다 (spec 006 FR-021) */}
      {characters.length > 1 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-2xl">
            <IconEmoji name="pet" emoji="🐾" size={30} className="-mt-1" /> 내 캐릭터
          </h2>
          {grid(characters, (item) => card(item, item.id === current.characterItemId, () => equip(item)), "")}
        </section>
      )}
    </>
  );
}
