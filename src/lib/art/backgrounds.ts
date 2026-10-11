// 미니룸 배경 (SVG). 2026-10-11 크레용 그림체 실내 방 (crayon.ts room): 벽지 + 창문 + 액자 + 나무 바닥.
// 가구가 모두 실내 가구라 바깥 풍경 대신 방 안을 그리고, 테마 풍경은 창문 밖으로 보여 준다.
// 좌표 1040×520, 바닥선 y≈370. 칸 비율이 달라도 아래 가운데를 기준으로 잘라 채운다 (xMidYMax slice).
// DB의 asset_key("bg.meadow" 등)로 고른다. accent는 광장 집 지붕 기본 색으로도 쓴다 (scripts/test-batch-d.ts가 초원 값을 확인한다).
import { room } from "./crayon";

const SCENES: Record<string, { kind: string; accent: string }> = {
  "bg.meadow": { kind: "meadow", accent: "#2f855a" },
  "bg.beach": { kind: "beach", accent: "#0369a1" },
  "bg.snow": { kind: "snow", accent: "#475569" },
  "bg.sakura": { kind: "sakura", accent: "#be185d" },
  "bg.night": { kind: "night", accent: "#a5b4fc" },
  "bg.space": { kind: "space", accent: "#f0abfc" },
};

const cache = new Map<string, string>();

/** 배경 장면 SVG. width는 예전 호출과 맞추려고 받는다 (그림은 비율대로 늘어난다) */
export function backgroundSvg(assetKey: string, width = 320): string {
  void width;
  const key = SCENES[assetKey] ? assetKey : "bg.meadow";
  let art = cache.get(key);
  if (art === undefined) {
    art = room(SCENES[key].kind).replace(/ width="\d+" height="\d+"/, ' preserveAspectRatio="xMidYMax slice"');
    cache.set(key, art);
  }
  return art;
}

/** CSS url("…")에 넣을 data URI. 배경 그림은 커서 encodeURIComponent(약 1.4배) 대신
 *  큰따옴표를 작은따옴표로 바꾸고 URL에서 뜻이 있는 글자(% # < >)만 바꾼다 (흔히 쓰는 SVG data URI 방식) */
export function backgroundDataUri(assetKey: string, width = 320): string {
  const body = backgroundSvg(assetKey, width).replace(/"/g, "'").replace(/[%#<>]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `data:image/svg+xml;charset=utf-8,${body}`;
}

export function backgroundAccent(assetKey: string): string {
  return (SCENES[assetKey] ?? SCENES["bg.meadow"]).accent;
}
