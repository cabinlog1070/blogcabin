// BlogCabin 그림체 공통 규칙 (2026-10-08 디자인 시안). 광장 건물·소품·캐릭터·동물 그림이 함께 쓴다
// 시점: 위에서 비스듬히 내려다본 3/4 시점(앞면이 보이고 지붕은 위·앞에서 보임). 빛은 왼쪽 위.
// 외곽선: 따뜻한 짙은 갈색, 둥근 이음. 그림 크기는 화면 크기의 2배 viewBox로 그린다 (선 굵기도 2배 기준).

export const OUTLINE = "#4a2e1c";
/** 외곽선 속성. w = viewBox 단위 굵기 (기본 2.6: 화면에서 약 1.3px) */
export const S = (w = 2.6): string => `stroke="${OUTLINE}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
export const FONT = `font-family="'Apple SD Gothic Neo','Noto Sans KR',sans-serif" font-weight="800"`;

export const PALETTE = {
  cream: "#f7efdd",
  // 통나무
  log: "#c98b4f", logShade: "#a86b3a", logHi: "#e2ac6c", logEnd: "#ebc58f", logRing: "#c4925a",
  wood: "#b07a48", woodShade: "#8d5d34", woodHi: "#d29c63",
  // 돌·흙
  stone: "#cfc3b1", stoneShade: "#a99c88", stoneHi: "#e8dfd0",
  brick: "#d9a56f", brickShade: "#b98552",
  dirt: "#dcc191", dirtShade: "#c9a874",
  // 풀·나무
  grass: "#8dbb5a", grassShade: "#6f9c46", grassHi: "#a9cf73",
  leaf: "#5f9e4b", leafShade: "#4c8a3d", leafHi: "#79b45f", leafHi2: "#9ccb72",
  pine: "#3f7a4c", pineShade: "#2f6340", pineHi: "#58935f",
  blossom: "#f6b9cc", blossomShade: "#e895b0", blossomHi: "#fcd6e2",
  // 포인트
  red: "#d9433b", redShade: "#b33129", redHi: "#ef6a5f",
  barn: "#b8433a", barnShade: "#933229",
  roofBlue: "#4b6cb7",
  white: "#fff8ec",
  yellow: "#f6cf6a", gold: "#f0b63a",
  pinkFlower: "#f39bb4", yellowFlower: "#f6d36b", whiteFlower: "#fffaf0",
  window: "#9fd0e8", windowHi: "#d7eff8", glow: "#ffd36e",
  skin: "#fbdcc4", skinShade: "#f0c2a2", hair: "#7a4a2b", hairShade: "#5e3720", hairHi: "#9a6340",
} as const;

/** #rrggbb 을 amount(0~1)만큼 어둡게 / 밝게 */
export function darken(hex: string, amount = 0.2): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export function lighten(hex: string, amount = 0.2): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * amount));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** 바닥 그림자 (아랫변 가운데 아래) */
export const groundShadow = (cx: number, cy: number, rx: number, ry: number): string => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#3b2a1a" opacity=".16"/>`;

/** 한 페이지에 여러 SVG가 있어도 gradient id가 겹치지 않게 접두사를 붙인다 */
let seq = 0;
export const uid = (prefix: string): string => `${prefix}-${(seq++).toString(36)}`;

/** 결정적 난수 (같은 씨앗이면 같은 그림) */
export function rng(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 완성 SVG. w·h = 화면 크기(px). viewBox는 2배 */
export function svg(w: number, h: number, body: string, defs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * 2} ${h * 2}" width="${w * 2}" height="${h * 2}">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
}

/** 다섯 꽃잎 꽃 */
export function flower(cx: number, cy: number, r: number, petal: string, center = "#f6c445"): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * (Math.PI / 180);
    out += `<circle cx="${(cx + Math.cos(a) * r * 0.62).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.62).toFixed(1)}" r="${(r * 0.5).toFixed(1)}" fill="${petal}" stroke="${OUTLINE}" stroke-width="1" />`;
  }
  return out + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.32).toFixed(1)}" fill="${center}"/>`;
}
