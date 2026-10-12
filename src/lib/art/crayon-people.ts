// 크레용 그림체 주민 (큰 머리 + 작고 통통한 몸·짧은 팔다리 몸 틀, 288×288 좌표, 발바닥 y=270).
// 앞·뒤·옆(오른쪽을 본다) 모습 × 서 있기(0)·걷기(1·2). 입은 꾸미기는 모습마다 그 방향에 맞게 그린다.
// 머리카락은 한 덩어리로 그리고 얼굴을 그 위에 얹어, 앞머리 선 = 얼굴 윗선이 되게 한다.

import { E, F, L, Rc, S, SKIN, blush, clip, dot, make, nid, pastel, shadow } from "./crayon";

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
// 몸 틀 (2026-10-12 정지원 님 시안): 큰 머리 아래 작고 통통한 한 덩어리 몸, 짧고 뭉툭한 팔다리
/** 머리(얼굴·머리카락·모자)를 1.1배로 키워 정수리(144, 22)를 기준으로 얹는다 */
const HEAD_T = "matrix(1.1 0 0 1.1 -14.4 -2.2)";
const TORSO = "M134 148Q122 152 121 166L118 214Q117 236 132 238L156 238Q171 236 170 214L167 166Q166 152 154 148Z";
const LEGL = "M118 222L119 262Q119 270 127 270L137 270Q142 270 142 264L142 232L143 222Z";
const ARML = "M124 162Q110 170 100 182Q93 190 97 196Q101 201 107 197Q114 191 122 186Z";
/** 좌우 뒤집기 (x → 288 - x). 절대 좌표 M·L·Q·C 명령만 쓰는 모양에 쓴다 */
const mirror = (d: string) =>
  d.replace(/([MLQC])([^MLQCZ]+)/g, (_, c: string, args: string) => c + args.trim().split(/[\s,]+/).map((v, i) => (i % 2 === 0 ? String(288 - parseFloat(v)) : v)).join(" "));
const ARMR = mirror(ARML);
const LEGR = mirror(LEGL);

const SIDE_LEG = (x: number) => `M${x} 222L${x + 1} 260Q${x} 270 ${x + 8} 270H${x + 24}Q${x + 29} 270 ${x + 26} 264L${x + 19} 260L${x + 20} 222Z`;
const SIDE_TORSO = "M136 148Q126 152 126 166L125 214Q125 238 140 238L150 238Q164 236 163 214L161 166Q160 152 152 148Z";
const SIDE_ARM = "M138 162q2 10 3 18q1 10 3 16q2 6 8 4q6-2 4-8l-3-14q-1-10-4-16q-6-6-11 0Z";

