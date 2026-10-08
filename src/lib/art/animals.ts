// 동물 농장 동물 그림 (SVG). 2026-10-08 디자인 시안(돼지·병아리·소·양·토끼 + 달걀)을 코드로 그린다.
// viewBox 128×128 (화면 크기의 2배 기준 선 굵기), 발바닥이 y≈116 근처. 단계(아기·청소년·어른)에 따라 크기가 커진다.
// 모두 오른쪽을 본다 (농장·광장에서 걸을 때 좌우로 뒤집는다).
// 그리는 법: 시안 좌표를 그대로 쓰고, 시안에서 왼쪽을 보는 동물은 마지막에 좌우 반전한다.
// 반전되는 동물은 빛 방향(lx)이 그림 좌표에서 +x 쪽이 되도록 하이라이트를 둔다 → 화면에서는 늘 왼쪽 위 빛.
// 펫 꾸미기(리본·꽃·스카프)는 몸과 함께 커지도록 같은 묶음 안에, 반전이 끝난 화면 좌표로 그린다.
import type { AnimalStage, PetAccessory } from "@/lib/farm";
import { OUTLINE, darken, groundShadow, rng } from "@/lib/art/style";

const OW = 2.4; // 실루엣 외곽선 (화면에서 약 1.2px)
const EYE = "#3a2417";
const n2 = (v: number) => +v.toFixed(2);

// ---------- 공통 도구 ----------
type Ell = [cx: number, cy: number, rx: number, ry: number, rot?: number];
type Tone = { base: string; shade: string; hi: string; line?: string; hoof?: string; hoofH?: number };
type Light = { box: [number, number, number, number]; b: Ell; h?: Ell | Ell[] };
type Ctx = { lx: number; blur: string; defs: string[]; id: (prefix: string) => string };

/**
 * 그림 하나의 준비물. id는 그림 안에서만 겹치지 않으면 된다 (그림은 data URI <img>·Phaser 텍스처라 문서가 따로다).
 * 전역 카운터(uid) 대신 그림마다 0부터 세어, 서버와 브라우저가 같은 문자열을 만든다 (하이드레이션 불일치 방지).
 * 접두사에 종류·단계·꾸미기를 넣어 서로 다른 그림끼리도 id가 겹치지 않는다.
 */
function makeCtx(lx: number, tag: string): Ctx {
  let n = 0;
  const id = (prefix: string) => `${prefix}-${tag}-${(n++).toString(36)}`;
  const blur = id("an-soft");
  return { lx, blur, id, defs: [`<filter id="${blur}" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="1.6"/></filter>`] };
}

// 도형 틀: % 자리에 속성이 들어간다
const P = (d: string) => `<path d="${d}" %/>`;
const E = (cx: number, cy: number, rx: number, ry: number, rot = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""} %/>`;
const C = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}" %/>`;
const paintShape = (shape: string, color: string, extra = "") => shape.replace("%", `fill="${color}" ${extra}`);

function clipGroup(ctx: Ctx, shapes: string[], inner: string): string {
  const id = ctx.id("an-clip");
  ctx.defs.push(`<clipPath id="${id}">${shapes.map((s) => s.replace("%", "")).join("")}</clipPath>`);
  return `<g clip-path="url(#${id})">${inner}</g>`;
}

/** 합쳐진 실루엣: 바깥쪽에만 외곽선이 남도록 (두꺼운 선 → 채움 순서) + 안쪽 칠은 클립 */
function blob(ctx: Ctx, shapes: string[], base: string, paint = "", ow = OW): string {
  const line = shapes
    .map((s) => s.replace("%", `fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="${ow * 2}" stroke-linejoin="round"`))
    .join("");
  const body = shapes.map((s) => paintShape(s, base)).join("");
  return `<g>${line}${body}${paint ? clipGroup(ctx, shapes, paint) : ""}</g>`;
}

/** 3톤 칠: 클립 안 전체 = 그림자색, 빛 쪽으로 밀린 타원 = 기본색, 더 작은 타원 = 하이라이트 (가장자리는 살짝 번지게) */
function tones(ctx: Ctx, { box, b, h }: Light, c: Tone): string {
  const [x0, y0, x1, y1] = box;
  const ell = ([cx, cy, rx, ry, rot = 0]: Ell, fill: string) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""} fill="${fill}"/>`;
  const hs: Ell[] = !h ? [] : Array.isArray(h[0]) ? (h as Ell[]) : [h as Ell];
  return `<g filter="url(#${ctx.blur})"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${c.shade}"/>${ell(b, c.base)}${hs
    .map((x) => ell(x, c.hi))
    .join("")}</g>`;
}

const stroke = (d: string, color: string, w = 1.5, op = 1) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op < 1 ? ` opacity="${op}"` : ""}/>`;
const spot = (cx: number, cy: number, rx: number, ry: number, rot = 0, op = 0.8, color = "#ffffff") =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""} fill="${color}" opacity="${op}"/>`;

/** 점눈 + 빛 쪽 하이라이트 */
function eye(ctx: Ctx, x: number, y: number, rx = 2.6, ry = 3.5): string {
  rx *= 1.12;
  ry *= 1.12;
  return (
    `<ellipse cx="${x}" cy="${y}" rx="${n2(rx)}" ry="${n2(ry)}" fill="${EYE}"/>` +
    `<circle cx="${n2(x + ctx.lx * rx * 0.34)}" cy="${n2(y - ry * 0.4)}" r="${n2(rx * 0.36)}" fill="#ffffff"/>` +
    `<circle cx="${n2(x - ctx.lx * rx * 0.3)}" cy="${n2(y + ry * 0.45)}" r="${n2(rx * 0.2)}" fill="#ffffff" opacity=".55"/>`
  );
}
const cheek = (x: number, y: number, rx = 5, ry = 3.4, color = "#f3848c", op = 0.5) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${op}"/>`;

