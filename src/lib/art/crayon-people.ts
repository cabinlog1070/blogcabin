// 크레용 그림체 주민 (2등신 몸 틀, 288×288 좌표, 발바닥 y=270).
// 앞·뒤·옆(오른쪽을 본다) 모습 × 서 있기(0)·걷기(1·2). 입은 꾸미기는 모습마다 그 방향에 맞게 그린다.
// 머리카락은 한 덩어리로 그리고 얼굴을 그 위에 얹어, 앞머리 선 = 얼굴 윗선이 되게 한다.

import { E, F, L, Rc, S, SKIN, blush, dot, make, nid, pastel, shadow } from "./crayon";

export type View = "front" | "back" | "side";
export type Frame = 0 | 1 | 2;
export type Kind = "girl" | "boy" | "visitor" | "mannequin";

/** 입은 옷 (꾸미기 조각들을 합친 것) */
export type Wear = {
  top?: TopWear;
  bottom?: BottomWear;
  shoes?: ShoesWear;
  hat?: HatWear;
};
export type TopWear = { color: string; longSleeve?: boolean; deco?: (v: View) => string };
export type BottomWear = { color: string; long?: boolean; skirt?: boolean };
export type ShoesWear = { color: string; boots?: boolean; deco?: (v: View) => string };
export type HatWear = { draw: (v: View) => string };

const BEIGE = "#e8d2ae";
const HEAD = "M144 20C200 20 214 66 207 100C202 126 190 141 144 144C98 141 86 126 81 100C74 66 88 20 144 20Z";
const TORSO = "M139 146Q122 149 118 156L114 214Q114 222 128 222L160 222Q174 222 174 214L170 156Q166 149 149 146Z";
const LEGL = "M114 204L114 264Q114 270 121 270L134 270Q140 270 140 264L141 204Z";
const LEGR = "M174 204L174 264Q174 270 167 270L154 270Q148 270 148 264L147 204Z";
const ARML = "M121 163Q106 180 93 199Q90 206 97 206L104 205Q108 209 112 205L119 188Z";
/** 좌우 뒤집기 (x → 288 - x). 절대 좌표 M·L·Q·C 명령만 쓰는 모양에 쓴다 */
const mirror = (d: string) =>
  d.replace(/([MLQC])([^MLQCZ]+)/g, (_, c: string, args: string) => c + args.trim().split(/[\s,]+/).map((v, i) => (i % 2 === 0 ? String(288 - parseFloat(v)) : v)).join(" "));
const ARMR = mirror(ARML);

const SIDE_LEG = (x: number) => `M${x} 204v60q0 6 6 6h20q4 0 2-6l-8-6v-54Z`;
const SIDE_TORSO = "M132 148Q124 152 122 160L124 214Q126 222 144 222Q162 222 164 214L162 160Q160 150 150 147Z";
const SIDE_ARM = "M137 156q2 8 4 20q2 16 3 26q2 8 9 6q6-2 4-8l-3-26q-1-14-4-20q-6-6-13 2Z";

type Hair = { c: string; front: string; face: string; under?: boolean; back: string; side: string };
const HAIRS: Record<"girl" | "boy" | "visitor", Hair> = {
  girl: {
    c: "#7a4a2a",
    front: "M80 98C72 40 106 18 144 18C182 18 216 40 208 98Q222 160 212 198Q212 210 198 208Q144 200 90 208Q76 210 76 198Q66 160 80 98Z",
    face: "M80 98Q96 92 104 74Q114 84 128 84Q166 86 188 70Q194 90 208 98C204 126 190 141 144 144C98 141 84 126 80 98Z",
    under: true,
    back: "M76 104C70 36 106 14 144 14C182 14 218 36 212 104V198Q212 208 202 208H86Q76 208 76 198Z",
    side: "M144 16C188 16 212 44 208 98Q196 84 184 70Q162 90 140 86Q134 100 136 122L138 200Q138 208 130 208H92Q82 208 82 198L82 104C76 50 104 16 144 16Z",
  },
  boy: {
    c: "#3a2a22",
    front: "M80 102q-10-84 64-84q74 0 66 82q-10-10-14-26q-14 10-30 8q4-8 2-16q-14 14-44 12q-10 0-20-6q-6 18-24 30Z",
    face: HEAD,
    back: "M80 104C72 42 104 16 144 16C184 16 216 42 208 104Q200 124 186 126Q144 120 102 126Q88 124 80 104Z",
    side: "M144 16C190 16 214 46 208 96Q200 82 190 72Q182 84 166 82Q170 74 168 66Q150 84 136 82Q132 100 136 122Q126 134 110 134Q88 126 82 104C74 50 104 16 144 16Z",
  },
  visitor: {
    c: "#d9a050",
    front: "M82 92q-4-74 62-74q66 0 62 74q-24-22-62-22q-38 0-62 22Z",
    face: HEAD,
    back: "M80 102C74 42 104 16 144 16C184 16 214 42 208 102Q196 120 144 120Q92 120 80 102Z",
    side: "M144 16C188 16 212 44 208 92Q190 72 160 74Q140 76 136 92Q132 108 136 122Q124 132 110 132Q88 126 82 104C76 50 104 16 144 16Z",
  },
};
const LEAF = "M144 18q-2-14 10-18q4 10-10 18Z";