type Hair = { c: string; front: string; face: string; under?: boolean; back: string; side: string };
const HAIRS: Record<"girl" | "boy" | "visitor", Hair> = {
  girl: {
    c: "#7a4a2a",
    front: "M80 98C72 40 106 18 144 18C182 18 216 40 208 98Q218 150 212 180Q212 190 198 188Q144 182 90 188Q76 190 76 180Q70 150 80 98Z",
    face: "M80 98Q96 92 104 74Q114 84 128 84Q166 86 188 70Q194 90 208 98C204 126 190 141 144 144C98 141 84 126 80 98Z",
    under: true,
    back: "M76 104C70 36 106 14 144 14C182 14 218 36 212 104V180Q212 190 202 190H86Q76 190 76 180Z",
    side: "M144 16C188 16 212 44 208 98Q196 84 184 70Q162 90 140 86Q134 100 136 122L138 182Q138 190 130 190H92Q82 190 82 180L82 104C76 50 104 16 144 16Z",
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

/** 팔 + 소매: 소매 색은 팔 모양 안에서만 칠하고 소매 끝선을 긋는다.
 *  윤곽선(armLine)을 먼저 긋고 살·소매(armFill)를 나중에 칠하면, 몸통 속으로 들어간 팔 윤곽은 몸통 색에 덮여
 *  어깨에서 팔이 한 덩어리로 이어져 나온다 */
const armLine = (d: string) => L(d, 4.5);
const armFill = (d: string, sy: number, top: string, skin: string) => {
  const id = nid("a");
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>${F(d, skin)}<g clip-path="url(#${id})">${F(Rc(60, 100, 180, sy - 100), top)}${L(`M60 ${sy}H240`, 3.5)}</g>`;
};
/** 옆모습 팔: 몸 앞에 오므로 윤곽을 긋되, 어깨 쪽은 서서히 투명해지게 해 몸통에서 자라 나온 것처럼 보이게 한다 */
const armSide = (d: string, sy: number, top: string, skin: string) => {
  const m = nid("m"), g = nid("g");
  const mask = `<linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="0" y1="160" x2="0" y2="168"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="${m}" maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="288"><rect width="288" height="288" fill="url(#${g})"/></mask>`;
  return `${mask}<g mask="url(#${m})">${armFill(d, sy, top, skin)}${armLine(d)}</g>`;
};
/** 다리 + 바지 + 신발 (다리 모양 그대로 잘라 입힌다) */
const leg = (c: Ctx, d: string, line: string) => {
  const id = nid("l");
  const pants = c.w.bottom?.skirt ? "" : F(Rc(60, 205, 160, c.w.bottom?.long ? 53 : 43), c.bot);
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>${F(d, c.skin)}<g clip-path="url(#${id})">${pants}${F(Rc(60, 256, 160, 20), c.shoe)}</g>${L(d, 4.5)}${L(line, 3)}`;
};
/** 몸통 + 아랫단(하의 색). 윤곽(torsoLine)과 색(torsoFill)을 나눠, 그 사이에 팔·다리를 그려 넣으면
 *  몸통 색이 팔·다리 윗부분을 덮어 이음새 없이 이어진다 */
const torsoLine = (d: string) => L(d, 5);
const torsoFill = (c: Ctx, d: string) => {
  const band = c.w.bottom?.skirt ? c.w.bottom.color : c.bot;
  // 윗옷·아랫단을 몸통 모양이 아니라 가로선으로 나눠 자른다: 크레용 면의 번진 가장자리가 다리 위에 다른 색으로 남지 않게
  return clip(Rc(0, 0, 288, 211), F(d, c.top)) + clip(Rc(0, 210, 288, 90), F(d, band));
};
const sleeveY = (c: Ctx, side: boolean) => (c.w.top?.longSleeve ? (side ? 192 : 190) : side ? 178 : 176);

// ── 앞·뒤 몸 (좌우 대칭) ──
function bodyFB(c: Ctx, v: View): string {
  const f = c.frame, bob = f ? -3 : 0;
  const liftL = f === 1 ? -7 : 0, liftR = f === 2 ? -7 : 0, swing = f === 1 ? 6 : f === 2 ? -6 : 0;
  const sy = sleeveY(c, false);
  const up = (x: string) => `<g transform="translate(0 ${bob})">${x}</g>`;
  const armL = (x: string) => `<g transform="rotate(${swing} 122 168)">${x}</g>`, armR = (x: string) => `<g transform="rotate(${-swing} 166 168)">${x}</g>`;
  // 윤곽(몸통·팔) → 다리 → 팔 색 → 몸통 색 순서: 몸통 색이 팔·다리 뿌리를 덮어 한 몸으로 이어진다
  let s = up(torsoLine(TORSO) + armL(armLine(ARML)) + armR(armLine(ARMR)));
  s += `<g transform="translate(0 ${liftL})">${leg(c, LEGL, "M119 258h23")}${bootF(c, 117)}</g>`;
  s += `<g transform="translate(0 ${liftR})">${leg(c, LEGR, "M146 258h23")}${bootF(c, 145)}</g>`;
  s += `<g transform="translate(0 ${bob})">`;
  s += armL(armFill(ARML, sy, c.top, c.skin)) + armR(armFill(ARMR, sy, c.top, c.skin));
  s += torsoFill(c, TORSO);
  if (c.w.bottom?.skirt) s += S("M119 206h50l10 32q-35 9-70 0Z", c.w.bottom.color, 4.5) + L("M134 210l-5 26M154 210l5 26", 2.5);
  s += c.w.top?.deco?.(v) ?? "";
  s += "</g>";
  return s + (c.w.shoes?.deco?.(v) ?? "");
}
const bootF = (c: Ctx, x: number) => (c.w.shoes?.boots ? S(Rc(x, 246, 26, 25, 5), c.shoe, 4) : "");

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
    if (under) o += `<g transform="translate(0 ${bob})"><g transform="${HEAD_T}">${S(HAIRS[c.kind as "girl"].front, HAIRS.girl.c, 5)}</g></g>`;
    o += bodyFB(c, v) + `<g transform="translate(0 ${bob})"><g transform="${HEAD_T}">${headFront(c)}${c.w.hat?.draw(v) ?? ""}</g></g>`;
  } else {
    o += bodyFB(c, v) + `<g transform="translate(0 ${bob})"><g transform="${HEAD_T}">${headBack(c)}${c.w.hat?.draw(v) ?? ""}</g></g>`;
  }
  return o;
}