/** 짧고 통통한 다리 (+발굽). far = 몸 뒤쪽 다리(한 톤 어둡게) */
function leg(ctx: Ctx, x: number, w: number, top: number, bot: number, c: Tone, far = false): string {
  const r = Math.min(4.5, w / 2.2);
  const d = `M ${x} ${top} L ${x} ${bot - r} Q ${x} ${bot} ${x + r} ${bot} L ${x + w - r} ${bot} Q ${x + w} ${bot} ${x + w} ${bot - r} L ${x + w} ${top} Z`;
  const base = far ? c.shade : c.base;
  const shade = far ? darken(c.shade, 0.1) : c.shade;
  const hi = far ? c.base : c.hi;
  const darkX = ctx.lx > 0 ? x - 2 : x + w * 0.66;
  const litX = ctx.lx > 0 ? x + w * 0.56 : x + w * 0.18;
  let paint = `<g filter="url(#${ctx.blur})"><rect x="${n2(darkX)}" y="${top}" width="${n2(w * 0.36 + 2)}" height="${bot - top + 3}" fill="${shade}"/><rect x="${n2(litX)}" y="${top}" width="${n2(w * 0.24)}" height="${bot - top}" fill="${hi}" opacity=".85"/></g>`;
  if (c.hoof) {
    const hh = c.hoofH ?? 5.5;
    const hoof = far ? darken(c.hoof, 0.12) : c.hoof;
    const curve = `M ${x - 1} ${bot - hh} Q ${x + w / 2} ${bot - hh - 1.8} ${x + w + 1} ${bot - hh}`;
    paint += `<path d="${curve} L ${x + w + 1} ${bot + 2} L ${x - 1} ${bot + 2} Z" fill="${hoof}"/>` + stroke(curve, OUTLINE, 1.1, 0.35);
  } else {
    // 털 끝 결
    paint += stroke(`M ${n2(x + w * 0.3)} ${top + 4} l 0 3 M ${n2(x + w * 0.62)} ${top + 6} l 0 3`, darken(base, 0.18), 1.1, 0.5);
  }
  return blob(ctx, [P(d)], base, paint);
}

function wrapFlip(inner: string, flip: boolean, ox: number, oy: number, sc = 1): string {
  const t = `translate(${ox} ${oy})${sc !== 1 ? ` scale(${sc})` : ""}`;
  return flip ? `<g transform="translate(128 0) scale(-1 1)"><g transform="${t}">${inner}</g></g>` : `<g transform="${t}">${inner}</g>`;
}

// ---------- 돼지 ----------
function drawPig(ctx: Ctx): string {
  const c: Tone = { base: "#f8c0b6", shade: "#eca198", hi: "#fde0d8", line: "#d98880", hoof: "#a46a5c", hoofH: 6.2 };
  const line = "#d98880";
  let o = groundShadow(57, 92.5, 53, 7);
  // 꼬불 꼬리 (몸 뒤)
  const tail = "M 101 35 C 104 27 111 27 111 20.5 C 111 14.5 104 14.5 104 19 C 104 23 109 23 109 19.5";
  o += stroke(tail, OUTLINE, 4.8) + stroke(tail, c.base, 2.4) + stroke("M 108.6 17.6 C 109.6 19 109.6 21 108.8 22", c.hi, 0.9, 0.9);
  // 다리 (짧고 통통, 발굽은 진한 갈색)
  o += leg(ctx, 87, 12, 66, 88.5, c, true);
  o += leg(ctx, 22, 16, 68, 92, c);
  o += leg(ctx, 78, 16, 70, 93, c);
  o += leg(ctx, 46.5, 17, 70, 96.5, c);
  // 몸통+머리 한 덩어리
  const body = P("M 30 16 C 45 10 72 10 87 15.5 C 102 21 110.5 36 110.5 52 C 110.5 68 103 77 90 80.5 C 74 83.5 48 83.5 34 79 C 20 75 8 67 6 55 C 5 41 12 26 30 16 Z");
  o += blob(
    ctx,
    [body],
    c.base,
    tones(ctx, { box: [0, 6, 116, 92], b: [63, 41, 50, 34], h: [[82, 27, 20, 9, 18], [35, 25, 10, 6, -20]] }, c) +
      // 살결: 배 주름, 다리 위 주름, 반짝 점
      stroke("M 61 73.5 Q 68 77 76 74.5", line, 1.3, 0.7) +
      stroke("M 26 74 Q 31 76.5 37 75.5", line, 1.2, 0.5) +
      stroke("M 97 66 Q 100 70 99 74", line, 1.2, 0.5) +
      spot(37, 23, 2.6, 1.5, -20, 0.6) +
      spot(95, 35, 2.2, 1.3, 35, 0.7),
  );
  // 귀 (앞쪽: 앞으로 젖혀진 귀, 뒤쪽: 앞으로 접힌 귀)
  const ear1 = P("M 33 19 C 28 11 19 8 12 12 C 7 15 6 22 9 27 C 14 30 23 28 30 25 Z");
  o += blob(
    ctx,
    [ear1],
    c.base,
    tones(ctx, { box: [4, 6, 36, 32], b: [24, 15, 13, 8], h: [26, 13, 6, 3, -15] }, c) +
      `<path d="M 31 21 C 27 16 22 14 18.5 16.5 C 18.5 21.5 21 25.5 26 26.5 Z" fill="${c.shade}" opacity=".75"/>` +
      stroke("M 21.5 14.5 Q 19 21 22.5 27", line, 1.2, 0.9),
  );
  const ear2 = P("M 57 19 C 61 13 75 13 84 21 C 87 29 80 37 70 40 C 63 41 59 36 59 30 Z");
  o += blob(
    ctx,
    [ear2],
    c.base,
    tones(ctx, { box: [54, 10, 90, 44], b: [74, 24, 14, 11], h: [77, 19, 6, 3, 20] }, c) + stroke("M 63.5 20.5 Q 61 28 65 35.5", line, 1.2, 0.9),
  );
  o += stroke("M 80.5 38 Q 82.5 43 79.5 49", line, 1.3, 0.8);
  // 코
  o +=
    `<ellipse cx="31" cy="61" rx="12.5" ry="9" fill="#f5a59d" stroke="#cf7870" stroke-width="1.9"/>` +
    spot(29, 64.5, 9.5, 3.6, 0, 0.4, "#e48880") +
    spot(34.5, 57.6, 6, 2.4, 0, 0.9, "#fcc9c2") +
    `<ellipse cx="26.6" cy="61" rx="1.9" ry="2.7" fill="#b45d58"/><ellipse cx="35.6" cy="61.6" rx="1.9" ry="2.7" fill="#b45d58"/>`;
  // 얼굴
  o += cheek(13, 56.5, 4.5, 3.2) + cheek(59.5, 62.5, 6, 4);
  o += eye(ctx, 20, 48) + eye(ctx, 52, 54);
  return wrapFlip(o, true, 7, 21);
}

