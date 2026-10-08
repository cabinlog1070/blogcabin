// 광장 건물·소품 그림 (SVG). Phaser가 이 SVG를 이미지로 바꿔 광장에 놓는다.
// 2026-10-08 디자인 시안(통나무집·건물·캠프파이어)을 옮겼다. 좌표는 화면 크기의 2배 viewBox 단위 (선명하게).
// 나무·바위 같은 자연 소품은 props.ts, 공통 외곽선·색·도우미는 style.ts.
import { backgroundAccent } from "./backgrounds";
import { bushInFrameSvg, natureTreeSvg } from "./props";
import { FONT, OUTLINE, PALETTE as P, darken, flower, groundShadow, lighten, rng, S, svg, uid } from "./style";

const C = P;

type Vec = number[];
type Rand = () => number;

// ===== 집 = 통나무 오두막 (단계별 성장, TOWN-11) =====
// 1단계: 박공 지붕 + 문 하나 / 2단계: + 앞 창문 두 개(꽃 상자)·박공 창·벽돌 굴뚝, 더 크게 / 3단계: + 지붕 다락방 창(도머), 더 크게
// 앞면(박공·문)은 정면, 왼쪽 옆벽이 왼쪽 위로 물러나는 3/4 시점. 지붕은 고른 색(TOWN-07)에서 밝기·어둡기를 뽑아 기와를 칠한다
// 단계는 집 주인의 레벨로 정한다 (houseStageForLevel, src/lib/game.ts). wall.left~right = 벽의 x 범위(충돌 영역, 화면 px)
export const HOUSE_STAGES = {
  1: { name: "작은 오두막", width: 150, height: 140, wall: { left: 26, right: 124, top: 70 }, roofTop: 20 },
  2: { name: "창문 있는 오두막", width: 182, height: 168, wall: { left: 24, right: 158, top: 84 }, roofTop: 20 },
  3: { name: "다락방 오두막", width: 214, height: 204, wall: { left: 24, right: 190, top: 104 }, roofTop: 14 },
} as const;
export type HouseStage = keyof typeof HOUSE_STAGES;

// ===== 지붕 색 (TOWN-07, 무료) =====
// 꾸미기 화면에서 고르는 기본 색 8가지. DB(blogs.roof_color)에는 키만 저장한다 (CHECK blogs_roof_color_check와 같은 목록)
export const ROOF_COLORS = {
  red: { name: "빨강", hex: "#dc2626" },
  orange: { name: "주황", hex: "#ea580c" },
  yellow: { name: "노랑", hex: "#eab308" },
  green: { name: "초록", hex: "#16a34a" },
  sky: { name: "하늘", hex: "#38bdf8" },
  blue: { name: "파랑", hex: "#2563eb" },
  purple: { name: "보라", hex: "#9333ea" },
  brown: { name: "갈색", hex: "#92400e" },
} as const;
export type RoofColor = keyof typeof ROOF_COLORS;
export const isRoofColor = (v: unknown): v is RoofColor => typeof v === "string" && Object.hasOwn(ROOF_COLORS, v);

/** 집 지붕에 칠할 색: 고른 색이 있으면 그 색, 없으면(또는 [배경 색 따라가기]) 장착한 배경의 강조색 */
export function roofHex(roofColor: string | null | undefined, backgroundAsset: string): string {
  return isRoofColor(roofColor) ? ROOF_COLORS[roofColor].hex : backgroundAccent(backgroundAsset);
}

// ----- 크기 (화면 px). 그림은 아랫변 가운데를 발 닿는 곳으로 놓는다 -----
export const BOARD_SIZE = { width: 170, height: 170 };
export const ATTENDANCE_SIZE = { width: 110, height: 150 };
export const SHOP_SIZE = { width: 210, height: 180 };
export const FARM_SIZE = { width: 260, height: 170 };
export const CAMPFIRE_SIZE = { width: 180, height: 150 };
export const FLAME_FRAMES = 3;
export const BENCH_SIZE = { width: 90, height: 40 };
export const LAMP_SIZE = { width: 40, height: 110 };
/** 랜턴 불빛 가운데: lampSvg 그림 왼쪽 위에서 (x, y) px */
export const LAMP_LIGHT = { x: 29.5, y: 49 };
export const TREE_SIZE = { width: 80, height: 100 };

type Proj = (X: number, Y: number, Z: number) => Vec;
type RoofPal = { base: string; base2: string; base3: string; hi: string; sh: string; deep: string; line: string; gap: string };
type Bloom = [number, number, number, string, string];
/** 그림 안 id 를 만드는 함수 (houseSvg 가 부를 때마다 단계·색으로 고정 id 를 쓰게 바꾼다) */
let cabId: (prefix: string) => string = uid;
// ---------- 작은 도우미 ----------
const n1 = (v: number) => Math.round(v * 10) / 10;
const pt = ([x, y]: Vec) => `${n1(x)},${n1(y)}`;
const cPoly = (ps: Vec[], attrs = "") => `<polygon points="${ps.map(pt).join(" ")}" ${attrs}/>`;
const pline = (ps: Vec[], attrs = "") => `<polyline points="${ps.map(pt).join(" ")}" fill="none" ${attrs}/>`;
const line = (a: Vec, b: Vec, stroke: string, w: number, extra = "") =>
  `<line x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const cRect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="${fill}" ${extra}/>`;
const cCirc = (x: number, y: number, r: number, fill: string, extra = "") => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${fill}" ${extra}/>`;

// 투영: 앞면은 정면 그대로, 깊이(Y)는 왼쪽 위로 (KA, KB). 지붕 기울기 PITCH.
const KA = 0.46, KB = 0.57, PITCH = 0.72;

// 단계별 치수 (모두 viewBox 2배 단위). xL~xR 이 벽의 x 범위(충돌 영역)
const STAGES = {
  1: { w: 150, h: 140, xL: 52, xR: 248, D: 118, Hw: 84, lh: 14, door: [30, 50], gableWin: 0, frontWin: null, chimney: false, dormer: false, lanterns: 1, ov: 15 },
  2: { w: 182, h: 168, xL: 48, xR: 316, D: 136, Hw: 104, lh: 14.86, door: [32, 56], gableWin: 22, frontWin: [32, 28], chimney: true, dormer: false, lanterns: 2, ov: 17 },
  3: { w: 214, h: 204, xL: 48, xR: 380, D: 164, Hw: 130, lh: 16.25, door: [34, 60], gableWin: 26, frontWin: [38, 32], chimney: true, dormer: true, lanterns: 2, ov: 19 },
};

const DOOR = "#8e5833", DOOR_PANEL = "#9f6740", DOOR_LINE = "#6a3f22", FRAME = "#a86f42", FRAME_HI = "#c68c58", METAL = "#5b3a24";
const STEP = { top: "#eddcbb", front: "#d3bb93", side: "#b99f78", line: "#a88d68" };
const CAP = { top: "#f3ead8", front: "#e2d5bd", side: "#c9b99c" };

// ---------- 통나무 벽 ----------
/** 앞면 통나무 (가로). x0~x1, 바닥 yb 부터 위로 */
function frontLogs(x0: number, x1: number, yb: number, yTop: number, lh: number, rand: Rand) {
  let s = "";
  const w = x1 - x0;
  const grain = darken(P.log, 0.32);
  for (let y1 = yb, i = 0; y1 > yTop; y1 -= lh, i++) {
    const y0 = y1 - lh;
    s += cRect(x0, y0, w, lh, P.log);
    s += cRect(x0, y0 + lh * 0.1, w, lh * 0.32, P.logHi, `opacity=".9"`);
    s += cRect(x0, y1 - lh * 0.3, w, lh * 0.3, P.logShade);
    // 나뭇결
    const g = Math.max(2, Math.round(w / 34));
    for (let k = 0; k < g; k++) {
      const gx = x0 + rand() * w, gl = 8 + rand() * 22, gy = y0 + lh * (0.42 + rand() * 0.2);
      s += line([gx, gy], [Math.min(x1, gx + gl), gy], grain, 1, `opacity=".5"`);
    }
    // 옹이
    if (rand() < 0.45) {
      const kx = x0 + 10 + rand() * (w - 20), ky = y0 + lh * 0.55;
      s += `<ellipse cx="${n1(kx)}" cy="${n1(ky)}" rx="2.8" ry="1.7" fill="${P.logShade}" stroke="${grain}" stroke-width=".9" opacity=".8"/>`;
    }
    if (i > 0 || y1 < yb) s += line([x0, y1], [x1, y1], OUTLINE, 1.5, `opacity=".85"`);
  }
  return s;
}

/** 왼쪽 옆벽 통나무 (깊이 방향으로 비스듬) */
function sideLogs(p: Proj, D: number, Hw: number, lh: number, rand: Rand) {
  const base = P.logShade, hi = "#bd7f47", sh = darken(P.logShade, 0.2), grain = darken(P.logShade, 0.34);
  let s = "";
  const n = Math.round(Hw / lh);
  for (let i = 0; i < n; i++) {
    const z0 = i * lh, z1 = z0 + lh;
    const band = (za: number, zb: number) => [p(0, 0, za), p(0, D, za), p(0, D, zb), p(0, 0, zb)];
    s += cPoly(band(z0, z1), `fill="${base}"`);
    s += cPoly(band(z1 - lh * 0.42, z1 - lh * 0.1), `fill="${hi}" opacity=".85"`);
    s += cPoly(band(z0, z0 + lh * 0.28), `fill="${sh}"`);
    const g = 2 + Math.floor(rand() * 2);
    for (let k = 0; k < g; k++) {
      const y0 = rand() * D * 0.8, len = 10 + rand() * 26, zc = z0 + lh * (0.4 + rand() * 0.25);
      s += line(p(0, y0, zc), p(0, Math.min(D, y0 + len), zc), grain, 1, `opacity=".55"`);
    }
    if (i > 0) s += line(p(0, 0, z0), p(0, D, z0), OUTLINE, 1.4, `opacity=".8"`);
  }
  return s;
}

/** 정면을 향한 통나무 끝 (나이테) */
function logEnd(cx: number, cy: number, r: number) {
  return (
    cCirc(cx, cy, r, P.logShade) +
    cCirc(cx - r * 0.1, cy - r * 0.12, r * 0.84, P.logEnd) +
    `<circle cx="${n1(cx - r * 0.06)}" cy="${n1(cy - r * 0.06)}" r="${n1(r * 0.58)}" fill="none" stroke="${P.logRing}" stroke-width="1.2"/>` +
    `<circle cx="${n1(cx - r * 0.04)}" cy="${n1(cy - r * 0.04)}" r="${n1(r * 0.3)}" fill="none" stroke="${P.logRing}" stroke-width="1.1"/>` +
    cCirc(cx - r * 0.03, cy - r * 0.03, r * 0.08, P.logRing) +
    cCirc(cx, cy, r, "none", S(2))
  );
}

/** 왼쪽을 향한 통나무 끝 (뒤 모서리, 타원으로 찌그러짐) */
function logEndSide(cx: number, cy: number, r: number) {
  const m = `transform="matrix(${-KA} ${-KB} 0 -1 ${n1(cx)} ${n1(cy)})"`;
  return (
    `<circle r="${r}" fill="${P.logEnd}" ${m} stroke="${OUTLINE}" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
    `<circle r="${n1(r * 0.55)}" fill="none" ${m} stroke="${P.logRing}" stroke-width="1.1" vector-effect="non-scaling-stroke"/>` +
    `<circle r="${n1(r * 0.86)}" fill="${P.logShade}" opacity=".35" transform="matrix(${-KA} ${-KB} 0 -1 ${n1(cx + 1)} ${n1(cy + 1.5)})"/>`
  );
}

// ---------- 지붕 ----------
/** 평행사변형 위 기와 격자. c0=앞 용마루, c1=뒤 용마루, c3=앞 처마 (2D) */
function tiles(c0: Vec, c1: Vec, c3: Vec, rows: number, cols: number, col: RoofPal, rand: Rand, clipId: string, stagger = false) {
  const Q = (u: number, v: number): Vec => [c0[0] + u * (c1[0] - c0[0]) + v * (c3[0] - c0[0]), c0[1] + u * (c1[1] - c0[1]) + v * (c3[1] - c0[1])];
  let s = `<g clip-path="url(#${clipId})">`;
  s += cPoly([Q(-0.2, -0.2), Q(1.2, -0.2), Q(1.2, 1.2), Q(-0.2, 1.2)], `fill="${col.gap}"`);
  const du = 1 / cols, dv = 1 / rows;
  // 기와 사이 틈은 화면에서 일정한 굵기(약 2.2)가 되도록 u·v 비율로 환산
  const lenU = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), lenV = Math.hypot(c3[0] - c0[0], c3[1] - c0[1]);
  const gu = 1.1 / lenU, gv = 1.3 / lenV;
  for (let i = 0; i < rows; i++) {
    const v0 = i * dv + gv, v1 = (i + 1) * dv - gv;
    const off = stagger ? (i % 2) * 0.5 * du : 0;
    for (let j = -1; j <= cols; j++) {
      const u0 = j * du + off + gu, u1 = (j + 1) * du + off - gu;
      const r = rand();
      const fill = r < 0.22 ? col.base2 : r > 0.84 ? col.base3 : col.base;
      const h = v1 - v0, w = u1 - u0;
      s += cPoly([Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)], `fill="${fill}"`);
      // 아래쪽(처마 쪽) 두께 그늘
      s += cPoly([Q(u0, v1 - h * 0.26), Q(u1, v1 - h * 0.26), Q(u1, v1), Q(u0, v1)], `fill="${col.sh}"`);
      // 앞쪽(오른쪽 아래) 옆 그늘
      s += cPoly([Q(u0, v0), Q(u0 + w * 0.12, v0), Q(u0 + w * 0.12, v1), Q(u0, v1)], `fill="${col.sh}" opacity=".55"`);
      // 위·뒤쪽 빛 (붓질)
      s += cPoly([Q(u0 + w * 0.2, v0 + h * 0.12), Q(u1 - w * 0.08, v0 + h * 0.12), Q(u1 - w * 0.08, v0 + h * 0.3), Q(u0 + w * 0.2, v0 + h * 0.3)], `fill="${col.hi}" opacity=".55"`);
      if (r < 0.3) s += cPoly([Q(u1 - w * 0.2, v0 + h * 0.12), Q(u1 - w * 0.08, v0 + h * 0.12), Q(u1 - w * 0.08, v1 - h * 0.35), Q(u1 - w * 0.2, v1 - h * 0.35)], `fill="${col.hi}" opacity=".4"`);
    }
  }
  return s + "</g>";
}

// ---------- 창문·문·등 ----------
function windowFront(cx: number, yBot: number, ww: number, wh: number, frame: string = FRAME_HI) {
  const x0 = cx - ww / 2, y0 = yBot - wh, f = 4;
  let s = "";
  s += cRect(x0, y0, ww, wh, frame, `rx="2" ${S(2.4)}`);
  s += cRect(x0 + f, y0 + f, ww - 2 * f, wh - 2 * f, P.window, `stroke="${darken(frame, 0.35)}" stroke-width="1.2"`);
  s += cRect(x0 + f, y0 + f, ww - 2 * f, 3, darken(P.window, 0.22));
  // 반사광
  s += cPoly([[x0 + f + 3, yBot - f], [x0 + f + 9, y0 + f + 3], [x0 + f + 14, y0 + f + 3], [x0 + f + 8, yBot - f]], `fill="${P.windowHi}" opacity=".85"`);
  // 창살
  s += cRect(cx - 1.6, y0 + f, 3.2, wh - 2 * f, frame, `stroke="${darken(frame, 0.35)}" stroke-width=".9"`);
  s += cRect(x0 + f, y0 + wh / 2 - 1.6, ww - 2 * f, 3.2, frame, `stroke="${darken(frame, 0.35)}" stroke-width=".9"`);
  s += line([x0 + 2, y0 + 2], [x0 + ww - 3, y0 + 2], lighten(frame, 0.35), 1.2, `opacity=".9"`);
  return s;
}

function flowerBox(cx: number, yTop: number, bw: number, rand: Rand) {
  const x0 = cx - bw / 2, h = 9;
  let s = "";
  // 잎
  for (let i = 0; i < 6; i++) {
    const lx = x0 + 3 + (i * (bw - 6)) / 5, ly = yTop - 1 - rand() * 2;
    s += cCirc(lx, ly, 4.2, P.leafShade, S(1.2)) + cCirc(lx - 1, ly - 1.2, 2.6, P.leafHi);
  }
  s += cRect(x0, yTop, bw, h, P.wood, `rx="1.5" ${S(2)}`);
  s += cRect(x0 + 1.5, yTop + 1.4, bw - 3, 2, P.woodHi, `opacity=".9"`);
  s += line([x0 + 2, yTop + h * 0.62], [x0 + bw - 2, yTop + h * 0.62], P.woodShade, 1);
  const cols = [P.pinkFlower, P.yellowFlower, P.whiteFlower, P.pinkFlower];
  for (let i = 0; i < 4; i++) {
    const fx = x0 + 5 + (i * (bw - 10)) / 3, fy = yTop - 4 - (i % 2) * 2.5;
    s += flower(n1(fx), n1(fy), 4.6, cols[i], i === 1 ? "#e9893b" : "#f6c445");
  }
  return s;
}

function lantern(x: number, y: number, s: number) {
  let o = "";
  o += cCirc(x, y, s * 1.55, P.glow, `opacity=".16"`);
  o += cCirc(x, y, s * 1.05, P.glow, `opacity=".22"`);
  o += cRect(x - 1.4, y - s * 1.25, 2.8, s * 0.5, METAL, S(1));
  o += cPoly([[x - s * 0.66, y - s * 0.6], [x + s * 0.66, y - s * 0.6], [x + s * 0.32, y - s * 0.98], [x - s * 0.32, y - s * 0.98]], `fill="${METAL}" ${S(1.6)}`);
  o += cRect(x - s * 0.5, y - s * 0.6, s, s * 1.18, METAL, `rx="1.2" ${S(1.8)}`);
  o += cRect(x - s * 0.32, y - s * 0.42, s * 0.64, s * 0.82, "#ffcf5a");
  o += `<ellipse cx="${n1(x)}" cy="${n1(y + s * 0.02)}" rx="${n1(s * 0.18)}" ry="${n1(s * 0.28)}" fill="#fff4c2"/>`;
  o += cRect(x - s * 0.36, y + s * 0.56, s * 0.72, s * 0.22, METAL, S(1.4));
  return o;
}

function door(cx: number, yb: number, dw: number, dh: number) {
  const fw = 5.5, ry = dw * 0.36, x0 = cx - dw / 2, x1 = cx + dw / 2;
  let s = "";
  // 아치 문틀
  const frameD = `M${n1(x0 - fw)},${n1(yb)} V${n1(yb - dh)} A${n1(dw / 2 + fw)},${n1(ry + fw)} 0 0 1 ${n1(x1 + fw)},${n1(yb - dh)} V${n1(yb)} Z`;
  s += `<path d="${frameD}" fill="${FRAME}" ${S(2.6)}/>`;
  s += `<path d="M${n1(x0 - fw + 2)},${n1(yb - 2)} V${n1(yb - dh)} A${n1(dw / 2 + fw - 2)},${n1(ry + fw - 2)} 0 0 1 ${n1(cx)},${n1(yb - dh - ry - fw + 2)}" fill="none" stroke="${FRAME_HI}" stroke-width="2"/>`;
  // 문짝
  const doorD = `M${n1(x0)},${n1(yb)} V${n1(yb - dh)} A${n1(dw / 2)},${n1(ry)} 0 0 1 ${n1(x1)},${n1(yb - dh)} V${n1(yb)} Z`;
  s += `<path d="${doorD}" fill="${DOOR}" stroke="${OUTLINE}" stroke-width="1.8"/>`;
  // 판자 결
  for (let i = 1; i < 3; i++) {
    const lx = x0 + (dw * i) / 3;
    s += line([lx, yb - dh - ry * 0.75], [lx, yb - 1], DOOR_LINE, 1.1, `opacity=".7"`);
  }
  // 네 칸 판넬
  const pw = dw * 0.32, ph = dh * 0.32, gap = dw * 0.1;
  for (const [px, py] of [[cx - gap / 2 - pw, yb - dh * 0.92], [cx + gap / 2, yb - dh * 0.92], [cx - gap / 2 - pw, yb - dh * 0.5], [cx + gap / 2, yb - dh * 0.5]]) {
    s += cRect(px, py, pw, ph, DOOR_PANEL, `rx="1.2" stroke="${DOOR_LINE}" stroke-width="1.2"`);
    s += line([px + 1.4, py + 1.6], [px + pw - 1.6, py + 1.6], lighten(DOOR_PANEL, 0.25), 1.1, `opacity=".9"`);
  }
  s += `<path d="M${n1(x0 + 2)},${n1(yb - dh)} A${n1(dw / 2 - 2)},${n1(ry - 2)} 0 0 1 ${n1(x1 - 2)},${n1(yb - dh)}" fill="none" stroke="${DOOR_LINE}" stroke-width="1.2" opacity=".8"/>`;
  // 손잡이
  s += cCirc(cx + dw * 0.3, yb - dh * 0.47, 2.4, P.gold, S(1.2));
  s += cCirc(cx + dw * 0.3 - 0.7, yb - dh * 0.47 - 0.7, 0.8, P.white);
  return s;
}

// ---------- 덤불·풀 ----------
function cabinBush(circles: Vec[], rand: Rand, flowers: Bloom[], defs: string[]) {
  const id = cabId("cab-bush");
  defs.push(`<clipPath id="${id}">${circles.map(([x, y, r]) => cCirc(x, y, r, "#000")).join("")}</clipPath>`);
  let s = circles.map(([x, y, r]) => cCirc(x, y, r + 1.5, OUTLINE)).join("");
  s += `<g clip-path="url(#${id})">`;
  const sorted = [...circles].sort((a, b) => a[1] - b[1]);
  const deep = darken(P.leafShade, 0.16);
  s += circles.map(([x, y, r]) => cCirc(x, y, r, P.leafShade)).join("");
  for (const [x, y, r] of sorted) {
    const cx = x - r * 0.1, cy = y - r * 0.16, cr = r * 0.8;
    s += cCirc(cx, cy, cr, P.leaf);
    // 뭉치 아래쪽 가장자리 (어두운 잎 테두리)
    const a0 = 0.12 * Math.PI, a1 = 0.88 * Math.PI;
    s += `<path d="M${n1(cx + Math.cos(a0) * cr)},${n1(cy + Math.sin(a0) * cr)} A${n1(cr)},${n1(cr)} 0 0 1 ${n1(cx + Math.cos(a1) * cr)},${n1(cy + Math.sin(a1) * cr)}" fill="none" stroke="${deep}" stroke-width="1.5" opacity=".8"/>`;
    // 위쪽 밝은 잎 (작은 원 2~3개)
    for (let k = 0; k < 3; k++) {
      const a = Math.PI * (1.1 + k * 0.3) + (rand() - 0.5) * 0.3;
      s += cCirc(cx + Math.cos(a) * cr * 0.45, cy + Math.sin(a) * cr * 0.45, cr * (0.28 + rand() * 0.1), P.leafHi);
    }
    // 잎 결
    const lx = cx + (rand() - 0.3) * cr * 0.6, ly = cy + cr * (0.15 + rand() * 0.3);
    s += `<path d="M${n1(lx - 2.6)},${n1(ly)} q2.6,2.4 5.2,0" fill="none" stroke="${deep}" stroke-width="1.1" opacity=".6"/>`;
    // 반짝이 점
    s += cCirc(cx - cr * 0.45, cy - cr * 0.4, Math.max(1, cr * 0.11), P.leafHi2);
    if (rand() < 0.6) s += cCirc(cx + cr * 0.1, cy - cr * 0.62, Math.max(0.8, cr * 0.08), P.leafHi2);
  }
  s += "</g>";
  for (const [fx, fy, fr, col, cen] of flowers) s += flower(n1(fx), n1(fy), fr, col, cen);
  return s;
}

/** 덤불 모양(돔)을 잎뭉치 원으로 빈틈없이 채운다. 바닥 가운데 (cx, by), 폭 w, 높이 h */
function blob(cx: number, by: number, w: number, h: number, rand: Rand, rScale = 1) {
  const r0 = Math.max(7, Math.min(w, h) * 0.2 * rScale);
  const ax = w / 2 - r0 * 0.9, ay = h - r0 * 1.5;
  const dy = r0 * 1.0, dx = r0 * 1.15;
  const ys: number[] = [];
  for (let y = 0; y <= ay + 0.01; y += dy) ys.push(y);
  if (ay - ys[ys.length - 1] > dy * 0.4) ys.push(ay);
  const out: Vec[] = [];
  for (const y of ys) {
    const half = ax * Math.sqrt(Math.max(0, 1 - (y / Math.max(ay, 1)) ** 2));
    const n = Math.max(1, Math.round((2 * half) / dx) + 1);
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (rand() - 0.5) * r0 * 0.4 : -half + (2 * half * i) / (n - 1);
      out.push([cx + x + (rand() - 0.5) * r0 * 0.3, by - r0 * 0.7 - y + (rand() - 0.5) * r0 * 0.25, r0 * (0.84 + rand() * 0.3)]);
    }
  }
  return out;
}

/** 덤불을 캔버스 안(4~W-4)에 들어오게 옆으로 민다 */
function fit(circles: Vec[], W2: number) {
  const lo = Math.min(...circles.map(([x, , r]) => x - r)), hi = Math.max(...circles.map(([x, , r]) => x + r));
  const dx = lo < 4 ? 4 - lo : hi > W2 - 4 ? W2 - 4 - hi : 0;
  return circles.map(([x, y, r]) => [x + dx, y, r]);
}

/** 덤불 위 꽃 자리: 잎뭉치 윗부분에서 고른다 */
function bloomOn(circles: Vec[], cols: string[][], rand: Rand, size = 4.8): Bloom[] {
  const top = [...circles].sort((a, b) => a[1] - b[1]);
  return cols.map((c, i): Bloom => {
    const [x, y, r] = top[(i * 2 + 1) % top.length];
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.6;
    return [x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.45, size * (0.9 + rand() * 0.25), c[0], c[1] ?? "#f6c445"];
  });
}

function cabinTuft(x: number, y: number, k = 1, col: string = P.grass) {
  const q = (dx: number, dy: number) => `${n1(x + dx * k)},${n1(y + dy * k)}`;
  const d = `M${q(-6, 0)} Q${q(-6, -4)} ${q(-9, -8)} Q${q(-4.5, -6)} ${q(-3, -3)} Q${q(-3.5, -8)} ${q(-1.5, -12)} Q${q(0.5, -7)} ${q(0.5, -3.5)} Q${q(2, -8)} ${q(4.5, -10)} Q${q(3.5, -5)} ${q(3.5, -2.5)} Q${q(6, -5)} ${q(9, -6)} Q${q(6.5, -3)} ${q(6, 0)} Z`;
  return `<path d="${d}" fill="${col}" stroke="${OUTLINE}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M${q(-1.2, -1)} Q${q(-1.4, -5)} ${q(-1.2, -8.5)}" fill="none" stroke="${P.grassHi}" stroke-width="1.1"/>`;
}

// ---------- 집 ----------
export function houseSvg(stage: HouseStage, roof: string): string {
  // 그림 id 는 단계·색에서 정한다: 서버·브라우저가 같은 문자열을 만들어야 꾸미기 화면 하이드레이션이 맞는다
  let seq = 0;
  cabId = (prefix: string) => `${prefix}-${stage}${roof.slice(1)}-${(seq++).toString(36)}`;
  const st = STAGES[stage] ?? STAGES[1];
  const W2 = st.w * 2, H2 = st.h * 2;
  const yb = H2 - 32;
  const { D, Hw, lh, ov } = st;
  const xF = st.xL + KA * D;
  const Wd = st.xR - xF;
  const R = (Wd / 2) * PITCH;
  const ovf = 10, ovb = 6, th = 9;
  const p: Proj = (X, Y, Z) => [xF + X - KA * Y, yb - Z - KB * Y];
  const rand = rng(stage * 97 + 13);
  const defs: string[] = [];
  const rf = {
    base: roof, base2: lighten(roof, 0.1), base3: darken(roof, 0.08),
    hi: lighten(roof, 0.42), sh: darken(roof, 0.2), deep: darken(roof, 0.4), line: darken(roof, 0.5),
    gap: darken(roof, 0.42),
  };
  const cx = xF + Wd / 2; // 앞면 가운데(문)
  let s = "";

  // 바닥 그림자
  s += groundShadow(n1((st.xL + st.xR) / 2 + 12), n1(yb - KB * D * 0.3), n1((st.xR - st.xL) / 2 + 12), n1(KB * D * 0.38 + 14));

  // 집 뒤 덤불 (오른쪽, 지붕 옆으로 삐죽)
  {
    const c = fit(blob(st.xR + 10, yb - Hw * 0.28, 34 + 12 * stage, Hw * 0.62, rand), W2);
    s += cabinBush(c, rand, bloomOn(c, [[P.redHi]], rand), defs);
  }

  // ----- 옆벽 -----
  const sideP = [p(0, 0, 0), p(0, D, 0), p(0, D, Hw), p(0, 0, Hw)];
  const sideClip = cabId("cab-side");
  defs.push(`<clipPath id="${sideClip}">${cPoly(sideP)}</clipPath>`);
  s += sideLogs(p, D, Hw, lh, rand);
  // 처마 그림자
  s += `<g clip-path="url(#${sideClip})">${pline([p(-ov, -ovf, Hw - ov * PITCH - th), p(-ov, D + ovb, Hw - ov * PITCH - th)].map(([x, y]) => [x + 4, y + 7]), `stroke="${OUTLINE}" stroke-width="18" opacity=".22"`)}</g>`;
  s += cPoly(sideP, `fill="none" ${S(2.6)}`);
  // 뒤 모서리 통나무 끝
  for (let i = 0; i < Math.round(Hw / lh); i++) {
    const [ex, ey] = p(-3, D, (i + 0.5) * lh);
    s += logEndSide(ex, ey, lh * 0.56);
  }

  // ----- 앞면 + 박공 -----
  const frontP = [p(0, 0, 0), p(Wd, 0, 0), p(Wd, 0, Hw), p(Wd / 2, 0, Hw + R), p(0, 0, Hw)];
  const frontClip = cabId("cab-front");
  defs.push(`<clipPath id="${frontClip}">${cPoly(frontP)}</clipPath>`);
  s += `<g clip-path="url(#${frontClip})">`;
  s += frontLogs(xF, xF + Wd, yb, yb - Hw - R - 2, lh, rand);
  // 처마 그림자 (박공 아래)
  const eaveLine = [p(-ov, -ovf, Hw - ov * PITCH - th), p(Wd / 2, -ovf, Hw + R - th), p(Wd + ov, -ovf, Hw - ov * PITCH - th)];
  s += pline(eaveLine.map(([x, y]) => [x, y + 6]), `stroke="${OUTLINE}" stroke-width="24" opacity=".1" stroke-linejoin="round"`);
  s += pline(eaveLine.map(([x, y]) => [x, y + 4]), `stroke="${OUTLINE}" stroke-width="14" opacity=".14" stroke-linejoin="round"`);
  // 벽 아래 땅 닿는 곳 어둡게
  s += cRect(xF, yb - 6, Wd, 6, OUTLINE, `opacity=".12"`);
  s += `</g>`;
  s += cPoly(frontP, `fill="none" ${S(2.6)}`);

  // 모서리 통나무 끝 (앞 왼쪽·오른쪽)
  for (let i = 0; i < Math.round(Hw / lh); i++) {
    const z = (i + 0.5) * lh;
    const [ax, ay] = p(0, -4, z), [bx, by] = p(Wd, -4, z);
    s += logEnd(ax, ay, lh * 0.6) + logEnd(bx, by, lh * 0.6);
  }

  // 박공 창 (2단계부터)
  if (st.gableWin) {
    const gw = st.gableWin, [gx, gy] = p(Wd / 2, 0, Hw + R * 0.14);
    s += windowFront(gx, gy, gw, gw, FRAME);
  }

  // 문
  const [dw, dh] = st.door;
  s += door(cx, yb, dw, dh);

  // 앞 창문 + 꽃상자 (2단계부터)
  if (st.frontWin) {
    const [ww, wh] = st.frontWin;
    const off = dw / 2 + 5.5 + 26 + ww / 2;
    for (const sx of [-1, 1]) {
      const wx = cx + sx * off, wyb = yb - Hw * 0.36;
      s += windowFront(wx, wyb, ww, wh);
      s += flowerBox(wx, wyb + 1, ww + 8, rand);
    }
  }

  // 벽등
  const ls = 8 + stage;
  const lx = dw / 2 + 5.5 + 11;
  if (st.lanterns >= 2) s += lantern(cx - lx, yb - dh * 0.78, ls);
  s += lantern(cx + lx, yb - dh * 0.78, ls);

  // ----- 지붕 -----
  const z0 = Hw - ov * PITCH;
  const FR = p(Wd / 2, -ovf, Hw + R), BR = p(Wd / 2, D + ovb, Hw + R);
  const FE = p(-ov, -ovf, z0), BE = p(-ov, D + ovb, z0);
  const FE2 = p(Wd + ov, -ovf, z0), BE2 = p(Wd + ov, D + ovb, z0);
  const dn = ([x, y]: Vec): Vec => [x, y + th];

  // 오른쪽 경사면 (좁은 띠)
  const rightClip = cabId("cab-rr");
  defs.push(`<clipPath id="${rightClip}">${cPoly([FR, FE2, BE2, BR])}</clipPath>`);
  s += cPoly([FR, FE2, BE2, BR], `fill="${rf.base2}"`);
  s += tiles(FR, BR, FE2, 4, 7, { ...rf, base: rf.base2, base2: lighten(roof, 0.16), base3: rf.base }, rand, rightClip);

  // 굴뚝 (오른쪽 경사면 뒤쪽)
  if (st.chimney) s += chimney(p, Wd, D, Hw, R, rand);

  // 앞 처마 두께 + 왼쪽 처마 두께
  s += cPoly([FE, FR, FE2, dn(FE2), dn(FR), dn(FE)], `fill="${rf.deep}"`);
  s += cPoly([BE, FE, dn(FE), dn(BE)], `fill="${darken(roof, 0.32)}"`);
  s += line(dn(FE), dn(FR), lighten(rf.deep, 0.2), 1.2, `opacity=".7"`);

  // 왼쪽 경사면 (크게 보이는 면)
  const leftClip = cabId("cab-lr");
  defs.push(`<clipPath id="${leftClip}">${cPoly([FR, BR, BE, FE])}</clipPath>`);
  s += cPoly([FR, BR, BE, FE], `fill="${rf.base}"`);
  const slopeLen = Math.hypot(FE[0] - FR[0], FE[1] - FR[1]);
  const depthLen = Math.hypot(BR[0] - FR[0], BR[1] - FR[1]);
  s += tiles(FR, BR, FE, Math.max(4, Math.round(slopeLen / 20)), Math.max(4, Math.round(depthLen / 21)), rf, rand, leftClip);
  const gid = cabId("cab-rg");
  defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${n1(BR[0])}" y1="${n1(BR[1])}" x2="${n1(FE[0])}" y2="${n1(FE[1])}"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>`);
  s += cPoly([FR, BR, BE, FE], `fill="url(#${gid})"`);

  // 다락 지붕창 (3단계)
  if (st.dormer) s += dormer(p, Wd, D, Hw, R, rf, rand, leftClip);

  // 용마루
  s += line(BR, FR, OUTLINE, 8);
  s += line(BR, FR, rf.hi, 4);
  // 외곽선
  s += cPoly([BR, BE, dn(BE), dn(FE), dn(FR), dn(FE2), FE2, BE2], `fill="none" ${S(2.8)}`);
  s += pline([BE, FE, FR, FE2], S(2.2));
  s += pline([FE2, FR], S(2.2));

  // ----- 돌계단 -----
  s += steps(p, Wd / 2, dw + 18);

  // ----- 앞 덤불·꽃·풀 -----
  {
    // 왼쪽 옆벽 뒤쪽을 감싸는 큰 덤불
    const [bx, by] = p(-6, D * (0.86 - 0.06 * stage), 0);
    const lc = fit(blob(bx + 2, by + 8, 40 + 16 * stage, Hw * (0.56 + 0.06 * stage), rand), W2);
    s += cabinBush(lc, rand, bloomOn(lc, [[P.whiteFlower, "#e9893b"], [P.pinkFlower], [P.redHi], ...(stage > 1 ? [[P.whiteFlower, "#e9893b"]] : []), ...(stage > 2 ? [[P.pinkFlower]] : [])], rand), defs);
    // 앞 왼쪽 모서리 아래 작은 꽃덤불
    const [fx, fy] = p(-4, 0, 0);
    const fc = blob(fx - 2, fy + 6, 26 + 4 * stage, 20 + 3 * stage, rand);
    s += cabinBush(fc, rand, bloomOn(fc, [[P.pinkFlower], [P.whiteFlower, "#e9893b"]], rand, 4.2), defs);
    // 오른쪽 덤불 (앞 오른쪽 모서리를 감쌈)
    const rc = fit(blob(st.xR + 14, yb + 6, 40 + 8 * stage, Hw * 0.5 + 8, rand), W2);
    s += cabinBush(rc, rand, bloomOn(rc, [[P.whiteFlower, "#e9893b"], [P.redHi], [P.pinkFlower], ...(stage > 2 ? [[P.whiteFlower, "#e9893b"]] : [])], rand), defs);
  }
  // 풀 포기와 작은 꽃
  const tufts = [[xF + 18, yb + 3], [cx - dw / 2 - 26, yb + 4], [cx + dw / 2 + 30, yb + 4], [xF + Wd - 16, yb + 6], [st.xL + 6, yb - KB * D * 0.3 + 10]];
  for (const [tx, ty] of tufts) s += cabinTuft(tx, ty, 0.9 + rand() * 0.3);
  s += flower(n1(cx - dw / 2 - 18), n1(yb + 5), 3.6, P.whiteFlower, "#f6c445");
  s += flower(n1(cx + dw / 2 + 40), n1(yb + 7), 3.6, P.yellowFlower, "#e9893b");

  return svg(st.w, st.h, s, defs.join(""));
}

