// 미니룸 가구 그림 (SHOP-05). 2026-10-11 크레용 그림체 (crayon.ts furniture).
// 가구마다 그림 상자 비율이 다르고, 미니룸 높이에 대한 비율(heightPct)로 크기를 정한다.
// 그래서 휴대폰처럼 좁은 화면에서도 미니룸 높이가 같으면 같은 크기로 보인다.
// 미니룸은 상자의 가운데를 가구 위치(x·y)에 놓는다 (components/character.tsx의 MiniRoom). DB의 asset_key("furn.chair" 등)로 고른다.
import { msg } from "@/lib/i18n";
import { FURN_CANVAS, FURN_FLAT, FURN_PAINT, furniture, pastel, withPaint } from "./crayon";

/** 가구 색 (SHOP-05, 2026-10-13): 방 테마에 맞춰 고르는 8가지. 고르지 않으면(null) 그린 그대로의 기본 색.
 *  DB user_items.color의 CHECK와 같은 목록이어야 한다 */
export const FURNITURE_COLORS = {
  wood: { name: msg("나무"), main: "#b07a48", dark: "#8a5a34", light: "#d8aa78" },
  pink: { name: msg("분홍"), main: "#f5a8bc", dark: "#d9788f", light: "#fbd3dc" },
  sky: { name: msg("하늘"), main: "#9fd0f0", dark: "#6aa8d8", light: "#d4ecfa" },
  mint: { name: msg("민트"), main: "#a8dcc0", dark: "#6fb894", light: "#d4efe0" },
  lemon: { name: msg("노랑"), main: "#f8e08a", dark: "#e0b84a", light: "#fcefc0" },
  lilac: { name: msg("보라"), main: "#c9b4ec", dark: "#9a80d0", light: "#e6daf6" },
  white: { name: msg("하양"), main: "#f7f3ec", dark: "#d8cfc0", light: "#ffffff" },
  navy: { name: msg("남색"), main: "#6a7bb0", dark: "#46558a", light: "#9eabd6" },
} as const;
export type FurnitureColor = keyof typeof FURNITURE_COLORS;
export const FURNITURE_COLOR_KEYS = Object.keys(FURNITURE_COLORS) as FurnitureColor[];
export const isFurnitureColor = (v: unknown): v is FurnitureColor => typeof v === "string" && Object.hasOwn(FURNITURE_COLORS, v);

/** 색을 붙인 가구 키: "furn.chair@pink". 색이 없으면 가구 키 그대로 (캐릭터의 "모습 키"와 같은 방식) */
export const paintedFurnitureKey = (assetKey: string, color: string | null | undefined) => (isFurnitureColor(color) ? `${assetKey}@${color}` : assetKey);
/** 색을 붙인 가구 키 풀기 */
export function parseFurnitureKey(key: string): { assetKey: string; color: FurnitureColor | null } {
  const [assetKey, color] = key.split("@");
  return { assetKey, color: isFurnitureColor(color) ? color : null };
}

const HEIGHT_PCT: Record<string, number> = {
  "furn.plant": 26, "furn.chair": 32, "furn.lamp": 44, "furn.desk": 34, "furn.bed": 34,
  "furn.bookshelf": 46, "furn.tv": 36, "furn.teddy": 22, "furn.rug": 15, "furn.console": 17,
  "furn.rocket": 50, "furn.basket": 24, "furn.cloud": 24, "furn.rainbow": 36,
};

const canvasOf = (key: string): [number, number] => FURN_CANVAS[parseFurnitureKey(key).assetKey] ?? [168, 168];

export function furnitureInfo(key: string) {
  const { assetKey } = parseFurnitureKey(key);
  const [w, h] = canvasOf(assetKey);
  // flat: 러그처럼 바닥에 까는 가구는 늘 캐릭터·다른 가구 뒤에 놓는다
  return { heightPct: HEIGHT_PCT[assetKey] ?? 24, aspect: w / h, flat: FURN_FLAT.has(assetKey) };
}

/** 같은 가구는 한 번만 그린다 */
const cache = new Map<string, string>();

/** 가구 SVG 문자열. assetKey는 색을 붙인 키("furn.chair@pink")도 된다. height는 픽셀 높이 (너비는 비율에 맞춘다).
 *  grass: 상점 썸네일처럼 발밑에 풀밭 조각을 깐다 (기본은 어느 배경에도 어울리는 흐린 그림자) */
export function furnitureSvg(assetKey: string, height = 120, { grass = false }: { grass?: boolean } = {}): string {
  const key = `${assetKey}|${grass ? 1 : 0}`;
  let art = cache.get(key);
  if (art === undefined) {
    const { assetKey: base, color } = parseFurnitureKey(assetKey);
    const tone = color ? FURNITURE_COLORS[color] : null;
    const map = tone ? Object.fromEntries(Object.entries(FURN_PAINT[base] ?? {}).map(([from, to]) => [from, tone[to]])) : null;
    art = pastel(() => withPaint(map, () => furniture(base, grass))); // 2026-10-12 파스텔 크레용 그림체
    cache.set(key, art);
  }
  const [w, h] = canvasOf(assetKey);
  const width = Math.round((height * w) / h);
  return art.replace(/ width="\d+" height="\d+"/, ` width="${width}" height="${height}"`);
}

export function furnitureDataUri(assetKey: string, height = 120, opts: { grass?: boolean } = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(furnitureSvg(assetKey, height, opts))}`;
}