// ---------- 병아리 (시안과 같은 방향: 반전 없음) ----------
function drawChick(ctx: Ctx): string {
  const c: Tone = { base: "#fbe07a", shade: "#f1c35a", hi: "#fef2b2", line: "#e0a948" };
  const line = "#e0a948";
  const orange = { base: "#f39a48", shade: "#dc7a32", hi: "#f8bb72" };
  let o = groundShadow(43, 86.5, 35, 6);
  // 발 (몸 뒤)
  const feet = [
    "M 35 77 L 35 84.5 M 35 84.5 L 29.4 87 M 35 84.5 L 35.8 88.8 M 35 84.5 L 41 87",
    "M 52.5 76 L 52.5 82.5 M 52.5 82.5 L 47.2 85 M 52.5 82.5 L 53.2 86.8 M 52.5 82.5 L 58 85",
  ];
  for (const d of feet) o += stroke(d, OUTLINE, 4.8) + stroke(d, orange.base, 2.4);
  // 오른쪽 작은 날개 (몸 뒤)
  o += blob(ctx, [E(71, 53, 6, 8.5, -15)], c.base, tones(ctx, { box: [62, 42, 80, 64], b: [69, 51, 5, 7], h: [68, 48, 2, 3] }, c));
  // 몸 + 머리 깃 + 앞 날개를 한 실루엣으로 (깃과 날개 안쪽 경계는 가는 선으로만)
  const body = P("M 44 19.5 C 60 19.5 72.5 34 72.5 52 C 72.5 68 60.5 80 44 80 C 27.5 80 15.5 68 15.5 52 C 15.5 34 28 19.5 44 19.5 Z");
  const tuft = [E(34.5, 17, 4.6, 6.4, -40), E(49.5, 15.5, 4.4, 6.4, 36), E(41.5, 13.2, 5, 7.6, -3)];
  const wing = P("M 22 44 C 16 43.5 10 45 7 48.5 C 4 51.5 4.5 55 7.5 56 C 5 58.5 5.8 62 9 62.5 C 8 65.5 10.5 68.5 14.5 68 C 18 70.5 25 70 30 66 L 30 50 Z");
  o += blob(
    ctx,
    [body, wing, ...tuft],
    c.base,
    tones(ctx, { box: [0, 0, 80, 86], b: [40, 44, 28, 32], h: [[32, 31, 11, 7, -32], [58, 27, 5, 2.6, 30], [40, 9, 2.2, 3.4, -3]] }, c) +
      // 깃털 결
      stroke("M 54 70 q 3 2.5 6 1", line, 1.3, 0.7) +
      stroke("M 44 74.5 q 3 2 6 0.6", line, 1.3, 0.6) +
      stroke("M 64 62 q 2.2 2.2 4.6 1.4", line, 1.2, 0.6) +
      stroke("M 38.4 20.5 Q 37.2 16.5 38.2 12.6 M 45.2 20.5 Q 46.2 16.5 45.6 12.4", line, 1.3, 0.9) +
      spot(32.5, 14.5, 1.3, 2.2, -40, 0.7, c.hi) +
      spot(49.8, 12.8, 1.2, 2.2, 36, 0.7, c.hi) +
      // 날개: 따로 빛을 받는 덩어리 + 깃 끝 사이 선 + 몸 안쪽 아랫선
      clipGroup(ctx, [wing], tones(ctx, { box: [0, 40, 36, 74], b: [18, 51, 14, 9.5], h: [14, 48, 7, 2.6, -8] }, c)) +
      stroke("M 7.5 56 Q 12 55.6 17.5 54.2 M 9 62.5 Q 14 62.6 20 61", line, 1.4, 0.95) +
      stroke("M 19.5 69.7 Q 27 69.4 30.6 62.6", OUTLINE, 2, 0.95) +
      spot(30, 29, 2.6, 1.5, -35, 0.8) +
      spot(25.8, 34.5, 1, 1, 0, 0.75),
  );
  // 부리
  o +=
    `<ellipse cx="53" cy="47" rx="4.8" ry="3" transform="rotate(8 53 47)" fill="${orange.base}" stroke="#b5602c" stroke-width="1.5"/>` +
    spot(51.6, 45.9, 2.2, 0.9, 8, 0.75, orange.hi);
  o += cheek(33.5, 52, 5, 3.3, "#f49a7e", 0.55) + cheek(67, 48, 3.8, 3, "#f49a7e", 0.55);
  o += eye(ctx, 40, 43, 2.4, 3.4) + eye(ctx, 61, 41, 2.4, 3.4);
  const sc = 1.12;
  return wrapFlip(o, false, n2(64 - 42.5 * sc), n2(117.5 - 89 * sc), sc);
}