function chimney(p: Proj, Wd: number, D: number, Hw: number, R: number, rand: Rand) {
  const zr = (X: number) => Hw + R - (X - Wd / 2) * PITCH; // 오른쪽 경사면 높이
  const x0 = Wd / 2 + Wd * 0.13, x1 = Wd / 2 + Wd * 0.3, y0 = D * 0.5, y1 = D * 0.66;
  const zt = Hw + R + 12;
  const front = [p(x0, y0, zr(x0) - 4), p(x1, y0, zr(x1) - 4), p(x1, y0, zt), p(x0, y0, zt)];
  const side = [p(x0, y0, zr(x0) - 4), p(x0, y1, zr(x0) - 4), p(x0, y1, zt), p(x0, y0, zt)];
  let s = "";
  // 옆면 (어둡게)
  s += cPoly(side, `fill="${P.brickShade}"`);
  const bh = 7;
  for (let z = zt - bh, r = 0; z > zr(x0) - 8; z -= bh, r++) {
    s += line(p(x0, y0, z), p(x0, y1, z), darken(P.brickShade, 0.25), 1, `opacity=".7"`);
    const yy = y0 + (r % 2 ? 0.5 : 0.25) * (y1 - y0);
    s += line(p(x0, yy, z), p(x0, yy, z + bh), darken(P.brickShade, 0.25), 1, `opacity=".7"`);
  }
  s += cPoly(side, `fill="none" ${S(2.2)}`);
  // 앞면 벽돌
  const cid = cabId("cab-ch");
  s += `<clipPath id="${cid}">${cPoly(front)}</clipPath>`;
  s += cPoly(front, `fill="${P.brick}"`);
  s += `<g clip-path="url(#${cid})">`;
  const [fx0, fyTop] = p(x0, y0, zt), [fx1] = p(x1, y0, zt);
  const bw = 11;
  for (let row = 0, y = fyTop; y < fyTop + (zt - zr(x1) + 10); y += bh, row++) {
    for (let x = fx0 - (row % 2 ? bw / 2 : 0); x < fx1; x += bw) {
      const r = rand();
      const c = r < 0.3 ? lighten(P.brick, 0.14) : r > 0.8 ? darken(P.brick, 0.07) : P.brick;
      s += cRect(x + 0.6, y + 0.6, bw - 1.2, bh - 1.2, c, `rx="1.2" stroke="${P.brickShade}" stroke-width="1"`);
      s += line([x + 2, y + 1.8], [x + bw - 3, y + 1.8], lighten(P.brick, 0.35), 1, `opacity=".7"`);
    }
  }
  s += cRect(fx1 - 4, fyTop, 4, 200, P.brickShade, `opacity=".35"`);
  s += `</g>`;
  s += cPoly(front, `fill="none" ${S(2.4)}`);
  // 머리 (크림색 돌)
  const e = 3.5, ch = 7;
  const cTop = [p(x0 - e, y0 - e, zt + ch), p(x1 + e, y0 - e, zt + ch), p(x1 + e, y1 + e, zt + ch), p(x0 - e, y1 + e, zt + ch)];
  s += cPoly([p(x0 - e, y0 - e, zt), p(x0 - e, y1 + e, zt), p(x0 - e, y1 + e, zt + ch), p(x0 - e, y0 - e, zt + ch)], `fill="${CAP.side}" ${S(2.2)}`);
  s += cPoly([p(x0 - e, y0 - e, zt), p(x1 + e, y0 - e, zt), p(x1 + e, y0 - e, zt + ch), p(x0 - e, y0 - e, zt + ch)], `fill="${CAP.front}" ${S(2.2)}`);
  s += cPoly(cTop, `fill="${CAP.top}" ${S(2.2)}`);
  const i = 3;
  s += cPoly([p(x0 + i, y0 + i, zt + ch), p(x1 - i, y0 + i, zt + ch), p(x1 - i, y1 - i, zt + ch), p(x0 + i, y1 - i, zt + ch)], `fill="#4a3426" stroke="${OUTLINE}" stroke-width="1.4"`);
  // 연기 한 줄기
  const [tx, ty] = p((x0 + x1) / 2, (y0 + y1) / 2, zt + ch);
  const puffs = [[tx, ty - 5, 4.2], [tx + 4, ty - 11, 5.4], [tx + 11, ty - 17, 6.6], [tx + 6, ty - 23, 5.2], [tx + 18, ty - 24, 5.6], [tx + 14, ty - 31, 4.4]];
  s += `<g opacity=".92">` + puffs.map(([x, y, r]) => cCirc(x, y, r + 1.3, OUTLINE)).join("");
  s += puffs.map(([x, y, r]) => cCirc(x, y, r, "#e4dccd")).join("");
  s += puffs.map(([x, y, r]) => cCirc(x - r * 0.15, y - r * 0.18, r * 0.78, "#fbf7ef")).join("");
  s += puffs.map(([x, y, r]) => cCirc(x - r * 0.35, y - r * 0.38, r * 0.22, "#ffffff")).join("") + `</g>`;
  return s;
}

function dormer(p: Proj, Wd: number, D: number, Hw: number, R: number, rf: RoofPal, rand: Rand, leftClip: string) {
  const zl = (X: number) => Hw + R - (Wd / 2 - X) * PITCH; // 왼쪽 경사면 높이
  const xAt = (z: number) => Wd / 2 - (Hw + R - z) / PITCH;
  const xd = Wd * 0.07, yd0 = D * 0.32, yd1 = yd0 + 50, ym = (yd0 + yd1) / 2;
  const zb = zl(xd), zE = zb + 24, Td = 1.0, zP = zE + ((yd1 - yd0) / 2) * Td;
  const od = 6, thd = 5, zEo = zE - od * Td;
  const R1 = p(xd - od, ym, zP), E1 = p(xd - od, yd0 - od, zEo), E2 = p(xAt(zEo), yd0 - od, zEo), R2 = p(xAt(zP), ym, zP);
  const E1b = p(xd - od, yd1 + od, zEo);
  const dn = ([x, y]: Vec): Vec => [x, y + thd];
  let s = "";
  // 큰 지붕 위에 드리운 그림자
  s += `<g clip-path="url(#${leftClip})">${cPoly([dn(E1b), dn(E1), E2, [E2[0] + 6, E2[1] + 12], [E1[0] + 8, E1[1] + 16], [E1b[0] + 6, E1b[1] + 14]], `fill="#1d1430" opacity=".22"`)}</g>`;
  // 정면 (왼쪽을 향함): 통나무
  const face = [p(xd, yd0, zb - 3), p(xd, yd1, zb - 3), p(xd, yd1, zE), p(xd, ym, zP), p(xd, yd0, zE)];
  const fid = cabId("cab-dm");
  s += `<clipPath id="${fid}">${cPoly(face)}</clipPath>`;
  s += cPoly(face, `fill="${P.log}"`);
  s += `<g clip-path="url(#${fid})">`;
  const lh = 9;
  for (let z = zb - 3; z < zP; z += lh) {
    const band = (za: number, zz: number) => [p(xd, yd0 - 8, za), p(xd, yd1 + 8, za), p(xd, yd1 + 8, zz), p(xd, yd0 - 8, zz)];
    s += cPoly(band(z + lh * 0.55, z + lh * 0.88), `fill="${P.logHi}" opacity=".9"`);
    s += cPoly(band(z, z + lh * 0.25), `fill="${P.logShade}"`);
    s += line(p(xd, yd0 - 8, z), p(xd, yd1 + 8, z), OUTLINE, 1.2, `opacity=".7"`);
  }
  s += `</g>`;
  s += cPoly(face, `fill="none" ${S(2.4)}`);
  // 앞쪽 옆 볼 (정면을 향한 삼각형)
  const cheek = [p(xd, yd0, zb - 3), p(xd, yd0, zE), p(xAt(zE), yd0, zE)];
  s += cPoly(cheek, `fill="${P.logShade}" ${S(2)}`);
  // 창 (왼쪽 면 위 평행사변형)
  const q = (y: number, z: number) => p(xd, y, z);
  const wy0 = ym - 11, wy1 = ym + 11, wz0 = zb + 2, wz1 = zb + 21;
  s += cPoly([q(wy0 - 3, wz0 - 3), q(wy1 + 3, wz0 - 3), q(wy1 + 3, wz1 + 3), q(wy0 - 3, wz1 + 3)], `fill="${FRAME}" ${S(2.2)}`);
  s += cPoly([q(wy0, wz0), q(wy1, wz0), q(wy1, wz1), q(wy0, wz1)], `fill="${P.window}" stroke="${darken(FRAME, 0.35)}" stroke-width="1"`);
  s += cPoly([q(wy0, wz1 - 3), q(wy1, wz1 - 3), q(wy1, wz1), q(wy0, wz1)], `fill="${darken(P.window, 0.22)}"`);
  s += cPoly([q(wy1 - 4, wz0 + 1), q(wy1 - 9, wz0 + 1), q(wy0 + 9, wz1 - 3), q(wy0 + 14, wz1 - 3)], `fill="${P.windowHi}" opacity=".85"`);
  s += line(q(ym, wz0), q(ym, wz1), FRAME, 3) + line(q(wy0, (wz0 + wz1) / 2), q(wy1, (wz0 + wz1) / 2), FRAME, 3);
  // 처마 두께 (왼쪽을 향하는 면)
  s += cPoly([E1b, R1, E1, dn(E1), dn(R1), dn(E1b)], `fill="${rf.deep}" ${S(2.2)}`);
  // 작은 지붕 앞 경사면 (기와)
  const rid = cabId("cab-dr");
  const quad = [R1, E1, E2, R2];
  s += `<clipPath id="${rid}">${cPoly(quad)}</clipPath>`;
  s += cPoly(quad, `fill="${rf.base}"`);
  const Rx = p(xAt(zEo), ym, zP);
  s += tiles(R1, Rx, E1, 2, Math.max(3, Math.round((Rx[0] - R1[0]) / 20)), rf, rand, rid);
  s += cPoly(quad, `fill="none" ${S(2.4)}`);
  s += line(R1, R2, OUTLINE, 6.5) + line(R1, R2, rf.hi, 3);
  return s;
}

function steps(p: Proj, X: number, wTop: number) {
  let s = "";
  const slab = (x0: number, x1: number, y0: number, y1: number, z1: number) => {
    let o = "";
    o += cPoly([p(x0, y0, 0), p(x0, y1, 0), p(x0, y1, z1), p(x0, y0, z1)], `fill="${STEP.side}" ${S(2)}`);
    o += cPoly([p(x0, y0, 0), p(x1, y0, 0), p(x1, y0, z1), p(x0, y0, z1)], `fill="${STEP.front}" ${S(2)}`);
    o += cPoly([p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], `fill="${STEP.top}" ${S(2)}`);
    const [a1, a2] = [p(x0 + 3, y0 + 2, z1), p(x1 - 3, y0 + 2, z1)];
    o += line([a1[0], a1[1] - 1.2], [a2[0], a2[1] - 1.2], "#fff6e6", 1.4, `opacity=".9"`);
    const m = (x0 + x1) / 2;
    o += line(p(m + 4, y0, z1 * 0.2), p(m + 6, y0, z1 * 0.8), STEP.line, 1, `opacity=".8"`);
    return o;
  };
  s += slab(X - wTop / 2, X + wTop / 2, -10, 0, 9);
  s += slab(X - wTop / 2 - 7, X + wTop / 2 + 7, -22, -10, 5);
  return s;
}


