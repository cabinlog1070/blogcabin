// 미니룸 자리 규칙 (SHOP-05). 좌표는 미니룸 기준 %(0~100). 서버 저장과 화면 그리기가 같은 계산을 쓴다
// (화면은 @/lib/shop, @/lib/art/furniture로 다시 읽는다)

/** 가구 그림 상자 크기 (그림 코드 crayon.ts의 캔버스) */
export const FURN_CANVAS: Record<string, [number, number]> = {
  "furn.plant": [160, 224], "furn.chair": [176, 240], "furn.lamp": [160, 336], "furn.desk": [360, 240], "furn.bed": [440, 256],
  // 2026-10-13 새 가구 9종
  "furn.bookshelf": [240, 320], "furn.tv": [280, 260], "furn.teddy": [200, 220], "furn.rug": [440, 140], "furn.console": [260, 200],
  "furn.rocket": [220, 360], "furn.basket": [220, 220], "furn.cloud": [320, 200], "furn.rainbow": [400, 240],
};
/** 바닥에 까는 가구 (그림자 없이 납작하게, 늘 캐릭터·다른 가구 뒤에) */
export const FURN_FLAT = new Set(["furn.rug"]);

/** 미니룸 높이에 대한 가구 높이 비율(%) */
const HEIGHT_PCT: Record<string, number> = {
  "furn.plant": 26, "furn.chair": 32, "furn.lamp": 44, "furn.desk": 34, "furn.bed": 34,
  "furn.bookshelf": 46, "furn.tv": 36, "furn.teddy": 22, "furn.rug": 15, "furn.console": 17,
  "furn.rocket": 50, "furn.basket": 24, "furn.cloud": 24, "furn.rainbow": 36,
};

/** 색을 붙인 가구 키("furn.chair@pink")에서 가구 키만 */
const baseKey = (key: string) => key.split("@")[0];

export function furnitureInfo(key: string) {
  const assetKey = baseKey(key);
  const [w, h] = FURN_CANVAS[assetKey] ?? [168, 168];
  // flat: 러그처럼 바닥에 까는 가구는 늘 캐릭터·다른 가구 뒤에 놓는다
  return { heightPct: HEIGHT_PCT[assetKey] ?? 24, aspect: w / h, flat: FURN_FLAT.has(assetKey) };
}

/** 벽 장식 (SHOP-05, 2026-10-13): 바닥이 아니라 벽에 붙이는 가구 */
export const WALL_FURNITURE = new Set(["furn.rocket", "furn.cloud", "furn.rainbow"]);
export const isWallFurniture = (key: string) => WALL_FURNITURE.has(baseKey(key));

/** 미니룸 배경(crayon.ts room, 1040×520)에서 벽 장식이 가리면 안 되는 곳 (미니룸 기준 %).
 *  창문은 커튼·창턱까지, 액자는 거는 끈까지. 바닥선은 y 370/520 */
const WALL_BLOCKS = [
  { x0: 3, x1: 29.5, y0: 9, y1: 50 }, // 창문
  { x0: 78.5, x1: 91.5, y0: 12, y1: 37 }, // 액자
];
const WALL_BOTTOM = 71;

/** 벽 장식 자리 맞추기: 벽 안에 들어가고 창문·액자와 겹치지 않는 곳 중에서 놓은 자리에 가장 가까운 곳.
 *  다른 가구는 그대로 돌려준다. 서버 저장과 그리기(예전에 놓은 자리) 모두 이것을 거친다 */
export function fitRoomSpot(key: string, x: number, y: number): { x: number; y: number } {
  if (!isWallFurniture(key)) return { x, y };
  const { heightPct, aspect } = furnitureInfo(key);
  const hh = heightPct / 2;
  const hw = (heightPct * aspect) / 4; // 미니룸은 2:1이라 너비 % = 높이 % × 비율 ÷ 2
  const fits = (cx: number, cy: number) =>
    cx - hw >= 0 && cx + hw <= 100 && cy - hh >= 0 && cy + hh <= WALL_BOTTOM &&
    WALL_BLOCKS.every((b) => cx + hw <= b.x0 || cx - hw >= b.x1 || cy + hh <= b.y0 || cy - hh >= b.y1);
  if (fits(x, y)) return { x, y };
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let cx = 0; cx <= 100; cx += 0.5) {
    for (let cy = 0; cy <= WALL_BOTTOM; cy += 0.5) {
      const d = (cx - x) ** 2 + ((cy - y) / 2) ** 2; // 미니룸은 2:1이라 세로 %는 절반 거리
      if (d < bestD && fits(cx, cy)) [best, bestD] = [{ x: cx, y: cy }, d];
    }
  }
  return best ?? { x: 54, y: Math.min(WALL_BOTTOM - hh, Math.max(hh, y)) };
}

/** 미니룸 위치(%)를 0~100 안으로 */
export function clampPct(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}

/** 미니룸 안 캐릭터·펫 자리 (SHOP-05, 2026-10-13). 좌표는 미니룸 기준 %, 발이 닿는 곳 */
export type RoomSpot = { x: number; y: number };
/** 캐릭터를 옮기지 않았을 때의 자리: 가운데 아래 */
export const ROOM_CHARACTER_SPOT: RoomSpot = { x: 50, y: 88 };
/** 캐릭터 발은 바닥 근처에만 (너무 위로 올리면 몸이 잘리고, 너무 아래면 발밑 닉네임이 잘린다) */
export const clampCharacterSpot = (s: RoomSpot): RoomSpot => ({ x: clampPct(Math.min(94, Math.max(6, s.x))), y: clampPct(Math.min(92, Math.max(55, s.y))) });
/** 놓은 펫이 돌아다니는 바닥 범위 */
export const PET_FLOOR = { minX: 6, maxX: 94, minY: 74, maxY: 98 };
export const clampPetSpot = (s: RoomSpot): RoomSpot => ({
  x: clampPct(Math.min(PET_FLOOR.maxX, Math.max(PET_FLOOR.minX, s.x))),
  y: clampPct(Math.min(PET_FLOOR.maxY, Math.max(PET_FLOOR.minY, s.y))),
});