// ---------- 소 ----------
function drawCow(ctx: Ctx): string {
  const c: Tone = { base: "#fdf6ea", shade: "#eadac2", hi: "#ffffff", line: "#d9c3a5", hoof: "#6f4a3a", hoofH: 6.5 };
  const patch: Tone = { base: "#8f6654", shade: "#75503f", hi: "#a9806b" };
  const horn: Tone = { base: "#efc46e", shade: "#d49e4b", hi: "#f9de9f" };
  const muzzle: Tone = { base: "#f6b3a6", shade: "#ea998e", hi: "#fccfc5" };
  let o = groundShadow(64, 93.5, 57, 7.5);
  // 꼬리 + 꼬리털
  o += stroke("M 107 47 C 111.5 43 113 38.5 114 33.5", OUTLINE, 2.4);
  o += blob(
    ctx,
    [C(116, 29, 4.6), C(112.8, 33.2, 3.8), C(119.2, 34, 3.6), C(116.2, 24.4, 3.3)],
    patch.base,
    tones(ctx, { box: [106, 18, 126, 40], b: [117, 28, 5, 6], h: [118, 25, 2, 1.6] }, patch) +
      stroke("M 114.5 27 q 1.5 1.5 1 3.5 M 117.5 31 q 1.2 1.4 0.6 3", darken(patch.shade, 0.15), 1, 0.6),
  );
  // 다리
  o += leg(ctx, 105, 10, 66, 88, c, true);
  o += leg(ctx, 29, 15, 64, 92, c);
  o += leg(ctx, 91, 15, 66, 92, c);
  o += leg(ctx, 53, 16, 68, 97, c);
  // 뒤쪽 귀와 뿔 (머리 뒤)
  o += blob(
    ctx,
    [E(19, 19, 15, 8.5, -12)],
    patch.base,
    tones(ctx, { box: [2, 8, 36, 30], b: [21, 17, 14, 7, -12], h: [24, 14, 6, 2.4, -12] }, patch) +
      `<ellipse cx="16.5" cy="20.5" rx="8" ry="4" transform="rotate(-12 16.5 20.5)" fill="#f2a5a4"/>` +
      spot(18, 19.2, 3.6, 1.4, -12, 0.7, "#fbc8c6"),
  );
  const hornL = P("M 38 15 C 38 10 39.5 5.5 43 3.8 C 45.5 2.8 47.5 4.5 47.8 7.5 C 48.2 10 48 12.5 47.5 15 Z");
  const hornR = P("M 71 18.5 C 71.5 13.5 73.5 8.5 77 7 C 79.5 6 81.5 7.5 81.6 10.5 C 81.8 13.5 81 16.5 80 20 Z");
  o += blob(ctx, [hornL], horn.base, tones(ctx, { box: [34, -2, 52, 18], b: [44.2, 9, 3.4, 7, 12], h: [45.2, 7, 1.2, 3.4, 12] }, horn));
  o += blob(ctx, [hornR], horn.base, tones(ctx, { box: [67, 2, 86, 24], b: [77.6, 13, 3.4, 7, 15], h: [78.6, 11, 1.2, 3.4, 15] }, horn));
  // 몸통+머리+주둥이 한 실루엣 (목 쪽은 선 없이 이어지고 턱선만 그린다)
  const bodyShape = P("M 56 30 C 74 22 104 24 114 42 C 120 54 119 70 111 78 C 100 86 70 87 52 83 C 40 80 34 72 36 62 Z");
  const headE = E(46, 42, 34, 30);
  const muzzleShape = E(30, 56.5, 20, 13.5);
  const bodyLight: Light = { box: [30, 18, 124, 96], b: [86, 48, 35, 31], h: [99, 37, 14, 8, 30] };
  const bodyPatches = [
    P("M 74 25 C 88 20 101 30 103 42 C 105 54 99 64 89 64.5 C 82 63.5 82 55 80 47 C 77 39 70 31 74 25 Z"),
    P("M 106 54 C 112 51.5 121 58 120 68 C 119 76 110 79 106 73 C 102 67 101.5 58.5 106 54 Z"),
  ];
  const headLight: Light = { box: [6, 8, 84, 76], b: [50, 38, 32, 28], h: [[61, 25, 14, 7, 20], [31, 22, 6, 3, -20]] };
  const headPatches = [
    P("M 13 23 C 19 12 33 7.5 42 11 C 40 17.5 34 22 28 25.5 C 22 29 14.5 28.5 13 23 Z"),
    P("M 57.5 14 C 66 9.5 80 11.5 86 20 C 90 30 84 42 76 44 C 68 44.5 62 36.5 60 28.5 C 58 22 56 18 57.5 14 Z"),
  ];
  o += blob(
    ctx,
    [bodyShape, headE, muzzleShape],
    c.base,
    tones(ctx, bodyLight, c) +
      clipGroup(ctx, bodyPatches, tones(ctx, bodyLight, patch)) +
      stroke("M 66 80.5 q 3 2 6 1 M 80 81 q 3 1.6 6 0.4", "#d9c3a5", 1.2, 0.7) +
      clipGroup(
        ctx,
        [headE, muzzleShape],
        tones(ctx, headLight, c) +
          clipGroup(ctx, headPatches, tones(ctx, headLight, patch)) +
          clipGroup(ctx, [muzzleShape], tones(ctx, { box: [8, 40, 52, 72], b: [32.5, 54, 19, 12], h: [37, 50, 8, 3.2] }, muzzle)) +
          paintShape(muzzleShape, "none", `stroke="#e0968b" stroke-width="1.3" opacity=".7"`),
      ) +
      stroke("M 35 70.4 A 34 30 0 0 0 71.5 61.8", OUTLINE, 2.1, 0.9),
  );
  // 앞쪽 귀 (머리 위에 겹침)
  o += blob(
    ctx,
    [P("M 70 27 C 78 21 92 22 97 29 C 99 35 92 39 84 38 C 78 37 72 33 70 27 Z")],
    patch.base,
    tones(ctx, { box: [66, 18, 102, 42], b: [86, 28, 14, 7], h: [90, 25, 6, 2.2, 8] }, patch) +
      `<path d="M 76.5 29.5 C 82 26.5 90 27.5 92.5 31 C 90.5 34.2 85 35 80.5 34 C 77.5 33.2 76.5 31.5 76.5 29.5 Z" fill="#f2a5a4"/>` +
      spot(86, 29.8, 3.6, 1.3, 5, 0.7, "#fbc8c6"),
  );
  // 얼굴
  o += `<ellipse cx="22" cy="54" rx="2" ry="2.7" fill="#b45e57"/><ellipse cx="36" cy="57" rx="2" ry="2.7" fill="#b45e57"/>`;
  o += cheek(63.5, 53.5, 5.5, 3.8);
  o += eye(ctx, 25, 37.5, 2.6, 3.6) + eye(ctx, 56, 45, 2.6, 3.6);
  return wrapFlip(o, true, 1, 19);
}