// ===== 마을 건물: 동물 농장, 상점, 마을 게시판, 출석 도장판 =====
// 손그림 느낌: 큰 면마다 왼쪽 위 밝음 → 오른쪽 아래 어두움 그라데이션, 그늘은 살짝 흐리게,
// 판자·기와마다 밝기 ±6% 흔들림, 그림 전체에 얼룩·결(feTurbulence) 을 아주 옅게 덮는다.
type Stop = [number, string, number?];
type Pal = { base: string; shade: string; hi: string; line: string; edge: string };
type LeavesOpt = { r?: number; n?: number; ow?: number; flowers?: number; flowerCols?: string[]; fr?: number; fc?: string };
type FencePost = { x: number; y: number; s: number; sc: number; hh: number; lean: number; tint: number };
// ───────────────────────── 공용 도우미 ─────────────────────────
const f = (n: number) => Math.round(n * 10) / 10;
const pts = (a: Vec[]) => a.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const up = (a: Vec, h: number): Vec => [a[0], a[1] - h];
const lerp = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const unit = (a: Vec): Vec => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; };
const op = (o: number) => (o < 1 ? ` opacity="${f(o * 100) / 100}"` : "");
const jit = (c: string, t: number) => (t >= 0 ? lighten(c, t) : darken(c, -t)); // 밝기 흔들림 (t: ±0.06 정도)

const SO = S(3.4); // 큰 덩어리 외곽선
const SM = S(2.6); // 작은 소품 외곽선
const poly = (a: Vec[], fill: string, st = SM) => `<polygon points="${pts(a)}" fill="${fill}" ${st}/>`;
const fpoly = (a: Vec[], fill: string, o = 1) => `<polygon points="${pts(a)}" fill="${fill}"${op(o)}/>`;
const ln = (a: Vec, b: Vec, col: string, w = 1.4, o = 1) =>
  `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${op(o)}/>`;
const pl = (a: Vec[], col: string, w = 1.4, o = 1) =>
  `<polyline points="${pts(a)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op(o)}/>`;
const circ = (x: number, y: number, r: number, fill: string, st = SM) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" ${st}/>`;
const fcirc = (x: number, y: number, r: number, fill: string, o = 1) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${op(o)}/>`;
const ell = (x: number, y: number, rx: number, ry: number, fill: string, st = SM) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${st}/>`;
const fell = (x: number, y: number, rx: number, ry: number, fill: string, o = 1) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${op(o)}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0, st = SM) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${rx}"` : ""} fill="${fill}" ${st}/>`;
const frect = (x: number, y: number, w: number, h: number, fill: string, o = 1, rx = 0) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${rx}"` : ""} fill="${fill}"${op(o)}/>`;
const path = (d: string, fill: string, st = "") => `<path d="${d}" fill="${fill}" ${st}/>`;

// ── 그림마다 쓰는 defs 모음 + 붓 느낌 필터 ──
let DEFS: string[] = [];
let FX: Record<string, string> = {};
/** 그림 안 id 를 만드는 함수. 광장 그림은 uid(), 농장 화면(서버에서도 그림)은 begin()에 고정 id 함수를 넘긴다 */
let bid: (prefix: string) => string = uid;
function begin(W: number, H: number, seed: number, ids: (prefix: string) => string = uid) {
  bid = ids;
  DEFS = [];
  FX = { paint: bid("paint"), soft: bid("soft"), soft3: bid("soft3"), soft6: bid("soft6") };
  const box = `filterUnits="userSpaceOnUse" x="-60" y="-60" width="${W + 120}" height="${H + 120}"`;
  // 얼룩(큰 무늬, 어두운/밝은) + 고운 결. 그림이 있는 곳(SourceAlpha)에만 얹는다.
  DEFS.push(
    `<filter id="${FX.paint}" ${box} color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.026" numOctaves="3" seed="${seed}" result="lo"/>` +
      `<feColorMatrix in="lo" type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.13  0 0 0 0 0.05  0.62 0 0 0 -0.3" result="dk"/>` +
      `<feColorMatrix in="lo" type="matrix" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.84  0 0 0.62 0 -0.3" result="lt"/>` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed + 5}" result="hi"/>` +
      `<feColorMatrix in="hi" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.11  0 0 0 0 0.04  0.26 0 0 0 -0.085" result="fn"/>` +
      `<feMerge result="tx"><feMergeNode in="dk"/><feMergeNode in="lt"/><feMergeNode in="fn"/></feMerge>` +
      `<feComposite in="tx" in2="SourceAlpha" operator="in" result="txm"/>` +
      `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="txm"/></feMerge></filter>`,
    `<filter id="${FX.soft}" ${box}><feGaussianBlur stdDeviation="1.6"/></filter>`,
    `<filter id="${FX.soft3}" ${box}><feGaussianBlur stdDeviation="3.2"/></filter>`,
    `<filter id="${FX.soft6}" ${box}><feGaussianBlur stdDeviation="6"/></filter>`,
  );
}
const finish = (w: number, h: number, body: string) => svg(w, h, `<g filter="url(#${FX.paint})">${body}</g>`, DEFS.join(""));
const soft = (body: string, k = "soft") => `<g filter="url(#${FX[k]})">${body}</g>`;
/** linearGradient. stops = [[offset, color, opacity?]], dir = [x1,y1,x2,y2] (objectBoundingBox) */
function lg(stops: Stop[], dir = [0, 0, 1, 1]) {
  const id = bid("lg");
  DEFS.push(`<linearGradient id="${id}" x1="${dir[0]}" y1="${dir[1]}" x2="${dir[2]}" y2="${dir[3]}">` +
    stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ""}/>`).join("") + `</linearGradient>`);
  return `url(#${id})`;
}
/** 왼쪽 위 밝음 → 오른쪽 아래 어두움 */
const face = (hi: string, base: string, sh: string, dir = [0, 0, 1, 1]) => lg([[0, hi], [0.48, base], [1, sh]], dir);
function inClip(shape: string, body: string) {
  const id = bid("cp");
  DEFS.push(`<clipPath id="${id}">${shape}</clipPath>`);
  return `<g clip-path="url(#${id})">${body}</g>`;
}

/** 외곽선 있는 굵은 띠 (난간, 흰 테두리 등). ow = 바깥 외곽선 굵기 */
function band(a: Vec[], w: number, fill: string, closed = false, ow = 3, oc: string = OUTLINE) {
  const tag = closed ? "polygon" : "polyline";
  const p = pts(a);
  return `<${tag} points="${p}" fill="none" stroke="${oc}" stroke-width="${f(w + ow * 2)}" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<${tag} points="${p}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

/** 부드럽게 흔들린 타원 덩어리 path */
function blobD(cx: number, cy: number, rx: number, ry: number, seed: number, jitAmt = 0.06, n = 26) {
  const r = rng(seed);
  const p: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * 2 * jitAmt;
    p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smoothD(p);
}
/** 점들을 지나는 매끈한 닫힌 곡선 */
function smoothD(p: Vec[]) {
  const n = p.length;
  const mid = (u: Vec, v: Vec): Vec => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  const m = mid(p[n - 1], p[0]);
  let d = `M${f(m[0])},${f(m[1])}`;
  for (let i = 0; i < n; i++) {
    const q = mid(p[i], p[(i + 1) % n]);
    d += `Q${f(p[i][0])},${f(p[i][1])} ${f(q[0])},${f(q[1])}`;
  }
  return d + "Z";
}
/** 가장자리가 풀잎처럼 삐죽삐죽한 땅 조각 */
function raggedD(cx: number, cy: number, rx: number, ry: number, seed: number, n = 44) {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, a2 = ((i + 0.5) / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * 0.1;
    const p = [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
    const s = Math.sin(a2) > -0.2 && r() < 0.75 ? 3 + r() * 6 : r() * 2;
    const q = [cx + Math.cos(a2) * (rx + s), cy + Math.sin(a2) * (ry + s * 0.9) - (s > 3 ? 1.5 : 0)];
    d += `${i ? "L" : "M"}${f(p[0])},${f(p[1])} L${f(q[0])},${f(q[1])} `;
  }
  return d + "Z";
}

// ── 잎 덩어리 (가장자리가 잎 끝처럼 오돌토돌) ──
const LF = { deep: "#2d5a2b", shade: "#3f7a3a", mid: "#6fa244", light: "#a9cf5f", hi: "#d3e98f" };

/** 잎 한 무더기의 외곽: 7~10개의 둥글거나 뾰족한 잎 끝 */
function clumpD(cx: number, cy: number, r: number, seed: number, nb?: number) {
  const R = rng(seed * 7919 + 13);
  const n = nb ?? 7 + Math.floor(R() * 4);
  const a0 = R() * Math.PI * 2;
  const P = (a: number, rr: number): Vec => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  const va: number[] = [], vr: number[] = [];
  for (let i = 0; i < n; i++) { va.push(a0 + ((i + (R() - 0.5) * 0.35) / n) * Math.PI * 2); vr.push(r * (0.8 + R() * 0.08)); }
  const s = P(va[0], vr[0]);
  let d = `M${f(s[0])},${f(s[1])}`;
  for (let i = 0; i < n; i++) {
    const A0 = va[i], A1 = i + 1 < n ? va[i + 1] : va[0] + Math.PI * 2;
    const span = A1 - A0, pk = r * (1.0 + R() * 0.1);
    const e = P(A1, vr[(i + 1) % n]);
    if (R() < 0.45) {
      const tip = P(A0 + span * (0.45 + R() * 0.1), pk * 1.05);
      const c1 = P(A0 + span * 0.22, pk), c2 = P(A1 - span * 0.22, pk);
      d += `Q${f(c1[0])},${f(c1[1])} ${f(tip[0])},${f(tip[1])}Q${f(c2[0])},${f(c2[1])} ${f(e[0])},${f(e[1])}`;
    } else {
      const c1 = P(A0 + span * 0.12, pk * 1.16), c2 = P(A1 - span * 0.12, pk * 1.16);
      d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(e[0])},${f(e[1])}`;
    }
  }
  return d + "Z";
}
/** 아몬드 모양 잎 하이라이트 */
function leafDab(x: number, y: number, len: number, ang: number, col: string, o = 1, wd = 0.42) {
  const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
  const nx = -dy * wd, ny = dx * wd, mx = x + dx / 2, my = y + dy / 2;
  return `<path d="M${f(x)},${f(y)}Q${f(mx + nx)},${f(my + ny)} ${f(x + dx)},${f(y + dy)}Q${f(mx - nx)},${f(my - ny)} ${f(x)},${f(y)}Z" fill="${col}"${op(o)}/>`;
}

/** 잎 덤불: 무더기 여러 개 + 3단계 초록 + 사이사이 짙은 홈 + 잎 모양 하이라이트, 꽃 옵션 */
function leaves(cx: number, cy: number, w: number, h: number, seed: number, opt: LeavesOpt = {}) {
  const r = rng(seed);
  const base = opt.r ?? Math.max(8, Math.min(24, Math.min(w, h) * 0.3));
  const n = opt.n ?? Math.max(4, Math.round((w * h) / (base * base * 2.1)));
  const blobs: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const rr = base * (0.75 + r() * 0.4);
    blobs.push([cx + Math.cos(a) * d * Math.max(2, w / 2 - rr * 0.8), cy + Math.sin(a) * d * Math.max(2, h / 2 - rr * 0.8), rr, 1 + Math.floor(r() * 1e5)]);
  }
  blobs.sort((p, q) => p[1] - q[1]);
  let out = `<path d="${blobs.map(([x, y, rr, s]) => clumpD(x, y, rr, s)).join("")}" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="${opt.ow ?? 6.6}" stroke-linejoin="round"/>`;
  for (const [x, y, rr, s] of blobs) {
    const low = ((y - cy) / (h / 2)) * 0.75 + ((x - cx) / (w / 2)) * 0.45;
    out += path(clumpD(x, y, rr, s), low > 0.8 ? darken(LF.shade, 0.08) : LF.shade);
    const mx = x - rr * 0.13, my = y - rr * 0.17;
    out += path(clumpD(mx, my, rr * 0.8, s + 1), low > 0.65 ? darken(LF.mid, 0.12) : LF.mid);
    if (low < 0.45) out += path(clumpD(x - rr * 0.3, y - rr * 0.36, rr * 0.48, s + 2, 6), LF.light, low > 0.1 ? `opacity=".8"` : "");
    // 짙은 홈 (아래쪽 잎 사이)
    for (let k = 0; k < 3; k++) {
      const a = Math.PI * (0.18 + 0.32 * k + r() * 0.12), d = rr * 0.6;
      const px = mx + Math.cos(a) * d, py = my + Math.sin(a) * d;
      out += pl([[px - 2.8, py - 2.4], [px, py + 0.6], [px + 2.4, py - 2.8]], LF.deep, 1.5, 0.7);
    }
    // 잎 모양 하이라이트
    const nd = low < 0.2 ? 4 : low < 0.7 ? 2 : 0;
    for (let k = 0; k < nd; k++) {
      const a = Math.PI * (1.0 + r() * 0.7), d = rr * (0.25 + r() * 0.4);
      out += leafDab(x - rr * 0.1 + Math.cos(a) * d, y - rr * 0.12 + Math.sin(a) * d, 4 + r() * 4, -0.5 - r() * 1.6, low < 0 ? LF.hi : LF.light, 0.95);
    }
  }
  for (let i = 0; i < (opt.flowers ?? 0); i++) {
    const a = r() * Math.PI * 2, d = 0.2 + Math.sqrt(r()) * 0.55;
    const cols = opt.flowerCols ?? [C.pinkFlower];
    out += flw(cx + (Math.cos(a) * d * w) / 2, cy + (Math.sin(a) * d * h) / 2, opt.fr ?? 6.5, cols[i % cols.length], opt.fc ?? "#f6c445", r() * 70);
  }
  return out;
}

/** 다섯 꽃잎 꽃 (꽃잎은 길쭉한 타원, 가운데 노란 점) */
function flw(cx: number, cy: number, r: number, petal: string, center = "#f6c445", rot = 0) {
  let o = "";
  const sw = f(Math.min(1.7, 0.8 + r * 0.07));
  for (let i = 0; i < 5; i++) {
    const a = i * 72 - 90 + rot, ar = (a * Math.PI) / 180;
    const px = cx + Math.cos(ar) * r * 0.56, py = cy + Math.sin(ar) * r * 0.56;
    o += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(r * 0.5)}" ry="${f(r * 0.38)}" transform="rotate(${f(a)} ${f(px)} ${f(py)})" fill="${petal}" stroke="${OUTLINE}" stroke-width="${sw}"/>`;
  }
  if (r > 6) {
    for (let i = 0; i < 5; i++) {
      const ar = ((i * 72 - 90 + rot) * Math.PI) / 180;
      o += ln([cx + Math.cos(ar) * r * 0.32, cy + Math.sin(ar) * r * 0.32], [cx + Math.cos(ar) * r * 0.62, cy + Math.sin(ar) * r * 0.62], darken(petal, 0.12), 1.2, 0.7);
    }
  }
  o += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.3)}" fill="${center}" stroke="${darken(center, 0.35)}" stroke-width="${f(Math.min(1.3, 0.5 + r * 0.06))}"/>`;
  if (r > 5) o += fcirc(cx - r * 0.08, cy - r * 0.1, r * 0.1, lighten(center, 0.55), 0.9);
  return o;
}

/** 풀잎 한 묶음 */
function tuft(x: number, y: number, s: number, col: string = C.grassShade) {
  const d = `M${f(x - s)},${f(y)} L${f(x - s * 1.15)},${f(y - s * 1.3)} L${f(x - s * 0.35)},${f(y - s * 0.45)} L${f(x)},${f(y - s * 1.8)} L${f(x + s * 0.35)},${f(y - s * 0.45)} L${f(x + s * 1.2)},${f(y - s * 1.25)} L${f(x + s)},${f(y)} Z`;
  return `<path d="${d}" fill="${col}" stroke="${darken(col, 0.3)}" stroke-width="1.2" stroke-linejoin="round"/>`;
}
/** 땅 위 풀 질감 (짧은 획) */
function grassTicks(cx: number, cy: number, rx: number, ry: number, n: number, seed: number, col: string = C.grassShade, o = 0.6) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = cx + Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry;
    out += pl([[x - 3, y], [x - 1.5, y - 4], [x, y], [x + 1.5, y - 5], [x + 3, y]], col, 1.3, o);
  }
  return out;
}
/** 풀밭 얼룩: 밝은 연두 조각 + 짙은 점 */
function grassMottle(cx: number, cy: number, rx: number, ry: number, seed: number, nLight = 6, nDark = 10) {
  const r = rng(seed);
  let lt = "", dk = "";
  for (let i = 0; i < nLight; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85;
    lt += path(blobD(cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, 18 + r() * 26, 7 + r() * 9, 1 + Math.floor(r() * 999), 0.2, 10), r() < 0.5 ? "#b9d872" : "#c8de7e", `opacity=".55"`);
  }
  for (let i = 0; i < nDark; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.9;
    dk += fell(cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, 4 + r() * 7, 2 + r() * 3, "#6a9a42", 0.45);
  }
  return soft(lt, "soft3") + soft(dk);
}

// ── 나무 부품 ──
/** 둥근 통나무 기둥 (울타리). 꼭대기는 나이테가 보이는 단면. lean = 기울기(도), tint = 밝기 흔들림 */
function post(x: number, yb: number, w = 18, h = 50, lean = 0, tint = 0) {
  const base = jit(C.wood, tint), sh = jit(C.woodShade, tint), hi = jit(C.woodHi, tint);
  const top = yb - h, ry = w * 0.32, L = x - w / 2, R = x + w / 2;
  let o = `<g transform="rotate(${f(lean)} ${f(x)} ${f(yb)})">`;
  o += `<path d="M${f(L)},${f(top)} V${f(yb)} Q${f(x)},${f(yb + ry * 1.3)} ${f(R)},${f(yb)} V${f(top)} Z" fill="${lg([[0, hi], [0.3, base], [0.6, base], [1, sh]], [0, 0, 1, 0])}" ${S(3.2)}/>`;
  o += ln([x - w * 0.05, top + ry + 6], [x - w * 0.05, yb - 9], darken(base, 0.25), 1.2, 0.55);
  o += ln([x + w * 0.24, top + ry + 14], [x + w * 0.24, yb - 3], darken(sh, 0.15), 1.1, 0.5);
  o += ell(x, top, w / 2, ry, jit(C.logEnd, tint), S(3));
  o += `<ellipse cx="${f(x)}" cy="${f(top)}" rx="${f(w * 0.27)}" ry="${f(ry * 0.52)}" fill="none" stroke="${C.logRing}" stroke-width="1.2"/>`;
  o += fcirc(x, top, 1.2, C.logRing);
  return o + `</g>`;
}
/** 가로 통나무 난간: 위쪽 빛, 아래쪽 그늘, 나뭇결 */
function rail(a: Vec, b: Vec, w = 10.5, tint = 0) {
  const base = jit(C.wood, tint);
  const d = unit(sub(b, a));
  let n = [d[1], -d[0]];
  if (n[0] + n[1] > 0) n = mul(n, -1); // 빛 쪽(왼쪽 위)
  const a1 = lerp(a, b, 0.04), b1 = lerp(a, b, 0.96);
  let o = band([a, b], w, base, false, 3);
  o += ln(add(a1, mul(n, -w * 0.28)), add(b1, mul(n, -w * 0.28)), darken(base, 0.2), w * 0.36, 0.85);
  o += ln(add(a1, mul(n, w * 0.24)), add(b1, mul(n, w * 0.24)), jit(C.woodHi, tint), 2, 0.9);
  o += ln(lerp(a, b, 0.22), lerp(a, b, 0.55), darken(base, 0.3), 1.1, 0.55);
  return o;
}
/** 나무 판재 (가로 들보): 끝이 둥근 판, 위 밝음 → 아래 그늘 */
function beam(x: number, y: number, w: number, h: number, seed = 1) {
  const r = rng(seed);
  let o = rect(x, y, w, h, lg([[0, C.woodHi], [0.35, C.wood], [0.7, C.wood], [1, C.woodShade]], [0, 0, 0, 1]), f(Math.min(7, h * 0.32)), SO);
  o += frect(x + 5, y + 2.6, w - 10, 2.4, lighten(C.woodHi, 0.2), 0.6, 1.2);
  for (let i = 0; i < Math.round(w / 30); i++) {
    const gx = x + 10 + r() * (w - 44), gy = y + h * (0.35 + r() * 0.35);
    o += ln([gx, gy], [gx + 14 + r() * 18, gy], darken(C.wood, 0.22), 1.1, 0.6);
  }
  return o;
}
/** 네모난 나무 기둥: 밝은 앞면 + 어두운 오른쪽 옆면, 바닥은 곧게 */
function sqPost(x: number, yTop: number, yBot: number, w: number, side: number, seed = 1) {
  const r = rng(seed);
  const fw = w - side;
  let o = rect(x, yTop, w, yBot - yTop, C.wood, 0, SO);
  o += frect(x + 1.7, yTop + 1.7, fw - 1.7, yBot - yTop - 3.4, lg([[0, C.woodHi], [0.45, C.wood], [1, darken(C.wood, 0.06)]], [0, 0, 1, 0]));
  o += frect(x + fw, yTop + 1.7, side - 1.7, yBot - yTop - 3.4, lg([[0, C.woodShade], [1, darken(C.woodShade, 0.12)]], [0, 0, 1, 0]));
  o += ln([x + fw, yTop + 1.7], [x + fw, yBot - 1.7], darken(C.woodShade, 0.25), 1.6, 0.9);
  for (let i = 0; i < 3; i++) {
    const gx = x + 4 + r() * (fw - 8), gy = yTop + 8 + r() * (yBot - yTop - 30);
    o += ln([gx, gy], [gx, gy + 12 + r() * 16], darken(C.wood, 0.22), 1.1, 0.55);
  }
  return o;
}

/** 나무 통 (원통). (cx, yb) = 바닥 가운데. 따뜻한 주황 갈색 + 가는 쇠테 */
const BRL = { base: "#b8703c", shade: "#8e5228", hi: "#d48f55", end: "#dca26a", ring: "#b77c47", hoop: "#4a3428", hoopHi: "#8c6f5c" };
function barrel(cx: number, yb: number, w: number, h: number, topFill?: (x: number, y: number, rx: number, ry: number) => string) {
  const rx = w / 2, ry = w * 0.2, top = yb - h, bulge = w * 0.08;
  const body = `M${f(cx - rx)},${f(top)} Q${f(cx - rx - bulge * 2)},${f(top + h / 2)} ${f(cx - rx)},${f(yb)} Q${f(cx)},${f(yb + ry * 1.5)} ${f(cx + rx)},${f(yb)} Q${f(cx + rx + bulge * 2)},${f(top + h / 2)} ${f(cx + rx)},${f(top)} Z`;
  let o = path(body, lg([[0, BRL.hi], [0.28, BRL.base], [0.62, BRL.base], [1, BRL.shade]], [0, 0, 1, 0]), w > 50 ? SO : S(3));
  let inner = "";
  const r = rng(Math.round(w * 13));
  const staves = [-0.72, -0.42, -0.12, 0.18, 0.48, 0.76];
  for (let i = 0; i < staves.length - 1; i++) {
    const t0 = staves[i], t1 = staves[i + 1], v = (r() - 0.5) * 0.12;
    inner += `<path d="M${f(cx + rx * t0)},${f(top)} Q${f(cx + rx * t0 * 1.12)},${f(top + h / 2)} ${f(cx + rx * t0)},${f(yb + ry)} L${f(cx + rx * t1)},${f(yb + ry)} Q${f(cx + rx * t1 * 1.12)},${f(top + h / 2)} ${f(cx + rx * t1)},${f(top)} Z" fill="${v > 0 ? "#fff" : "#000"}" opacity="${f(Math.abs(v) * 100) / 100}"/>`;
  }
  for (const t of staves) {
    inner += `<path d="M${f(cx + rx * t)},${f(top + 2)} Q${f(cx + rx * t * 1.12)},${f(top + h / 2)} ${f(cx + rx * t)},${f(yb + ry * (1 - Math.abs(t)) * 0.9)}" fill="none" stroke="${darken(BRL.shade, 0.15)}" stroke-width="1.3" opacity=".7"/>`;
  }
  inner += soft(`<path d="M${f(cx - rx + 4)},${f(top + 6)} Q${f(cx - rx - bulge + 4)},${f(top + h / 2)} ${f(cx - rx + 4.5)},${f(yb - 6)}" fill="none" stroke="${lighten(BRL.hi, 0.25)}" stroke-width="${f(w * 0.08)}" stroke-linecap="round" opacity=".8"/>`);
  o += inClip(`<path d="${body}"/>`, inner);
  const hw = w * 0.065 + 1.2;
  for (const t of [0.2, 0.78]) {
    const y = top + h * t, ex = rx + bulge * 1.6 * Math.sin(Math.PI * t);
    const d = `M${f(cx - ex)},${f(y)} Q${f(cx)},${f(y + ry * 1.5)} ${f(cx + ex)},${f(y)}`;
    o += `<path d="${d}" fill="none" stroke="${BRL.hoop}" stroke-width="${f(hw)}" stroke-linecap="round"/>`;
    o += `<path d="M${f(cx - ex * 0.85)},${f(y - hw * 0.25)} Q${f(cx - ex * 0.35)},${f(y + ry * 0.9 - hw * 0.25)} ${f(cx)},${f(y + ry * 0.72 - hw * 0.25)}" fill="none" stroke="${BRL.hoopHi}" stroke-width="1" stroke-linecap="round" opacity=".9"/>`;
  }
  o += ell(cx, top, rx, ry, BRL.end, w > 50 ? S(3.2) : S(2.8));
  if (topFill) o += topFill(cx, top, rx, ry);
  else {
    o += `<ellipse cx="${f(cx)}" cy="${f(top)}" rx="${f(rx * 0.62)}" ry="${f(ry * 0.6)}" fill="none" stroke="${BRL.ring}" stroke-width="1.2"/>`;
    o += ln([cx - rx * 0.6, top], [cx + rx * 0.6, top], BRL.ring, 1, 0.7);
  }
  return o;
}

