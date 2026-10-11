// 미니룸 가구 그림 (SHOP-05). 2026-10-11 크레용 그림체 (crayon.ts furniture).
// 가구마다 그림 상자 비율이 다르고, 미니룸 높이에 대한 비율(heightPct)로 크기를 정한다.
// 그래서 휴대폰처럼 좁은 화면에서도 미니룸 높이가 같으면 같은 크기로 보인다.
// 미니룸은 상자의 가운데를 가구 위치(x·y)에 놓는다 (components/character.tsx의 MiniRoom). DB의 asset_key("furn.chair" 등)로 고른다.
import { FURN_CANVAS, furniture } from "./crayon";

const HEIGHT_PCT: Record<string, number> = { "furn.plant": 26, "furn.chair": 32, "furn.lamp": 44, "furn.desk": 34, "furn.bed": 34 };

const canvasOf = (assetKey: string): [number, number] => FURN_CANVAS[assetKey] ?? [168, 168];

export function furnitureInfo(assetKey: string) {
  const [w, h] = canvasOf(assetKey);
  return { heightPct: HEIGHT_PCT[assetKey] ?? 24, aspect: w / h };
}

/** 같은 가구는 한 번만 그린다 */
const cache = new Map<string, string>();

/** 가구 SVG 문자열. height는 픽셀 높이 (너비는 비율에 맞춘다).
 *  grass: 상점 썸네일처럼 발밑에 풀밭 조각을 깐다 (기본은 어느 배경에도 어울리는 흐린 그림자) */
export function furnitureSvg(assetKey: string, height = 120, { grass = false }: { grass?: boolean } = {}): string {
  const key = `${assetKey}|${grass ? 1 : 0}`;
  let art = cache.get(key);
  if (art === undefined) {
    art = furniture(assetKey, grass);
    cache.set(key, art);
  }
  const [w, h] = canvasOf(assetKey);
  const width = Math.round((height * w) / h);
  return art.replace(/ width="\d+" height="\d+"/, ` width="${width}" height="${height}"`);
}

export function furnitureDataUri(assetKey: string, height = 120, opts: { grass?: boolean } = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(furnitureSvg(assetKey, height, opts))}`;
}