// ---------- 양 ----------
function drawSheep(ctx: Ctx): string {
  const wool: Tone = { base: "#fcf3e2", shade: "#ead8b9", hi: "#fffbf3", line: "#d8c09a" };
  const woolLine = "#d8c09a";
  const face: Tone = { base: "#f7dbc0", shade: "#eac2a0", hi: "#fdebd9" };
  const legC: Tone = { base: "#8b6a57", shade: "#6f513f", hi: "#a6866f" };
  let o = groundShadow(59, 89.5, 53, 7.5);
  o += leg(ctx, 91, 12, 70, 86, legC, true);
  o += leg(ctx, 27, 13, 72, 89, legC);
  o += leg(ctx, 85, 13, 72, 89, legC);
  o += leg(ctx, 53, 14, 72, 93, legC);
  // 털 뭉치: 큰 타원 + 둘레의 큼직한 몽글몽글
  const r = rng(5);
  const puffs = [E(60, 45, 40, 31), C(94, 72.5, 10), C(28, 74, 9.5), C(60, 79, 9)];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.2;
    puffs.push(C(n2(60 + Math.cos(a) * 38.5), n2(45 + Math.sin(a) * 30), n2(10.5 + r() * 2.5)));
  }
  // 털 결: 몽글한 덩어리 윗선 (⌒)
  const arcs = (pts: [number, number, number?][]) => pts.map(([x, y, w = 5]) => `M ${x - w} ${y + 2} Q ${x} ${y - 3} ${x + w} ${y + 2}`).join(" ");
  const curls = arcs([[34, 17], [49, 13, 6], [64, 12, 6], [79, 15, 6], [92, 23], [27, 29], [86, 33, 6], [99, 38], [97, 53, 5], [92, 67, 6], [80, 77, 6], [66, 33, 5], [78, 47, 5], [84, 59, 5]]);
  const woolLight: Light = { box: [4, -4, 116, 92], b: [66, 40, 42, 34], h: [[80, 23, 20, 9, 20], [50, 14, 12, 5]] };
  o += blob(ctx, puffs, wool.base, tones(ctx, woolLight, wool) + stroke(curls, woolLine, 1.4, 0.75) + spot(84, 18, 2.6, 1.4, 25, 0.9) + spot(66, 10.5, 2, 1.1, 0, 0.9));
  // 귀 (얼굴 뒤, 아래로 처진 귀)
  o += blob(
    ctx,
    [P("M 25 47 C 16 42 6 44 4.5 51 C 4.5 58.5 14 62 24 57.5 Z")],
    face.base,
    tones(ctx, { box: [0, 40, 28, 64], b: [16, 50, 11, 6.5], h: [18, 46.5, 5, 2] }, face) +
      `<path d="M 23.5 49.5 C 17 47.5 10 49 9.5 52.5 C 10 56 16.5 57.5 23 55 Z" fill="#f2aca4"/>`,
  );
  o += blob(
    ctx,
    [P("M 69 45 C 80 42.5 91 50 93 58 C 93 63.5 86 65 79.5 61 C 75 58 71 54 69 51 Z")],
    face.base,
    tones(ctx, { box: [64, 40, 97, 68], b: [82, 51, 12, 7.5, 35], h: [83, 47.5, 5, 2, 35] }, face) +
      `<path d="M 71.5 48 C 78.5 47 86.5 53 89 58.5 C 85 59.8 79.5 57.5 73.5 53 Z" fill="#f2aca4"/>`,
  );
  // 얼굴
  o += blob(ctx, [E(47, 56, 27.5, 17)], face.base, tones(ctx, { box: [14, 34, 80, 78], b: [50.5, 53, 26.5, 15.5], h: [57, 48, 10, 4.5] }, face));
  // 앞머리 털 (얼굴 위를 덮는 물결) — 몸 털과 같은 빛으로 칠해 경계가 안 보이게
  const cusps: [number, number][] = [[19, 49], [27.8, 43], [37.8, 40], [48, 39], [58.2, 40], [67.8, 43], [76, 49]];
  let edge = `M ${cusps[0][0]} ${cusps[0][1]}`;
  for (let i = 1; i < cusps.length; i++) edge += ` A 6 6.4 0 0 0 ${cusps[i][0]} ${cusps[i][1]}`;
  const forelock = P(`M 18 28 L ${edge.slice(2)} L 77 28 Z`);
  o += clipGroup(ctx, [forelock], tones(ctx, woolLight, wool) + stroke(arcs([[30, 36, 4.5], [46, 33, 5], [62, 35, 4.5]]), woolLine, 1.4, 0.75));
  o += stroke(edge, OUTLINE, 2.3);
  // 표정
  o += cheek(24.5, 58.5, 4.5, 3) + cheek(60, 59, 4.6, 3.1);
  o += stroke("M 38.5 57.6 L 38.5 59.5 M 36.6 61.1 Q 38.5 59 40.4 61.1", "#8a5646", 1.15);
  o += eye(ctx, 29, 51.5, 2.5, 3.4) + eye(ctx, 53, 53.5, 2.5, 3.4);
  return wrapFlip(o, true, 5, 25);
}