/** 꽃 화분 (테라코타). (cx, yb) = 바닥 가운데 */
function pot(cx: number, yb: number, w: number, h: number) {
  const t = "#c9744a", ts = "#a85a36", th = "#e0956a";
  let o = `<path d="M${f(cx - w * 0.42)},${f(yb - h)} L${f(cx - w * 0.33)},${f(yb)} Q${f(cx)},${f(yb + 4)} ${f(cx + w * 0.33)},${f(yb)} L${f(cx + w * 0.42)},${f(yb - h)} Z" fill="${lg([[0, th], [0.35, t], [1, ts]], [0, 0, 1, 0])}" ${S(3)}/>`;
  o += rect(cx - w / 2, yb - h - h * 0.28, w, h * 0.32, lg([[0, th], [0.4, t], [1, ts]], [0, 0, 1, 0]), 3, S(3));
  o += frect(cx - w / 2 + 3, yb - h - h * 0.24, w * 0.5, h * 0.08, lighten(th, 0.3), 0.8, 1);
  return o;
}

// 색
const K = {
  hay: "#f1cc68", hayShade: "#d5a743", hayHi: "#fbe39b", hayLine: "#b98a33",
  water: "#6cb6de", waterHi: "#c3e8f7", waterShade: "#4f97c4",
  cork: "#c49c72", corkShade: "#a8825a", corkHi: "#d6b48c",
  paper: "#fcf4e0", paperPink: "#f9d9d0", paperBlue: "#eef2f2",
  wall: "#f3ddb0", wallShade: "#ddc08c", wallHi: "#fbecc9",
  door: "#5f9a4a", doorShade: "#477c37", doorHi: "#7db866",
  chalk: "#2f4740", plate: "#3e6050", plateHi: "#557a68",
  path: "#ecd3a3", pathLine: "#d4b47d", pathHi: "#f6e4be",
  orange: "#f2924e",
};
const TILE = { base: "#d65c4c", shade: "#b0433a", hi: "#f08d7c", line: "#8e3229", edge: "#a23b31" };

// ───────────────────────── 1. 동물 농장 ─────────────────────────
const ROOF = { base: "#8a4a36", shade: "#6b3626", hi: "#a6624a", line: "#4a2618", edge: "#5a2c1e" };

/** 평행사변형 면 위 기와 줄. point(u,t)=o+U*u+T*t. 줄은 U 방향(처마와 나란히), 엇갈려 쌓인다 */
function shingles(o: Vec, U: Vec, T: Vec, rows: number, cols: number, pal: Pal, seed: number) {
  const p = (u: number, t: number) => add(add(o, mul(U, u)), mul(T, t));
  const r = rng(seed);
  let tint = "", lines = "", his = "", shade = "";
  for (let k = 0; k < rows; k++) {
    const off = (k % 2) * 0.5;
    const t0 = k / rows, t1 = (k + 1) / rows;
    for (let j = -1; j <= cols; j++) {
      const a = Math.max(0, (j + off) / cols), b = Math.min(1, (j + 1 + off) / cols);
      if (b <= a) continue;
      const v = (r() - 0.5) * 2;
      tint += fpoly([p(a, t0), p(b, t0), p(b, t1), p(a, t1)], v > 0 ? "#fff" : "#000", Math.abs(v) * 0.1);
      if (a > 0.005) lines += `M${pts([p(a, t0 + 0.02)])} L${pts([p(a, t1)])} `;
    }
    shade += fpoly([p(0, t1 - 0.3 / rows), p(1, t1 - 0.3 / rows), p(1, t1), p(0, t1)], pal.shade, 0.55);
    if (k < rows) lines += `M${pts([p(0, t1)])} L${pts([p(1, t1)])} `;
    his += `M${pts([p(0.0, t0 + 0.12 / rows)])} L${pts([p(1, t0 + 0.12 / rows)])} `;
  }
  return tint + soft(shade) +
    `<path d="${his}" fill="none" stroke="${pal.hi}" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>` +
    `<path d="${lines}" fill="none" stroke="${pal.line}" stroke-width="2" stroke-linecap="round" opacity=".95"/>`;
}

/** 헛간 (농장 안). 기준: 앞모서리 바닥 Cn */
function barn() {
  const V = [-76, -36], G = [122, -18], H = 72, RISE = 54;
  const Vn = unit(V), Gn = unit(G);
  const Cn = [236, 198];
  const B = add(Cn, V), R = add(Cn, G);
  const Ct = up(Cn, H), Bt = up(B, H), Rt = up(R, H);
  const P = up(lerp(Ct, Rt, 0.5), RISE);
  const Pp = sub(P, mul(V, 0.1));
  const Qp = add(Pp, mul(V, 1.25));
  const L = mul(sub(Ct, P), 1.15);
  const E1 = add(Pp, L), E2 = add(E1, mul(V, 1.25));
  const Rr = mul(sub(Rt, P), 1.12);
  const RF = add(Pp, Rr), RB = add(Qp, Rr);
  const red = C.barn, redS = C.barnShade, redH = lighten(C.barn, 0.16), seam = darken(C.barn, 0.32);
  const r = rng(77);
  let o = "";

  // 바닥 그림자
  o += soft(fpoly([add(B, [-16, 6]), add(Cn, [-4, 16]), add(R, [18, 10]), add(R, [6, -10]), add(B, [0, -8])], "#2f4a1c", 0.3), "soft3");

  // 옆벽 (왼쪽 앞)
  const side = [Cn, B, Bt, Ct];
  let sb = fpoly(side, face(lighten(red, 0.12), red, darken(redS, 0.04), [0, 0, 1, 1]));
  for (let k = 0; k < 7; k++) {
    const a = add(Cn, mul(V, k / 7)), b = add(Cn, mul(V, (k + 1) / 7)), v = (r() - 0.5) * 2;
    sb += fpoly([a, b, up(b, H + 30), up(a, H + 30)], v > 0 ? "#fff" : "#000", Math.abs(v) * 0.09);
  }
  for (let k = 1; k < 7; k++) sb += ln(add(Cn, mul(V, k / 7)), add(Ct, mul(V, k / 7)), seam, 1.6, 0.7);
  for (let k = 0; k < 7; k++) sb += ln(add(up(Cn, 10 + (k % 3) * 6), mul(V, (k + 0.3) / 7)), add(up(Ct, -26 - (k % 2) * 10), mul(V, (k + 0.3) / 7)), redH, 1.3, 0.45);
  sb += soft(fpoly([E2, E1, add(E1, [0, 22]), add(E2, [0, 22])], darken(redS, 0.1), 0.75) + fpoly([add(B, [0, -14]), add(Cn, [0, -14]), add(Cn, [0, 4]), add(B, [0, 4])], redS, 0.45));
  // 옆벽 창문
  const wo = up(add(Cn, mul(Vn, 20)), 26);
  const win = [wo, add(wo, mul(Vn, 26)), up(add(wo, mul(Vn, 26)), 27), up(wo, 27)];
  sb += poly(win, C.white, S(2.6));
  const wi = [add(up(wo, 4), mul(Vn, 4.5)), add(up(wo, 4), mul(Vn, 21.5)), add(up(wo, 23), mul(Vn, 21.5)), add(up(wo, 23), mul(Vn, 4.5))];
  sb += poly(wi, "#3d4f7a", S(1.6));
  sb += fpoly([wi[3], lerp(wi[3], wi[2], 0.55), lerp(wi[0], wi[1], 0.0)], "#6f86b5", 0.9);
  o += inClip(`<polygon points="${pts(side)}"/>`, sb) + poly(side, "none", SO);

  // 박공 앞면 (오른쪽 앞)
  const gable = [Cn, R, Rt, P, Ct];
  let gb = fpoly(gable, face(lighten(red, 0.08), red, darken(redS, 0.08), [0, 0, 1, 1]));
  for (let k = 0; k < 10; k++) {
    const a = add(Cn, mul(G, k / 10)), b = add(Cn, mul(G, (k + 1) / 10)), v = (r() - 0.5) * 2;
    gb += fpoly([a, b, up(b, 160), up(a, 160)], v > 0 ? "#fff" : "#000", Math.abs(v) * 0.09);
  }
  for (let k = 1; k < 10; k++) gb += ln(add(Cn, mul(G, k / 10)), up(add(Cn, mul(G, k / 10)), 160), seam, 1.6, 0.65);
  for (let k = 0; k < 10; k++) gb += ln(up(add(Cn, mul(G, (k + 0.35) / 10)), 10), up(add(Cn, mul(G, (k + 0.35) / 10)), 60 + (k % 3) * 18), redH, 1.3, 0.4);
  gb += soft(fpoly([add(Cn, mul(G, 0.8)), add(R, [2, 0]), up(R, 140), up(add(Cn, mul(G, 0.72)), 140)], redS, 0.5) +
    fpoly([add(Cn, [0, -12]), add(R, [0, -12]), add(R, [0, 3]), add(Cn, [0, 3])], redS, 0.4) +
    fpoly([add(Ct, [0, 16]), add(P, [0, 16]), add(Rt, [0, 16]), add(Rt, [0, -6]), add(P, [0, -6]), add(Ct, [0, -6])], darken(redS, 0.1), 0.55));
  // 큰 문 (흰 X)
  const dO = add(Cn, mul(Gn, 24)), DW = 74, DH = 66;
  const d0 = dO, d1 = add(dO, mul(Gn, DW)), d2 = up(d1, DH), d3 = up(d0, DH);
  gb += fpoly([d0, d1, d2, d3], face(lighten(redS, 0.04), redS, darken(redS, 0.18)));
  for (let k = 1; k < 6; k++) gb += ln(lerp(d0, d1, k / 6), lerp(d3, d2, k / 6), darken(redS, 0.25), 1.4, 0.8);
  gb += soft(fpoly([lerp(d3, d2, 0.04), lerp(d3, d2, 0.96), add(lerp(d3, d2, 0.96), [0, 11]), add(lerp(d3, d2, 0.04), [0, 11])], darken(redS, 0.3), 0.6));
  const fr = [add(d0, [4, -4]), add(d1, [-4, -4]), add(d2, [-4, 5]), add(d3, [4, 5])];
  gb += band([fr[0], fr[2]], 6, C.white, false, 2.2) + band([fr[1], fr[3]], 6, C.white, false, 2.2);
  gb += band([...fr, fr[0]], 7.5, C.white, false, 2.4);
  gb += ln(lerp(fr[3], fr[2], 0.06), lerp(fr[3], fr[2], 0.94), "#ffffff", 1.4, 0.9);
  gb += ln(lerp(fr[1], fr[0], 0.06), lerp(fr[1], fr[0], 0.94), "#e0d2bf", 1.6, 0.9);
  // 박공 작은 창
  const go = up(add(Cn, mul(Gn, 50)), 82);
  const gw = [go, add(go, mul(Gn, 22)), up(add(go, mul(Gn, 22)), 22), up(go, 22)];
  gb += poly(gw, C.white, S(2.4));
  const gi = [add(up(go, 4), mul(Gn, 4)), add(up(go, 4), mul(Gn, 18)), add(up(go, 18), mul(Gn, 18)), add(up(go, 18), mul(Gn, 4))];
  gb += poly(gi, "#3d4f7a", S(1.5));
  gb += fcirc(lerp(gi[0], gi[2], 0.5)[0], lerp(gi[0], gi[2], 0.5)[1] + 1, 3.4, "#f4e3c8");
  o += inClip(`<polygon points="${pts(gable)}"/>`, gb) + poly(gable, "none", SO);

  // 뒤 모서리 흰 기둥
  o += band([lerp(B, Bt, 0.02), lerp(B, Bt, 0.9)], 5, C.white, false, 2.6);

  // 지붕: 두께(처마) → 오른쪽 면 → 왼쪽 면
  const th = [0, 8];
  o += poly([E2, E1, add(E1, th), add(E2, th)], ROOF.edge, SO);
  o += poly([Pp, E1, add(E1, th), add(Pp, th)], ROOF.edge, SO);
  o += poly([Pp, RF, add(RF, th), add(Pp, th)], ROOF.edge, SO);
  const rface = [Pp, Qp, RB, RF];
  o += inClip(`<polygon points="${pts(rface)}"/>`, fpoly(rface, face(ROOF.base, ROOF.shade, darken(ROOF.shade, 0.15))) +
    shingles(Pp, mul(V, 1.25), Rr, 3, 6, { ...ROOF, hi: ROOF.base }, 11)) + poly(rface, "none", SO);
  const lface = [Pp, Qp, E2, E1];
  let lb = fpoly(lface, face(ROOF.hi, ROOF.base, ROOF.shade, [1, 0, 0, 1]));
  lb += soft(fpoly([Qp, add(Qp, mul(L, 0.45)), add(Pp, mul(L, 0.25)), Pp], ROOF.hi, 0.45) + fpoly([add(Qp, mul(L, 0.8)), E2, E1, add(Pp, mul(L, 0.82))], ROOF.shade, 0.5), "soft3");
  lb += shingles(Pp, mul(V, 1.25), L, 6, 7, ROOF, 7);
  o += inClip(`<polygon points="${pts(lface)}"/>`, lb) + poly(lface, "none", SO);
  // 용마루
  o += band([lerp(Pp, Qp, 0.0), lerp(Pp, Qp, 1)], 5.5, ROOF.shade, false, 3);
  o += ln(lerp(Pp, Qp, 0.04), lerp(Pp, Qp, 0.96), ROOF.hi, 1.5, 0.85);

  // 흰 테두리: 앞모서리 → 박공 처마 밑 → 오른쪽 모서리 (끊김 없이)
  const fasL = (x: number) => { const a = add(Pp, th), b = add(E1, th); const s = (x - a[0]) / (b[0] - a[0]); return lerp(a, b, s); };
  const fasR = (x: number) => { const a = add(Pp, th), b = add(RF, th); const s = (x - a[0]) / (b[0] - a[0]); return lerp(a, b, s); };
  const TW = 8;
  const trim = [Cn, add(fasL(Ct[0]), [0, TW / 2 + 0.5]), add(Pp, [0, 8 + TW / 2 + 0.5]), add(fasR(Rt[0] - 2), [0, TW / 2 + 0.5]), add(R, [-2, 0])];
  o += band(trim, TW, C.white, false, 2.8);
  o += pl([add(trim[1], [2, -1.5]), add(trim[2], [0, -1.6]), add(trim[3], [-2, -1.5])], "#ffffff", 1.4, 0.9);
  o += pl([add(trim[1], [3, 2.6]), add(trim[2], [0, 2.6]), add(trim[3], [-3, 2.6])], "#e6d8c4", 1.6, 0.9);
  o += ln(add(trim[0], [-2, -3]), add(trim[1], [-2, 6]), "#ffffff", 1.4, 0.8);

  // 굴뚝: 용마루 뒤쪽 끝 가까이, 네모난 회갈색 + 짙은 뚜껑
  const CH = { base: "#8f7a6c", shade: "#6f5c50", hi: "#a8968a", cap: "#4e3f37" };
  const c0 = add(add(Pp, mul(V, 1.02)), mul(L, 0.2));
  const cw = 13, cd = 11, chH = 30;
  const cl = add(c0, mul(Vn, cd)), cr = add(c0, mul(Gn, cw));
  const crB = add(cr, [0, -cw * 0.85]); // 오른쪽 면 아랫변은 지붕 경사를 따라 올라간다
  o += poly([cl, c0, up(c0, chH), up(cl, chH)], face(CH.hi, CH.base, CH.shade), S(3));
  o += poly([c0, crB, up(cr, chH), up(c0, chH)], CH.shade, S(3));
  o += ln(add(up(cl, chH - 4), [2, 0]), add(cl, [2, -4]), lighten(CH.hi, 0.2), 1.4, 0.6);
  const capO = 2.4;
  const k0 = up(add(c0, [0, 0]), chH), k1 = up(cl, chH), k2 = add(up(cl, chH), mul(Gn, cw)), k3 = up(cr, chH);
  o += poly([add(k0, [0, capO]), add(k1, [-capO, capO * 0.5]), add(k1, [-capO, -capO]), add(k2, [capO, -capO * 1.4]), add(k3, [capO, -capO * 0.4]), add(k3, [capO, capO * 0.8])], CH.cap, S(2.6));
  o += poly([k0, k1, k2, k3], "#2f2622", S(1.4));
  o += soft(fpoly([cl, c0, crB, add(crB, [8, 12]), add(cl, [6, 14])], ROOF.line, 0.35));
  return o;
}

/** 모서리가 둥근 사각형 (네 점) path */
function roundQuad(q: Vec[], rr = 4, bulge = 1.2) {
  const n = q.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = q[i], b = q[(i + 1) % n], c = q[(i + 2) % n];
    const ab = unit(sub(b, a)), bc = unit(sub(c, b));
    const p1 = sub(b, mul(ab, rr)), p2 = add(b, mul(bc, rr));
    const s = add(a, mul(ab, rr));
    const nrm = [ab[1], -ab[0]];
    const m = add(lerp(s, p1, 0.5), mul(nrm, -bulge));
    if (i === 0) d += `M${f(s[0])},${f(s[1])}`;
    d += `Q${f(m[0])},${f(m[1])} ${f(p1[0])},${f(p1[1])}Q${f(b[0])},${f(b[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + "Z";
}

/** 건초 더미 (3열 × 2단, 둥근 모서리 덩이). O = 앞 왼쪽 바닥 모서리 */
function hay(O: Vec, cols = 3, bw = 29, bh = 21, d = 30) {
  const Vn = unit([-76, -36]), Gn = unit([122, -18]);
  const W = cols * bw, Htot = bh * 2;
  const A = add(O, mul(Gn, W)), Bk = add(O, mul(Vn, d));
  const Ot = up(O, Htot), At = up(A, Htot), Bt = up(Bk, Htot), Tt = add(At, mul(Vn, d));
  const r = rng(5);
  let o = soft(fpoly([add(Bk, [-8, 6]), add(O, [-2, 10]), add(A, [14, 8]), add(A, [6, -6])], "#2f4a1c", 0.3), "soft3");
  // 전체 외곽 (바깥 실루엣만 진한 갈색)
  o += poly([O, A, At, Tt, Bt, Bk], OUTLINE, `stroke="${OUTLINE}" stroke-width="7" stroke-linejoin="round"`);
  const line = `stroke="${K.hayLine}" stroke-width="1.8" stroke-linejoin="round"`;
  const straw = (q: Vec[], col: string, nn: number, seed: number) => {
    const rr = rng(seed);
    let s = "";
    for (let k = 0; k < nn; k++) {
      const t = (k + 0.3 + rr() * 0.4) / nn;
      const a0 = lerp(q[0], q[1], t), a1 = lerp(q[3], q[2], t);
      s += ln(lerp(a0, a1, 0.12 + rr() * 0.1), lerp(a0, a1, 0.55 + rr() * 0.35), col, 1.2, 0.65);
    }
    return s;
  };
  // 왼쪽 옆면 (그늘) 2단
  for (let j = 0; j < 2; j++) {
    const q = [up(O, bh * j), up(Bk, bh * j), up(Bk, bh * (j + 1)), up(O, bh * (j + 1))];
    o += path(roundQuad(q, 3.5, 0.8), face(K.hayShade, darken(K.hayShade, 0.06), darken(K.hayShade, 0.16)), line);
    o += straw(q, darken(K.hayShade, 0.2), 5, 30 + j);
  }
  // 앞면 3 × 2
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < cols; i++) {
      const a = add(O, mul(Gn, bw * i)), b = add(O, mul(Gn, bw * (i + 1)));
      const q = [up(a, bh * j), up(b, bh * j), up(b, bh * (j + 1)), up(a, bh * (j + 1))];
      const v = (r() - 0.5) * 0.1;
      o += path(roundQuad(q, 4, 1.4), face(jit(K.hayHi, v), jit(K.hay, v), jit(K.hayShade, v)), line);
      o += straw([q[3], q[2], q[1], q[0]].reverse(), K.hayShade, 7, 40 + i + j * 5);
      o += soft(fpoly([lerp(q[0], q[3], 0.0), lerp(q[1], q[2], 0.0), lerp(q[1], q[2], 0.22), lerp(q[0], q[3], 0.22)], K.hayShade, 0.55));
      o += ln(lerp(lerp(q[3], q[2], 0.12), lerp(q[0], q[1], 0.12), 0.08), lerp(lerp(q[3], q[2], 0.5), lerp(q[0], q[1], 0.5), 0.08), "#fff3c4", 1.6, 0.8);
      for (const t of [0.3, 0.72]) o += ln(lerp(q[0], q[1], t), lerp(q[3], q[2], t), "#b9813a", 1.8, 0.7);
    }
  }
  // 윗면 3칸
  for (let i = 0; i < cols; i++) {
    const a = add(Ot, mul(Gn, bw * i)), b = add(Ot, mul(Gn, bw * (i + 1)));
    const q = [a, b, add(b, mul(Vn, d)), add(a, mul(Vn, d))];
    o += path(roundQuad(q, 3.5, 0.8), face("#fff0b8", K.hayHi, K.hay), line);
    for (let k = 1; k < 5; k++) o += ln(lerp(lerp(q[0], q[3], 0.15), lerp(q[1], q[2], 0.15), k / 5), lerp(lerp(q[0], q[3], 0.85), lerp(q[1], q[2], 0.85), k / 5), K.hay, 1.3, 0.85);
  }
  return o;
}

/** 물통 (나무 구유 + 물). (cx, cy) = 윗면 가운데 */
function trough(cx: number, cy: number, rx = 36, ry = 14, h = 14) {
  const W = { base: "#8d5d34", shade: "#6e4526", hi: "#a87146", rim: "#7a4e2c" };
  let o = soft(fell(cx + 6, cy + h + 5, rx + 8, ry * 0.75, "#2f4a1c", 0.3), "soft3");
  const body = `M${f(cx - rx)},${f(cy)} V${f(cy + h)} A${rx} ${ry} 0 0 0 ${f(cx + rx)},${f(cy + h)} V${f(cy)} Z`;
  o += path(body, lg([[0, W.hi], [0.3, W.base], [1, W.shade]], [0, 0, 1, 0]), SO);
  for (const t of [-0.6, -0.22, 0.16, 0.54]) {
    const x = cx + rx * t, yy = cy + ry * Math.sqrt(1 - t * t);
    o += ln([x, yy + 1], [x, yy + h - 1], darken(W.shade, 0.15), 1.3, 0.7);
  }
  o += `<path d="M${f(cx - rx + 1)},${f(cy + h * 0.55)} A${rx} ${ry} 0 0 0 ${f(cx + rx - 1)},${f(cy + h * 0.55)}" fill="none" stroke="#4a3428" stroke-width="2.6" opacity=".9"/>`;
  o += ell(cx, cy, rx, ry, W.rim, SO);
  o += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx - 3)}" ry="${f(ry - 2.4)}" fill="none" stroke="${W.hi}" stroke-width="1.6" opacity=".8"/>`;
  o += ell(cx, cy + 1, rx - 7.5, ry - 5, K.water, `stroke="#4a3428" stroke-width="2"`);
  o += soft(fell(cx + 5, cy + 2.5, rx - 13, ry - 8, K.waterShade, 0.6));
  o += ln([cx - rx * 0.48, cy - 2.2], [cx - rx * 0.12, cy - 3], K.waterHi, 2, 0.95);
  o += ln([cx + rx * 0.02, cy + 2], [cx + rx * 0.28, cy + 1.4], K.waterHi, 1.6, 0.85);
  return o;
}

