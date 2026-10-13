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
  /** 헤어 (2026-10-13). 없으면 캐릭터의 기본 머리(짧은 머리 주민은 짧은 머리, 긴 머리 주민은 긴 머리) */
  hair?: HairWear;
};
export type TopWear = { color: string; longSleeve?: boolean; sleeveless?: boolean; /** 기모노처럼 발목까지 내려오는 옷자락 */ robe?: boolean; deco?: (v: View) => string };
export type BottomWear = { color: string; long?: boolean; skirt?: boolean; /** 한복 치마처럼 가슴께에서 발목까지 오는 긴 치마 */ longSkirt?: boolean; /** 꼬리처럼 몸 밖으로 나오는 장식. 앞·옆은 몸 뒤, 뒤는 몸 위에 그린다 */ tail?: (v: View) => string };
export type ShoesWear = { color: string; boots?: boolean; deco?: (v: View) => string };
export type HatWear = { draw: (v: View) => string };

const BEIGE = "#e8d2ae";
/** 카드 바탕색 (globals.css의 paper) */
const PAPER = "#fffaf0";
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

/** 머리 모양: c 색, front 앞모습(under면 얼굴 뒤에 깔고 face의 윗선이 앞머리가 된다), back 뒷모습, side 옆모습 */
export type HairWear = { c: string; front: string; face: string; under?: boolean; back: string; side: string; /** 머리 뒤에 숨겨 그리는 덩어리(똥머리 등). 머리카락 윗선이 그 위를 덮어 겹친 선이 보이지 않는다 */ behind?: string };
type Hair = HairWear;
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
/** 앞머리 덩어리. 뒤에 숨긴 덩어리(behind)가 있으면 파스텔 면이 반쯤 비쳐 겹친 자리가 짙어 보여서, 밑에 종이색을 먼저 깐다 */
const hairFront = (H: Hair) => (H.behind ? `<path d="${H.front}" fill="${PAPER}"/>` : "") + S(H.front, H.c, 5);
/** 입은 헤어, 없으면 캐릭터의 기본 머리 (마네킹은 머리 없음) */
const hairOf = (c: Ctx): Hair | null => c.w.hair ?? (c.kind === "mannequin" ? null : HAIRS[c.kind]);

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
const sleeveY = (c: Ctx, side: boolean) => (c.w.top?.sleeveless ? 120 : c.w.top?.longSleeve ? (side ? 198 : 196) : side ? 180 : 189);

// ── 앞·뒤 몸 (좌우 대칭) ──
function bodyFB(c: Ctx, v: View): string {
  const f = c.frame, bob = f ? -3 : 0;
  const liftL = f === 1 ? -7 : 0, liftR = f === 2 ? -7 : 0, swing = f === 1 ? 6 : f === 2 ? -6 : 0;
  let s = v === "front" ? (c.w.bottom?.tail?.(v) ?? "") : "";
  s += `<g transform="translate(0 ${liftL})">${leg(c, LEGL, "M114 256h26")}${bootF(c, 112)}</g>`;
  s += `<g transform="translate(0 ${liftR})">${leg(c, LEGR, "M148 256h26")}${bootF(c, 146)}</g>`;
  s += `<g transform="translate(0 ${bob})">`;
  const sy = sleeveY(c, false);
  s += `<g transform="rotate(${swing} 119 162)">${armS(ARML, sy, c.top, c.skin)}</g>`;
  s += `<g transform="rotate(${-swing} 169 162)">${armS(ARMR, sy, c.top, c.skin)}</g>`;
  s += torso(c, TORSO);
  if (v === "back") s += c.w.bottom?.tail?.(v) ?? "";
  if (c.w.bottom?.longSkirt) s += S("M116 176h56l18 86q-46 10 -92 0Z", c.w.bottom.color, 4.5) + L("M134 182l-8 76M154 182l8 76", 2.5);
  else if (c.w.bottom?.skirt) s += S("M115 200h58l10 34q-39 10 -78 0Z", c.w.bottom.color, 4.5) + L("M132 204l-6 28M156 204l6 28", 2.5);
  if (c.w.top?.robe) s += S("M114 194h60l8 68q-38 9 -76 0Z", c.top, 4.5);
  s += c.w.top?.deco?.(v) ?? "";
  s += "</g>";
  return s + (c.w.shoes?.deco?.(v) ?? "");
}
const bootF = (c: Ctx, x: number) => (c.w.shoes?.boots ? S(Rc(x, 238, 30, 34, 5), c.shoe, 4) : "");