// ---------- 토끼 ----------
function drawRabbit(ctx: Ctx): string {
  const fur: Tone = { base: "#fdf7ef", shade: "#ecdfd2", hi: "#ffffff", line: "#d9c7b6" };
  const pink: Tone = { base: "#f5a8a9", shade: "#ec9093", hi: "#fbc8c6" };
  const line = "#d9c7b6";
  let o = groundShadow(46, 98.5, 41, 7);
  // 동그란 꼬리 (몸 뒤)
  o += blob(
    ctx,
    [C(74, 67, 6.5), C(79.2, 72, 5.5), C(77, 78, 5), C(70.5, 78, 5)],
    fur.base,
    tones(ctx, { box: [62, 58, 88, 86], b: [76, 69, 7, 7], h: [78, 65, 3, 2] }, fur) + stroke("M 74 74 q 2 -1.5 4 0", line, 1.2, 0.7),
  );
  // 긴 귀 (머리 뒤, 바깥으로 살짝 벌어짐)
  const ear = (cx: number, cy: number, rx: number, ry: number, rot: number, inner: [number, number, number, number, number]) =>
    blob(
      ctx,
      [E(cx, cy, rx, ry, rot)],
      fur.base,
      tones(ctx, { box: [cx - 14, cy - 24, cx + 14, cy + 24], b: [cx + 1.5, cy - 1, rx, ry, rot], h: [cx + 3, cy - 6, 2.4, 8, rot] }, fur) +
        clipGroup(
          ctx,
          [E(...inner)],
          tones(ctx, { box: [cx - 10, cy - 20, cx + 10, cy + 22], b: [inner[0] + 1, inner[1] - 1, inner[2], inner[3], inner[4]], h: [inner[0] + 1.6, inner[1] - 4, 1.4, 5.5, inner[4]] }, pink),
        ),
    );
  o += ear(38.5, 21, 8.6, 20.5, -11, [37.9, 22.5, 4.2, 14, -11]);
  o += ear(63, 25, 9.4, 20.5, 25, [63, 26.5, 4.6, 14, 25]);
  // 머리+몸+앞발 한 덩어리
  o += blob(
    ctx,
    [E(41, 61, 30, 23.5), E(45, 84, 22, 15), E(28, 83, 12, 13), E(59, 86, 13.5, 12.5), E(27, 95, 7, 5), E(40, 96, 7, 4.8)],
    fur.base,
    tones(ctx, { box: [6, 34, 80, 104], b: [47, 59, 29, 27], h: [[56, 47, 13, 7, 20], [64, 80, 5, 7]] }, fur) +
      // 턱 아래 그늘, 가슴 털, 앞발, 뒷다리 선
      stroke("M 22 80.5 Q 34 86 47 82.5", line, 1.5, 0.8) +
      stroke("M 31 84 l 1.6 2.6 l 1.6 -2.6 M 37 85.5 l 1.4 2.4 l 1.4 -2.4", line, 1.1, 0.8) +
      stroke("M 33.9 100 Q 34.6 97.2 33.6 94.6", OUTLINE, 1.7, 0.85) +
      stroke("M 51 99.6 Q 50.4 93.5 53.4 89", OUTLINE, 1.7, 0.85) +
      stroke("M 60 76 q 4 -1 7 1.6", line, 1.2, 0.7),
  );
  // 얼굴
  o += cheek(16.5, 67.5, 4.6, 3.1, "#f39a9e", 0.55) + cheek(54.5, 69.5, 5, 3.4, "#f39a9e", 0.55);
  o += `<path d="M 30.6 64.2 L 35.4 64.2 Q 35.6 64.6 35.2 65 L 33.4 66.8 Q 33 67.2 32.6 66.8 L 30.8 65 Q 30.4 64.6 30.6 64.2 Z" fill="#f0939a" stroke="#c9707a" stroke-width=".8"/>`;
  o += stroke("M 33 67 L 33 68.2 M 29.6 68.2 Q 31.3 70.8 33 68.2 Q 34.7 70.8 36.4 68.2", OUTLINE, 1.25);
  o += eye(ctx, 23, 59, 2.6, 3.5) + eye(ctx, 47, 64, 2.6, 3.5);
  return wrapFlip(o, true, 18, 17);
}

// ---------- 달걀 ----------
function drawEgg(ctx: Ctx): string {
  const c: Tone = { base: "#f8eedb", shade: "#e7d4b4", hi: "#fffaf0" };
  let o = groundShadow(64, 101.5, 27, 5);
  const egg = P("M 64 32 C 80 32 90.5 58 90.5 74 C 90.5 90 79 100.5 64 100.5 C 49 100.5 37.5 90 37.5 74 C 37.5 58 48 32 64 32 Z");
  const r = rng(11);
  let speck = "";
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = 66 + Math.cos(a) * d * 20;
    const y = 72 + Math.sin(a) * d * 24;
    if (x < 58 && y < 64) continue; // 하이라이트 자리 비우기
    const rr = 0.8 + r() * 1.2;
    speck += spot(n2(x), n2(y), n2(rr * 1.2), n2(rr), n2(r() * 180), n2(0.55 + r() * 0.35), r() > 0.5 ? "#c39a70" : "#a97f5a");
  }
  o += blob(
    ctx,
    [egg],
    c.base,
    tones(ctx, { box: [30, 26, 98, 106], b: [60, 64, 26, 33], h: [[53, 54, 8, 13, 22]] }, c) + speck + spot(51.5, 51, 3.4, 6.4, 24, 0.85) + spot(55.5, 42.6, 1.4, 1.4, 0, 0.8),
  );
  return o;
}

// ---------- 펫 꾸미기 (화면 좌표: 오른쪽을 보는 완성 그림 위에 그린다, 빛은 왼쪽 위) ----------
const RIBBON = { base: "#f37c9e", shade: "#d95a80", hi: "#fbb3c8" };
const SCARF = { base: "#4a9fd8", shade: "#3482bb", hi: "#8cc6ec", stripe: "#fff8ec" };
const PETAL = { base: "#fffaf0", shade: "#efe1c8" };
const PISTIL = { base: "#f6c445", hi: "#fbe08a" };