/** 둥근 팔각형 같은 울타리 둘레의 점 (superellipse) */
function fencePt(cx: number, cy: number, rx: number, ry: number, t: number, p = 3.4): Vec {
  const c = Math.cos(t), s = Math.sin(t);
  return [cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / p)];
}

export function farmSvg(): string {
  const { width: w, height: h } = FARM_SIZE;
  begin(w * 2, h * 2, 3);
  let o = "";
  // 땅
  o += soft(path(blobD(264, 222, 258, 120, 21, 0.035), "#3b2a1a", `opacity=".14"`), "soft3");
  const groundD = blobD(260, 210, 256, 122, 22, 0.04);
  o += path(groundD, lg([[0, "#a4ca63"], [0.5, "#8dbb5a"], [1, "#77a64b"]], [0, 0, 0.7, 1]));
  o += inClip(`<path d="${groundD}"/>`, grassMottle(260, 210, 230, 104, 5, 9, 18));
  // 헛간 문에서 앞으로 이어지는 흙길
  const dirt = [[262, 196], [300, 192], [334, 186], [360, 200], [372, 226], [356, 254], [306, 266], [252, 258], [232, 236], [238, 210]];
  o += soft(path(smoothD(dirt), C.dirt, `opacity=".9"`));
  o += soft(path(smoothD(dirt.map(([x, y]) => [300 + (x - 300) * 0.66, 222 + (y - 222) * 0.6])), lighten(C.dirt, 0.3), `opacity=".7"`), "soft3");
  const rd = rng(12);
  for (let i = 0; i < 14; i++) o += fell(262 + rd() * 90, 204 + rd() * 50, 2 + rd() * 2, 1.2 + rd(), C.dirtShade, 0.6);
  o += grassTicks(260, 214, 230, 100, 60, 4);
  o += grassTicks(240, 200, 200, 80, 22, 9, "#bcd77a", 0.8);

  // 울타리 기둥 위치: 둥근 팔각형 둘레를 고르게 (17개), 높이·기울기 조금씩 다르게
  const cx = 262, cy = 204, rx = 238, ry = 108, N = 17;
  const samp: { t: number; p: Vec; L: number }[] = [];
  let tot = 0;
  for (let i = 0; i <= 720; i++) {
    const t = (i / 720) * Math.PI * 2, p = fencePt(cx, cy, rx, ry, t);
    if (i) tot += Math.hypot(p[0] - samp[i - 1].p[0], p[1] - samp[i - 1].p[1]);
    samp.push({ t, p, L: tot });
  }
  const rp = rng(31);
  const posts: FencePost[] = [];
  for (let i = 0; i < N; i++) {
    const want = ((i + 0.5 + (rp() - 0.5) * 0.22) / N) * tot;
    const sp = samp.find((s) => s.L >= want) ?? samp[samp.length - 1];
    const s = Math.sin(sp.t);
    const sc = 0.86 + 0.14 * (s + 1) / 2;
    posts.push({ x: sp.p[0], y: sp.p[1], s, sc, hh: 50 + (rp() - 0.5) * 10, lean: (rp() - 0.5) * 4, tint: (rp() - 0.5) * 0.12 });
  }
  const railPair = (p: FencePost, q: FencePost, seed: number) => {
    const hp = (k: number) => up([p.x, p.y], k * p.sc), hq = (k: number) => up([q.x, q.y], k * q.sc);
    const wr = 10.5 * Math.min(p.sc, q.sc), rr = rng(seed);
    return rail(hp(15), hq(15), wr, (rr() - 0.5) * 0.12) + rail(hp(34), hq(34), wr, (rr() - 0.5) * 0.12);
  };
  const backRails: string[] = [], frontRails: string[] = [];
  for (let i = 0; i < N; i++) {
    const p = posts[i], q = posts[(i + 1) % N];
    (p.y < cy - 10 && q.y < cy - 10 ? backRails : frontRails).push(railPair(p, q, 100 + i));
  }
  const drawPost = (p: FencePost) => post(p.x, p.y, 19 * p.sc, p.hh * p.sc, p.lean, p.tint);
  let back = backRails.join("");
  posts.filter((p) => p.y < cy - 10).sort((a, b) => a.y - b.y).forEach((p) => (back += drawPost(p)));
  let front = frontRails.join("");
  posts.filter((p) => p.y >= cy - 10).sort((a, b) => a.y - b.y).forEach((p) => (front += drawPost(p)));

  o += back;
  // 헛간 오른쪽 덤불 (꽃)
  o += leaves(398, 166, 96, 56, 31, { r: 15, flowers: 4, flowerCols: [C.pinkFlower, "#e8607a"], fr: 7.5 });
  o += leaves(150, 116, 46, 32, 37, { r: 12 });
  o += barn();
  // 헛간 아래 풀·꽃
  o += leaves(244, 204, 30, 18, 41, { r: 9, flowers: 1, flowerCols: ["#f08a5d"], fr: 6.5 });
  o += leaves(352, 188, 26, 16, 43, { r: 8.5, flowers: 1, flowerCols: [C.pinkFlower], fr: 6.5 });
  for (const [x, y, s] of [[330, 196, 4.5], [365, 194, 4], [270, 205, 4]]) o += tuft(x, y, s);
  o += flw(318, 200, 6.5, C.whiteFlower, "#f6c445", 10);
  // 건초 (헛간 왼쪽 벽에 붙여), 통, 물통
  o += hay([128, 226]);
  o += soft(fell(218, 244, 22, 6, "#2f4a1c", 0.35));
  o += barrel(214, 242, 34, 34, (x, y, rx, ry) => {
    let t = ell(x, y, rx * 0.8, ry * 0.75, "#c9a24e", S(1.6));
    const r = rng(8);
    for (let i = 0; i < 9; i++) t += fcirc(x + (r() - 0.5) * rx * 1.2, y + (r() - 0.5) * ry * 0.9, 1.6 + r(), r() < 0.5 ? "#e9c66b" : "#a8823a");
    return t;
  });
  o += trough(408, 230);
  o += tuft(400, 262, 4.5) + tuft(452, 254, 4) + tuft(160, 272, 5) + tuft(262, 274, 4);
  for (const [x, y, s] of [[72, 218, 4], [330, 282, 4.5], [462, 212, 4], [96, 272, 4], [228, 286, 4]]) o += tuft(x, y, s, C.grassShade);
  o += flw(456, 224, 6.5, C.pinkFlower, "#f6c445", 20) + flw(92, 252, 6.5, C.yellowFlower, "#e58a2e", 5) + flw(302, 290, 6, C.whiteFlower, "#f6c445", 30);
  o += flw(384, 270, 6.5, C.yellowFlower, "#e58a2e", 40) + flw(180, 280, 6, C.whiteFlower, "#f6c445", 12);

  o += front;
  // 울타리 밖 꽃 (왼쪽 아래)
  o += leaves(46, 306, 52, 24, 51, { r: 9, n: 7 });
  o += flw(30, 296, 12.5, C.whiteFlower, "#f6c445", 8) + flw(62, 310, 10, "#f6a25e", "#f6d36b", 30) + flw(52, 290, 7, C.pinkFlower, "#f6c445", 0);
  o += tuft(84, 320, 5) + tuft(488, 302, 5) + tuft(470, 320, 4.5) + tuft(14, 252, 4.5);
  o += flw(494, 314, 7, C.yellowFlower, "#e58a2e", 15);
  return finish(w, h, o);
}

// ───────────────────────── 2. 상점 ─────────────────────────
const AWN = { base: "#e25a6c", shade: "#c9435a", hi: "#f08a96", line: "#a8384b" };

/** 줄무늬 차양 (n 칸, 양 끝이 빨강이 되게 홀수). 아래는 반원 주름 */
function awning(x0t: number, x1t: number, x0b: number, x1b: number, yt: number, yb: number, n: number) {
  let o = "";
  const sh = 9.5;
  const gR = lg([[0, AWN.hi], [0.28, AWN.base], [0.72, AWN.base], [1, AWN.shade]], [0, 0, 0, 1]);
  const gW = lg([[0, "#ffffff"], [0.28, "#fff7ec"], [0.72, "#fbefe0"], [1, "#e9d6c2"]], [0, 0, 0, 1]);
  let outline = `M${f(x0t)},${f(yt)} L${f(x1t)},${f(yt)} L${f(x1b)},${f(yb)}`;
  let seams = "";
  for (let i = n - 1; i >= 0; i--) {
    const tl = x0t + ((x1t - x0t) * i) / n, tr = x0t + ((x1t - x0t) * (i + 1)) / n;
    const bl = x0b + ((x1b - x0b) * i) / n, br = x0b + ((x1b - x0b) * (i + 1)) / n;
    const rr = (br - bl) / 2;
    const isRed = i % 2 === 0;
    const d = `M${f(tl)},${f(yt)} L${f(tr)},${f(yt)} L${f(br)},${f(yb)} A${f(rr)} ${sh} 0 0 1 ${f(bl)},${f(yb)} Z`;
    o += path(d, isRed ? gR : gW);
    // 주름 아래쪽 좁은 그늘 (흐리게)
    o += soft(`<path d="M${f(bl + 1.5)},${f(yb - 3)} L${f(br - 1.5)},${f(yb - 3)} A${f(rr - 1.5)} ${sh - 2} 0 0 1 ${f(bl + 1.5)},${f(yb - 3)} Z" fill="${isRed ? AWN.shade : "#e2ccb6"}" opacity=".75"/>`);
    o += ln([tl + (tr - tl) * 0.3, yt + 4], [bl + (br - bl) * 0.3, yb - 10], isRed ? AWN.hi : "#ffffff", 2, isRed ? 0.55 : 0.9);
    if (i > 0) seams += `M${f(tl)},${f(yt)} L${f(bl)},${f(yb)} `;
    outline += ` A${f(rr)} ${sh} 0 0 1 ${f(bl)},${f(yb)}`;
  }
  outline += ` Z`;
  o += `<path d="${seams}" fill="none" stroke="${AWN.line}" stroke-width="1.4" opacity=".55"/>`;
  // 들보 밑 그늘
  o += inClip(`<path d="${outline}"/>`, soft(frect(x0b, yt - 4, x1b - x0b, 12, "#5a2a2a", 0.3), "soft3"));
  o += `<path d="${outline}" fill="none" ${SO}/>`;
  return o;
}

/** 둥근 기와 지붕(상점): 기와 끝마다 외곽이 살짝 울퉁불퉁하고, 아래 양끝은 바깥으로 살짝 휜다 */
function domeRoof(x0: number, x1: number, yTop: number, yBot: number, rows: number, seed: number, pal: Pal = TILE) {
  const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2, H = yBot - yTop, p = 2.8;
  const shape = (x: number) => { const u = Math.min(1, Math.abs((x - cx) / hw)); return Math.pow(1 - Math.pow(u, p), 1 / p); };
  const FL = 9;
  const flare = (y: number) => { const k = Math.max(0, 1 - (yBot - y) / (0.3 * H)); return FL * k * k; };
  // 외곽 점: superellipse 를 각도로 고르게, 길이 기준으로 기와마다 작은 혹
  const raw: Vec[] = [];
  const M = 240;
  for (let i = 0; i <= M; i++) {
    const t = Math.PI * (1 - i / M), c = Math.cos(t), s = Math.sin(t);
    raw.push([cx + hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), yBot - H * Math.pow(Math.abs(s), 2 / p)]);
  }
  let acc = 0;
  const outPts = raw.map((q, i) => {
    if (i) acc += Math.hypot(q[0] - raw[i - 1][0], q[1] - raw[i - 1][1]);
    const a = raw[Math.max(0, i - 1)], b = raw[Math.min(M, i + 1)];
    const tg = unit(sub(b, a)), nrm = [tg[1], -tg[0]];
    const bump = 2.6 * Math.abs(Math.sin((Math.PI * acc) / 19)) * Math.min(1, (yBot - q[1]) / 12);
    const qq = add(q, mul(nrm, bump));
    return [qq[0] + Math.sign(qq[0] - cx) * flare(qq[1]), qq[1]];
  });
  const d = `M${pts([outPts[0]])} L${outPts.slice(1).map((q) => pts([q])).join(" L")} Z`;

  let body = frect(x0 - 16, yTop - 8, x1 - x0 + 32, H + 12, face(pal.hi, pal.base, pal.shade, [0, 0, 1, 1]));
  body += soft(fell(cx + hw * 0.8, yBot, hw * 0.55, H * 0.8, pal.shade, 0.5) + fell(cx - hw * 0.4, yTop + H * 0.22, hw * 0.5, H * 0.38, pal.hi, 0.45), "soft6");
  const r = rng(seed);
  const rowY = (k: number, x: number) => yBot - H * shape(x) * (1 - k / rows);
  const span = x1 - x0;
  let tint = "", seps = "", edges = "", his = "", shades = "";
  for (let k = 0; k < rows; k++) {
    const n = Math.round(3 + k * 1.9 + span / 62);
    const off = (k % 2) * 0.5;
    for (let i = -1; i <= n; i++) {
      const xa = Math.max(x0, x0 + ((i + off) / n) * span), xb = Math.min(x1, x0 + ((i + 1 + off) / n) * span);
      if (xb - xa < 3) continue;
      const ta = rowY(k, xa), tb = rowY(k, xb), ba = rowY(k + 1, xa), bb = rowY(k + 1, xb);
      const xm = (xa + xb) / 2, dip = Math.min(4.5, (ba - ta) * 0.35);
      const v = (r() - 0.5) * 2;
      tint += `<path d="M${f(xa)},${f(ta)} L${f(xb)},${f(tb)} L${f(xb)},${f(bb)} Q${f(xm)},${f((ba + bb) / 2 + dip)} ${f(xa)},${f(ba)} Z" fill="${v > 0 ? "#fff" : "#000"}" opacity="${f(Math.abs(v) * 12) / 100}"/>`;
      shades += `M${f(xa + 2)},${f(ba - 2.8)} Q${f(xm)},${f((ba + bb) / 2 + dip - 2.8)} ${f(xb - 2)},${f(bb - 2.8)} `;
      edges += `M${f(xa)},${f(ba)} Q${f(xm)},${f((ba + bb) / 2 + dip)} ${f(xb)},${f(bb)} `;
      if (xa > x0 + 2 && ba - ta > 5) seps += `M${f(xa)},${f(ta + 1)} L${f(xa)},${f(ba)} `;
      if (ba - ta > 7) his += `M${f(xa + 3)},${f(ta + 3.4)} L${f(xb - 4)},${f(tb + 3.4)} `;
    }
  }
  body += tint;
  body += soft(`<path d="${shades}" fill="none" stroke="${pal.shade}" stroke-width="4" stroke-linecap="round" opacity=".75"/>`);
  body += `<path d="${his}" fill="none" stroke="${pal.hi}" stroke-width="2" stroke-linecap="round" opacity=".9"/>`;
  body += `<path d="${seps}" fill="none" stroke="${pal.line}" stroke-width="1.6" stroke-linecap="round"/>`;
  body += `<path d="${edges}" fill="none" stroke="${pal.line}" stroke-width="2.1" stroke-linecap="round"/>`;
  return inClip(`<path d="${d}"/>`, body) + `<path d="${d}" fill="none" ${SO}/>`;
}

/** 위로 곧게 선 잎 + 주황 백합 화분 식물 */
function lilyPlant(cx: number, yb: number) {
  const r = rng(404);
  let o = "";
  const leaf = (bx: number, by: number, ang: number, len: number, wid: number, col: string) => {
    const a = (ang * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
    const tip = [bx + dx * len, by + dy * len], nx = -dy, ny = dx;
    const m1 = [bx + dx * len * 0.45 + nx * wid, by + dy * len * 0.45 + ny * wid];
    const m2 = [bx + dx * len * 0.45 - nx * wid, by + dy * len * 0.45 - ny * wid];
    let s = `<path d="M${f(bx)},${f(by)} Q${f(m1[0])},${f(m1[1])} ${f(tip[0])},${f(tip[1])} Q${f(m2[0])},${f(m2[1])} ${f(bx)},${f(by)}Z" fill="${col}" ${S(2.2)}/>`;
    s += ln([bx + dx * 4, by + dy * 4], [bx + dx * len * 0.8, by + dy * len * 0.8], darken(col, 0.25), 1.2, 0.7);
    s += leafDab(bx + dx * len * 0.2 - nx * 2, by + dy * len * 0.2 - ny * 2, len * 0.35, a, lighten(col, 0.3), 0.7, 0.18);
    return s;
  };
  // 줄기
  const heads = [[cx - 14, yb - 62, -8], [cx + 4, yb - 72, 12], [cx + 18, yb - 58, 24], [cx - 2, yb - 52, -20]];
  for (const [hx, hy] of heads) o += `<path d="M${f(cx)},${f(yb)} Q${f((cx + hx) / 2 + 2)},${f((yb + hy) / 2)} ${f(hx)},${f(hy + 4)}" fill="none" stroke="${darken(LF.shade, 0.1)}" stroke-width="2.4" stroke-linecap="round"/>`;
  // 뒤쪽 잎 (어둡게) → 앞쪽 잎 (밝게)
  for (const [ang, len] of [[-128, 40], [-100, 48], [-70, 44], [-48, 36]]) o += leaf(cx + (r() - 0.5) * 6, yb, ang, len, 6.5, LF.shade);
  for (const [ang, len] of [[-150, 32], [-118, 38], [-86, 42], [-60, 36], [-30, 30]]) o += leaf(cx + (r() - 0.5) * 8, yb + 1, ang, len, 7, LF.mid);
  // 백합 꽃
  for (const [hx, hy, rot] of heads) o += lily(hx, hy, 9.5, rot);
  return o;
}
function lily(x: number, y: number, r: number, rot: number) {
  const P = { base: "#f08a3c", hi: "#ffb86b", shade: "#d0602a" };
  let o = `<g transform="rotate(${rot} ${f(x)} ${f(y)})">`;
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 - 90) * Math.PI) / 180, len = r * (i % 2 ? 0.9 : 1.05);
    const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len * 0.85];
    const nx = -Math.sin(a), ny = Math.cos(a), w = r * 0.32;
    const m = [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 * 0.85];
    o += `<path d="M${f(x)},${f(y)} Q${f(m[0] + nx * w)},${f(m[1] + ny * w)} ${f(tip[0])},${f(tip[1])} Q${f(m[0] - nx * w)},${f(m[1] - ny * w)} ${f(x)},${f(y)}Z" fill="${i < 3 ? P.hi : P.base}" stroke="${OUTLINE}" stroke-width="1.5" stroke-linejoin="round"/>`;
    o += ln([x + Math.cos(a) * len * 0.2, y + Math.sin(a) * len * 0.17], [x + Math.cos(a) * len * 0.62, y + Math.sin(a) * len * 0.53], P.shade, 1, 0.8);
  }
  o += fcirc(x, y, r * 0.22, "#b8461f");
  for (const a of [-120, -70, -30]) { const ar = (a * Math.PI) / 180; o += fcirc(x + Math.cos(ar) * r * 0.42, y + Math.sin(ar) * r * 0.42, 1.2, "#6b3216"); }
  return o + `</g>`;
}