function headFront(c: Ctx): string {
  const H = hairOf(c);
  if (!H) return S(HEAD, c.skin, 5.5);
  // 파스텔 면은 반쯤 비쳐서, 머리카락 위에 얹는 얼굴·귀(여자 주민)는 밑에 종이색을 먼저 깔아 머리색이 비치지 않게 한다
  let s = H.under ? [E(85, 112, 10, 15), E(203, 112, 10, 15), H.face].map((d) => `<path d="${d}" fill="${PAPER}"/>`).join("") : "";
  s += S(E(85, 112, 10, 15), c.skin, 4.5) + S(E(203, 112, 10, 15), c.skin, 4.5) + S(H.face, c.skin, 5.5);
  if (c.kind !== "mannequin") s += dot(122, 100, 6) + dot(166, 100, 6) + blush(110, 116) + blush(178, 116) + L("M137 117q7 7 14 0", 3.5);
  if (!H.under) s += hairFront(H);
  if (c.kind === "visitor") s += S(LEAF, "#6fb34f", 3.5);
  return s;
}
function headBack(c: Ctx): string {
  const H = hairOf(c);
  if (!H) return S(HEAD, c.skin, 5.5);
  let s = S(E(85, 112, 10, 15), c.skin, 4.5) + S(E(203, 112, 10, 15), c.skin, 4.5);
  if (!H.under) s += S(HEAD, c.skin, 5.5);
  s += S(H.back, H.c, 5);
  if (c.kind === "visitor") s += S(LEAF, "#6fb34f", 3.5);
  return s;
}