/** 리본: (x, y) = 매듭 가운데, s = 크기, rot = 기울기 */
function ribbon(x: number, y: number, s = 1, rot = 0): string {
  const loop = (dir: 1 | -1) => {
    const d = `M 0 0 C ${dir * 3} -6 ${dir * 11} -10 ${dir * 14} -6 C ${dir * 16.5} -2.5 ${dir * 15} 4.5 ${dir * 11} 6 C ${dir * 7} 7 ${dir * 3} 4 0 0 Z`;
    return (
      `<path d="${d}" fill="${RIBBON.base}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>` +
      stroke(`M ${dir * 3.5} -0.5 C ${dir * 6} -3.5 ${dir * 10} -5 ${dir * 12} -3.5`, RIBBON.shade, 1.3, 0.8) +
      spot(dir * 9.5, -5.6, 2.6, 1.2, dir * 20, dir < 0 ? 0.9 : 0.6, RIBBON.hi)
    );
  };
  const tails =
    `<path d="M -2 2 L -7.5 12 L -4 11 L -2.2 14 L 1 3 Z" fill="${RIBBON.shade}" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M 2 2 L 7 12.5 L 3.6 11.6 L 1.6 14.4 L -0.6 3 Z" fill="${RIBBON.base}" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`;
  const knot = `<ellipse cx="0" cy="0.4" rx="3.6" ry="4" fill="${RIBBON.base}" stroke="${OUTLINE}" stroke-width="2"/>` + spot(-1, -0.8, 1.3, 1.1, 0, 0.9, RIBBON.hi);
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${tails}${loop(-1)}${loop(1)}${knot}</g>`;
}

/** 꽃: (x, y) = 꽃 가운데, s = 크기 */
function petFlower(x: number, y: number, s = 1, rot = 0): string {
  let petals = "";
  let shade = "";
  for (let i = 0; i < 5; i++) {
    petals += `<ellipse cx="0" cy="-5.6" rx="4.4" ry="5.6" transform="rotate(${i * 72})" fill="${PETAL.base}" stroke="${OUTLINE}" stroke-width="1.8"/>`;
    // 꽃잎 안쪽 그늘 (오른쪽 아래가 어둡다)
    shade += `<ellipse cx="1.4" cy="-4.2" rx="2" ry="2.8" transform="rotate(${i * 72})" fill="${PETAL.shade}" opacity=".75"/>`;
  }
  const center = `<circle r="3.6" fill="${PISTIL.base}" stroke="${OUTLINE}" stroke-width="1.6"/>` + spot(-1, -1.1, 1.3, 1, 0, 0.95, PISTIL.hi);
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${petals}${shade}${center}</g>`;
}

type Pt = [x: number, y: number];
type ScarfSpec = {
  /** 목에 두른 띠의 가운데 선 (2차 곡선): 시작 p0 → 조절점 c → 끝 p2 */
  p0: Pt;
  c: Pt;
  p2: Pt;
  /** 띠 두께 */
  w?: number;
  /** 매듭 자리 (곡선 위 0~1). 꼬리는 매듭에서 아래로 늘어진다 */
  knot?: number;
  tail?: number;
};