export function shopSvg(): string {
  const { width: w, height: h } = SHOP_SIZE;
  begin(w * 2, h * 2, 11);
  let o = "";
  // 땅: 풀 + 앞 포장길
  const gD = raggedD(210, 320, 206, 34, 61, 52);
  o += path(gD, lg([[0, "#a4ca63"], [0.5, C.grass], [1, "#77a64b"]], [0, 0, 0.6, 1]));
  o += inClip(`<path d="${gD}"/>`, grassMottle(210, 320, 190, 30, 6, 4, 8));
  const pathD = `M120,302 L300,302 Q340,330 356,350 Q210,362 70,350 Q86,326 120,302 Z`;
  let pv = frect(40, 296, 340, 70, lg([[0, K.pathHi], [0.5, K.path], [1, darken(K.path, 0.06)]], [0, 0, 1, 1]));
  for (let k = 0; k < 4; k++) {
    const y = 304 + k * 13;
    pv += ln([40, y], [380, y], K.pathLine, 1.4, 0.8);
    for (let x = 60 + (k % 2) * 14; x < 380; x += 28) pv += ln([x, y], [x, y + 13], K.pathLine, 1.3, 0.7);
    for (let x = 64 + (k % 2) * 14; x < 380; x += 56) pv += ln([x, y + 3], [x + 14, y + 3], "#fff3d6", 1.4, 0.8);
  }
  o += inClip(`<path d="${pathD}"/>`, pv);
  o += soft(fell(210, 306, 170, 12, "#3b2a1a", 0.22), "soft3");

  // 뒤 덤불 (양옆, 노란 꽃)
  o += leaves(36, 214, 76, 190, 71, { r: 19, flowers: 6, flowerCols: [C.yellowFlower, "#f5b041"], fr: 6.5, fc: "#e58a2e" });
  o += leaves(388, 214, 70, 170, 72, { r: 19, flowers: 6, flowerCols: [C.yellowFlower, "#f5b041"], fr: 6.5, fc: "#e58a2e" });

  // 벽
  const wx0 = 58, wx1 = 362, wy0 = 176, wy1 = 306;
  o += rect(wx0, wy0, wx1 - wx0, wy1 - wy0, face(K.wallHi, K.wall, K.wallShade), 0, SO);
  o += soft(frect(wx1 - 70, wy0 + 2, 68, wy1 - wy0 - 4, K.wallShade, 0.45), "soft3");
  // 나무 기둥
  for (const x of [50, 226, 352]) {
    o += rect(x, wy0 - 4, 18, wy1 - wy0 + 6, lg([[0, C.woodHi], [0.35, C.wood], [0.62, C.wood], [1, C.woodShade]], [0, 0, 1, 0]), 2, S(3.2));
    o += ln([x + 9, wy0 + 14], [x + 9, wy0 + 50], darken(C.wood, 0.22), 1.1, 0.6);
    o += ln([x + 9, wy1 - 50], [x + 9, wy1 - 18], darken(C.wood, 0.22), 1.1, 0.6);
  }
  // 진열창
  const gx0 = 80, gy0 = 212, gx1 = 216, gy1 = 274;
  o += rect(gx0 - 8, gy0 - 8, gx1 - gx0 + 16, gy1 - gy0 + 16, face(C.woodHi, C.wood, C.woodShade), 3, S(3));
  let gw = frect(gx0, gy0, gx1 - gx0, gy1 - gy0, lg([[0, "#c4e3f3"], [0.45, "#8ec7e6"], [1, "#6fa9cf"]], [0, 0, 1, 1]));
  gw += fpoly([[gx0 + 10, gy1], [gx0 + 50, gy0], [gx0 + 64, gy0], [gx0 + 24, gy1]], "#ffffff", 0.35);
  gw += fpoly([[gx0 + 32, gy1], [gx0 + 72, gy0], [gx0 + 78, gy0], [gx0 + 38, gy1]], "#ffffff", 0.3);
  // 진열 상품: 주황 마름모 두 개 + 선반
  gw += frect(gx0, gy1 - 14, gx1 - gx0, 14, "#c89a64");
  gw += ln([gx0, gy1 - 14], [gx1, gy1 - 14], darken("#c89a64", 0.4), 2, 0.9);
  for (const [x, y, s] of [[122, 238, 19], [172, 236, 17]]) {
    gw += poly([[x, y - s], [x + s, y], [x, y + s], [x - s, y]], face(lighten(K.orange, 0.25), K.orange, darken(K.orange, 0.15)), S(2.4));
    gw += fpoly([[x + s - 3, y], [x, y + s - 3], [x - 4, y + s - 7], [x + s - 7, y - 1]], darken(K.orange, 0.18), 0.55);
    gw += ln([x - s * 0.45, y - 2], [x - 2, y - s * 0.45], "#fff4dc", 2, 0.9);
  }
  o += inClip(`<rect x="${gx0}" y="${gy0}" width="${gx1 - gx0}" height="${gy1 - gy0}"/>`, gw) + rect(gx0, gy0, gx1 - gx0, gy1 - gy0, "none", 0, S(2.2));
  // 창 밑 벽돌
  o += rect(gx0 - 12, gy1 + 8, gx1 - gx0 + 24, 9, face(C.woodHi, C.wood, C.woodShade, [0, 0, 0, 1]), 2, S(2.6));
  const bx0 = gx0 - 6, by0 = gy1 + 17, bw = gx1 - gx0 + 12, bh = wy1 - by0;
  let br = frect(bx0, by0, bw, bh, face(lighten(C.brick, 0.1), C.brick, C.brickShade));
  for (let k = 0; k < 3; k++) {
    const y = by0 + k * 6.5;
    br += ln([bx0, y], [bx0 + bw, y], C.brickShade, 1.3, 0.9);
    for (let x = bx0 + (k % 2) * 9; x < bx0 + bw; x += 18) {
      br += ln([x, y], [x, y + 6.5], C.brickShade, 1.2, 0.9);
      br += frect(x + 2, y + 1.3, 10, 1.6, lighten(C.brick, 0.35), 0.8);
    }
  }
  o += inClip(`<rect x="${bx0}" y="${by0}" width="${bw}" height="${bh}"/>`, br) + rect(bx0, by0, bw, bh, "none", 0, S(2.2));
  // 문 (위 창 + 아래 2×2 판)
  const dx0 = 250, dy0 = 208, dx1 = 340, dy1 = 306;
  o += rect(dx0 - 7, dy0 - 7, dx1 - dx0 + 14, dy1 - dy0 + 7, face(C.woodHi, C.wood, C.woodShade), 3, S(3));
  o += rect(dx0, dy0, dx1 - dx0, dy1 - dy0, face(K.doorHi, K.door, K.doorShade), 0, S(2.6));
  o += soft(frect(dx1 - 16, dy0 + 2, 14, dy1 - dy0 - 4, K.doorShade, 0.8));
  // 위 창: 연한 청회색 안쪽 테
  o += rect(dx0 + 12, dy0 + 9, 66, 36, "#2e3d58", 3, S(2.4));
  o += rect(dx0 + 16, dy0 + 13, 58, 28, "#3f5277", 2, `stroke="#b9c7d8" stroke-width="3"`);
  o += fpoly([[dx0 + 18, dy0 + 15], [dx0 + 32, dy0 + 15], [dx0 + 22, dy0 + 39], [dx0 + 18, dy0 + 39]], "#ffffff", 0.14);
  o += `<text x="${dx0 + 45}" y="${dy0 + 31}" text-anchor="middle" font-size="10" ${FONT} fill="#e9eef7" letter-spacing="1">OPEN</text>`;
  for (const [px, py] of [[dx0 + 12, dy0 + 52], [dx0 + 47, dy0 + 52], [dx0 + 12, dy0 + 75], [dx0 + 47, dy0 + 75]]) {
    o += rect(px, py, 31, 19, darken(K.door, 0.07), 2, `stroke="${darken(K.doorShade, 0.15)}" stroke-width="1.8"`);
    o += ln([px + 2, py + 2], [px + 29, py + 2], darken(K.doorShade, 0.2), 1.4, 0.7);
    o += ln([px + 2, py + 17.4], [px + 29, py + 17.4], K.doorHi, 1.4, 0.9);
    o += ln([px + 29.2, py + 3], [px + 29.2, py + 16], K.doorHi, 1.2, 0.7);
  }
  o += circ(dx0 + 7, dy0 + 56, 4.2, C.gold, S(1.8)) + fcirc(dx0 + 5.8, dy0 + 54.8, 1.4, "#fff3c2");
  // 돌 계단
  o += rect(dx0 - 12, dy1 - 2, dx1 - dx0 + 24, 12, face(C.stoneHi, C.stone, C.stoneShade, [0, 0, 0, 1]), 3, S(2.8));
  o += ln([dx0 + 20, dy1 - 1], [dx0 + 20, dy1 + 9], C.stoneShade, 1.3) + ln([dx0 + 66, dy1 - 1], [dx0 + 66, dy1 + 9], C.stoneShade, 1.3);

  // 차양 아래 그림자 (벽·창·문 위쪽)
  const x0b = 32, x1b = 388, yb = 184, n = 11;
  let cast = frect(wx0 - 10, wy0, wx1 - wx0 + 20, yb - wy0 + 6, "#6b4a2a", 0.5);
  for (let i = 0; i < n; i++) {
    const bl = x0b + ((x1b - x0b) * i) / n, rr = (x1b - x0b) / n / 2;
    cast += fell(bl + rr, yb + 7, rr, 11, "#6b4a2a", 0.5);
  }
  o += inClip(`<rect x="${wx0 - 10}" y="${wy0}" width="${wx1 - wx0 + 20}" height="${wy1 - wy0}"/>`, soft(cast, "soft3"));
  o += awning(48, 372, x0b, x1b, 142, yb, n);
  // 지붕
  o += domeRoof(36, 384, 34, 132, 5, 3);
  // 들보 (끝은 그냥 둥근 판)
  o += beam(24, 120, 372, 24, 5);
  // 간판
  o += soft(frect(130, 66, 170, 58, "#3b2a1a", 0.25, 12));
  o += rect(124, 60, 172, 58, face("#d9a46a", "#c58d55", "#a8743f"), 12, SO);
  o += rect(129.5, 65, 161, 47, lg([[0, "#fff1c6"], [0.5, "#fbe7b0"], [1, "#efd08f"]], [0, 0, 0, 1]), 9, `stroke="#d9ac6c" stroke-width="2"`);
  o += frect(136, 68.5, 148, 6, "#fff8e2", 0.8, 3);
  o += circ(160, 89, 14, C.gold, S(2.6));
  o += `<circle cx="160" cy="89" r="9" fill="none" stroke="#d1932a" stroke-width="2"/>`;
  o += fcirc(160, 89, 8, "#f7c94f");
  o += `<path d="M152,84 Q156,78 163,79" fill="none" stroke="#fff3c4" stroke-width="2.4" stroke-linecap="round"/>`;
  o += `<text x="230" y="101" text-anchor="middle" font-size="30" ${FONT} fill="${OUTLINE}">상점</text>`;

  // 앞 소품: 백합 화분(왼쪽), 칠판, 작은 화분, 통(오른쪽)
  o += soft(fell(50, 336, 30, 6, "#2f3a1a", 0.3));
  o += lilyPlant(48, 298);
  o += pot(48, 334, 52, 30);
  // 칠판 A형 입간판 (살짝 비스듬히: 오른쪽 다리가 더 뒤)
  o += soft(fell(132, 348, 40, 6, "#2f3a1a", 0.3));
  o += band([[118, 262], [104, 344]], 4.5, C.woodShade, false, 2.6) + band([[150, 266], [172, 338]], 4.5, C.woodShade, false, 2.6);
  const TL = [100, 256], TR = [158, 262], BR = [164, 328], BL = [94, 338];
  o += poly([TL, TR, BR, BL], face(C.woodHi, C.wood, C.woodShade), S(3));
  const iTL = [106, 264], iTR = [152, 268.5], iBR = [157.5, 321.5], iBL = [100.5, 330];
  o += poly([iTL, iTR, iBR, iBL], lg([[0, "#3d5a51"], [0.5, K.chalk], [1, "#25382f"]], [0, 0, 1, 1]), S(2));
  o += fpoly([iTL, lerp(iTL, iTR, 0.35), lerp(iBL, iBR, 0.15), iBL], "#ffffff", 0.06);
  const Q = (u: number, v: number) => lerp(lerp(iTL, iTR, u), lerp(iBL, iBR, u), v);
  const chalk = "#f3efe2";
  const doodles: ((x: number, y: number) => string)[] = [
    (x, y) => `<rect x="${f(x - 4)}" y="${f(y - 3.5)}" width="8" height="7" rx="1" fill="none" stroke="${chalk}" stroke-width="1.5"/>` + ln([x - 4, y - 1], [x + 4, y - 1], chalk, 1.1),
    (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="3.8" fill="none" stroke="${chalk}" stroke-width="1.5"/>` + fcirc(x, y, 1.2, chalk),
    (x, y) => pl([[x - 4, y + 3], [x - 1.5, y - 3.5], [x + 1, y + 2], [x + 4, y - 3]], chalk, 1.5),
    (x, y) => `<path d="M${f(x)},${f(y + 3.5)} C${f(x - 6)},${f(y - 1)} ${f(x - 2)},${f(y - 5)} ${f(x)},${f(y - 1.5)} C${f(x + 2)},${f(y - 5)} ${f(x + 6)},${f(y - 1)} ${f(x)},${f(y + 3.5)}Z" fill="none" stroke="${chalk}" stroke-width="1.4"/>`,
    (x, y) => `<path d="M${f(x - 3.5)},${f(y - 3)} H${f(x + 2.5)} V${f(y + 3.5)} H${f(x - 3.5)}Z M${f(x + 2.5)},${f(y - 1.5)} h2 v3 h-2" fill="none" stroke="${chalk}" stroke-width="1.4"/>`,
    (x, y) => { let d = ""; for (let i = 0; i < 10; i++) { const a = (i * 36 - 90) * Math.PI / 180, rr = i % 2 ? 1.8 : 4.2; d += `${i ? "L" : "M"}${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`; } return `<path d="${d}Z" fill="none" stroke="${chalk}" stroke-width="1.3" stroke-linejoin="round"/>`; },
    (x, y) => ln([x - 4, y - 2], [x + 4, y - 2], chalk, 1.5) + ln([x - 4, y + 2], [x + 2, y + 2], chalk, 1.5),
    (x, y) => `<path d="M${f(x - 3.5)},${f(y + 3)} L${f(x)},${f(y - 4)} L${f(x + 3.5)},${f(y + 3)}Z" fill="none" stroke="${chalk}" stroke-width="1.4" stroke-linejoin="round"/>`,
  ];
  let di = 0;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
    const [x, y] = Q(col ? 0.7 : 0.3, 0.14 + row * 0.24);
    o += `<g opacity=".9">${doodles[di++ % doodles.length](x, y)}</g>`;
  }
  o += band([BL, [92, 352]], 4, C.woodShade, false, 2.6) + band([BR, [165, 342]], 4, C.woodShade, false, 2.6);
  // 작은 화분
  o += soft(fell(212, 331, 18, 4, "#2f3a1a", 0.3));
  o += leaves(212, 286, 30, 22, 83, { r: 9, n: 6, flowers: 1, flowerCols: ["#e8564a"], fr: 7, fc: "#f6d36b" });
  o += pot(212, 328, 32, 22);
  // 오른쪽 통 + 흰 꽃
  o += soft(fell(370, 352, 40, 7, "#2f3a1a", 0.35));
  o += barrel(366, 348, 66, 64, (x, y, rx, ry) => fell(x, y, rx * 0.86, ry * 0.8, "#6b4a2c"));
  o += leaves(366, 272, 64, 30, 85, { r: 11, n: 9 });
  for (const [x, y, s, a] of [[350, 266, 9, 0], [376, 260, 9.5, 20], [362, 278, 8, 40], [390, 274, 7.5, 10]]) o += flw(x, y, s, C.whiteFlower, "#f6c445", a);
  // 풀
  for (const [x, y, s] of [[18, 340, 5], [86, 352, 4.5], [190, 344, 4], [240, 338, 4], [406, 346, 5], [320, 356, 4]]) o += tuft(x, y, s);
  return finish(w, h, o);
}

// ───────────────────────── 3. 마을 게시판 ─────────────────────────

/** 낮고 넓은 우진각 지붕: 사다리꼴, 용마루는 아래 폭의 ~58%이고 살짝 둥글다. 기와 줄은 처마와 나란히 */
function hipRoof(x0: number, x1: number, yTop: number, yBot: number, rows: number, seed: number, pal: Pal = TILE, rk = 0.58) {
  const W = x1 - x0, cx = (x0 + x1) / 2, H = yBot - yTop, rw = (W * rk) / 2;
  const arch = H * 0.14;
  const xl = (t: number) => x0 + (cx - rw - x0) * t - 2.5 * Math.sin(Math.PI * t);
  const xr = (t: number) => x1 - (x1 - (cx + rw)) * t + 2.5 * Math.sin(Math.PI * t);
  const yAt = (t: number, x: number) => yBot - t * (H + arch * Math.max(0, 1 - ((x - cx) / (W / 2)) ** 2));
  const outline: Vec[] = [];
  const S1 = 14;
  for (let i = 0; i <= S1; i++) { const t = i / S1; outline.push([xl(t), yAt(t, xl(t))]); }
  for (let i = 1; i < 16; i++) { const x = cx - rw + (2 * rw * i) / 16; outline.push([x, yAt(1, x)]); }
  for (let i = S1; i >= 0; i--) { const t = i / S1; outline.push([xr(t), yAt(t, xr(t))]); }
  const d = `M${outline.map((q) => pts([q])).join(" L")} Z`;
  const r = rng(seed);
  let body = frect(x0 - 6, yTop - arch - 6, W + 12, H + arch + 12, face(pal.hi, pal.base, pal.shade, [0, 0, 1, 1]));
  body += soft(fpoly([[cx + rw * 0.7, yTop - 10], [x1 + 6, yBot + 4], [cx + rw * 0.45, yBot + 4]], pal.shade, 0.55) + fpoly([[x0 - 6, yBot], [cx - rw, yTop - 8], [cx - rw * 0.5, yTop - 8], [x0 + W * 0.18, yBot]], pal.hi, 0.35), "soft6");
  let tint = "", edges = "", seps = "", his = "", shades = "";
  for (let k = 0; k < rows; k++) {
    const t0 = k / rows, t1 = (k + 1) / rows;
    const L0 = xl(t1) - 14, R0 = xr(t1) + 14;
    const n = Math.max(4, Math.round((R0 - L0) / 22));
    const off = (k % 2) * 0.5;
    for (let i = -1; i <= n; i++) {
      const xa = Math.max(L0, L0 + ((i + off) / n) * (R0 - L0)), xb = Math.min(R0, L0 + ((i + 1 + off) / n) * (R0 - L0));
      if (xb - xa < 3) continue;
      const ta = yAt(t1, xa), tb = yAt(t1, xb), ba = yAt(t0, xa), bb = yAt(t0, xb), xm = (xa + xb) / 2;
      const dip = Math.min(3.6, (ba - ta) * 0.32);
      const v = (r() - 0.5) * 2;
      tint += `<path d="M${f(xa)},${f(ta)} L${f(xb)},${f(tb)} L${f(xb)},${f(bb)} Q${f(xm)},${f((ba + bb) / 2 + dip)} ${f(xa)},${f(ba)} Z" fill="${v > 0 ? "#fff" : "#000"}" opacity="${f(Math.abs(v) * 12) / 100}"/>`;
      edges += `M${f(xa)},${f(ba)} Q${f(xm)},${f((ba + bb) / 2 + dip)} ${f(xb)},${f(bb)} `;
      shades += `M${f(xa + 2)},${f(ba - 2.6)} Q${f(xm)},${f((ba + bb) / 2 + dip - 2.6)} ${f(xb - 2)},${f(bb - 2.6)} `;
      seps += `M${f(xa)},${f(ta + 1)} L${f(xa)},${f(ba)} `;
      his += `M${f(xa + 3)},${f(ta + 3)} L${f(xb - 4)},${f(tb + 3)} `;
    }
  }
  body += tint;
  body += soft(`<path d="${shades}" fill="none" stroke="${pal.shade}" stroke-width="3.6" stroke-linecap="round" opacity=".75"/>`);
  body += `<path d="${his}" fill="none" stroke="${pal.hi}" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>`;
  body += `<path d="${seps}" fill="none" stroke="${pal.line}" stroke-width="1.5" stroke-linecap="round"/>`;
  body += `<path d="${edges}" fill="none" stroke="${pal.line}" stroke-width="2" stroke-linecap="round"/>`;
  // 처마 끝 (아래 가는 띠)
  body += frect(x0 - 4, yBot - 3.5, W + 8, 5, pal.edge, 0.95);
  // 모서리(내림마루) 선
  const hipL = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [xl(t) + 2.6, yAt(t, xl(t)) + 1.2]; });
  const hipR = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [xr(t) - 2.6, yAt(t, xr(t)) + 1.2]; });
  body += pl(hipL, pal.hi, 3, 0.7) + pl(hipR, pal.line, 2.6, 0.6);
  let o = inClip(`<path d="${d}"/>`, body) + `<path d="${d}" fill="none" ${SO}/>`;
  // 용마루
  const ridge = Array.from({ length: 9 }, (_, i) => { const x = cx - rw + 4 + ((2 * rw - 8) * i) / 8; return [x, yAt(1, x) + 1]; });
  o += band(ridge, 4.5, pal.shade, false, 2.6) + pl(ridge.map(([x, y]) => [x, y - 1]), pal.base, 1.6, 0.9);
  return o;
}

function note(x: number, y: number, w: number, h: number, paper: string, rot: number, lines = 3, lineCol = "#d9a47e") {
  let o = `<g transform="rotate(${rot} ${f(x + w / 2)} ${f(y + h / 2)})">`;
  o += soft(frect(x + 2.5, y + 3.5, w, h, "#3b2a1a", 0.3, 2));
  o += rect(x, y, w, h, lg([[0, lighten(paper, 0.5)], [0.6, paper], [1, darken(paper, 0.05)]], [0, 0, 1, 1]), 2, S(2.2));
  o += fpoly([[x + w, y + h - 10], [x + w, y + h], [x + w - 10, y + h]], darken(paper, 0.1));
  for (let i = 0; i < lines; i++) {
    const ly = y + 16 + i * ((h - 22) / Math.max(1, lines));
    o += ln([x + 7, ly], [x + w - 7 - (i === lines - 1 ? 12 : 0), ly], lineCol, 2, 0.95);
  }
  o += circ(x + w / 2, y + 4, 4.4, C.red, S(1.6)) + fcirc(x + w / 2 - 1.4, y + 2.6, 1.4, "#ffd1c9");
  return o + `</g>`;
}

/** 게시판 나무틀 + 코르크판 (안쪽 나무 턱 + 부드러운 얼룩). 바깥 x0..x1, y0..y1 */
function corkFrame(x0: number, y0: number, x1: number, y1: number, t = 10, seed = 1) {
  let o = soft(frect(x0 + 4, y0 + 6, x1 - x0, y1 - y0, "#2f2a1a", 0.25, 4), "soft3");
  o += rect(x0, y0, x1 - x0, y1 - y0, face(C.woodHi, C.wood, C.woodShade), 3, SO);
  o += frect(x0 + 3, y0 + 2.5, x1 - x0 - 6, 2.6, lighten(C.woodHi, 0.2), 0.7, 1.2);
  const ix0 = x0 + t, iy0 = y0 + t, ix1 = x1 - t, iy1 = y1 - t;
  // 안쪽 나무 턱
  o += rect(ix0 - 2.5, iy0 - 2.5, ix1 - ix0 + 5, iy1 - iy0 + 5, darken(C.woodShade, 0.12), 2, `stroke="${darken(C.woodShade, 0.35)}" stroke-width="1.6"`);
  const cork = `<rect x="${f(ix0)}" y="${f(iy0)}" width="${f(ix1 - ix0)}" height="${f(iy1 - iy0)}"/>`;
  let c = frect(ix0, iy0, ix1 - ix0, iy1 - iy0, face(K.corkHi, K.cork, K.corkShade));
  const r = rng(seed);
  let blot = "";
  for (let i = 0; i < Math.round((ix1 - ix0) * (iy1 - iy0) / 1600); i++) {
    blot += fell(ix0 + r() * (ix1 - ix0), iy0 + r() * (iy1 - iy0), 8 + r() * 12, 5 + r() * 7, r() < 0.55 ? K.corkShade : K.corkHi, 0.45);
  }
  c += soft(blot, "soft3");
  for (let i = 0; i < Math.round((ix1 - ix0) * (iy1 - iy0) / 300); i++) {
    c += fcirc(ix0 + 4 + r() * (ix1 - ix0 - 8), iy0 + 6 + r() * (iy1 - iy0 - 10), 0.8 + r() * 0.6, r() < 0.65 ? darken(K.corkShade, 0.1) : K.corkHi, 0.6);
  }
  c += soft(frect(ix0, iy0, ix1 - ix0, 9, "#5a3a20", 0.35) + frect(ix0, iy0, 6, iy1 - iy0, "#5a3a20", 0.25));
  o += inClip(cork, c);
  return { svg: o, ix0, iy0, ix1, iy1 };
}

/** 땅 접촉 그림자 + 풀 몇 포기로 기둥 바닥을 가린다 */
const postFoot = (x: number, yb: number, w: number) => soft(fell(x + w * 0.6, yb + 1, w * 0.9, 4, "#2f3a1a", 0.4)) + tuft(x + 2, yb + 3, 5) + tuft(x + w - 3, yb + 4, 4.5, "#7fae4e");

export function boardSvg(): string {
  const { width: w, height: h } = BOARD_SIZE;
  begin(w * 2, h * 2, 17);
  let o = "";
  // 땅 + 길
  const gD = raggedD(170, 304, 164, 34, 91, 48);
  o += path(gD, lg([[0, "#a4ca63"], [0.5, C.grass], [1, "#77a64b"]], [0, 0, 0.6, 1]));
  o += inClip(`<path d="${gD}"/>`, grassMottle(170, 304, 150, 28, 7, 5, 8));
  const pathD = `M128,284 L212,284 Q232,312 240,340 L100,340 Q108,312 128,284 Z`;
  let pv = frect(90, 280, 160, 64, lg([[0, K.pathHi], [0.5, K.path], [1, darken(K.path, 0.06)]], [0, 0, 1, 1]));
  for (let k = 0; k < 5; k++) {
    const y = 288 + k * 11;
    pv += ln([90, y], [250, y], K.pathLine, 1.3, 0.85);
    for (let x = 100 + (k % 2) * 12; x < 250; x += 24) pv += ln([x, y], [x, y + 11], K.pathLine, 1.2, 0.75);
  }
  o += inClip(`<path d="${pathD}"/>`, pv);
  o += soft(fell(170, 290, 130, 9, "#3b2a1a", 0.22), "soft3");
  // 덤불 (양옆, 노란 꽃)
  o += leaves(42, 200, 74, 190, 93, { r: 19, flowers: 6, flowerCols: [C.yellowFlower, "#f5b041"], fr: 7, fc: "#e58a2e" });
  o += leaves(298, 168, 76, 250, 94, { r: 19, flowers: 7, flowerCols: [C.yellowFlower, "#f5b041"], fr: 7, fc: "#e58a2e" });
  // 판 (좌우 굵은 네모 기둥 사이)
  const fr = corkFrame(60, 122, 280, 266, 12, 7);
  o += fr.svg;
  for (const [x, s] of [[48, 1], [270, 2]]) {
    o += sqPost(x, 112, 298, 22, 7, s);
    o += postFoot(x, 298, 22);
  }
  // 아래 가로대
  o += beam(38, 256, 264, 18, 9);
  // 쪽지 4장
  o += note(80, 142, 48, 46, K.paper, -2, 3);
  o += note(138, 140, 48, 46, K.paper, 1.5, 3);
  o += note(80, 198, 48, 46, K.paperBlue, 1.5, 3, "#a9b6c2");
  o += note(138, 198, 48, 46, K.paperPink, -1.5, 3, "#e19a8e");
  // 이름판
  o += soft(frect(205, 147, 64, 26, "#3b2a1a", 0.3, 3));
  o += rect(200, 142, 66, 26, face(K.plateHi, K.plate, darken(K.plate, 0.15)), 3, S(2.6));
  o += frect(204, 145, 58, 3, lighten(K.plateHi, 0.2), 0.7, 1.5);
  o += `<text x="233" y="160.5" text-anchor="middle" font-size="11.5" ${FONT} fill="#f4ecd8">마을 게시판</text>`;
  // 도장 동그라미 4개: 흰 원 + 빨간 테 + 빨간 점
  for (const [x, y] of [[218, 198], [252, 199], [218, 233], [252, 232]]) {
    o += soft(fcirc(x + 1.5, y + 2.5, 12.5, "#3b2a1a", 0.25));
    o += circ(x, y, 12.5, lg([[0, "#ffffff"], [1, "#efe4d0"]], [0, 0, 1, 1]), S(2.2));
    o += `<circle cx="${x}" cy="${y}" r="8.4" fill="none" stroke="#d9473f" stroke-width="2.6"/>`;
    o += fcirc(x, y, 4, "#d9473f") + fcirc(x - 1.3, y - 1.4, 1.2, "#ffb3a8");
  }
  // 지붕 + 들보
  o += beam(44, 106, 252, 20, 3);
  o += hipRoof(40, 300, 72, 112, 3, 13);
  // 앞 풀·꽃
  for (const [x, y, s] of [[96, 320, 4.5], [248, 318, 5], [290, 308, 4.5], [26, 298, 4]]) o += tuft(x, y, s);
  o += flw(78, 326, 7, C.whiteFlower, "#f6c445", 0) + flw(264, 330, 7, C.yellowFlower, "#e58a2e", 20) + flw(304, 322, 6, C.whiteFlower, "#f6c445", 35);
  return finish(w, h, o);
}