// ── 옆모습 (오른쪽을 본다) ──
function side(c: Ctx): string {
  const sw = c.frame === 1 ? 12 : c.frame === 2 ? -12 : 0;
  let o = shadow(144, 270, 36, 6);
  const sideLeg = (x: number, rot: number) => {
    const d = SIDE_LEG(x);
    const boot = c.w.shoes?.boots ? S(`M${x} 246h26v18q0 6-6 6h-20Z`, c.shoe, 4) : "";
    return `<g transform="rotate(${rot} 144 226)">${leg(c, d, `M${x + 1} 260h19`)}${boot}</g>`;
  };
  const lift = `translate(0 -${c.frame ? 3 : 0})`;
  // 몸통 윤곽 → 다리 → 몸통 색: 다리 뿌리가 몸통 속으로 들어가 이음새가 보이지 않는다
  o += `<g transform="${lift}">${torsoLine(SIDE_TORSO)}</g>`;
  o += sideLeg(129, -sw) + sideLeg(135, sw);
  o += `<g transform="${lift}">`;
  const H = c.kind === "mannequin" ? null : HAIRS[c.kind];
  o += torsoFill(c, SIDE_TORSO);
  if (c.w.bottom?.skirt) o += S("M126 206h38l12 32q-31 9-62 0Z", c.w.bottom.color, 4.5) + L("M142 210l-4 26", 2.5);
  o += c.w.top?.deco?.("side") ?? "";
  // 머리는 앞모습과 같은 동그란 두상을 몸 한가운데 위에 얹고, 머리카락이 뒤통수·정수리를 덮는다
  o += `<g transform="${HEAD_T}">` + S(HEAD, c.skin, 5.5);
  if (H) {
    o += dot(184, 102, 6) + blush(190, 120) + L("M194 124q6 2 10-2", 3.5);
    o += S(H.side, H.c, 5) + S(E(140, 112, 10, 15), c.skin, 4.5);
    if (c.kind === "visitor") o += S(LEAF, "#6fb34f", 3.5);
  }
  o += (c.w.hat?.draw("side") ?? "") + "</g>";
  o += `<g transform="rotate(${-sw * 2} 144 164)">${armSide(SIDE_ARM, sleeveY(c, true), c.top, c.skin)}</g>`;
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
  "avatar.top.stripe": { slot: "top", top: { color: "#ffffff", deco: (v: View) => (v === "side" ? recolor(L("M129 180h30M128 196h32", 3), "#4f8fe0") : recolor(L("M122 180h44M121 196h46", 3), "#4f8fe0")) } },
  "avatar.top.hoodie": {
    slot: "top",
    top: {
      color: "#f29a4a", longSleeve: true,
      deco: (v: View) => (v === "front" ? L("M138 160v14M150 160v14", 2.5) + S("M130 186h28v12h-28Z", "#e0843a", 3.5) : v === "back" ? S("M124 156q20 16 40 0q-3 12-20 16q-17-4-20-16Z", "#e0843a", 3.5) : S("M130 156q-8 12 2 20q8-8 8-20Z", "#e0843a", 3.5)),
    },
  },
  "avatar.top.knit": { slot: "top", top: { color: "#6fb38a", longSleeve: true, deco: (v: View) => (v === "side" ? L("M130 176l7 7l7-7l7 7l7-7", 3) + L("M129 200h30", 3) : L("M123 176l7 7l7-7l7 7l7-7l7 7l7-7", 3) + L("M121 200h46", 3)) } },
  "avatar.bottom.shorts": { slot: "bottom", bottom: { color: "#4f8fe0" } },
  "avatar.bottom.jeans": { slot: "bottom", bottom: { color: "#3e5f9e", long: true } },
  "avatar.bottom.skirt": { slot: "bottom", bottom: { color: "#e8574b", skirt: true } },
  "avatar.shoes.sneakers": { slot: "shoes", shoes: { color: "#ffffff", deco: (v: View) => (v === "side" ? "" : recolor(L("M122 265h16M150 265h16", 2.5), "#e8433a")) } },
  "avatar.shoes.boots": { slot: "shoes", shoes: { color: "#8a5a3a", boots: true } },
  "avatar.shoes.shiny": { slot: "shoes", shoes: { color: "#f28fa8", deco: (v: View) => (v === "side" ? star(146, 262) : star(126, 262) + star(156, 262)) } },
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