/** 목도리: 몸 곡선을 따라 휜 띠(뜨개 줄무늬) + 매듭 + 늘어진 꼬리 두 갈래 */
function scarf({ p0, c, p2, w = 7.5, knot = 0.62, tail = 12 }: ScarfSpec): string {
  const at = (t: number): Pt => [
    n2((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p2[0]),
    n2((1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p2[1]),
  ];
  const d = `M ${p0[0]} ${p0[1]} Q ${c[0]} ${c[1]} ${p2[0]} ${p2[1]}`;
  const band = (color: string, width: number, extra = "") =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  const [kx, ky] = at(knot);
  const tailPiece = (dx: number, color: string) => {
    const x = kx + dx;
    const y = ky + 1;
    const bend = dx * 0.6;
    return (
      `<path d="M ${n2(x - 3)} ${y} C ${n2(x - 3.4 + bend)} ${n2(y + tail * 0.5)} ${n2(x - 2.6 + bend)} ${n2(y + tail * 0.8)} ${n2(x - 3.4 + bend * 1.6)} ${n2(y + tail)} L ${n2(x + 3.2 + bend * 1.6)} ${n2(y + tail + 0.6)} C ${n2(x + 2.6 + bend)} ${n2(y + tail * 0.75)} ${n2(x + 3.4 + bend)} ${n2(y + tail * 0.45)} ${n2(x + 3)} ${y} Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>` +
      stroke(`M ${n2(x - 3 + bend * 1.3)} ${n2(y + tail * 0.66)} L ${n2(x + 3 + bend * 1.3)} ${n2(y + tail * 0.66)}`, SCARF.stripe, 1.3, 0.85) +
      stroke(`M ${n2(x - 2.4 + bend * 1.6)} ${n2(y + tail + 0.3)} l -0.5 2.4 M ${n2(x + 0.2 + bend * 1.6)} ${n2(y + tail + 0.5)} l 0 2.6 M ${n2(x + 2.6 + bend * 1.6)} ${n2(y + tail + 0.6)} l 0.5 2.4`, OUTLINE, 1.4)
    );
  };
  return (
    `<g>` +
    tailPiece(-2.2, SCARF.shade) +
    tailPiece(2.6, SCARF.base) +
    band(OUTLINE, w + 4.4) +
    band(SCARF.base, w) +
    // 아래쪽 그늘, 뜨개 줄무늬, 위쪽 빛
    `<path d="M ${p0[0]} ${n2(p0[1] + w * 0.28)} Q ${c[0]} ${n2(c[1] + w * 0.28)} ${p2[0]} ${n2(p2[1] + w * 0.28)}" fill="none" stroke="${SCARF.shade}" stroke-width="${n2(w * 0.4)}" stroke-linecap="round" opacity=".8"/>` +
    `<path d="${d}" fill="none" stroke="${SCARF.stripe}" stroke-width="${n2(w * 0.62)}" stroke-dasharray="0.9 3.4" opacity=".5"/>` +
    `<path d="M ${p0[0]} ${n2(p0[1] - w * 0.22)} Q ${c[0]} ${n2(c[1] - w * 0.22)} ${p2[0]} ${n2(p2[1] - w * 0.22)}" fill="none" stroke="${SCARF.hi}" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>` +
    `<ellipse cx="${kx}" cy="${n2(ky + 0.6)}" rx="4.6" ry="${n2(w * 0.66)}" fill="${SCARF.base}" stroke="${OUTLINE}" stroke-width="2"/>` +
    spot(n2(kx - 1.3), n2(ky - 0.8), 1.6, 1.1, 0, 0.85, SCARF.hi) +
    `</g>`
  );
}

type Kind = "pig" | "chick" | "cow" | "sheep" | "rabbit";
type AccessoryArt = Record<Exclude<PetAccessory, "none">, () => string>;

// 종마다 머리 위·귀 옆·목 자리가 다르다. 좌표는 오른쪽을 보는 완성 그림(128×128) 기준
const ACCESSORY: Record<Kind, AccessoryArt> = {
  // 돼지: 두 귀 사이 정수리 / 앞쪽 귀 끝 / 코 아래 턱을 감싼 목
  pig: {
    ribbon: () => ribbon(76, 34, 0.95, 4),
    flower: () => petFlower(109, 51, 0.95, 10),
    scarf: () => scarf({ p0: [49, 84], c: [78, 106], p2: [113, 86], w: 7, knot: 0.36, tail: 11 }),
  },
  // 병아리: 머리 깃 밑동을 묶은 리본 / 깃 옆 / 부리 아래 목 (앞 날개 뒤에서 시작)
  chick: {
    ribbon: () => ribbon(66, 41, 0.85, 0),
    flower: () => petFlower(80, 42, 0.85, 12),
    scarf: () => scarf({ p0: [49, 84], c: [72, 96], p2: [95, 82], w: 7, knot: 0.62, tail: 11 }),
  },
  // 소: 두 뿔 사이 이마 / 오른쪽 뿔과 귀 사이 / 턱선 아래 목
  cow: {
    ribbon: () => ribbon(67, 32, 0.95, 2),
    flower: () => petFlower(93, 37, 0.85, 10),
    scarf: () => scarf({ p0: [54, 80], c: [72, 98], p2: [98, 90], w: 7.5, knot: 0.66, tail: 12 }),
  },
  // 양: 얼굴 위 앞머리 / 오른쪽 처진 귀 위 / 턱 아래
  sheep: {
    ribbon: () => ribbon(78, 58, 0.85, 4),
    flower: () => petFlower(113, 67, 0.85, 10),
    scarf: () => scarf({ p0: [50, 90], c: [76, 106], p2: [106, 90], w: 7.5, knot: 0.64, tail: 10 }),
  },
  // 토끼: 두 귀 사이 정수리 / 오른쪽 귀 밑동 / 턱 아래
  rabbit: {
    ribbon: () => ribbon(61, 56, 0.9, 4),
    flower: () => petFlower(84, 59, 0.8, 10),
    scarf: () => scarf({ p0: [47, 93], c: [72, 110], p2: [93, 93], w: 7, knot: 0.64, tail: 9 }),
  },
};

const DRAW: Record<Kind, (ctx: Ctx) => string> = { pig: drawPig, chick: drawChick, cow: drawCow, sheep: drawSheep, rabbit: drawRabbit };
/** 시안에서 왼쪽을 봐서 좌우 반전하는 동물 (빛 방향을 반대로 둔다) */
const FLIPPED: Record<Kind, boolean> = { pig: true, chick: false, cow: true, sheep: true, rabbit: true };
/** DB asset_key → 그림 종류 */
const KIND_BY_ASSET: Record<string, Kind> = {
  "animal.chick": "chick",
  "animal.bunny": "rabbit",
  "animal.piglet": "pig",
  "animal.calf": "cow",
  "animal.lamb": "sheep",
};
const kindOf = (assetKey: string): Kind => KIND_BY_ASSET[assetKey] ?? "chick";

const STAGE_SCALE: Record<AnimalStage, number> = { baby: 0.62, teen: 0.82, adult: 1 };
/** 단계별로 줄일 때 기준점 (발바닥 가운데) */
const FEET = { x: 64, y: 116 };

function wrap(body: string, size: number, defs: string[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}"><defs>${defs.join("")}</defs>${body}</svg>`;
}

/** 동물 SVG (오른쪽을 봄). 단계가 낮을수록 작게 (발바닥 기준으로 줄인다). accessory = 펫 꾸미기 */
export function animalSvg(assetKey: string, stage: AnimalStage, size = 64, accessory: PetAccessory = "none"): string {
  const kind = kindOf(assetKey);
  const ctx = makeCtx(FLIPPED[kind] ? 1 : -1, `${kind}${stage[0]}${accessory[0]}`);
  const extra = accessory !== "none" ? (ACCESSORY[kind][accessory]?.() ?? "") : "";
  const k = STAGE_SCALE[stage] ?? 1;
  const body = DRAW[kind](ctx) + extra;
  const inner = k === 1 ? body : `<g transform="translate(${n2(FEET.x - FEET.x * k)} ${n2(FEET.y - FEET.y * k)}) scale(${k})">${body}</g>`;
  return wrap(inner, size, ctx.defs);
}

/** 아직 부화하지 않은 알 (크림색 점박이 달걀) */
export function eggSvg(size = 64): string {
  const ctx = makeCtx(-1, "egg");
  return wrap(drawEgg(ctx), size, ctx.defs);
}

/** 아직 모으지 못한 동물의 실루엣 (카드 도감). 그림 전체를 한 색으로 덮는다 (무늬·하이라이트가 비치지 않게) */
export function silhouetteSvg(assetKey: string, size = 64): string {
  const kind = kindOf(assetKey);
  const ctx = makeCtx(FLIPPED[kind] ? 1 : -1, `${kind}sil`);
  const flat = ctx.id("an-flat");
  ctx.defs.push(
    `<filter id="${flat}" x="0" y="0" width="128" height="128" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feFlood flood-color="#b9ad9d"/><feComposite in2="SourceAlpha" operator="in"/></filter>`,
  );
  return wrap(`<g filter="url(#${flat})">${DRAW[kind](ctx)}</g>`, size, ctx.defs);
}

export function toAnimalDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