// ───────────────────────── 4. 출석 도장판 ─────────────────────────

/** 출석 도장 칸 (빈 칸 또는 빨간 별 도장) */
function stampSlot(x: number, y: number, r: number, stamped: boolean, rot = 0) {
  let o = soft(fcirc(x + 1.5, y + 2.5, r, "#3b2a1a", 0.25));
  o += circ(x, y, r, lg([[0, "#ffffff"], [1, "#efe2cc"]], [0, 0, 1, 1]), S(2.2));
  if (!stamped) {
    o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.68)}" fill="none" stroke="#c9a77d" stroke-width="1.5" stroke-dasharray="3 3" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`;
    return o;
  }
  const red = "#d8453c";
  o += `<g transform="rotate(${rot} ${f(x)} ${f(y)})" opacity=".92">`;
  o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.76)}" fill="none" stroke="${red}" stroke-width="2.2"/>`;
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = (i * 36 - 90) * Math.PI / 180, rr = i % 2 ? r * 0.25 : r * 0.58;
    d += `${i ? "L" : "M"}${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)} `;
  }
  o += `<path d="${d}Z" fill="${red}" stroke="${darken(red, 0.2)}" stroke-width="1" stroke-linejoin="round"/>`;
  o += `</g>`;
  return o;
}

export function attendanceSvg(): string {
  const { width: w, height: h } = ATTENDANCE_SIZE;
  begin(w * 2, h * 2, 23);
  let o = "";
  // 풀밭 (가장자리 삐죽삐죽)
  const gD = raggedD(110, 282, 78, 15, 101, 30);
  o += path(gD, lg([[0, "#a4ca63"], [0.5, C.grass], [1, "#77a64b"]], [0, 0, 0.6, 1]));
  o += inClip(`<path d="${gD}"/>`, grassMottle(110, 282, 70, 12, 9, 3, 4));
  // 기둥 하나 (네모, 오른쪽 옆면 어둡게) + 까치발
  o += band([[104, 236], [64, 210]], 6, C.woodShade, false, 3) + band([[116, 236], [156, 210]], 6, C.woodShade, false, 3);
  o += ln([100, 232], [68, 211], C.woodHi, 1.4, 0.6);
  o += sqPost(98, 200, 284, 24, 8, 4);
  o += postFoot(98, 284, 24);
  // 판
  const fr = corkFrame(22, 88, 198, 212, 10, 17);
  o += fr.svg;
  // 초록 머리판
  o += soft(frect(58, 100, 112, 28, "#3b2a1a", 0.3, 4));
  o += rect(54, 96, 112, 28, face("#6fa865", "#4f8a4a", "#3f7339", [0, 0, 0, 1]), 4, S(2.8));
  o += frect(58, 99, 104, 3, lighten("#6fa865", 0.25), 0.7, 1.5);
  o += `<text x="110" y="116" text-anchor="middle" font-size="15.5" ${FONT} fill="#fbf3e2">출석 도장</text>`;
  // 도장 칸 7개 (4 + 3), 앞 4개에 별 도장. 빈 칸은 조금씩 비뚤게
  const r = 14;
  const slots = [[51, 147], [87, 146], [123, 147.5], [159, 146], [69, 183], [105.5, 182], [141, 183.5]];
  const rots = [-12, 8, -4, 14, 9, -15, 22];
  slots.forEach(([x, y], i) => (o += stampSlot(x, y, r, i < 4, rots[i])));
  // 빨간 핀으로 꽂은 작은 쪽지 (오른쪽 아래 구석)
  o += `<g transform="rotate(9 176 186)">`;
  o += soft(frect(167, 178, 20, 17, "#3b2a1a", 0.3, 1.5));
  o += rect(165, 176, 20, 17, K.paper, 1.5, S(1.8));
  o += ln([169, 184], [181, 184], "#d9a47e", 1.6) + ln([169, 189], [177, 189], "#d9a47e", 1.6);
  o += circ(175, 178, 3.4, C.red, S(1.4)) + fcirc(174, 177, 1, "#ffd1c9");
  o += `</g>`;
  // 지붕 + 들보
  o += beam(16, 76, 188, 16, 13);
  o += hipRoof(10, 210, 50, 80, 2, 23);
  // 풀·꽃
  for (const [x, y, s] of [[70, 286, 4.5], [148, 288, 5], [56, 280, 4], [166, 280, 4]]) o += tuft(x, y, s);
  o += flw(84, 292, 6, C.yellowFlower, "#e58a2e", 10) + flw(140, 294, 6, C.whiteFlower, "#f6c445", 30) + flw(158, 286, 5, C.pinkFlower, "#f6c445", 0);
  return finish(w, h, o);
}


// ===== 캠프파이어 (광장 가운데) =====
// 돌 고리 + 바퀴살 장작 + 숯불은 한 장(campfireSvg), 불꽃은 몇 장(flameSvg)을 번갈아 보여 줘서 일렁이게 한다.
// 불꽃은 앞쪽 돌 뒤로 들어가야 하므로 앞쪽 장작·돌만 따로 한 장(campfireFrontSvg) 더 겹친다.
type PitLog = { ax: number; ay: number; bx: number; by: number; r0: number; r1: number; i: number };
type FlameShape = { L: number[]; C: number[]; R: number[]; vL: number; vR: number; wide: number; nub: number[] | null };
const f1 = (n: number) => +n.toFixed(1);

/** 점 목록 → 부드러운 닫힌 곡선 (중점 2차 베지어) */
function smoothClosed(pts: Vec[]) {
  const n = pts.length;
  const mid = (p: Vec, q: Vec): Vec => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m = mid(pts[n - 1], pts[0]);
  let d = `M${f1(m[0])},${f1(m[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = mid(pts[i], pts[(i + 1) % n]);
    d += `Q${f1(p[0])},${f1(p[1])} ${f1(q[0])},${f1(q[1])}`;
  }
  return d + "Z";
}

/** 매끈한 덩어리(숯) path */
function coalBlobD(cx: number, cy: number, rx: number, ry: number, rand: Rand, n = 9, jit = 0.12) {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + (rand() - 0.5) * 2 * jit;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smoothClosed(pts);
}

/** 둥근 돔 돌 모양: 바닥은 납작, 위는 둥글게. (cx, by) = 바닥 가운데 */
function domeD(cx: number, by: number, w: number, h: number, rand: Rand, jit = 0.05) {
  const n = 30, pts: Vec[] = [];
  const cyc = by - h * 0.42, ph1 = rand() * 6.28, ph2 = rand() * 6.28;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const k = 1 + jit * (Math.sin(2 * t + ph1) * 0.6 + Math.sin(3 * t + ph2) * 0.4);
    let x: number, y: number;
    if (s < 0) { x = c; y = s * 0.58; } // 둥근 윗부분
    else { x = Math.sign(c) * Math.pow(Math.abs(c), 0.78); y = Math.pow(s, 0.68) * 0.42; } // 납작한 바닥
    pts.push([cx + x * (w / 2) * k, cyc + y * h * k]);
  }
  return smoothClosed(pts);
}

// ───────────────────────── 모닥불 (불꽃 없음) ─────────────────────────
// 화면 180×150 (viewBox 360×300). 불 중심 = (180, 198) = 화면 (90, 99)px. 불꽃도 같은 기준점.
const CX = 180, CY = 200, RX = 102, RY = 52;
const STONE = { base: "#c4bfcb", shade: "#9b94a6", hi: "#e3e0e9", speck: "#7b7486", warm: "#f0a060" };
const WOOD = { base: "#a8552e", lit: "#d47c42", shade: "#7a3a1f", hot: "#ffb04a" };

/** 돌 하나: 바닥 접촉 그림자 + 3톤 돔 + 하이라이트 캡. warm = 불빛을 받는 정도(0~1) */
function stone(cx: number, cy: number, w: number, h: number, seed: number, warm = 0) {
  const by = cy + h * 0.44;
  const outer = domeD(cx, by, w, h, rng(seed));
  const base = domeD(cx - w * 0.06, by - h * 0.1, w * 0.86, h * 0.84, rng(seed));
  const hi = domeD(cx - w * 0.16, by - h * 0.62, w * 0.36, h * 0.24, rng(seed + 5), 0.1);
  const r = rng(seed + 9);
  let out = `<ellipse cx="${f1(cx + 2)}" cy="${f1(by - 1)}" rx="${f1(w * 0.48)}" ry="${f1(h * 0.12)}" fill="#5b3a24" opacity=".26"/>`;
  out += `<path d="${outer}" fill="${STONE.shade}" ${S()}/>`;
  out += `<path d="${base}" fill="${STONE.base}"/>`;
  if (warm > 0) out += `<path d="${domeD(cx + w * 0.02, by - 2.5, w * 0.8, h * 0.42, rng(seed + 2))}" fill="${STONE.warm}" opacity="${f1(warm)}"/>`;
  out += `<path d="${hi}" fill="${STONE.hi}"/>`;
  out += `<ellipse cx="${f1(cx - w * 0.22)}" cy="${f1(by - h * 0.74)}" rx="${f1(w * 0.06)}" ry="${f1(h * 0.045)}" fill="#fbfaff"/>`;
  for (let i = 0; i < 3; i++) {
    out += `<circle cx="${f1(cx + (r() - 0.35) * w * 0.6)}" cy="${f1(by - h * (0.2 + r() * 0.3))}" r="${f1(0.9 + r() * 0.9)}" fill="${STONE.speck}" opacity=".45"/>`;
  }
  return out;
}

/** 타원 둘레를 같은 길이로 n 등분한 점들 */
function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n: number, start = -Math.PI / 2) {
  const N = 720, acc = [0], pts: Vec[] = [];
  for (let i = 0; i <= N; i++) pts.push([cx + Math.cos(start + (i / N) * 2 * Math.PI) * rx, cy + Math.sin(start + (i / N) * 2 * Math.PI) * ry]);
  for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[N], out: Vec[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (acc[j + 1] < target) j++;
    out.push(pts[j]);
  }
  return out;
}

/** 끝이 굵어지는 쐐기 캡슐 path: a(반지름 r0) → b(반지름 r1) */
function taperD(ax: number, ay: number, r0: number, bx: number, by: number, r1: number) {
  const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
  const sp = Math.max(-0.95, Math.min(0.95, (r1 - r0) / L)), cp = Math.sqrt(1 - sp * sp);
  const t1 = [nx * cp - ux * sp, ny * cp - uy * sp], t2 = [-nx * cp - ux * sp, -ny * cp - uy * sp];
  const A1 = [ax + t1[0] * r0, ay + t1[1] * r0], B1 = [bx + t1[0] * r1, by + t1[1] * r1];
  const B2 = [bx + t2[0] * r1, by + t2[1] * r1], A2 = [ax + t2[0] * r0, ay + t2[1] * r0];
  return `M${f1(A1[0])},${f1(A1[1])}L${f1(B1[0])},${f1(B1[1])}A${f1(r1)},${f1(r1)} 0 1 0 ${f1(B2[0])},${f1(B2[1])}L${f1(A2[0])},${f1(A2[1])}A${f1(r0)},${f1(r0)} 0 0 0 ${f1(A1[0])},${f1(A1[1])}Z`;
}

/** 짧고 굵은 장작 토막(쐐기): (ax,ay)=가운데 쪽 끝(달아오름), (bx,by)=바깥 끝(돌 밑으로 숨음) */
function pitLog(ax: number, ay: number, bx: number, by: number, r0: number, r1: number, gHot: string, seed: number) {
  const clip = uid("cf-log");
  const L = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / L, dy = (by - ay) / L;
  const d = taperD(ax, ay, r0, bx, by, r1);
  const sh = (oy: number, k: number) => taperD(ax, ay + oy * r0, r0 * k, bx, by + oy * r1, r1 * k);
  let out = `<clipPath id="${clip}"><path d="${d}"/></clipPath>`;
  out += `<path d="${d}" fill="${WOOD.base}"/>`;
  out += `<g clip-path="url(#${clip})">`;
  out += `<path d="${sh(0.78, 0.82)}" fill="${WOOD.shade}"/>`; // 아래쪽(앞면) 그늘
  out += `<path d="${sh(-0.3, 0.78)}" fill="${WOOD.lit}"/>`; // 위쪽 밝은 면
  // 나뭇결 + 밝은 결
  const r = rng(seed);
  for (let i = 0; i < 2; i++) {
    const k = (r() - 0.5) * 0.8;
    const m = (t: number) => [ax + (bx - ax) * t + -dy * (r0 + (r1 - r0) * t) * k, ay + (by - ay) * t + dx * (r0 + (r1 - r0) * t) * k];
    const p0 = m(0.25), p1 = m(0.95);
    out += `<path d="M${f1(p0[0])},${f1(p0[1])}L${f1(p1[0])},${f1(p1[1])}" stroke="${WOOD.shade}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>`;
  }
  out += `<path d="M${f1(ax + (bx - ax) * 0.35)},${f1(ay + (by - ay) * 0.35 - r0 * 0.9)}L${f1(ax + (bx - ax) * 0.85)},${f1(ay + (by - ay) * 0.85 - r1 * 0.55)}" stroke="#eda468" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>`;
  // 가운데 쪽 끝이 숯불처럼 달아오름
  out += `<circle cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(r1 * 1.7)}" fill="url(#${gHot})"/>`;
  out += `</g>`;
  out += `<path d="${d}" fill="none" ${S()}/>`;
  return out;
}

function campfireParts() {
  const gGlow = uid("cf-glow"), gPit = uid("cf-pit"), gHot = uid("cf-hot"), gEmber = uid("cf-ember");
  const defs =
    `<radialGradient id="${gGlow}"><stop offset="0" stop-color="#ffd98a" stop-opacity=".6"/><stop offset=".55" stop-color="#ffe09a" stop-opacity=".55"/><stop offset=".72" stop-color="#ffeab4" stop-opacity=".4"/><stop offset=".88" stop-color="#ffeab4" stop-opacity=".14"/><stop offset="1" stop-color="#ffeab4" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${gPit}" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#c0643a"/><stop offset=".7" stop-color="#a65434"/><stop offset="1" stop-color="#8a4428"/></radialGradient>` +
    `<radialGradient id="${gHot}"><stop offset="0" stop-color="#ffe08a" stop-opacity=".95"/><stop offset=".35" stop-color="${WOOD.hot}" stop-opacity=".8"/><stop offset="1" stop-color="#f07a30" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${gEmber}"><stop offset="0" stop-color="#fff2b8" stop-opacity=".9"/><stop offset=".35" stop-color="#ffc24a" stop-opacity=".6"/><stop offset="1" stop-color="#f08a3a" stop-opacity="0"/></radialGradient>`;

  let under = "", front = "";
  // 바닥을 비추는 따뜻한 빛 (회색 원판 없음) + 돌 고리 밑 아주 옅은 따뜻한 그림자
  under += `<ellipse cx="${CX}" cy="${CY + 8}" rx="180" ry="112" fill="url(#${gGlow})"/>`;
  under += `<ellipse cx="${CX}" cy="${CY + 10}" rx="${RX + 16}" ry="${RY + 16}" fill="#8a5a3a" opacity=".12"/>`;

  // 불자리 바닥 (주황빛 흙)
  under += `<ellipse cx="${CX}" cy="${CY + 2}" rx="${RX - 14}" ry="${RY - 6}" fill="url(#${gPit})" ${S()}/>`;
  const ra = rng(42);
  for (let i = 0; i < 6; i++) {
    const a = ra() * Math.PI * 2, d = 0.45 + ra() * 0.4;
    under += `<ellipse cx="${f1(CX + Math.cos(a) * 70 * d)}" cy="${f1(CY + 2 + Math.sin(a) * 38 * d)}" rx="${f1(4 + ra() * 4)}" ry="${f1(2 + ra() * 1.5)}" fill="#7a3a22" opacity=".25"/>`;
  }

  // 장작: 가운데에서 바퀴살처럼 뻗은 짧고 굵은 쐐기 토막 8개 (바깥 끝은 돌 밑으로)
  const logs = [90, 136, 181, 227, 270, 314, 359, 44].map((deg, i) => {
    const a = (deg * Math.PI) / 180, r0 = 7, r1 = 66 + (i % 3) * 3;
    return {
      ax: CX + Math.cos(a) * r0, ay: CY + 4 + Math.sin(a) * r0 * 0.52,
      bx: CX + Math.cos(a) * r1, by: CY + 4 + Math.sin(a) * r1 * 0.52, r0: 4.5, r1: 15 - (i % 2) * 1.2, i,
    };
  });
  const isFront = (l: PitLog) => l.by > CY + 12;
  const drawLog = (l: PitLog) => pitLog(l.ax, l.ay, l.bx, l.by, l.r0, l.r1, gHot, 50 + l.i);
  under += logs.filter((l) => !isFront(l)).sort((p, q) => p.by - q.by).map(drawLog).join("");

  // 가운데 숯불 무더기
  const re = rng(7), coals: { x: number; y: number; r: number; c: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const a = re() * Math.PI * 2, d = Math.sqrt(re());
    coals.push({ x: CX + Math.cos(a) * 24 * d, y: CY + 4 + Math.sin(a) * 10 * d, r: 5 + re() * 3.5, c: re() });
  }
  coals.sort((p, q) => p.y - q.y);
  under += coals.map((c, i) => {
    const fill = c.c < 0.35 ? "#e0602e" : c.c < 0.7 ? "#f28a34" : "#f9b048";
    return `<path d="${coalBlobD(c.x, c.y, c.r, c.r * 0.72, rng(100 + i), 7, 0.18)}" fill="${darken(fill, 0.2)}" ${S(1.8)}/>` +
      `<circle cx="${f1(c.x - c.r * 0.25)}" cy="${f1(c.y - c.r * 0.25)}" r="${f1(c.r * 0.45)}" fill="${lighten(fill, 0.35)}"/>`;
  }).join("");

  // 돌 고리: 12개, 서로 겹쳐 한 덩어리 벽처럼
  const pts = ellipsePoints(CX, CY, RX, RY, 12);
  const stones = pts.map(([x, y], i) => {
    const t = (y - CY) / RY; // -1(뒤) ~ 1(앞)
    const s = 0.91 + 0.09 * t;
    const jx = (rng(300 + i)() - 0.5) * 3;
    return { x: x + jx, y, w: 58 * s, h: 47 * s, i, warm: t < 0.3 ? 0.1 + 0.12 * (0.3 - t) / 1.3 : 0 };
  });
  const drawStone = (s: { x: number; y: number; w: number; h: number; i: number; warm: number }) => stone(s.x, s.y, s.w, s.h, 11 + s.i * 13, s.warm);
  under += stones.filter((s) => s.y < CY - 2).sort((p, q) => p.y - q.y).map(drawStone).join("");

  // (불꽃은 여기 사이에 들어간다)
  front += logs.filter(isFront).sort((p, q) => p.by - q.by).map(drawLog).join("");
  // 숯불이 장작을 비추는 빛
  front += `<ellipse cx="${CX}" cy="${CY + 4}" rx="58" ry="28" fill="url(#${gEmber})"/>`;
  const rs = rng(19);
  for (let i = 0; i < 7; i++) {
    front += `<circle cx="${f1(CX + (rs() - 0.5) * 70)}" cy="${f1(CY + 4 + (rs() - 0.5) * 26)}" r="${f1(1.1 + rs() * 1.1)}" fill="#fff1a8" opacity=".9"/>`;
  }
  front += stones.filter((s) => s.y >= CY - 2).sort((p, q) => p.y - q.y).map(drawStone).join("");
  return { under, front, defs };
}

// ───────────────────────── 불꽃 3프레임 ─────────────────────────
// 같은 기준점: 불꽃 밑동 = (180, FBY). 모닥불 svg 위에 그대로 겹치면 된다.
const FBY = 214;

/**
 * 튤립 모양 불꽃 한 겹. 넓은 혀 3개 (왼쪽 낮게 · 가운데 가장 높게 · 오른쪽 중간).
 * p: { L:[u,v], C:[u,v], R:[u,v], vL, vR(골 높이), wide(가장 넓은 높이), nub }
 * u = 폭 기준(-1..1), v = 높이 기준(0..1)
 */
function tulipD(cx: number, by: number, W: number, H: number, p: FlameShape) {
  const X = (u: number) => cx + (u * W) / 2, Y = (v: number) => by - v * H;
  const Pt = (u: number, v: number) => `${f1(X(u))},${f1(Y(v))}`;
  const [lx, lh] = p.L, [ccx, ch] = p.C, [rx, rh] = p.R;
  const vrx = (ccx + rx) / 2 + 0.03, vry = p.vR;
  const vlx = (ccx + lx) / 2 - 0.02, vly = p.vL;
  const wv = p.wide ?? 0.4;
  let d = `M${Pt(0, 0)}`;
  d += `C${Pt(0.38, 0)} ${Pt(0.54, 0.03)} ${Pt(0.64, 0.1)}`; // 오므린 밑동
  d += `C${Pt(0.78, 0.2)} ${Pt(1, wv - 0.14)} ${Pt(1, wv)}`; // → 오른쪽 가장 넓은 곳 (볼록하게)
  if (p.nub) {
    const [nx, nh] = p.nub;
    d += `C${Pt(1.03, wv + 0.06)} ${Pt(nx + 0.12, nh - 0.1)} ${Pt(nx, nh)}`;
    d += `C${Pt(nx - 0.05, nh - 0.07)} ${Pt(nx - 0.08, nh - 0.09)} ${Pt(nx - 0.13, nh - 0.1)}`;
    d += `C${Pt(rx + 0.32, rh - 0.3)} ${Pt(rx + 0.26, rh - 0.2)} ${Pt(rx, rh)}`;
  } else {
    d += `C${Pt(1.0, wv + 0.12)} ${Pt(rx + 0.22, rh - 0.2)} ${Pt(rx, rh)}`; // 오른쪽 혀 바깥 날
  }
  d += `C${Pt(rx - 0.16, rh - 0.18)} ${Pt(vrx + 0.1, vry + 0.08)} ${Pt(vrx, vry)}`; // 오른쪽 혀 안쪽 날 → 골
  d += `C${Pt(vrx - 0.01, vry + 0.2)} ${Pt(ccx + 0.3, ch - 0.26)} ${Pt(ccx, ch)}`; // 가운데 혀 오른쪽
  d += `C${Pt(ccx - 0.28, ch - 0.26)} ${Pt(vlx + 0.02, vly + 0.2)} ${Pt(vlx, vly)}`; // 가운데 혀 왼쪽 → 골
  d += `C${Pt(vlx - 0.1, vly + 0.08)} ${Pt(lx + 0.16, lh - 0.18)} ${Pt(lx, lh)}`; // 왼쪽 혀 안쪽 날
  d += `C${Pt(lx - 0.2, lh - 0.17)} ${Pt(-1.0, wv + 0.1)} ${Pt(-1, wv - 0.02)}`; // 왼쪽 혀 바깥 날
  d += `C${Pt(-1, wv - 0.16)} ${Pt(-0.78, 0.2)} ${Pt(-0.64, 0.1)}`;
  d += `C${Pt(-0.54, 0.03)} ${Pt(-0.38, 0)} ${Pt(0, 0)}Z`;
  return d;
}

/** 위로 뾰족한 물방울 (불꽃 심지) */
function teardropD(cx: number, by: number, w: number, h: number, lean = 0) {
  const X = (u: number) => cx + (u * w) / 2, Y = (v: number) => by - v * h;
  const Pt = (u: number, v: number) => `${f1(X(u))},${f1(Y(v))}`;
  return `M${Pt(0, 0)}C${Pt(0.62, 0)} ${Pt(1, 0.2)} ${Pt(1, 0.36)}C${Pt(1, 0.6)} ${Pt(0.3 + lean, 0.8)} ${Pt(lean, 1)}C${Pt(-0.3 + lean, 0.8)} ${Pt(-1, 0.6)} ${Pt(-1, 0.36)}C${Pt(-1, 0.2)} ${Pt(-0.62, 0)} ${Pt(0, 0)}Z`;
}