type Ctx = { kind: Kind; frame: Frame; skin: string; top: string; bot: string; shoe: string; w: Wear };

/** 팔 + 소매: 소매 색은 팔 모양 안에서만 칠하고 소매 끝선을 긋는다 */
const armS = (d: string, sy: number, top: string, skin: string) => {
  const id = nid("a");
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>${F(d, skin)}<g clip-path="url(#${id})">${F(Rc(60, 100, 180, sy - 100), top)}${L(`M60 ${sy}H240`, 3.5)}</g>${L(d, 4.5)}`;
};
/** 다리 + 바지 + 신발 (다리 모양 그대로 잘라 입힌다) */
const leg = (c: Ctx, d: string, line: string) => {
  const id = nid("l");
  const pants = c.w.bottom?.skirt ? "" : F(Rc(60, 200, 160, c.w.bottom?.long ? 70 : 22), c.bot);
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>${F(d, c.skin)}<g clip-path="url(#${id})">${pants}${F(Rc(60, 256, 160, 20), c.shoe)}</g>${L(d, 4.5)}${L(line, 3)}`;
};
/** 몸통 + 아랫단(하의 색) */
const torso = (c: Ctx, d: string) => {
  const id = nid("t");
  const band = c.w.bottom?.skirt ? c.w.bottom.color : c.bot;
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>${F(d, c.top)}<g clip-path="url(#${id})">${F(Rc(60, 198, 160, 30), band)}</g>${L(d, 5)}`;
};
const sleeveY = (c: Ctx, side: boolean) => (c.w.top?.longSleeve ? (side ? 198 : 196) : side ? 180 : 189);

// ── 앞·뒤 몸 (좌우 대칭) ──
function bodyFB(c: Ctx, v: View): string {
  const f = c.frame, bob = f ? -3 : 0;
  const liftL = f === 1 ? -7 : 0, liftR = f === 2 ? -7 : 0, swing = f === 1 ? 6 : f === 2 ? -6 : 0;
  let s = "";
  s += `<g transform="translate(0 ${liftL})">${leg(c, LEGL, "M114 256h26")}${bootF(c, 112)}</g>`;
  s += `<g transform="translate(0 ${liftR})">${leg(c, LEGR, "M148 256h26")}${bootF(c, 146)}</g>`;
  s += `<g transform="translate(0 ${bob})">`;
  const sy = sleeveY(c, false);
  s += `<g transform="rotate(${swing} 119 162)">${armS(ARML, sy, c.top, c.skin)}</g>`;
  s += `<g transform="rotate(${-swing} 169 162)">${armS(ARMR, sy, c.top, c.skin)}</g>`;
  s += torso(c, TORSO);
  if (c.w.bottom?.skirt) s += S("M115 200h58l10 34q-39 10 -78 0Z", c.w.bottom.color, 4.5) + L("M132 204l-6 28M156 204l6 28", 2.5);
  s += c.w.top?.deco?.(v) ?? "";
  s += "</g>";
  return s + (c.w.shoes?.deco?.(v) ?? "");
}
const bootF = (c: Ctx, x: number) => (c.w.shoes?.boots ? S(Rc(x, 238, 30, 34, 5), c.shoe, 4) : "");

function headFront(c: Ctx): string {
  if (c.kind === "mannequin") return S(HEAD, c.skin, 5.5);
  const H = HAIRS[c.kind];
  let s = S(E(85, 112, 10, 15), c.skin, 4.5) + S(E(203, 112, 10, 15), c.skin, 4.5) + S(H.face, c.skin, 5.5);
  s += dot(122, 100, 6) + dot(166, 100, 6) + blush(110, 116) + blush(178, 116) + L("M137 117q7 7 14 0", 3.5);
  if (!H.under) s += S(H.front, H.c, 5);
  if (c.kind === "visitor") s += S(LEAF, "#6fb34f", 3.5);
  return s;
}
function headBack(c: Ctx): string {
  if (c.kind === "mannequin") return S(HEAD, c.skin, 5.5);
  const H = HAIRS[c.kind];
  let s = S(E(85, 112, 10, 15), c.skin, 4.5) + S(E(203, 112, 10, 15), c.skin, 4.5);
  if (c.kind !== "girl") s += S(HEAD, c.skin, 5.5);
  s += S(H.back, H.c, 5);
  if (c.kind === "visitor") s += S(LEAF, "#6fb34f", 3.5);
  return s;
}

function front(c: Ctx, v: View): string {
  const bob = c.frame ? -3 : 0;
  let o = shadow(144, 270, 40, 6);
  const under = c.kind !== "mannequin" && HAIRS[c.kind].under;
  if (v === "front") {
    if (under) o += `<g transform="translate(0 ${bob})">${S(HAIRS[c.kind as "girl"].front, HAIRS.girl.c, 5)}</g>`;
    o += bodyFB(c, v) + `<g transform="translate(0 ${bob})">${headFront(c)}${c.w.hat?.draw(v) ?? ""}</g>`;
  } else {
    o += bodyFB(c, v) + `<g transform="translate(0 ${bob})">${headBack(c)}${c.w.hat?.draw(v) ?? ""}</g>`;
  }
  return o;
}

// ── 옆모습 (오른쪽을 본다) ──
function side(c: Ctx): string {
  const sw = c.frame === 1 ? 12 : c.frame === 2 ? -12 : 0;
  let o = shadow(144, 270, 36, 6);
  const sideLeg = (x: number, rot: number) => {
    const d = SIDE_LEG(x);
    const boot = c.w.shoes?.boots ? S(`M${x - 2} 238h28v26q0 6-6 6h-22Z`, c.shoe, 4) : "";
    return `<g transform="rotate(${rot} 144 206)">${leg(c, d, `M${x} 256h24`)}${boot}</g>`;
  };
  o += sideLeg(134, -sw) + sideLeg(136, sw);
  o += `<g transform="translate(0 -${c.frame ? 3 : 0})">`;
  const H = c.kind === "mannequin" ? null : HAIRS[c.kind];
  o += torso(c, SIDE_TORSO);
  if (c.w.bottom?.skirt) o += S("M122 200h44l12 34q-34 10-68 0Z", c.w.bottom.color, 4.5) + L("M140 204l-4 28", 2.5);
  o += c.w.top?.deco?.("side") ?? "";
  // 머리는 앞모습과 같은 동그란 두상을 몸 한가운데 위에 얹고, 머리카락이 뒤통수·정수리를 덮는다
  o += S(HEAD, c.skin, 5.5);
  if (H) {
    o += dot(184, 102, 6) + blush(190, 120) + L("M194 124q6 2 10-2", 3.5);
    o += S(H.side, H.c, 5) + S(E(140, 112, 10, 15), c.skin, 4.5);
    if (c.kind === "visitor") o += S(LEAF, "#6fb34f", 3.5);
  }
  o += c.w.hat?.draw("side") ?? "";
  o += `<g transform="rotate(${-sw * 2} 143 160)">${armS(SIDE_ARM, sleeveY(c, true), c.top, c.skin)}</g>`;
  o += "</g>";
  return o + (c.w.shoes?.deco?.("side") ?? "");
}

/** 주민 한 장 (viewBox 288, width·height = size) */
export function person(kind: Kind, view: View, frame: Frame, wear: Wear, size: number): string {
  const mq = kind === "mannequin";
  const c: Ctx = {
    kind, frame, w: wear,
    skin: mq ? BEIGE : SKIN,
    top: wear.top?.color ?? (mq ? BEIGE : kind === "visitor" ? "#a8d07a" : "#ffffff"),
    bot: wear.bottom?.color ?? (mq ? BEIGE : kind === "visitor" ? "#6f8fb0" : "#9aa3ad"),
    shoe: wear.shoes?.color ?? (mq ? BEIGE : "#7a4a2a"),
  };
  // 광장 그림과 같은 파스텔 크레용 그림체 (2026-10-12)
  return pastel(() => make(288, 288, () => (view === "side" ? side(c) : front(c, view)), { dw: size, dh: size }));
}

// ── 꾸미기 그림 ──
const recolor = (s: string, c: string) => s.replace(/#262220|#7b5a44/g, c); // 검은 선·파스텔 갈색 선 둘 다
const star = (x: number, y: number) => `<path d="M${x} ${y}l3 5l5 1l-5 2l-1 5l-3-4l-5 0l4-4Z" fill="#fff"/>`;

export const WEAR_PIECES = {
  "avatar.top.stripe": { slot: "top", top: { color: "#ffffff", deco: (v: View) => (v === "side" ? recolor(L("M126 168h34M126 184h36M126 200h36", 3), "#4f8fe0") : recolor(L("M116 168h56M114 184h60M114 200h60", 3), "#4f8fe0")) } },
  "avatar.top.hoodie": {
    slot: "top",
    top: {
      color: "#f29a4a", longSleeve: true,
      deco: (v: View) => (v === "front" ? L("M136 150v24M152 150v24", 2.5) + S("M124 194h40v14h-40Z", "#e0843a", 3.5) : v === "back" ? S("M116 150q28 22 56 0q-4 18-28 22q-24-4-28-22Z", "#e0843a", 3.5) : S("M124 150q-10 14 4 26q8-12 8-26Z", "#e0843a", 3.5)),
    },
  },
  "avatar.top.knit": { slot: "top", top: { color: "#6fb38a", longSleeve: true, deco: (v: View) => (v === "side" ? L("M126 170l8 8l8-8l8 8l8-8", 3) + L("M126 196h36", 3) : L("M118 170l8 8l8-8l8 8l8-8l8 8l8-8l8 8", 3) + L("M118 196h52", 3)) } },
  "avatar.bottom.shorts": { slot: "bottom", bottom: { color: "#4f8fe0" } },
  "avatar.bottom.jeans": { slot: "bottom", bottom: { color: "#3e5f9e", long: true } },
  "avatar.bottom.skirt": { slot: "bottom", bottom: { color: "#e8574b", skirt: true } },
  "avatar.shoes.sneakers": { slot: "shoes", shoes: { color: "#ffffff", deco: (v: View) => (v === "side" ? "" : recolor(L("M116 264h22M150 264h22", 2.5), "#e8433a")) } },
  "avatar.shoes.boots": { slot: "shoes", shoes: { color: "#8a5a3a", boots: true } },
  "avatar.shoes.shiny": { slot: "shoes", shoes: { color: "#f28fa8", deco: (v: View) => (v === "side" ? star(146, 260) : star(126, 260) + star(160, 260)) } },
  "avatar.hat.straw": {
    slot: "hat",
    hat: { draw: () => S(E(144, 46, 88, 16), "#f2d27a", 5) + S("M100 46q4-40 44-40q40 0 44 40Z", "#f2d27a", 5) + S("M100 36h88v10h-88Z", "#e8433a", 3.5) },
  },
  "avatar.hat.beanie": {
    slot: "hat",
    hat: { draw: () => S("M82 70q-2-58 62-60q64 2 62 60Z", "#8f6ad6", 5) + S(Rc(78, 58, 132, 18, 8), "#7a55c4", 4.5) + S(E(144, 10, 12), "#f4efe6", 4) },
  },
  "avatar.hat.crown": {
    slot: "hat",
    hat: {
      draw: (v: View) => {
        const gems = v === "back" ? "" : `<circle cx="144" cy="30" r="6" fill="#e8433a"/><circle cx="118" cy="34" r="4" fill="#4f8fe0"/><circle cx="170" cy="34" r="4" fill="#4f8fe0"/>`;
        return S("M104 44l-4-40l24 20l20-26l20 26l24-20l-4 40Z", "#f2c230", 5) + gems;
      },
    },
  },
} as const;
