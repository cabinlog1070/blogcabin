"use client";

// 꾸미기 화면 (SHOP-04·05·06, TOWN-07). 2026-10-13: 캐릭터 꾸미기 / 미니룸 꾸미기 / 집 테마 탭 3개.
// 컴퓨터에서는 왼쪽에 미니룸, 오른쪽에 고르는 칸. 휴대폰에서는 미니룸이 위에 있다.
// 고르는 것은 화면에만 바로 보이고, [저장하기]를 눌러야 한 번에 저장된다 (saveCloset).
import { useEffect, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { FurnitureArt, MiniRoom, type RoomFurniture, type RoomPet } from "@/components/character";
import { useT } from "@/components/i18n";
import { IconEmoji } from "@/components/icon-emoji";
import { ItemArt } from "@/components/item-art";
import { PetArt } from "@/components/pet-art";
import {
  backgroundDataUri,
  canWear,
  composeLook,
  fitRoomSpot,
  FURNITURE_COLOR_KEYS,
  FURNITURE_COLORS,
  furnitureInfo,
  isFurnitureColor,
  isWallFurniture,
  MANNEQUIN,
  paintedFurnitureKey,
  type FurnitureColor,
} from "@/lib/assets";
import { HOUSE_STAGES, houseSvg, ROOF_COLORS, roofHex, type HouseStage, type RoofColor } from "@/lib/art/town";
import { msg } from "@/lib/i18n";
import { clampCharacterSpot, clampPct, clampPetSpot, CLOSET_TABS, ROOM_CHARACTER_SPOT, type ClosetTab, type ItemType, type RoomSpot } from "@/lib/shop";
import { saveCloset, type ClosetDraft } from "./actions";

type OwnedItem = { id: number; type: ItemType; slot: string | null; name: string; assetKey: string; color?: string | null };
type Message = { ok: boolean; text: string } | null;

const TAB_LABEL: Record<ClosetTab, { icon: string; name: string; short: string }> = {
  char: { icon: "👕", name: msg("캐릭터 꾸미기"), short: msg("캐릭터") },
  room: { icon: "🛋", name: msg("미니룸 꾸미기"), short: msg("미니룸") },
  house: { icon: "🏠", name: msg("집 테마"), short: msg("집 테마") },
};

/** 캐릭터 꾸미기 칸: 상점과 같은 나눔 (헤어 → 모자 → 상의 → 하의 → 신발) */
const WEAR_TABS = [
  { slot: "hair", label: msg("💇 헤어") },
  { slot: "hat", label: msg("🎩 모자") },
  { slot: "top", label: msg("👕 상의") },
  { slot: "bottom", label: msg("👖 하의") },
  { slot: "shoes", label: msg("👟 신발") },
] as const;
/** 캐릭터 그림에 입히는 순서 (아래에 깔리는 것부터) */
const DRAW_ORDER = ["hair", "bottom", "top", "shoes", "hat"];
/** 미니룸 꾸미기 칸 */
type RoomTab = "floor" | "wall" | "pet";

/** 꾸미기 화면의 미니룸 영역 (화면에 하나뿐). 끌기가 끝날 때 이 안에 놓였는지 본다 */
const roomRect = () => document.querySelector("[data-mini-room]")?.getBoundingClientRect();

/** 끌고 있는 가구: 화면 좌표(px)와 미니룸에서 보일 크기 */
type Drag = { item: OwnedItem; fromRoom: boolean; startX: number; startY: number; x: number; y: number; moved: boolean; height: number };
/** 미니룸 안에서 바로 끌어 옮기는 캐릭터·펫: 누른 곳과 발 자리의 차이(%)를 지켜서 손가락을 따라간다 */
type LiveDrag = { kind: "character" | "pet"; startX: number; startY: number; dx: number; dy: number; moved: boolean };
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

/** 화면에서 고치는 중인 꾸미기 (저장하기를 누르면 ClosetDraft로 보낸다) */
type Draft = {
  characterItemId: number;
  backgroundItemId: number;
  worn: Partial<Record<string, number>>;
  roof: string | null;
  placed: RoomFurniture[]; // assetKey는 색을 붙인 키
  colors: Record<number, FurnitureColor | null>;
  charAt: RoomSpot;
  petAt: RoomSpot | null;
};

const FAIL = msg("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요");

export function ClosetView({
  items,
  equipped,
  nickname,
  roofColor,
  houseStage,
  pet = null,
  characterSpot = null,
  petSpot = null,
  initialTab = "char",
}: {
  items: OwnedItem[];
  equipped: {
    characterItemId: number;
    backgroundItemId: number;
    worn: { slot: string; itemId: number }[];
    furniture: { itemId: number; assetKey: string; x: number; y: number }[];
  };
  nickname: string;
  roofColor: string | null; // 고른 지붕 색 (TOWN-07). null = 배경 색 따라가기
  houseStage: HouseStage; // 내 레벨로 정한 집 단계 (TOWN-11), 미리 보기도 같은 단계로
  pet?: RoomPet | null; // 데리고 다니는 펫 (미니룸에 놓을 수 있다)
  characterSpot?: RoomSpot | null; // 미니룸 안 캐릭터 발 자리 (null = 가운데 아래)
  petSpot?: RoomSpot | null; // 미니룸에 놓은 펫 자리 (null = 캐릭터 옆)
  initialTab?: ClosetTab;
}) {
  const t = useT();
  const furniture = items.filter((i) => i.type === "furniture");
  const [saved, setSaved] = useState<Draft>(() => {
    const colors = Object.fromEntries(furniture.map((i) => [i.id, isFurnitureColor(i.color) ? i.color : null])) as Record<number, FurnitureColor | null>;
    return {
      characterItemId: equipped.characterItemId,
      backgroundItemId: equipped.backgroundItemId,
      worn: Object.fromEntries(equipped.worn.map((w) => [w.slot, w.itemId])),
      roof: roofColor,
      placed: equipped.furniture.map((f) => ({ id: f.itemId, assetKey: f.assetKey, x: f.x, y: f.y })),
      colors,
      charAt: characterSpot ?? ROOM_CHARACTER_SPOT,
      petAt: petSpot,
    };
  });
  const [draft, setDraft] = useState<Draft>(saved);
  const [tab, setTab] = useState<ClosetTab>(initialTab);
  const [wearTab, setWearTab] = useState<string>("hair");
  const [roomTab, setRoomTab] = useState<RoomTab>("floor");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<LiveDrag | null>(null);
  const [petCardDrag, setPetCardDrag] = useState<PetCardDrag | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // "저장했어요"는 2초 뒤에 사라진다
  useEffect(() => {
    if (!message?.ok) return;
    const timer = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [message]);

  // 저장하지 않고 창을 닫거나 새로고침하면 브라우저가 한 번 묻는다
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const byId = (id: number | null | undefined) => items.find((i) => i.id === id);
  const character = byId(draft.characterItemId);
  const background = byId(draft.backgroundItemId);
  const look = composeLook(
    character?.assetKey ?? "",
    DRAW_ORDER.map((s) => byId(draft.worn[s])?.assetKey ?? "").filter(Boolean),
  );
  // 꾸미기 카드 그림: 내 캐릭터(남자·여자 주민)에 입혀서, 아니면 마네킹에
  const wearer = character && canWear(character.assetKey) ? character.assetKey : MANNEQUIN;

  function save() {
    const sent = draft;
    const body: ClosetDraft = {
      characterItemId: sent.characterItemId,
      backgroundItemId: sent.backgroundItemId,
      worn: sent.worn,
      roof: sent.roof,
      furniture: sent.placed.map((f) => ({ itemId: f.id, x: f.x, y: f.y })),
      colors: Object.fromEntries(Object.entries(sent.colors).filter(([id, c]) => c !== saved.colors[Number(id)])),
      character: sent.charAt,
      pet: sent.petAt,
    };
    setMessage(null);
    start(async () => {
      try {
        const r = await saveCloset(body);
        if (r.ok) {
          setSaved(sent);
          setMessage({ ok: true, text: t("저장했어요 ✓ 내 블로그 미니룸과 광장에 바로 보여요") });
        } else setMessage({ ok: false, text: r.error ?? t(FAIL) });
      } catch {
        // 서버 오류(네트워크, DB 등)도 오류 화면 대신 알려준다. 고친 내용은 화면에 그대로 남는다
        setMessage({ ok: false, text: t(FAIL) });
      }
    });
  }

  function revert() {
    setDraft(saved);
    setSelectedId(null);
    setMessage(null);
  }

  // ===== 캐릭터 꾸미기 (SHOP-06) =====
  // 부위마다 하나. 입은 것을 다시 누르면 벗는다. 헤어는 벗을 수 없다
  function wear(item: OwnedItem) {
    if (!item.slot) return;
    const on = draft.worn[item.slot] === item.id;
    if (on && item.slot === "hair") return;
    update({ worn: { ...draft.worn, [item.slot]: on ? undefined : item.id } });
  }

  // ===== 가구 (SHOP-05) =====
  /** 고른 색을 붙인 가구 키 */
  const painted = (item: OwnedItem, colors = draft.colors) =>
    item.type === "furniture" ? paintedFurnitureKey(item.assetKey, colors[item.id]) : item.assetKey;

  function paint(item: OwnedItem, color: FurnitureColor | null) {
    const colors = { ...draft.colors, [item.id]: color };
    const key = painted(item, colors);
    update({ colors, placed: draft.placed.map((f) => (f.id === item.id ? { ...f, assetKey: key } : f)) });
  }

  function place(item: OwnedItem, x: number, y: number) {
    // 벽 장식은 벽 안, 창문·액자를 가리지 않는 가장 가까운 자리로 맞춘다
    const at = fitRoomSpot(item.assetKey, clampPct(x), clampPct(y));
    const spot = { id: item.id, assetKey: painted(item), x: at.x, y: at.y };
    const already = draft.placed.some((f) => f.id === item.id);
    update({ placed: already ? draft.placed.map((f) => (f.id === item.id ? spot : f)) : [...draft.placed, spot] });
    setSelectedId(item.id);
  }

  function remove(item: OwnedItem) {
    update({ placed: draft.placed.filter((f) => f.id !== item.id) });
    if (selectedId === item.id) setSelectedId(null);
  }

  /** 목록의 가구를 누르면(끌지 않고): 미니룸에 없으면 빈 자리에 놓고, 있으면 색을 고르도록 고른다. 키보드로도 쓸 수 있다 */
  function pickFurniture(item: OwnedItem) {
    if (draft.placed.some((f) => f.id === item.id)) setSelectedId(item.id);
    else if (isWallFurniture(item.assetKey)) place(item, 54, 25);
    else place(item, 18 + ((draft.placed.length * 16) % 64), 80);
  }

  // ===== 미니룸 안 캐릭터·펫 (SHOP-05) =====
  /** 펫 카드를 누르면(끌지 않고) 미니룸에 놓거나, 놓여 있으면 캐릭터 옆으로 되돌린다 */
  function togglePet() {
    update({ petAt: draft.petAt ? null : PET_DEFAULT_SPOT });
  }

  /** 미니룸 안의 캐릭터·놓은 펫을 끌어 옮긴다. 펫은 미니룸 밖으로 끌어내면 캐릭터 옆으로 돌아간다 */
  function liveProps(kind: "character" | "pet") {
    const spotOf = () => (kind === "character" ? draft.charAt : draft.petAt);
    return {
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        const rect = roomRect();
        const spot = spotOf();
        if (e.button !== 0 || !rect || !spot) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = toRoomPct(rect, e.clientX, e.clientY);
        setLive({ kind, startX: e.clientX, startY: e.clientY, dx: spot.x - p.x, dy: spot.y - p.y, moved: false });
      },
      onPointerMove(e: ReactPointerEvent<HTMLElement>) {
        const rect = roomRect();
        if (!live || live.kind !== kind || !rect) return;
        const moved = live.moved || Math.hypot(e.clientX - live.startX, e.clientY - live.startY) > 6;
        if (!moved) return;
        const p = toRoomPct(rect, e.clientX, e.clientY);
        const to = { x: p.x + live.dx, y: p.y + live.dy };
        if (kind === "character") update({ charAt: clampCharacterSpot(to) });
        else update({ petAt: clampPetSpot(to) });
        if (!live.moved) setLive({ ...live, moved });
      },
      onPointerUp(e: ReactPointerEvent<HTMLElement>) {
        if (!live || live.kind !== kind) return;
        setLive(null);
        if (live.moved && kind === "pet" && !insideRect(roomRect(), e.clientX, e.clientY)) update({ petAt: null });
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
      if (rect && insideRect(rect, e.clientX, e.clientY)) update({ petAt: clampPetSpot(toRoomPct(rect, e.clientX, e.clientY)) });
    },
    onPointerCancel() {
      setPetCardDrag(null);
    },
  };

  /** 포인터(마우스·터치·펜)로 가구 끌기. 포인터 캡처로 미니룸 밖으로 나가도 계속 따라온다 */
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
          // 끌지 않고 눌렀다 떼면: 미니룸 안 가구는 색 고르기, 목록 카드는 놓기·고르기
          if (fromRoom) {
            setSelectedId(item.id);
            setTab("room");
          } else pickFurniture(item);
          return;
        }
        const rect = roomRect();
        if (rect && insideRect(rect, e.clientX, e.clientY)) {
          const p = toRoomPct(rect, e.clientX, e.clientY);
          place(item, p.x, p.y);
        } else if (fromRoom) remove(item); // 미니룸 밖으로 끌어내면 빠진다
      },
      onPointerCancel() {
        setDrag(null);
      },
    };
  }

  const grid = (list: OwnedItem[], render: (item: OwnedItem) => ReactNode, empty: string, cols = "grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4") =>
    list.length ? <div className={`grid gap-2.5 ${cols}`}>{list.map(render)}</div> : <p className="card p-4 text-center text-sm text-ink-soft">{empty}</p>;

  const card = (
    item: OwnedItem,
    { on, onClick, extra = {}, sub, art }: { on: boolean; onClick: (e?: { detail: number }) => void; extra?: object; sub?: string; art?: ReactNode },
  ) => (
    <button
      key={item.id}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...extra}
      className={`card p-2 text-center transition hover:-translate-y-0.5 ${on ? "border-sun! bg-honey" : ""} ${item.type === "furniture" ? "touch-none select-none" : ""} ${selectedId === item.id && tab === "room" ? "ring-2 ring-ember ring-offset-2 ring-offset-cream" : ""}`}
    >
      {art ?? <ItemArt type={item.type} assetKey={painted(item)} className="pointer-events-none h-20" characterSize={70} wearer={wearer} />}
      <span className="mt-1 block text-sm font-bold">
        {on && "✓ "}
        {t(item.name)}
      </span>
      {sub && <span className="block text-xs text-ink-soft">{sub}</span>}
    </button>
  );

  const pill = (label: string, on: boolean, onClick: () => void, key: string, data?: object) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      {...data}
      className={`rounded-full border-2 px-3.5 py-1 text-sm font-bold transition ${on ? "border-ink bg-honey text-ink" : "border-line bg-paper text-ink-soft hover:text-ink"}`}
    >
      {label}
    </button>
  );

  const swatch = (key: string, name: string, hex: string, on: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={name}
      title={name}
      onClick={onClick}
      className={`h-9 w-9 rounded-full border-4 transition hover:-translate-y-0.5 ${on ? "border-ink" : "border-white shadow-[0_0_0_2px_var(--color-line)]"}`}
      style={{ background: hex }}
    />
  );

  // ===== 오른쪽(휴대폰은 아래) 고르는 칸 =====
  const characters = items.filter((i) => i.type === "character");
  const avatars = items.filter((i) => i.type === "avatar");
  const selected = byId(selectedId);
  const selectedPlaced = selected && draft.placed.some((f) => f.id === selected.id);

  let panel: ReactNode = null;
  if (tab === "char") {
    // 예전에 상점에서 캐릭터를 산 회원만: 가진 캐릭터 중에서 바꿀 수 있다 (spec 006 FR-021)
    const tabs = [...WEAR_TABS.map((w) => ({ key: w.slot as string, label: t(w.label) })), ...(characters.length > 1 ? [{ key: "character", label: t("🐾 캐릭터") }] : [])];
    const list = wearTab === "character" ? characters : avatars.filter((i) => i.slot === wearTab);
    panel = (
      <section data-wear-section aria-label={t("캐릭터 꾸미기")}>
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label={t("옷 종류")}>
          {tabs.map((w) => pill(w.label, wearTab === w.key, () => setWearTab(w.key), w.key, { "data-wear-tab": w.key }))}
        </div>
        {grid(
          list,
          (item) =>
            wearTab === "character"
              ? card(item, { on: item.id === draft.characterItemId, onClick: () => update({ characterItemId: item.id }) })
              : card(item, { on: draft.worn[item.slot!] === item.id, onClick: () => wear(item), sub: draft.worn[item.slot!] === item.id && item.id !== saved.worn[item.slot!] ? t("입어 보는 중") : undefined }),
          wearTab === "hair" ? t("아직 가진 헤어가 없어요. 상점에서 헤어를 받아 보세요.") : t("아직 이 종류의 옷이 없어요. 상점에서 사 보세요."),
        )}
      </section>
    );
  } else if (tab === "room") {
    const list = furniture.filter((i) => (roomTab === "wall") === isWallFurniture(i.assetKey));
    panel = (
      <>
        {/* 가구 색 (SHOP-05): 미니룸이나 목록에서 누른 가구의 색을 고른다. 저장하기 버튼 바로 아래 */}
        <section className="card mb-3 p-3" data-furniture-color-section aria-label={t("가구 색")}>
          {selected && selectedPlaced ? (
            <div className="flex items-center gap-3">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-cream p-3" data-furniture-color-preview={draft.colors[selected.id] ?? "default"}>
                <FurnitureArt assetKey={painted(selected)} className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-2 font-bold">
                  <IconEmoji name="furniture" emoji="🎨" size={22} className="-mt-0.5" /> {t("{name} 색", { name: t(selected.name) })}
                </p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("{name} 색", { name: t(selected.name) })}>
                  {FURNITURE_COLOR_KEYS.map((key) =>
                    swatch(key, t(FURNITURE_COLORS[key].name), FURNITURE_COLORS[key].main, draft.colors[selected.id] === key, () => paint(selected, key)),
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={!draft.colors[selected.id]} onClick={() => paint(selected, null)} aria-pressed={!draft.colors[selected.id]} className="btn bg-paper py-1 text-xs text-ink">
                    {t("기본 색")}
                  </button>
                  <button type="button" onClick={() => remove(selected)} className="btn bg-paper py-1 text-xs text-berry" data-remove-furniture>
                    {t("미니룸에서 빼기")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-2 text-center text-sm text-ink-soft">{t("미니룸이나 아래 목록에서 가구를 누르면 색을 바꿀 수 있어요.")}</p>
          )}
        </section>
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label={t("가구 종류")}>
          {pill(t("🪑 바닥 가구"), roomTab === "floor", () => setRoomTab("floor"), "floor", { "data-room-tab": "floor" })}
          {pill(t("🌈 벽 장식"), roomTab === "wall", () => setRoomTab("wall"), "wall", { "data-room-tab": "wall" })}
          {pill(t("🐾 펫"), roomTab === "pet", () => setRoomTab("pet"), "pet", { "data-room-tab": "pet" })}
        </div>
        {roomTab === "pet" ? (
          // 미니룸 펫 (SHOP-05): 데리고 다니는 펫을 미니룸에 놓으면 블로그 홈 미니룸에서 돌아다닌다
          <section data-room-pet-section aria-label={t("미니룸 펫")}>
            {pet ? (
              <>
                <p className="mb-3 text-sm text-ink-soft">
                  {t("데리고 다니는 펫을 미니룸으로 끌어다 놓으면 방 안을 돌아다녀요. 미니룸 밖으로 끌어내면 다시 캐릭터 옆으로 와요.")}
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    aria-pressed={draft.petAt !== null}
                    {...petCardProps}
                    // 마우스·터치는 petCardProps가 처리하고, onClick은 키보드(Enter·Space, detail 0)만 처리한다
                    onClick={(e) => e.detail === 0 && togglePet()}
                    className={`card touch-none select-none p-2 text-center transition hover:-translate-y-0.5 ${draft.petAt ? "border-sun! bg-honey" : ""}`}
                    data-room-pet-card
                  >
                    <span className="pointer-events-none flex h-20 items-center justify-center rounded-xl bg-cream">
                      <PetArt assetKey={pet.assetKey} stage={pet.stage} accessory={pet.accessory} color={pet.color} size={64} />
                    </span>
                    <span className="mt-1 block text-sm font-bold">
                      {draft.petAt && "✓ "}
                      {pet.name}
                    </span>
                    <span className="block text-xs text-ink-soft">{draft.petAt ? t("미니룸에서 노는 중") : t("캐릭터 옆")}</span>
                  </button>
                </div>
              </>
            ) : (
              <p className="card p-4 text-center text-sm text-ink-soft">{t("동물 농장에서 데리고 다닐 펫을 고르면 미니룸에 놓을 수 있어요.")}</p>
            )}
          </section>
        ) : (
          <section data-furniture-section={roomTab} aria-label={roomTab === "wall" ? t("벽 장식") : t("바닥 가구")}>
            <p className="mb-2 text-xs text-ink-soft">
              {roomTab === "wall"
                ? t("벽 장식은 벽에만 붙고, 창문과 액자를 가리지 않는 자리로 놓여요.")
                : t("가구를 미니룸으로 끌어다 놓으세요. 미니룸 밖으로 끌어내면 빠져요. (지금 {n}개)", { n: draft.placed.length })}
            </p>
            {grid(
              list,
              (item) => {
                const on = draft.placed.some((f) => f.id === item.id);
                // 마우스·터치는 dragProps의 onPointerUp이 처리하고, onClick은 키보드(Enter·Space, detail 0)만 처리한다
                const onKey = (e?: { detail: number }) => e?.detail === 0 && pickFurniture(item);
                return card(item, { on, onClick: onKey, extra: dragProps(item, false), sub: on ? t("미니룸에 있음") : undefined });
              },
              roomTab === "wall" ? t("아직 벽 장식이 없어요. 상점에서 구름·무지개·우주선을 사 보세요.") : t("아직 가구가 없어요. 상점에서 가구를 사 보세요."),
            )}
          </section>
        )}
      </>
    );
  } else {
    const roof = draft.roof;
    panel = (
      <>
        {/* 광장 내 집 지붕 색 (TOWN-07): 무료, 배경과 상관없이. 미리 보기는 내 레벨의 집 단계로 (TOWN-11) */}
        <section className="card mb-4 flex flex-wrap items-center gap-4 p-3" data-roof-section aria-label={t("지붕 색")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 그린 SVG */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(houseSvg(houseStage, roofHex(roof, background?.assetKey ?? "")))}`}
            alt={t("내 집 미리 보기 ({stage})", { stage: t(HOUSE_STAGES[houseStage].name) })}
            data-roof-preview={roofHex(roof, background?.assetKey ?? "")}
            className="h-24 w-auto"
          />
          <div className="min-w-0 flex-1">
            <p className="mb-2 font-bold">
              <IconEmoji name="home" emoji="🏠" size={22} className="-mt-0.5" /> {t("지붕 색")}
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("지붕 색")}>
              {(Object.keys(ROOF_COLORS) as RoofColor[]).map((key) => swatch(key, t(ROOF_COLORS[key].name), ROOF_COLORS[key].hex, roof === key, () => update({ roof: key })))}
            </div>
            <button type="button" disabled={roof === null} onClick={() => update({ roof: null })} aria-pressed={roof === null} className="btn mt-2 bg-paper py-1 text-xs text-ink">
              {t("벽지 색 따라가기")}
            </button>
          </div>
        </section>
        <section data-wallpaper-section aria-label={t("벽지")}>
          <h3 className="mb-2 font-bold">
            <IconEmoji name="background" emoji="🖼" size={22} className="-mt-0.5" /> {t("벽지")}
          </h3>
          {grid(
            items.filter((i) => i.type === "background"),
            (item) =>
              card(item, {
                on: item.id === draft.backgroundItemId,
                onClick: () => update({ backgroundItemId: item.id }),
                // eslint-disable-next-line @next/next/no-img-element -- 코드로 그린 SVG
                art: <img src={backgroundDataUri(item.assetKey, 240)} alt="" className="pointer-events-none h-16 w-full rounded-xl object-cover" />,
              }),
            "",
            "grid-cols-3",
          )}
        </section>
      </>
    );
  }

  return (
    <>
      {/* 탭 3개: 캐릭터 꾸미기 / 미니룸 꾸미기 / 집 테마. 휴대폰에서는 짧은 이름 */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border-2 border-line bg-paper p-1" role="tablist" aria-label={t("꾸미기")}>
        {CLOSET_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            data-closet-tab={key}
            className={`rounded-xl px-2 py-2.5 text-center text-sm font-bold transition sm:text-base ${tab === key ? "bg-leaf text-white shadow" : "text-ink-soft hover:text-ink"}`}
          >
            {TAB_LABEL[key].icon} <span className="sm:hidden">{t(TAB_LABEL[key].short)}</span>
            <span className="max-sm:hidden">{t(TAB_LABEL[key].name)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
        {/* 왼쪽(휴대폰은 위): 미니룸. 컴퓨터에서는 스크롤해도 따라온다 */}
        <div className="md:sticky md:top-20">
          <MiniRoom
            characterAsset={look}
            backgroundAsset={background?.assetKey ?? ""}
            nickname={nickname}
            furniture={draft.placed}
            hiddenFurnitureId={drag?.fromRoom && drag.moved ? drag.item.id : null}
            selectedFurnitureId={tab === "room" ? selectedId : null}
            furnitureProps={(f) => {
              const item = byId(f.id);
              return item ? { ...dragProps(item, true), title: t("{name} (누르면 색 바꾸기, 끌어서 옮기기, 밖으로 끌어내면 빠져요)", { name: t(item.name) }) } : {};
            }}
            pet={pet}
            characterSpot={draft.charAt}
            petSpot={draft.petAt}
            petWander={false}
            characterProps={{ ...liveProps("character"), title: t("끌어서 캐릭터 자리 옮기기") }}
            petProps={pet ? { ...liveProps("pet"), title: t("{name} (끌어서 옮기기, 밖으로 끌어내면 캐릭터 옆으로 돌아와요)", { name: pet.name }) } : undefined}
            className="w-full rounded-2xl border-2 border-line shadow-[0_4px_0_0_var(--color-line)]"
          />
          <p className="mt-2 text-center text-xs text-ink-soft">
            {tab === "char" && t("입어 본 옷이 바로 미니룸 캐릭터에 보여요. 캐릭터는 끌어서 자리를 옮길 수 있어요.")}
            {tab === "room" && t("가구·캐릭터·펫을 끌어서 옮기고, 가구를 누르면 색을 바꿀 수 있어요.")}
            {tab === "house" && t("벽지를 바꾸면 미니룸 배경이 바뀌어요.")}
          </p>
        </div>

        {/* 오른쪽(휴대폰은 아래): 저장하기 + 고르는 칸 */}
        <div>
          <div className={`card mb-3 flex items-center justify-between gap-3 p-3 ${dirty ? "border-sun! bg-honey" : ""}`} data-save-bar={dirty ? "dirty" : "clean"}>
            <p role="status" aria-live="polite" className={`min-w-0 text-sm ${message ? (message.ok ? "font-bold text-leaf-dark" : "font-bold text-berry") : "text-ink-soft"}`}>
              {message?.text ?? (dirty ? t("바꾼 것이 있어요. 저장하기를 눌러야 적용돼요.") : t("모두 저장되어 있어요."))}
            </p>
            <div className="flex shrink-0 gap-1.5">
              {dirty && (
                <button type="button" onClick={revert} disabled={pending} className="btn bg-paper px-3 text-sm text-ink">
                  {t("되돌리기")}
                </button>
              )}
              <button type="button" onClick={save} disabled={!dirty || pending} className="btn bg-leaf px-4 text-white disabled:opacity-50" data-save-closet>
                💾 {pending ? t("저장하는 중…") : t("저장하기")}
              </button>
            </div>
          </div>
          {panel}
        </div>
      </div>

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
    </>
  );
}