// 프레임별 바깥 겹 (조금씩 흔들림)
const FRAMES: FlameShape[] = [
  { L: [-0.6, 0.67], C: [0.03, 1.0], R: [0.62, 0.75], vL: 0.4, vR: 0.43, wide: 0.36, nub: null },
  { L: [-0.66, 0.71], C: [-0.07, 0.95], R: [0.56, 0.69], vL: 0.43, vR: 0.4, wide: 0.35, nub: [0.92, 0.55] },
  { L: [-0.56, 0.63], C: [0.1, 1.03], R: [0.65, 0.78], vL: 0.38, vR: 0.45, wide: 0.38, nub: null },
];
const SPARKS = [
  [[128, 70, 2.4], [232, 58, 2], [204, 22, 1.8], [150, 36, 2.2], [246, 96, 1.6], [114, 104, 1.8], [178, 8, 1.6], [262, 34, 2], [100, 54, 1.5]],
  [[136, 52, 2.2], [226, 76, 2.4], [194, 12, 1.8], [118, 92, 1.6], [240, 40, 2], [158, 20, 1.5], [254, 104, 1.8], [104, 40, 2], [214, 34, 1.4]],
  [[124, 48, 2], [218, 42, 2.4], [168, 10, 2], [244, 84, 1.8], [142, 86, 1.6], [196, 28, 1.5], [108, 72, 2], [258, 56, 1.6], [232, 14, 1.4]],
];

function flameParts(frame = 0) {
  const f = ((frame % 3) + 3) % 3;
  const p = FRAMES[f];
  const W = 124, H = 158;
  const gHalo = uid("fl-halo"), gOut = uid("fl-out"), gMid = uid("fl-mid"), gIn = uid("fl-in"), gCore = uid("fl-core"), clip = uid("fl-clip"), gFade = uid("fl-fade"), mask = uid("fl-mask");
  const outer = tulipD(CX, FBY, W, H, p);
  const scale = (q: FlameShape, ku: number, kv: number, kval: number, du = 0): FlameShape => ({
    L: [q.L[0] * ku + du, q.L[1] * kv], C: [q.C[0] * ku + du, q.C[1]], R: [q.R[0] * ku + du, q.R[1] * kv],
    vL: q.vL * kval, vR: q.vR * kval, wide: q.wide, nub: null,
  });
  // 안쪽 겹은 빛 방향(왼쪽 위)으로 조금 치우친다
  const mid = tulipD(CX - 3, FBY - 2, W * 0.76, H * 0.8, scale(p, 1.02, 0.9, 1.12, -0.02));
  const inner = teardropD(CX - 5, FBY - 5, W * 0.44, H * 0.56, p.C[0] * 0.6 - 0.04);
  const core = teardropD(CX - 5, FBY - 7, W * 0.2, H * 0.34, p.C[0] * 0.3);

  const defs =
    `<radialGradient id="${gHalo}"><stop offset="0" stop-color="#ffd36e" stop-opacity=".34"/><stop offset=".5" stop-color="#ffc85a" stop-opacity=".14"/><stop offset="1" stop-color="#ffc85a" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${gOut}" gradientUnits="userSpaceOnUse" x1="0" y1="${FBY - H}" x2="0" y2="${FBY}"><stop offset="0" stop-color="#f0784e"/><stop offset=".45" stop-color="#f2834f"/><stop offset="1" stop-color="#f5a05a"/></linearGradient>` +
    `<linearGradient id="${gMid}" gradientUnits="userSpaceOnUse" x1="0" y1="${FBY - H * 0.8}" x2="0" y2="${FBY}"><stop offset="0" stop-color="#f99a44"/><stop offset=".5" stop-color="#fbb04a"/><stop offset="1" stop-color="#fcc25a"/></linearGradient>` +
    `<linearGradient id="${gIn}" gradientUnits="userSpaceOnUse" x1="0" y1="${FBY - H * 0.58}" x2="0" y2="${FBY}"><stop offset="0" stop-color="#ffd468"/><stop offset=".55" stop-color="#ffe28a"/><stop offset="1" stop-color="#fff0b8"/></linearGradient>` +
    `<radialGradient id="${gCore}" cx=".5" cy=".62" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#fffbe6"/><stop offset=".8" stop-color="#fff2b0" stop-opacity=".7"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="${clip}"><path d="${outer}"/></clipPath>` +
    `<linearGradient id="${gFade}" gradientUnits="userSpaceOnUse" x1="0" y1="${FBY - 26}" x2="0" y2="${FBY + 2}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient>` +
    `<mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="300"><rect width="360" height="300" fill="url(#${gFade})"/></mask>`;

  let b = `<ellipse cx="${CX}" cy="${FBY - 84}" rx="128" ry="112" fill="url(#${gHalo})"/>`;
  b += `<g mask="url(#${mask})">`;
  b += `<path d="${outer}" fill="url(#${gOut})" stroke="#e0603a" stroke-width="1.2" stroke-linejoin="round"/>`;
  // 바깥 겹 안: 오른쪽 그늘 / 왼쪽 밝은 기운
  b += `<g clip-path="url(#${clip})"><ellipse cx="${CX + 66}" cy="${FBY - 50}" rx="30" ry="96" fill="#e65f40" opacity=".28"/></g>`;
  b += `<path d="${mid}" fill="url(#${gMid})"/>`;
  b += `<path d="${inner}" fill="url(#${gIn})"/>`;
  b += `<path d="${core}" fill="url(#${gCore})"/>`;
  b += `</g>`;
  // 높이 튀어 오르는 작은 불씨
  b += SPARKS[f].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${f1(r * 2.2)}" fill="#fff6d8" opacity=".12"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff6d8"/>`).join("");
  return { body: b, defs };
}

// ───────────────────────── 공개 함수 ─────────────────────────
/** 돌 고리 + 바퀴살 장작 + 숯불 (불꽃 없음). 화면 180×150, 불 중심 = (90, 99)px */
export function campfireSvg(): string {
  const c = campfireParts();
  return svg(180, 150, c.under + c.front, c.defs);
}

/** 불꽃 한 프레임 (0,1,2). 화면 180×150, 모닥불과 같은 기준점 — 그대로 겹쳐 쓴다 */
export function flameSvg(frame: number): string {
  const fl = flameParts(frame);
  return svg(180, 150, fl.body, fl.defs);
}

/** 모닥불의 앞쪽 장작·돌만 (불꽃 위에 겹쳐서 불꽃 밑동이 앞 돌 뒤로 들어가 보이게 한다). 크기·기준점은 campfireSvg와 같다 */
export function campfireFrontSvg(): string {
  const c = campfireParts();
  return svg(180, 150, c.front, c.defs);
}

/** 가로로 누운 통나무 의자. 화면 90×40 */
function logBenchSvg(): string {
  const clip = uid("bench-clip");
  const C = { base: "#a86a3c", lit: "#c98a52", hi: "#dca468", shade: "#7a4526", dark: "#5e321b", face: "#c99560", faceShade: "#b37e4c", ring: "#9c6a40" };
  const L = 34, R = 154, T = 14, B = 60, cy = (T + B) / 2, ry = (B - T) / 2, ex = 13;
  const bodyD = `M${L},${T}L${R},${T}A${ex},${ry} 0 0 1 ${R},${B}L${L},${B}Z`;
  const defs = `<clipPath id="${clip}"><path d="${bodyD}"/></clipPath>`;
  let b = `<ellipse cx="${(L + R) / 2 + 4}" cy="${B + 7}" rx="78" ry="8" fill="#3b2a1a" opacity=".16"/>`;
  // 받침 다리 두 개 (작고 진한 둥근 토막)
  for (const x of [56, 142]) {
    b += `<ellipse cx="${x}" cy="${B + 4}" rx="9" ry="7.5" fill="${C.dark}" ${S()}/><ellipse cx="${x - 2}" cy="${B + 2}" rx="4.6" ry="3.2" fill="${C.shade}"/>`;
  }
  // 몸통 3톤
  b += `<path d="${bodyD}" fill="${C.base}"/>`;
  b += `<g clip-path="url(#${clip})">`;
  b += `<path d="M${L - 4},${B - 13}C80,${B - 11} 120,${B - 14} ${R + 20},${B - 12}L${R + 20},${B + 4}L${L - 4},${B + 4}Z" fill="${C.shade}"/>`;
  b += `<path d="M${L - 4},${T - 2}L${R + 20},${T - 2}L${R + 20},${T + 14}C120,${T + 15.5} 80,${T + 12.5} ${L - 4},${T + 14.5}Z" fill="${C.lit}"/>`;
  b += `<path d="M${L + 14},${T + 5}C70,${T + 4} 110,${T + 5.5} ${R - 6},${T + 4.5}" stroke="${C.hi}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85"/>`;
  // 오른쪽 둥근 끝의 그늘
  b += `<path d="M${R - 2},${T}A${ex + 2},${ry} 0 0 1 ${R - 2},${B}L${R + 20},${B}L${R + 20},${T}Z" fill="${C.shade}" opacity=".45"/>`;
  // 굵은 홈(나뭇결) 3~4줄: 둥근 몸통을 따라 살짝 휜다
  const grooves = [[52, 27, 128, 26, 1], [66, 37, 160, 37.5, 0], [44, 47, 112, 48.5, -1], [120, 49, 150, 50, -1]];
  b += grooves.map(([x1, y1, x2, y2, c]) => `<path d="M${x1},${y1}C${f1(x1 + (x2 - x1) * 0.33)},${f1(y1 - 1.6 * c - 0.6)} ${f1(x1 + (x2 - x1) * 0.66)},${f1(y2 - 1.6 * c + 0.6)} ${x2},${y2}" fill="none" stroke="${C.shade}" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`).join("");
  // 짧은 갈라짐
  b += [[86, 21, 98, 21.6], [138, 31, 148, 31.4], [74, 42, 82, 42.4]].map(([x1, y1, x2, y2]) => `<path d="M${x1},${y1}L${x2},${y2}" stroke="${C.dark}" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`).join("");
  // 옹이 (오른쪽 1/3)
  b += `<ellipse cx="126" cy="33" rx="6" ry="3.4" fill="${C.shade}" stroke="${C.dark}" stroke-width="1.2" opacity=".95"/><ellipse cx="125.4" cy="32.4" rx="2.4" ry="1.3" fill="${C.dark}"/>`;
  b += `<path d="M118,33.5C120,30 124,29 128,29.4" stroke="${C.lit}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".8"/>`;
  b += `</g>`;
  b += `<path d="${bodyD}" fill="none" ${S()}/>`;
  // 왼쪽 자른 면: 두꺼운 껍질 테두리 + 옅은 나이테 1~2줄 + 가운데 점
  b += `<ellipse cx="${L}" cy="${cy}" rx="15" ry="${ry}" fill="${C.shade}" ${S()}/>` +
    `<ellipse cx="${L - 0.5}" cy="${cy}" rx="11.6" ry="${ry - 3.6}" fill="${C.face}"/>` +
    `<path d="M${L + 6},${cy - 15}A11.6,${ry - 3.6} 0 0 1 ${L + 2},${cy + 18.5}A10,16 0 0 0 ${L + 6},${cy - 15}Z" fill="${C.faceShade}" opacity=".8"/>` +
    `<ellipse cx="${L - 0.5}" cy="${cy}" rx="7" ry="12.5" fill="none" stroke="${C.ring}" stroke-width="1.6" opacity=".6"/>` +
    `<circle cx="${L - 0.5}" cy="${cy}" r="2.2" fill="${C.dark}"/>`;
  return svg(90, 40, b, defs);
}

/** 풀 덤불: 둥근 잎 뭉치 + 뾰족한 풀잎 (3가지 초록) */
function mossTuft(x: number, y: number, s = 1, seed = 1) {
  const r = rng(seed);
  const tones = [P.grassShade, P.grass, P.grassHi];
  let out = "";
  const blobs = [[-6, -5, 5.5], [2, -8, 6.5], [9, -4, 5], [-10, -2, 4.2], [14, -1, 3.6]];
  out += blobs.map(([dx, dy, rr]) => `<circle cx="${f1(x + dx * s)}" cy="${f1(y + dy * s)}" r="${f1(rr * s + 1.3)}" fill="${OUTLINE}"/>`).join("");
  out += blobs.map(([dx, dy, rr], i) => `<circle cx="${f1(x + dx * s)}" cy="${f1(y + dy * s)}" r="${f1(rr * s)}" fill="${i % 2 ? P.leaf : P.leafShade}"/>`).join("");
  out += blobs.map(([dx, dy, rr]) => `<circle cx="${f1(x + (dx - rr * 0.3) * s)}" cy="${f1(y + (dy - rr * 0.35) * s)}" r="${f1(rr * 0.42 * s)}" fill="${P.leafHi}"/>`).join("");
  for (let i = 0; i < 6; i++) {
    const bx = x + (i - 2.5) * 4 * s, h = (8 + r() * 6) * s, lean = (i - 2.5) * 2.2 * s + (r() - 0.5) * 2;
    out += `<path d="M${f1(bx - 2.4 * s)},${y}Q${f1(bx + lean * 0.3)},${f1(y - h * 0.6)} ${f1(bx + lean)},${f1(y - h)}Q${f1(bx + lean * 0.4 + 1.2)},${f1(y - h * 0.5)} ${f1(bx + 2.4 * s)},${y}Z" fill="${tones[(i + seed) % 3]}" stroke="${OUTLINE}" stroke-width="1.1" stroke-linejoin="round"/>`;
  }
  out += `<circle cx="${f1(x - 3 * s)}" cy="${f1(y - 9 * s)}" r="1" fill="${lighten(P.leafHi2, 0.4)}"/><circle cx="${f1(x + 5 * s)}" cy="${f1(y - 11 * s)}" r=".9" fill="${lighten(P.leafHi2, 0.4)}"/>`;
  return out;
}

/** 각진 나무 기둥 + 관통한 굵은 가로대 + 매달린 캠핑 랜턴. 화면 40×110 */
function lanternPostSvg(): string {
  const gHalo = uid("lp-halo"), gGlass = uid("lp-glass"), gWash = uid("lp-wash");
  const W = { lit: "#ad6d3c", hi: "#c98a52", hi2: "#dba66c", shade: "#7a4426", dark: "#5c311b", top: "#cf955a" };
  const PL = 9, PR = 38, PM = PL + Math.round((PR - PL) * 0.6), PT = 22, PB = 200; // 기둥 앞 두 면
  const BT = 40, BB = 55; // 가로대 앞면 (위·아래)
  const LX = 59, LY = 96; // 랜턴 중심
  const defs =
    `<radialGradient id="${gHalo}"><stop offset="0" stop-color="#ffd36e" stop-opacity=".9"/><stop offset=".45" stop-color="#ffcf66" stop-opacity=".62"/><stop offset=".75" stop-color="#ffc85a" stop-opacity=".22"/><stop offset="1" stop-color="#ffc85a" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${gGlass}" cx=".45" cy=".5" r=".62"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#fff3b8"/><stop offset=".65" stop-color="#ffd166"/><stop offset="1" stop-color="#f19a36"/></radialGradient>` +
    `<linearGradient id="${gWash}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0a050" stop-opacity="0"/><stop offset=".45" stop-color="#f0a050" stop-opacity=".55"/><stop offset="1" stop-color="#f0a050" stop-opacity="0"/></linearGradient>`;
  let b = `<ellipse cx="${(PL + PR) / 2 + 4}" cy="${PB + 8}" rx="30" ry="7" fill="#3b2a1a" opacity=".16"/>`;
  // 기둥: 왼쪽 밝은 면(60%) + 오른쪽 그늘 면(40%)
  b += `<rect x="${PL}" y="${PT}" width="${PM - PL}" height="${PB - PT}" fill="${W.lit}"/>` +
    `<rect x="${PM}" y="${PT}" width="${PR - PM}" height="${PB - PT}" fill="${W.shade}"/>` +
    `<rect x="${PL + 2.6}" y="${PT + 4}" width="4.4" height="${PB - PT - 8}" rx="2" fill="${W.hi}"/>` +
    `<path d="M${PL + 4.8},${PT + 30}V${PT + 86}M${PL + 4.8},${PT + 104}V${PT + 140}" stroke="${W.hi2}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
  // 나뭇결 (밝은 면은 중간 톤, 그늘 면은 더 진하게)
  b += `<path d="M${PL + 11},${PT + 44}V${PT + 98}M${PL + 13.5},${PT + 110}V${PT + 168}M${PL + 9.5},${PT + 120}V${PT + 150}M${PL + 14},${PT + 50}V${PT + 82}" stroke="${W.shade}" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>` +
    `<path d="M${PM + 5},${PT + 60}V${PT + 130}M${PM + 8},${PT + 140}V${PT + 172}" stroke="${W.dark}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>` +
    `<ellipse cx="${PL + 10}" cy="${PT + 132}" rx="2.6" ry="4.6" fill="${W.shade}"/><ellipse cx="${PL + 9.6}" cy="${PT + 131.4}" rx="1" ry="2.2" fill="${W.dark}"/>`;
  // 랜턴 빛이 그늘 면을 주황으로 물들인다
  b += `<rect x="${PM}" y="${LY - 46}" width="${PR - PM}" height="92" fill="url(#${gWash})"/>`;
  b += `<path d="M${PM},${PT}V${PB}" stroke="${OUTLINE}" stroke-width="1.4" opacity=".55"/>`;
  // 꼭대기: 모서리를 깎은 머리, 윗면이 보인다 (기둥과 한 외곽선)
  b += `<path d="M${PL + 0.5},${PT + 2}L${PL + 4},${PT - 5}H${PR - 4}L${PR - 0.5},${PT + 2}Z" fill="${W.top}"/>` +
    `<path d="M${PM},${PT + 2}L${PR - 4},${PT - 5}L${PR - 0.5},${PT + 2}Z" fill="${darken(W.top, 0.12)}"/>` +
    `<path d="M${PL + 5},${PT - 2.2}H${PM - 4}" stroke="${lighten(W.top, 0.4)}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M${PL + 1},${PT + 2}H${PR - 1}" stroke="${OUTLINE}" stroke-width="1.5" opacity=".6"/>`;
  b += `<path d="M${PL},${PB}V${PT + 2}L${PL + 4},${PT - 5}H${PR - 4}L${PR},${PT + 2}V${PB}Z" fill="none" ${S()}/>`;
  // 발: 살짝 넓은 받침
  b += `<path d="M${PL - 3},${PB + 8}L${PL - 1},${PB - 6}H${PR + 1}L${PR + 3},${PB + 8}Z" fill="${W.lit}" ${S()}/>` +
    `<path d="M${PM + 1},${PB - 6}H${PR + 1}L${PR + 3},${PB + 8}H${PM + 2}Z" fill="${W.shade}"/>` +
    `<path d="M${PL},${PB - 2}H${PM - 2}" stroke="${W.hi}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M${PL - 3},${PB + 8}L${PL - 1},${PB - 6}H${PR + 1}L${PR + 3},${PB + 8}Z" fill="none" ${S()}/>`;
  // 굵은 가로대: 기둥을 관통, 왼쪽으로 조금, 오른쪽으로 길게, 끝은 둥근 손잡이
  const AL = PL - 8, AR = 70;
  b += `<path d="M${AL},${BT}L${AL + 4},${BT - 5}H${AR}V${BT}Z" fill="${W.top}" ${S(2.2)}/>` + // 가로대 윗면
    `<rect x="${AL}" y="${BT}" width="${AR - AL}" height="${BB - BT}" rx="2" fill="${W.lit}" ${S()}/>` +
    `<rect x="${AL + 2}" y="${BT + 2}" width="${AR - AL - 6}" height="3.6" rx="1.6" fill="${W.hi}"/>` +
    `<rect x="${AL + 2}" y="${BB - 5}" width="${AR - AL - 6}" height="3.6" fill="${W.shade}"/>` +
    `<path d="M${AL + 3},${BB - 3}H${AR - 4}" stroke="#f0a050" stroke-width="2" opacity=".35"/>` +
    `<path d="M${PR + 4},${BT + 8}H${AR - 10}M${AL + 3},${BT + 9}H${PL + 6}" stroke="${W.shade}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>` +
    `<rect x="${AL}" y="${BT}" width="${AR - AL}" height="${BB - BT}" rx="2" fill="none" ${S()}/>`;
  b += `<circle cx="${AR}" cy="${(BT + BB) / 2 - 1}" r="9" fill="${W.lit}" ${S()}/>` +
    `<path d="M${AR + 2},${(BT + BB) / 2 + 6.6}A8,8 0 0 0 ${AR + 7.6},${(BT + BB) / 2 - 3}A9,9 0 0 1 ${AR + 2},${(BT + BB) / 2 + 6.6}Z" fill="${W.shade}"/>` +
    `<circle cx="${AR - 2.6}" cy="${(BT + BB) / 2 - 4.4}" r="3.2" fill="${W.hi}"/>`;

  // 랜턴 빛무리 (강하게)
  b += `<ellipse cx="${LX - 6}" cy="${LY}" rx="30" ry="42" fill="url(#${gHalo})"/>`;
  // 고리
  b += `<path d="M${LX},${BB + 1}V${BB + 6}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${LX}" cy="${BB + 9}" r="3.4" fill="none" stroke="${OUTLINE}" stroke-width="2.2"/>`;
  // 둥근 돔 뚜껑
  const DT = BB + 12, DB = LY - 13; // 돔 위·아래
  b += `<path d="M${LX - 11},${DB}C${LX - 11},${DT + 1} ${LX + 11},${DT + 1} ${LX + 11},${DB}Z" fill="#6a3d24" ${S(2.2)}/>` +
    `<path d="M${LX - 7.6},${DB - 1.2}C${LX - 7.4},${DT + 4.4} ${LX - 1},${DT + 3} ${LX + 0.5},${DT + 3.4}" stroke="#9a6440" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  b += `<rect x="${LX - 14}" y="${DB - 1}" width="28" height="5" rx="2" fill="#5a3320" ${S(2.2)}/>`;
  // 빛나는 유리 몸통 (넓고 밝게), 바깥 테두리 기둥 2개만
  const GT = DB + 4, GB = LY + 15;
  b += `<rect x="${LX - 13.5}" y="${GT}" width="27" height="${GB - GT}" rx="4" fill="url(#${gGlass})" ${S(2.2)}/>` +
    `<path d="M${LX - 11.6},${GT + 1}V${GB - 1}M${LX + 11.6},${GT + 1}V${GB - 1}" stroke="#7a4628" stroke-width="2.6"/>` +
    `<path d="M${LX},${GT + 5}C${LX + 4.6},${GT + 10} ${LX + 4.2},${GT + 17} ${LX},${GT + 20}C${LX - 4.2},${GT + 17} ${LX - 4.6},${GT + 10} ${LX},${GT + 5}Z" fill="#ffffff"/>` +
    `<path d="M${LX - 7.6},${GT + 4}V${GT + 13}" stroke="#fffdf0" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>`;
  // 짧고 어두운 바닥
  b += `<rect x="${LX - 14}" y="${GB - 1}" width="28" height="6" rx="2" fill="#5a3320" ${S(2.2)}/>` +
    `<path d="M${LX - 10},${GB + 0.6}H${LX + 3}" stroke="#86522f" stroke-width="1.4" stroke-linecap="round"/>`;
  // 발밑 이끼 풀 (1.5배, 발을 감싼다) + 작은 꽃
  b += mossTuft(PL + 6, PB + 11, 0.95, 1) + mossTuft(PR + 5, PB + 12, 1.25, 2) + mossTuft(PM - 2, PB + 14, 0.8, 3);
  b += flower(PR + 16, PB + 2, 4.4, P.whiteFlower) + flower(PL - 3, PB + 4, 3.6, P.yellowFlower, "#f0a63a");
  return svg(40, 110, b, defs);
}


// ===== 불가의 통나무 의자, 랜턴 기둥 =====
/** 불가에 놓는 통나무 의자 (BENCH_SIZE) */
export function benchSvg(): string {
  return logBenchSvg();
}
/** 랜턴 기둥: 각진 나무 기둥 + 가로대에 매단 캠핑 랜턴 (LAMP_SIZE, 불빛 가운데 LAMP_LIGHT) */
export function lampSvg(): string {
  return lanternPostSvg();
}

// ===== 나무 =====
/** 광장 나무 (TREE_SIZE). bush 는 꽃 덤불을 같은 틀 아래 가운데에 놓는다 */
export function treeSvg(kind: "round" | "pine" | "bush" | "blossom"): string {
  return kind === "bush" ? bushInFrameSvg(TREE_SIZE.width, TREE_SIZE.height) : natureTreeSvg(kind);
}

// ===== 농장 화면(farm.ts)이 같은 그림체로 그릴 때 쓰는 조각 =====
/** 농장 화면 조각 그리기. begin(W, H, seed, ids) 의 ids 로 그림 안 id 를 고정 문자열로 만들 수 있다 (서버에서도 그리는 그림) */
export const farmPaint = {
  begin, finish, post, rail, barn, hay, leaves, flw, tuft, soft, fell, ell, ln, pl, lg, face, K, C,
  /** 지금 그리는 그림의 defs (반복 타일처럼 svg 크기를 직접 정해 감쌀 때) */
  defs: () => DEFS.join(""),
};

export function toDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