function front(c: Ctx, v: View): string {
  const bob = c.frame ? -3 : 0;
  let o = shadow(144, 270, 40, 6);
  const H = hairOf(c);
  if (H?.behind) o += `<g transform="translate(0 ${bob})">${S(H.behind, H.c, 5)}</g>`;
  if (v === "front") {
    if (H?.under) o += `<g transform="translate(0 ${bob})">${hairFront(H)}</g>`;
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
  o += c.w.bottom?.tail?.("side") ?? "";
  o += sideLeg(134, -sw) + sideLeg(136, sw);
  o += `<g transform="translate(0 -${c.frame ? 3 : 0})">`;
  const H = hairOf(c);
  o += torso(c, SIDE_TORSO);
  if (c.w.bottom?.longSkirt) o += S("M122 176h44l16 86q-38 9-76 0Z", c.w.bottom.color, 4.5) + L("M142 182l-6 76", 2.5);
  else if (c.w.bottom?.skirt) o += S("M122 200h44l12 34q-34 10-68 0Z", c.w.bottom.color, 4.5) + L("M140 204l-4 28", 2.5);
  if (c.w.top?.robe) o += S("M122 194h44l8 68q-30 9-60 0Z", c.top, 4.5);
  o += c.w.top?.deco?.("side") ?? "";
  // 머리는 앞모습과 같은 동그란 두상을 몸 한가운데 위에 얹고, 머리카락이 뒤통수·정수리를 덮는다
  o += S(HEAD, c.skin, 5.5);
  if (H) {
    if (c.kind !== "mannequin") o += dot(184, 102, 6) + blush(190, 120) + L("M194 124q6 2 10-2", 3.5);
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
const DINO = "#7cc46a", DINO_BELLY = "#f6efc8", DINO_SPIKE = "#f2a64a";
/** 공룡 등의 뾰족한 가시 (가운데 x, 아래 y, 반폭, 높이) */
const spike = (x: number, y: number, w: number, h: number) => S(`M${x - w} ${y}l${w} -${h}l${w} ${h}Z`, DINO_SPIKE, 3);
/** 공룡 모자: 머리 위를 덮는 초록 후드, 앞쪽 가장자리에 하얀 이빨, 위에 동그란 눈과 등가시 */
function dinoHood(v: View): string {
  const edge = (x: number) => 84 - 22 * (1 - ((x - 144) / 64) ** 2); // 후드 가장자리 높이
  let o = "";
  if (v === "side") o += S("M104 22l-12-14l20 4Z", DINO_SPIKE, 3) + S("M88 38l-18-8l16 14Z", DINO_SPIKE, 3) + S("M80 60l-18-2l16 12Z", DINO_SPIKE, 3);
  else o += spike(128, 16, 8, 16) + spike(144, 12, 8, 18) + spike(160, 16, 8, 16);
  o += S("M80 84q-4-74 64-76q68 2 64 76q-64-22-128 0Z", DINO, 5);
  if (v === "back") return o + spike(144, 44, 6, 12) + spike(144, 64, 6, 12);
  const teeth = (v === "side" ? [168, 180, 192] : [100, 114, 128, 144, 160, 174, 188]).map((x) => `<path d="M${x - 5} ${edge(x) - 1}l5 9l5-9Z" fill="#fbf6ec"/>`).join("");
  const eyes = v === "side" ? S(E(176, 36, 9, 10), "#fbf6ec", 3) + dot(178, 37, 4) : S(E(120, 36, 9, 10), "#fbf6ec", 3) + S(E(168, 36, 9, 10), "#fbf6ec", 3) + dot(121, 37, 4) + dot(167, 37, 4);
  return o + teeth + eyes;
}
/** 작은 다섯 잎 꽃 (꽃신·기모노 무늬) */
const flower = (x: number, y: number) =>
  [0, 72, 144, 216, 288].map((a) => `<circle cx="${(x + 3.5 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(y + 3.5 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="2.6" fill="#fbf6ec"/>`).join("") + `<circle cx="${x}" cy="${y}" r="1.8" fill="#f2c230"/>`;
/** 금색 단추 */
const button = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#f2c230"/>`;
const star = (x: number, y: number) => `<path d="M${x} ${y}l3 5l5 1l-5 2l-1 5l-3-4l-5 0l4-4Z" fill="#fff"/>`;

export const WEAR_PIECES = {
  // 헤어 (2026-10-13): 처음 고른 주민의 머리를 떼어 내 누구나 바꿔 쓸 수 있게 했다
  "avatar.hair.short": { slot: "hair", hair: HAIRS.boy },
  "avatar.hair.long": { slot: "hair", hair: HAIRS.girl },
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
  // 해적 옷 (2026-10-12): 바다 모험 느낌의 옷을 이 마을 그림체로 새로 그렸다
  "avatar.top.vest": {
    slot: "top",
    top: {
      color: "#e0483e", sleeveless: true,
      deco: (v: View) => (v === "front" ? S("M134 148q10 3 20 0l-5 50h-10Z", SKIN, 3.5) + button(128, 172) + button(160, 172) : v === "side" ? S("M156 150h6l2 46h-7Z", SKIN, 3) : ""),
    },
  },
  "avatar.top.coat": {
    slot: "top",
    top: {
      color: "#7a3040", longSleeve: true,
      deco: (v: View) =>
        v === "front"
          ? recolor(L("M124 150l20 24l20-24M144 174v24", 3), "#f2c230") + button(136, 184) + button(152, 184) + button(136, 196) + button(152, 196)
          : v === "back" ? recolor(L("M118 196h52", 3), "#f2c230")
          : recolor(L("M158 152l-4 44", 3), "#f2c230") + button(150, 172) + button(150, 188),
    },
  },
  "avatar.bottom.sailor": { slot: "bottom", bottom: { color: "#efe4cc", long: true } },
  "avatar.shoes.sandals": {
    slot: "shoes",
    shoes: { color: "#f6cfa8", deco: (v: View) => recolor(v === "side" ? L("M136 262h22M134 270h28", 3.5) : L("M116 262h22M150 262h22M114 270h26M148 270h26", 3.5), "#8a5a3a") },
  },
  "avatar.hat.pirate": {
    slot: "hat",
    hat: {
      draw: (v: View) => {
        const skull = v === "back" ? "" : S(E(144, 34, 9, 8), "#fbf6ec", 2.5) + dot(140, 34, 2.2) + dot(148, 34, 2.2) + recolor(L("M132 44l24 10M156 44l-24 10", 3.5), "#fbf6ec");
        return S("M86 62q2-50 58-54q56 4 58 54q-58-12-116 0Z", "#3a3238", 5) + S("M68 66q76-30 152 0q-4 12-14 9q-62-16-124 0q-10 3-14-9Z", "#3a3238", 5) + recolor(L("M80 66q64-20 128 0", 3), "#f2c230") + skull;
      },
    },
  },
  "avatar.hat.bandana": {
    slot: "hat",
    hat: {
      draw: (v: View) => {
        const knot = v === "side" ? S("M92 74l-16 4l6 14Z", "#4f9d5a", 4) : v === "back" ? S(E(144, 72, 8, 6), "#4f9d5a", 4) + S("M140 76l-10 18l10-2Z", "#4f9d5a", 3.5) + S("M148 76l10 18l-10-2Z", "#4f9d5a", 3.5) : "";
        return S("M80 80q-4-66 64-68q68 2 64 68q-64-20-128 0Z", "#4f9d5a", 5) + recolor(L("M100 46l6 6M126 32l6 6M160 34l6 6M184 50l6 6", 3), "#2f6e3d") + knot;
      },
    },
  },
  // 공룡 옷 (2026-10-12): 모자·상의·하의·신발을 다 입으면 초록 공룡 점프수트가 된다
  "avatar.hat.dino": { slot: "hat", hat: { draw: (v: View) => dinoHood(v) } },
  "avatar.top.dino": {
    slot: "top",
    top: {
      color: DINO, longSleeve: true,
      deco: (v: View) =>
        v === "front"
          ? S(E(144, 190, 20, 26), DINO_BELLY, 3.5) + recolor(L("M128 182h32M126 196h36", 2.5), "#d9c98a")
          : v === "back" ? spike(144, 162, 7, 12) + spike(144, 182, 7, 12) + spike(144, 202, 7, 12)
          : S("M156 160q12 30 0 58q-10-2-10-29q0-27 10-29Z", DINO_BELLY, 3.5) + S("M124 162l-11 6l11 7Z", DINO_SPIKE, 3) + S("M124 184l-11 6l11 7Z", DINO_SPIKE, 3),
    },
  },
  "avatar.bottom.dino": {
    slot: "bottom",
    bottom: {
      color: DINO, long: true,
      tail: (v: View) =>
        v === "front"
          ? S("M166 204q38 4 50 38q-28 6-50-16Z", DINO, 4.5)
          : v === "back"
            ? S("M128 206q-8 36 16 60q24-24 16-60Z", DINO, 4.5) + spike(144, 222, 5, 9) + spike(144, 238, 4, 8)
            : S("M130 196q-36 6-56 42q30 6 58-18Z", DINO, 4.5) + S("M104 208l-6-10l12 2Z", DINO_SPIKE, 3) + S("M90 220l-8-8l12 0Z", DINO_SPIKE, 3),
    },
  },
  "avatar.shoes.dino": {
    slot: "shoes",
    shoes: {
      color: DINO,
      deco: (v: View) =>
        (v === "side" ? [154, 161, 168] : [117, 125, 133, 155, 163, 171]).map((x) => `<path d="M${x - 3} 270l3-6l3 6Z" fill="#fbf6ec"/>`).join(""),
    },
  },
  // 한복 (2026-10-12): 노란 저고리 + 분홍 긴 치마(또는 하늘색 바지) + 꽃신
  "avatar.top.jeogori": {
    slot: "top",
    top: {
      color: "#f6d36a", longSleeve: true,
      deco: (v: View) =>
        v === "front"
          ? S("M128 148l16 22l16-22h-6l-10 14l-10-14Z", "#fbf6ec", 2.5) + S(E(152, 172, 6, 5), "#d9434f", 3) + S("M151 175l-6 24l7-3Z", "#d9434f", 2.5) + S("M154 175l4 22l4-4Z", "#d9434f", 2.5)
          : v === "side" ? S("M154 150l8 0l-4 18Z", "#fbf6ec", 2.5) + S("M156 172l-2 22l6-3Z", "#d9434f", 2.5)
          : "",
    },
  },
  "avatar.bottom.hanbok-skirt": { slot: "bottom", bottom: { color: "#f28fa8", skirt: true, longSkirt: true } },
  "avatar.bottom.hanbok-pants": { slot: "bottom", bottom: { color: "#a9cfe8", long: true } },
  "avatar.shoes.kkotsin": {
    slot: "shoes",
    shoes: { color: "#e8574b", deco: (v: View) => (v === "side" ? flower(152, 264) : flower(127, 264) + flower(161, 264)) },
  },
  // 기모노 (2026-10-12): 발목까지 오는 하늘색 기모노에 빨간 허리띠, 나무 게타
  "avatar.top.kimono": {
    slot: "top",
    top: {
      color: "#8fb8e8", longSleeve: true, robe: true,
      deco: (v: View) => {
        const obi = v === "side" ? S("M122 186h44v16h-44Z", "#e8574b", 3.5) : S("M114 186h60v16h-60Z", "#e8574b", 3.5);
        const petals = v === "back" ? flower(130, 222) + flower(158, 244) : v === "side" ? flower(140, 226) : flower(126, 224) + flower(160, 240);
        if (v === "front") return S("M128 148l18 30l16-30h-6l-10 18l-12-18Z", "#fbf6ec", 2.5) + L("M150 202l-6 58", 2.5) + obi + petals;
        if (v === "back") return obi + S("M126 182l18 10l18-10l-4 26l-14-8l-14 8Z", "#e8574b", 3.5) + petals;
        return S("M154 150l8 0l-6 24Z", "#fbf6ec", 2.5) + obi + S("M118 180l10 10l-10 12Z", "#e8574b", 3) + petals;
      },
    },
  },
  "avatar.shoes.geta": {
    slot: "shoes",
    shoes: { color: "#c98d5a", deco: (v: View) => recolor(v === "side" ? L("M146 258l6 6l6-6", 3) : L("M120 258l6 6l6-6M154 258l6 6l6-6", 3), "#d9434f") },
  },
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
