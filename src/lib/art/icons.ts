// UI 아이콘 (2026-10-08 디자인 시안 ① "UI 아이콘 프리셋"). 이모지 대신 쓰는 코드로 그린 SVG.
// 그림체: 붉은 기가 도는 짙은 갈색 외곽선(밝은 아이콘은 바탕색 쪽으로 물든 선), 빛은 왼쪽 위.
// 명암은 세 톤(밝은 면 → 바탕 → 오른쪽 아래 옅은 그늘)으로 부드럽게, 흰 반사점은 하트·경고에만 둔다.
// 좌표는 96×96 viewBox (48px 아이콘의 2배). 작은 크기(20~24px)에서도 알아보도록 실루엣을 굵고 단순하게 그린다.
import { PALETTE, darken, lighten, uid } from "./style";

export const ICON_NAMES = [
  "mail", "coin", "exp", "heart", "comment", "guestbook",
  "notice", "inquiry", "write", "search", "category", "invite",
  "pet", "shop", "background", "furniture", "clothes", "hat",
  "settings", "level", "alert", "news", "achievement", "home",
  "egg", "potion", "carrot", "hand", "calendar", "lock", "logout", "back", "campfire",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/* ───────────── 공통 도우미 ───────────── */

/** 그림 하나를 그리는 동안 쓰는 defs와 id 만들기 */
type Ctx = { id: (p: string) => string; defs: string[] };

/** 아이콘 외곽선: 시안의 붉은 갈색 (광장 그림의 OUTLINE보다 붉고 진하다) */
const INK = "#4a1a10";
/** 밝은 아이콘은 외곽선을 바탕색 쪽으로 물들인다 (시안 측정값) */
const INKS: Partial<Record<IconName, string>> = {
  exp: "#d06e12",
  heart: "#7c1413",
  alert: "#7e1a14",
  news: "#274920",
  achievement: "#0b1d40",
};
const HEART_INK = "#7c1413";
const LEAF_INK = "#2f6b3a";
/** 지금 그리는 아이콘의 외곽선 색 (draw()가 아이콘마다 바꾼다) */
let ink = INK;
const S = (w = 2.6, col?: string): string =>
  `stroke="${col ?? ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/** 바깥 외곽선 굵기 (viewBox 단위). 안쪽 선은 더 가늘게 */
const W = 3.6;
const n1 = (v: number) => Math.round(v * 100) / 100;

type Tone = { hi?: string; sh?: string; cx?: number; cy?: number; r?: number };

/** 왼쪽 위가 밝고 오른쪽 아래가 살짝 어두운 둥근 명암 (세 톤) */
function rad(c: Ctx, base: string, t: Tone = {}): string {
  const id = c.id("r");
  const hi = t.hi ?? lighten(base, 0.42);
  const sh = t.sh ?? darken(base, 0.12);
  c.defs.push(
    `<radialGradient id="${id}" cx="${t.cx ?? 0.34}" cy="${t.cy ?? 0.28}" r="${t.r ?? 0.86}" fx="${t.cx ?? 0.34}" fy="${t.cy ?? 0.28}">` +
      `<stop offset="0" stop-color="${hi}"/><stop offset=".52" stop-color="${base}"/><stop offset="1" stop-color="${sh}"/></radialGradient>`,
  );
  return `url(#${id})`;
}

/** 위에서 아래로 (또는 x1..y2 방향) 세 톤 직선 명암 */
function lin(c: Ctx, stops: [string, string, string], x2 = 0, y2 = 1, x1 = 0, y1 = 0): string {
  const id = c.id("l");
  c.defs.push(
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
      `<stop offset="0" stop-color="${stops[0]}"/><stop offset=".5" stop-color="${stops[1]}"/><stop offset="1" stop-color="${stops[2]}"/></linearGradient>`,
  );
  return `url(#${id})`;
}

/** 작은 흰 반사점 (하트·경고에만) */
const spec = (x: number, y: number, r = 3): string =>
  `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(r)}" ry="${n1(r * 0.78)}" transform="rotate(-30 ${n1(x)} ${n1(y)})" fill="#fff" opacity=".9"/>`;
/** 부드러운 넓은 광택 (왼쪽 위의 밝은 기운) */
const gloss = (x: number, y: number, rx: number, ry: number, rot = -30, op = 0.28): string =>
  `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(rx)}" ry="${n1(ry)}" transform="rotate(${rot} ${n1(x)} ${n1(y)})" fill="#fff" opacity="${op}"/>`;

/** 여러 도형을 한 덩어리로 보이게: 바깥에만 굵은 외곽선을 두르고 안쪽 이음선은 가늘게 */
type Part = [tag: string, attrs: string, fill: string];
const sil = (parts: Part[], w = W, col?: string): string =>
  parts.map(([t, a]) => `<${t} ${a} fill="${col ?? ink}" ${S(w * 2 - 2, col)}/>`).join("");
const paint = (parts: Part[], w = 2): string =>
  parts.map(([t, a, fill]) => `<${t} ${a} fill="${fill}"${w ? ` ${S(w)}` : ""}/>`).join("");
const solid = (parts: Part[], inner = 2, w = W, col?: string): string => sil(parts, w, col) + paint(parts, inner);
/** 도형들의 합집합을 grow만큼 부풀린 받침(색 fill) + 그 바깥 외곽선 */
const backing = (parts: Part[], grow: number, fill: string, w = 2.8): string =>
  parts.map(([t, a]) => `<${t} ${a} fill="${ink}" ${S(n1((grow + w) * 2))}/>`).join("") +
  parts.map(([t, a]) => `<${t} ${a} fill="${fill}" stroke="${fill}" stroke-width="${n1(grow * 2)}" stroke-linejoin="round"/>`).join("");

/** 굵은 선(손잡이·줄기 등): 외곽선 + 색 */
const tube = (d: string, color: string, width: number, w = W, col?: string): string =>
  `<path d="${d}" fill="none" stroke="${col ?? ink}" stroke-width="${n1(width + w * 2 - 1)}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

const shadow = (cx: number, cy: number, rx: number, ry: number): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#3b2a1a" opacity=".13"/>`;

/** 꼭짓점을 둥글린 다각형 (r = 모서리에서 깎는 길이) */
function roundPoly(pts: [number, number][], r: number): string {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la / 2), rb = Math.min(r, lb / 2);
    const s = [p[0] + ((a[0] - p[0]) / la) * ra, p[1] + ((a[1] - p[1]) / la) * ra];
    const e = [p[0] + ((b[0] - p[0]) / lb) * rb, p[1] + ((b[1] - p[1]) / lb) * rb];
    d += `${i === 0 ? "M" : "L"}${n1(s[0])} ${n1(s[1])}Q${n1(p[0])} ${n1(p[1])} ${n1(e[0])} ${n1(e[1])}`;
  }
  return d + "Z";
}

/** 하트 경로 (cx, cy 가운데, s = 크기). 넓고 통통한 잎, 얕은 홈, 둥근 아래 끝 (폭:높이 ≈ 1.17:1) */
function heartPath(cx: number, cy: number, s: number): string {
  const P = (x: number, y: number) => `${n1(cx + x * s)} ${n1(cy + y * s)}`;
  return (
    `M${P(0, 0.97)}` +
    `C${P(-0.09, 0.97)} ${P(-0.17, 0.92)} ${P(-0.27, 0.85)}` +
    `C${P(-0.62, 0.6)} ${P(-1.15, 0.24)} ${P(-1.15, -0.3)}` +
    `C${P(-1.15, -0.76)} ${P(-0.86, -1)} ${P(-0.54, -1)}` +
    `C${P(-0.27, -1)} ${P(-0.07, -0.88)} ${P(0, -0.72)}` +
    `C${P(0.07, -0.88)} ${P(0.27, -1)} ${P(0.54, -1)}` +
    `C${P(0.86, -1)} ${P(1.15, -0.76)} ${P(1.15, -0.3)}` +
    `C${P(1.15, 0.24)} ${P(0.62, 0.6)} ${P(0.27, 0.85)}` +
    `C${P(0.17, 0.92)} ${P(0.09, 0.97)} ${P(0, 0.97)}Z`
  );
}
const HEART = "#f2707a";
/** 산호빛 하트 (외곽선은 진홍) */
function heart(c: Ctx, cx: number, cy: number, s: number, w = W): string {
  return (
    `<path d="${heartPath(cx, cy, s)}" fill="${rad(c, HEART, { hi: "#ffa3a8", sh: "#df5a66", cx: 0.3, cy: 0.25 })}" ${S(w, HEART_INK)}/>` +
    gloss(cx - s * 0.5, cy - s * 0.42, s * 0.32, s * 0.2, -35, 0.35) +
    spec(cx - s * 0.6, cy - s * 0.5, Math.max(1.3, s * 0.11))
  );
}

/** 통통한 네 갈래 별: 가운데는 두툼하고 골은 오목, 끝은 살짝 둥글게 (a·b = 3차 곡선 조절점, tr = 끝을 둥글리는 정도) */
function starPath(cx: number, cy: number, rx: number, ry: number, a = 0.16, b = 0.42, tr = 0.08): string {
  type V = [number, number];
  const T: V[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const C: [V, V][] = [[[a, -b], [b, -a]], [[b, a], [a, b]], [[-a, b], [-b, a]], [[-b, -a], [-a, -b]]];
  // 3차 곡선의 blossom: 곡선 일부(tr..1-tr)의 조절점을 구한다
  const bl = (i: number, u: number, v: number, w: number): V => {
    const p = [T[i], C[i][0], C[i][1], T[(i + 1) % 4]];
    const k = [
      (1 - u) * (1 - v) * (1 - w),
      (1 - u) * (1 - v) * w + (1 - u) * v * (1 - w) + u * (1 - v) * (1 - w),
      (1 - u) * v * w + u * (1 - v) * w + u * v * (1 - w),
      u * v * w,
    ];
    return [k.reduce((s, f, j) => s + f * p[j][0], 0), k.reduce((s, f, j) => s + f * p[j][1], 0)];
  };
  const P = ([x, y]: V) => `${n1(cx + x * rx)} ${n1(cy + y * ry)}`;
  const e = 1 - tr;
  let d = `M${P(bl(0, tr, tr, tr))}`;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    d += `C${P(bl(i, tr, tr, e))} ${P(bl(i, tr, e, e))} ${P(bl(i, e, e, e))}Q${P(T[j])} ${P(bl(j, tr, tr, tr))}`;
  }
  return d + "Z";
}

/** 잎 하나 (밑동 → 끝, w = 반폭). 끝은 살짝만 뾰족 */
function leafPath(bx: number, by: number, tx: number, ty: number, w: number, tip = 0.5): string {
  const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  const P = (t: number, s: number) => `${n1(bx + dx * t + nx * s)} ${n1(by + dy * t + ny * s)}`;
  return `M${P(0, 0)}C${P(0.12, w * 1.05)} ${P(0.86, w * tip * 1.5)} ${P(1, 0)}C${P(0.86, -w * tip * 1.5)} ${P(0.12, -w * 1.05)} ${P(0, 0)}Z`;
}

/** 연필 (x1,y1 = 심 끝, x2,y2 = 지우개 끝, h = 반폭). 몸통은 밝은 면/어두운 면 두 톤 */
function pencil(c: Ctx, x1: number, y1: number, x2: number, y2: number, h: number): string {
  const L = Math.hypot(x2 - x1, y2 - y1);
  const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const t = L * 0.25; // 깎은 부분
  const e = L * 0.15; // 지우개
  const b = L * 0.11; // 쇠 띠
  const bodyEnd = L - e - b;
  const parts: Part[] = [
    ["path", `d="M0 0L${n1(t)} ${n1(-h)}H${n1(bodyEnd)}V${n1(h)}H${n1(t)}Z"`, "none"],
    ["path", `d="M${n1(bodyEnd)} ${n1(-h - 0.6)}H${n1(L - h * 0.6)}Q${n1(L)} ${n1(-h - 0.6)} ${n1(L)} ${n1(-h * 0.3)}V${n1(h * 0.3)}Q${n1(L)} ${n1(h + 0.6)} ${n1(L - h * 0.6)} ${n1(h + 0.6)}H${n1(bodyEnd)}Z"`, "none"],
  ];
  const wood = lin(c, ["#fde6c2", "#f3d2a0", "#ddb27a"]);
  const eraser = lin(c, ["#f6939a", "#e8606a", "#c94653"]);
  const metal = lin(c, ["#eef2f7", "#c9d2de", "#9eabbd"]);
  const wave = `Q${n1(t + h * 0.4)} ${n1(-h * 0.5)} ${n1(t)} 0Q${n1(t + h * 0.4)} ${n1(h * 0.5)} ${n1(t)} ${n1(h)}`;
  return (
    `<g transform="translate(${n1(x1)} ${n1(y1)}) rotate(${n1(a)})">` +
    sil(parts) +
    `<path d="M0 0L${n1(t)} ${n1(-h)}${wave}Z" fill="${wood}"/>` +
    // 몸통: 위(빛 받는 면) 밝은 노랑, 아래 진한 노랑
    `<path d="M${n1(t)} ${n1(-h)}H${n1(bodyEnd)}V0H${n1(t)}Q${n1(t + h * 0.4)} ${n1(-h * 0.5)} ${n1(t)} ${n1(-h)}Z" fill="#ffd968"/>` +
    `<path d="M${n1(t)} 0H${n1(bodyEnd)}V${n1(h)}H${n1(t)}Q${n1(t + h * 0.4)} ${n1(h * 0.5)} ${n1(t)} 0Z" fill="#efac34"/>` +
    `<path d="M${n1(t + h * 0.3)} 0H${n1(bodyEnd)}" stroke="#d99228" stroke-width="${n1(Math.max(1, h * 0.12))}"/>` +
    `<path d="M${n1(t + h * 0.6)} ${n1(-h * 0.55)}H${n1(bodyEnd - h * 0.4)}" stroke="#fff3c4" stroke-width="${n1(h * 0.2)}" stroke-linecap="round" opacity=".7"/>` +
    `<path d="M0 0L${n1(t * 0.36)} ${n1(-h * 0.36)}V${n1(h * 0.36)}Z" fill="${ink}"/>` +
    `<path d="M${n1(t)} ${n1(-h)}${wave}" fill="none" ${S(Math.max(1.4, h * 0.15))}/>` +
    `<path ${parts[1][1]} fill="${eraser}" ${S(Math.max(1.6, h * 0.16))}/>` +
    `<rect x="${n1(bodyEnd)}" y="${n1(-h - 0.6)}" width="${n1(b)}" height="${n1(h * 2 + 1.2)}" fill="${metal}" ${S(Math.max(1.6, h * 0.16))}/>` +
    `<path d="M${n1(bodyEnd + b * 0.36)} ${n1(-h + 1)}V${n1(h - 1)}M${n1(bodyEnd + b * 0.68)} ${n1(-h + 1)}V${n1(h - 1)}" stroke="#93a1b4" stroke-width="${n1(Math.max(1, h * 0.11))}"/>` +
    `</g>`
  );
}

const PAPER = "#fffaf0";
const PAPER_SH = "#eadcc4";
const GOLD = "#f4bd36";
const LEAF = "#74b552";
const BLUE = "#5c9ce4";
const STRAW = "#ecc982";
const WOOD = PALETTE.log;
const CHAIR = "#d49a5c";
const TAN = "#c9a77a";

/** 말풍선 흰 바탕 */
const bubbleFill = (c: Ctx) => rad(c, "#fdf8ee", { hi: "#ffffff", sh: "#e8dcc8", cx: 0.32, cy: 0.25 });

/** 잎이 뭉친 덤불: 겹친 원 몇 개 + 평평한 밑동 (base = 땅 선). 외곽선은 짙은 초록 */
function shrub(c: Ctx, circles: [number, number, number][], base: number, w = 2.8): string {
  const xs = circles.map(([x]) => x), rs = circles.map(([, , r]) => r);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), rMin = Math.min(...rs);
  const leaf = rad(c, LEAF, { hi: "#a8da7c", sh: "#5a9a44" });
  const parts: Part[] = [
    ["rect", `x="${n1(x0)}" y="${n1(base - rMin)}" width="${n1(x1 - x0)}" height="${n1(rMin)}"`, "#64a64a"],
    ...circles.map(([x, y, r]): Part => ["circle", `cx="${x}" cy="${y}" r="${r}"`, leaf]),
  ];
  // 잎 결: 덩어리마다 오른쪽 아래에 짧은 짙은 초록 호
  const marks = circles
    .filter(([, , r]) => r >= 4.5)
    .map(([x, y, r]) => `M${n1(x - r * 0.2)} ${n1(y + r * 0.32)}q${n1(r * 0.3)} ${n1(r * 0.28)} ${n1(r * 0.62)} ${n1(-r * 0.06)}`)
    .join("");
  return sil(parts, w, LEAF_INK) + paint(parts, 0) + (marks ? `<path d="${marks}" fill="none" stroke="${LEAF_INK}" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>` : "");
}

/** 다섯 꽃잎 꽃 (외곽선 있음) */
function flower(cx: number, cy: number, r: number, petal: string, center = "#f6c445"): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * (Math.PI / 180);
    out += `<circle cx="${n1(cx + Math.cos(a) * r * 0.58)}" cy="${n1(cy + Math.sin(a) * r * 0.58)}" r="${n1(r * 0.5)}" fill="${petal}" ${S(1.5)}/>`;
  }
  return out + `<circle cx="${cx}" cy="${cy}" r="${n1(r * 0.34)}" fill="${center}" ${S(1.2)}/>`;
}

/** 친구 초대 아이콘의 아이 한 명 (cx = 가운데, y = 머리 가운데) */
function kid(c: Ctx, cx: number, y: number, dress: string): string {
  const X = (dx: number) => n1(cx + dx);
  const Y = (dy: number) => n1(y + dy);
  const hair = rad(c, "#8b5631", { hi: "#b77c4c", sh: "#6e4024" });
  const skin = rad(c, PALETTE.skin, { hi: "#fff0e2", sh: "#f2c6a6" });
  const dressFill = rad(c, dress, { hi: "#a9cdf2", sh: "#4f8ccc" });
  const eye = (dx: number) =>
    `<ellipse cx="${X(dx)}" cy="${Y(3.2)}" rx="2.6" ry="3.2" fill="${ink}"/><circle cx="${X(dx - 0.8)}" cy="${Y(2)}" r="1.05" fill="#fff"/>`;
  const arm = (s: number) =>
    tube(`M${X(s * 9)} ${Y(17.5)}L${X(s * 13.6)} ${Y(26)}`, dress, 4.6, 2.2) +
    `<circle cx="${X(s * 14.2)}" cy="${Y(28)}" r="2.7" fill="${PALETTE.skin}" ${S(1.8)}/>`;
  return (
    // 다리·신발
    `<rect x="${X(-6.2)}" y="${Y(31)}" width="4.6" height="7" rx="2" fill="${PALETTE.skin}" ${S(1.8)}/>` +
    `<rect x="${X(1.6)}" y="${Y(31)}" width="4.6" height="7" rx="2" fill="${PALETTE.skin}" ${S(1.8)}/>` +
    `<ellipse cx="${X(-4.2)}" cy="${Y(38.6)}" rx="3.8" ry="2.4" fill="#7a4228" ${S(1.8)}/>` +
    `<ellipse cx="${X(4.2)}" cy="${Y(38.6)}" rx="3.8" ry="2.4" fill="#7a4228" ${S(1.8)}/>` +
    // 팔 (옷 뒤) → 원피스: 아래로 살짝 퍼진 치마, 흰 둥근 깃
    arm(-1) + arm(1) +
    `<path d="M${X(-7.5)} ${Y(14)}Q${X(-10.5)} ${Y(15)} ${X(-11)} ${Y(20)}L${X(-13.4)} ${Y(31.5)}Q${X(-13.6)} ${Y(33.5)} ${X(-11.5)} ${Y(33.5)}H${X(11.5)}Q${X(13.6)} ${Y(33.5)} ${X(13.4)} ${Y(31.5)}L${X(11)} ${Y(20)}Q${X(10.5)} ${Y(15)} ${X(7.5)} ${Y(14)}Z" fill="${dressFill}" ${S(2.6)}/>` +
    `<path d="M${X(-6)} ${Y(14.2)}Q${X(-5)} ${Y(19.6)} ${X(0)} ${Y(16.4)}Q${X(5)} ${Y(19.6)} ${X(6)} ${Y(14.2)}Z" fill="#fffaf2" ${S(1.6)}/>` +
    // 뒷머리 (턱 아래까지 둥글게)
    `<path d="M${X(-16.5)} ${Y(0)}C${X(-16.5)} ${Y(-12)} ${X(-9)} ${Y(-18)} ${X(0)} ${Y(-18)}C${X(9)} ${Y(-18)} ${X(16.5)} ${Y(-12)} ${X(16.5)} ${Y(0)}C${X(17.5)} ${Y(8)} ${X(17)} ${Y(13)} ${X(12)} ${Y(15.5)}Q${X(0)} ${Y(6)} ${X(-12)} ${Y(15.5)}C${X(-17)} ${Y(13)} ${X(-17.5)} ${Y(8)} ${X(-16.5)} ${Y(0)}Z" fill="${hair}" ${S(2.6)}/>` +
    // 귀 → 얼굴
    `<circle cx="${X(-13.4)}" cy="${Y(3.4)}" r="3" fill="${PALETTE.skin}" ${S(2)}/><circle cx="${X(13.4)}" cy="${Y(3.4)}" r="3" fill="${PALETTE.skin}" ${S(2)}/>` +
    `<circle cx="${X(0)}" cy="${Y(0.6)}" r="13.4" fill="${skin}" ${S(2.6)}/>` +
    // 앞머리
    `<path d="M${X(-14.2)} ${Y(1.6)}C${X(-14.8)} ${Y(-12)} ${X(-8)} ${Y(-15.5)} ${X(0)} ${Y(-15.5)}C${X(8)} ${Y(-15.5)} ${X(14.8)} ${Y(-12)} ${X(14.2)} ${Y(1.6)}C${X(11)} ${Y(-4)} ${X(7)} ${Y(-5)} ${X(4)} ${Y(-5)}C${X(2)} ${Y(-8.5)} ${X(-2)} ${Y(-8.5)} ${X(-4)} ${Y(-5)}C${X(-8)} ${Y(-5)} ${X(-12)} ${Y(-3)} ${X(-14.2)} ${Y(1.6)}Z" fill="${hair}" ${S(2.2)}/>` +
    gloss(cx - 6, y - 10.5, 4, 1.6, -20, 0.3) +
    eye(-5.4) + eye(5.4) +
    `<ellipse cx="${X(-9)}" cy="${Y(7.6)}" rx="2.6" ry="1.6" fill="#f39bb4" opacity=".7"/><ellipse cx="${X(9)}" cy="${Y(7.6)}" rx="2.6" ry="1.6" fill="#f39bb4" opacity=".7"/>` +
    `<path d="M${X(-2)} ${Y(8.2)}Q${X(0)} ${Y(10.2)} ${X(2)} ${Y(8.2)}" fill="none" ${S(1.5)}/>`
  );
}

/* ───────────── 아이콘 ───────────── */

const ICONS: Record<IconName, (c: Ctx) => string> = {
  // 메일(쪽지): 크림색 편지 봉투(접힌 선은 옅은 황갈색)와 산호빛 하트 봉인
  mail: (c) =>
    `<rect x="10" y="22" width="76" height="54" rx="8" fill="${lin(c, ["#fffdf6", "#f9eedb", "#efdcbc"])}" ${S(W)}/>` +
    `<path d="M17 70L40 51.5M79 70L56 51.5" stroke="${TAN}" stroke-width="2.3" stroke-linecap="round"/>` +
    `<path d="M15.5 27L48 52.5L80.5 27" fill="none" stroke="${TAN}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    heart(c, 48, 50, 12.5, 2.6),

  // 코인: 두께가 보이는 금화, 안쪽 테두리와 돋을새김 $ 무늬
  coin: (c) => {
    const s = "M57 38.6C55.2 34.6 51.4 33 47.6 33C42.6 33 39.2 35.6 39.2 39.6C39.2 44.4 43.6 45.8 48 47C53 48.4 57.4 50 57.4 55.6C57.4 60.2 53.4 63 48 63C44 63 40 61.4 38.2 57.6M48 28.5V67.5";
    const body: Part[] = [
      ["circle", `cx="50" cy="49.5" r="34"`, "#c4831a"],
      ["circle", `cx="47" cy="48" r="34"`, rad(c, GOLD, { hi: "#ffe680", sh: "#e6a82a" })],
    ];
    return (
      sil(body) + paint(body, 0) +
      `<circle cx="47" cy="48" r="34" fill="none" stroke="#b5741a" stroke-width="1.6"/>` +
      `<circle cx="47" cy="48" r="26.5" fill="${lin(c, ["#eaa82a", "#f4bf3c", "#fbd666"], 1, 1)}" stroke="#c4831a" stroke-width="2.6"/>` +
      `<g transform="translate(-1 0)">` +
      `<path d="${s}" transform="translate(1.2 1.4)" fill="none" stroke="#c98415" stroke-width="5.6" stroke-linecap="round"/>` +
      `<path d="${s}" fill="none" stroke="#ffe17a" stroke-width="5.6" stroke-linecap="round"/>` +
      `</g>` +
      gloss(30, 30, 9, 4.5, -40, 0.22)
    );
  },

  // 경험치: 통통한 금빛 네 갈래 별과 작은 반짝이 둘 (외곽선은 주황)
  exp: (c) => {
    const f = lin(c, ["#ffe066", "#f6b52a", "#e8901c"]);
    return (
      `<path d="${starPath(48, 44, 28, 31)}" fill="${f}" ${S(3.6)}/>` +
      `<path d="${starPath(45.5, 40.5, 13, 15)}" fill="#fff3a6" opacity=".55"/>` +
      `<path d="${starPath(20.5, 62, 6.5, 8)}" fill="${f}" ${S(2.6)}/>` +
      `<path d="${starPath(75.5, 62, 6.5, 8)}" fill="${f}" ${S(2.6)}/>`
    );
  },

  // 좋아요: 넓고 통통한 산호빛 하트
  heart: (c) => heart(c, 48, 49, 29),

  // 댓글: 하얀 말풍선과 작은 점 세 개
  comment: (c) =>
    `<path d="M48 15C68.8 15 85 27 85 42C85 57 68.8 69 48 69C44 69 40 68.5 36.4 67.4L21 78L24.6 63.6C16.2 58.4 11 50.6 11 42C11 27 27.2 15 48 15Z" fill="${bubbleFill(c)}" ${S(W)}/>` +
    `<circle cx="31.5" cy="42" r="3.9" fill="#7b5136"/><circle cx="48" cy="42" r="3.9" fill="#7b5136"/><circle cx="64.5" cy="42" r="3.9" fill="#7b5136"/>` +
    gloss(28, 25, 8, 3.5, -20, 0.3),

  // 방명록: 빨간 표지의 펼친 책과 연필
  guestbook: (c) =>
    `<path d="M7 36Q27 30 48 38Q69 30 89 36V80Q69 74 48 82Q27 74 7 80Z" fill="${rad(c, "#d6453d", { hi: "#ec7a6c", sh: "#b4362e" })}" ${S(W)}/>` +
    `<path d="M12 30Q30 24 48 33V76Q30 67 12 73Z" fill="${lin(c, ["#fffdf6", "#fbf2e0", "#efe0c6"], 1, 0)}" ${S(2.6)}/>` +
    `<path d="M48 33Q66 24 84 30V73Q66 67 48 76Z" fill="${lin(c, ["#f6ead2", "#fbf2e0", "#fffaf0"], 1, 0)}" ${S(2.6)}/>` +
    `<path d="M18 40Q30 36 42 42M18 49Q30 45 42 51M18 58Q30 54 42 60M54 42Q63 37 72 38M54 51Q64 46 76 47M54 60Q66 55 78 56" fill="none" stroke="#d8c19c" stroke-width="2.4" stroke-linecap="round"/>` +
    pencil(c, 57, 60, 89, 13, 6.8),

  // 공지사항: 빨간 확성기 (흰 몸통, 두꺼운 빨간 테, 연분홍 입구)
  notice: (c) => {
    const red = rad(c, "#e0463d", { hi: "#f4806f", sh: "#c13a31" });
    return (
      `<g transform="rotate(-16 48 50)">` +
      `<path d="M28.5 57L27.5 73Q27.5 78 32.5 78H36.5Q41 78 40.5 73L40 59Z" fill="${red}" ${S(W)}/>` +
      `<rect x="8" y="37.5" width="17" height="25" rx="7" fill="${red}" ${S(W)}/>` +
      `<path d="M22 41L66 24V75L22 58Z" fill="${lin(c, ["#ffffff", "#fbf5ea", "#e6dac8"])}" ${S(W)}/>` +
      `<circle cx="76.5" cy="30.5" r="4" fill="#f2a93a" ${S(2.4)}/>` +
      `<ellipse cx="67" cy="49.5" rx="11" ry="27" fill="${red}" ${S(W)}/>` +
      `<ellipse cx="69.4" cy="49.5" rx="6.4" ry="20" fill="#f7d2c9" ${S(2)}/>` +
      `<ellipse cx="70.4" cy="49.5" rx="1.5" ry="11" fill="#df9f93"/>` +
      gloss(31, 44.5, 6, 2.2, -20, 0.5) +
      gloss(14, 43, 2, 4, 0, 0.35) +
      `</g>`
    );
  },

  // 문의하기: 하트가 든 네모 말풍선 (짧고 뭉툭한 꼬리)
  inquiry: (c) =>
    `<path d="M23 14H73Q83 14 83 24V60Q83 70 73 70H42L28.5 81L30.5 70H23Q13 70 13 60V24Q13 14 23 14Z" fill="${bubbleFill(c)}" ${S(W)}/>` +
    heart(c, 48, 42.5, 14.6, 3) +
    gloss(25, 23, 7, 3, -20, 0.3),

  // 글쓰기: 짧고 통통한 노란 연필 (빨간 지우개, 푸른 회색 쇠 띠)
  write: (c) => pencil(c, 20, 76, 76, 20, 12.5),

  // 검색: 옅은 황갈색 테 돋보기, 푸른 유리
  search: (c) =>
    tube("M58 58L75 75", "#d18a3e", 12.5) +
    `<path d="M57.5 61.5L71 75" stroke="#f0b46e" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="40" cy="40" r="27" fill="${rad(c, "#c7ae93", { hi: "#e8d6c1", sh: "#9b7f63" })}" ${S(W)}/>` +
    `<circle cx="40" cy="40" r="22" fill="${rad(c, "#9fd3f2", { hi: "#e3f5ff", sh: "#69acdf" })}" ${S(2.2)}/>` +
    `<path d="M25.5 37Q27 26.5 37.5 23.5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,

  // 카테고리: 노란 폴더
  category: (c) =>
    `<path d="M11 26Q11 19 18 19H37Q41.5 19 43.5 23L46 27H78Q85 27 85 34V72Q85 79 78 79H18Q11 79 11 72Z" fill="${rad(c, "#e7a92f", { sh: "#cf921f" })}" ${S(W)}/>` +
    `<path d="M11 41Q11 35 17 35H79Q85 35 85 41V72Q85 79 78 79H18Q11 79 11 72Z" fill="${lin(c, ["#ffe58f", "#f8cd58", "#edb43c"])}" ${S(W)}/>` +
    `<path d="M18 41.5H78" stroke="#fff6cf" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,

  // 친구 초대: 원피스 입은 아이 둘 (사이를 띄워 작은 크기에서도 둘로 보이게)
  invite: (c) =>
    [24, 72].map((x) => `<g transform="translate(${x} 48) scale(1.08) translate(${-x} -48)">${kid(c, x, 37, "#6aa5de")}</g>`).join(""),

  // 동물 돌보기: 한 덩어리 발바닥 (캐러멜색 받침 위에 연한 젤리 다섯 개)
  pet: (c) => {
    const bean = rad(c, "#f4c084", { hi: "#fde0b6", sh: "#eeae66", cx: 0.32, cy: 0.26 });
    const toe = (x: number, y: number, rot: number): Part =>
      ["ellipse", `cx="${x}" cy="${y}" rx="9.5" ry="10.5" transform="rotate(${rot} ${x} ${y})"`, bean];
    const parts: Part[] = [
      toe(22.5, 45, -32), toe(37, 29.5, -10), toe(59, 29.5, 10), toe(73.5, 45, 32),
      ["path", `d="M48 45.5C58.5 45.5 68 55 68 63.5C68 70.5 62 74 56.5 73C53 72.3 51 70.8 48 70.8C45 70.8 43 72.3 39.5 73C34 74 28 70.5 28 63.5C28 55 37.5 45.5 48 45.5Z"`, bean],
    ];
    return (
      `<g transform="translate(0 2)">` +
      backing(parts, 4, rad(c, "#d38a45", { hi: "#dd9a58", sh: "#c27a38" }), 2.8) +
      paint(parts, 0) +
      gloss(39, 56, 6, 3.4, -30, 0.3) +
      `</g>`
    );
  },

  // 상점: 빨강·하양 줄무늬 차양이 있는 작은 가게, 아래 모서리에 낮은 덤불
  shop: (c) => {
    let stripes = "";
    let edge = "";
    for (let i = 0; i < 6; i++) {
      const tx0 = 18 + i * 10, tx1 = tx0 + 10, bx0 = 12 + i * 12, bx1 = bx0 + 12;
      const fill = i % 2 === 0 ? lin(c, ["#f07a6d", "#e0554a", "#cc4238"]) : lin(c, ["#ffffff", "#fff8ec", "#eee3d2"]);
      stripes += `<path d="M${tx0} 24L${tx1} 24L${bx1} 40Q${(bx0 + bx1) / 2} 49 ${bx0} 40Z" fill="${fill}"/>`;
    }
    for (let i = 5; i >= 0; i--) {
      const bx0 = 12 + i * 12;
      edge += `Q${bx0 + 6} 49 ${bx0} 40`;
    }
    return (
      shadow(48, 82, 36, 4) +
      `<rect x="19" y="36" width="58" height="42" fill="${lin(c, ["#fff0c4", "#f8e0a2", "#ecca84"], 1, 1)}" ${S(W)}/>` +
      `<rect x="14" y="75" width="68" height="7" rx="3" fill="${lin(c, [PALETTE.stoneHi, PALETTE.stone, PALETTE.stoneShade])}" ${S(2.6)}/>` +
      `<path d="M30 76V59Q30 52 38 52Q46 52 46 59V76Z" fill="${lin(c, ["#cf8f55", "#b8763f", "#9c6232"], 1, 0)}" ${S(2.6)}/>` +
      `<circle cx="38" cy="60" r="4" fill="${PALETTE.window}" ${S(1.8)}/>` +
      `<circle cx="42.4" cy="67.5" r="1.5" fill="${ink}"/>` +
      `<rect x="52" y="52" width="19" height="15" rx="3" fill="${rad(c, PALETTE.window, { hi: PALETTE.windowHi, sh: "#86bcd8" })}" ${S(2.6)}/>` +
      `<path d="M61.5 52V67M52 59.5H71" stroke="${ink}" stroke-width="2"/>` +
      stripes +
      `<path d="M18 24H78L84 40${edge}L18 24Z" fill="none" ${S(W)}/>` +
      `<rect x="14" y="15" width="68" height="10" rx="4" fill="${rad(c, "#e0554a", { sh: "#c4423a" })}" ${S(W)}/>` +
      gloss(24, 18.5, 6, 1.6, 0, 0.4) +
      shrub(c, [[19.5, 72.5, 3.5], [23.5, 69.5, 4.6], [28, 72.8, 3.2]], 76, 2.4) +
      shrub(c, [[68, 72.8, 3.2], [72.5, 69.5, 4.6], [76.5, 72.5, 3.5]], 76, 2.4)
    );
  },

  // 배경(꾸미기): 하늘·구름·뭉게뭉게 나무 둘·풀밭 풍경 카드
  background: (c) => {
    const clip = c.id("clip");
    c.defs.push(`<clipPath id="${clip}"><rect x="10" y="15" width="76" height="66" rx="9"/></clipPath>`);
    const leaf = rad(c, "#6fb04f", { hi: "#a8da7c", sh: "#55963f" });
    const big: Part[] = [
      [55, 40, 8], [60, 30, 9], [70, 28.5, 9], [77, 37, 8], [72, 45, 8], [61, 45.5, 8],
    ].map(([x, y, r]): Part => ["circle", `cx="${x}" cy="${y}" r="${r}"`, leaf]);
    const small: Part[] = [
      [21, 49, 5.6], [25, 42, 6.4], [32, 43.5, 6], [33.5, 50.5, 5.2], [26, 53, 5.6],
    ].map(([x, y, r]): Part => ["circle", `cx="${x}" cy="${y}" r="${r}"`, leaf]);
    const trunk = lin(c, [PALETTE.logHi, WOOD, PALETTE.logShade], 1, 0);
    return (
      `<rect x="10" y="15" width="76" height="66" rx="9" fill="${lin(c, ["#6fbfec", "#a4d9f3", "#e4f5fb"])}"/>` +
      `<g clip-path="url(#${clip})">` +
      `<path d="M17 34Q17 28 23 28Q25 23 31 24Q36 22 39 27Q44 28 43 33Q43 35 40 35H20Q17 35 17 34Z" fill="#fff" stroke="#cfe6f2" stroke-width="1.6"/>` +
      `<path d="M41 22Q42 18 46 19Q49 16 52 19Q56 19 55 23H42Q41 23 41 22Z" fill="#fff" opacity=".9"/>` +
      `<path d="M62 66L63.5 48H70.5L72 66Q67 68 62 66Z" fill="${trunk}" ${S(2.2)}/>` +
      sil(big, 2.6, LEAF_INK) + paint(big, 0) +
      `<path d="M52 37Q55 33 59 34M63 26Q67 23 71 25" fill="none" stroke="#c4e79a" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M23.5 64L24.6 52H29.4L30.5 64Q27 65.5 23.5 64Z" fill="${trunk}" ${S(2)}/>` +
      sil(small, 2.4, LEAF_INK) + paint(small, 0) +
      `<path d="M21 43Q24 39.5 27.5 40" fill="none" stroke="#c4e79a" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M6 64Q12 61 18 62.5Q24 60 30 62Q37 59.5 44 62Q52 63.5 58 64.5Q65 62.5 72 63Q80 60 90 61V86H6Z" fill="${lin(c, ["#a9d96f", "#8dc35a", "#76ad4c"])}" stroke="#5f9a40" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<circle cx="38" cy="71" r="2.4" fill="#f59ab6"/><circle cx="47" cy="75" r="2.2" fill="#fff"/><circle cx="75" cy="72" r="2.4" fill="#f6d36b"/><circle cx="20" cy="74" r="2" fill="#fff"/>` +
      `</g>` +
      `<rect x="10" y="15" width="76" height="66" rx="9" fill="none" ${S(2.6)}/>`
    );
  },

  // 가구: 비스듬히 본 나무 의자 (좁은 등받이, 윗면이 보이는 두툼한 좌판, 바깥으로 벌어진 앞다리)
  furniture: (c) => {
    const leg = lin(c, ["#efc68c", CHAIR, "#b97d45"], 1, 0);
    const top = roundPoly([[27, 47], [69, 47], [82.5, 63], [13.5, 63]], 7);
    return (
      shadow(48, 89, 30, 4) +
      `<rect x="19.5" y="62" width="10.5" height="27" rx="4.2" transform="rotate(6 24.75 62)" fill="${leg}" ${S(W)}/>` +
      `<rect x="66" y="62" width="10.5" height="27" rx="4.2" transform="rotate(-6 71.25 62)" fill="${leg}" ${S(W)}/>` +
      `<path d="M29 56V20Q29 7 48 7Q67 7 67 20V56Z" fill="${rad(c, CHAIR, { hi: "#efc68c", sh: "#bd8248" })}" ${S(W)}/>` +
      `<path d="M41.5 14V50M54.5 14V50" stroke="#b47a44" stroke-width="2.4" stroke-linecap="round"/>` +
      gloss(36, 16, 4, 2, -15, 0.3) +
      `<rect x="13.5" y="57" width="69" height="16" rx="7.5" fill="${lin(c, ["#c98d52", "#b97b42", "#a46a36"])}" ${S(W)}/>` +
      `<path d="${top}" fill="${lin(c, ["#f6d7a4", "#ecc287", "#e0b072"])}" ${S(W)}/>` +
      gloss(33, 52, 8, 2, -4, 0.3)
    );
  },

  // 옷/의상: 옷걸이에 걸린 네모진 흰 티셔츠 (거의 옆으로 뻗은 짧은 소매, 파란 소매 끝·목둘레)
  clothes: (c) => {
    const hemMask = c.id("m"), fade = c.id("l");
    c.defs.push(
      `<linearGradient id="${fade}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>` +
        `<mask id="${hemMask}"><rect x="0" y="66" width="96" height="14" fill="url(#${fade})"/></mask>`,
    );
    return (
    `<g transform="translate(0 3)">` +
    tube("M48 25V17Q48 10 54 10Q60 10 60 15.5", "#c98b4f", 3.2, 2.4) +
    tube("M23 35L48 25L73 35", "#c98b4f", 3.2, 2.4) +
    `<path d="M37 27L26.5 30.5L11 38.5Q9.4 39.4 9.9 41L13.4 50.4Q14 52 15.6 51.4L26 47.4V76Q26 79 29 79H67Q70 79 70 76V47.4L80.4 51.4Q82 52 82.6 50.4L86.1 41Q86.6 39.4 85 38.5L69.5 30.5L59 27Q55 35 48 35Q41 35 37 27Z" fill="${rad(c, "#fdf8ef", { hi: "#ffffff", sh: "#e2dacd", cx: 0.3, cy: 0.2 })}" ${S(W)}/>` +
    `<path d="M26.6 66H69.4V76Q69.4 78.4 67 78.4H29Q26.6 78.4 26.6 76Z" fill="${lin(c, ["#d6e8f8", "#d6e8f8", "#c4dcf3"])}" opacity=".5" mask="url(#${hemMask})"/>` +
    `<path d="M10.2 40.6L13.8 50.5L18.3 48.8L14.7 38.4Z" fill="${BLUE}" ${S(2.2)}/>` +
    `<path d="M85.8 40.6L82.2 50.5L77.7 48.8L81.3 38.4Z" fill="${BLUE}" ${S(2.2)}/>` +
    tube("M37 27Q41 35 48 35Q55 35 59 27", BLUE, 3.6, 1.6) +
    gloss(36, 47, 5, 9, 10, 0.35) +
    `</g>`
    );
  },

  // 모자: 넓은 챙 위의 낮고 둥근 밀짚모자, 두꺼운 빨간 띠와 큰 리본
  hat: (c) => {
    const straw = rad(c, STRAW, { hi: "#fbe7b8", sh: "#d9ad66" });
    const red = rad(c, "#e5605a", { hi: "#f79288", sh: "#cc4a43" });
    return (
      `<g transform="rotate(-9 48 58)">` +
      `<ellipse cx="48" cy="62" rx="44" ry="17.5" fill="${straw}" ${S(W)}/>` +
      `<path d="M10 66Q15 74 28 77.5M84 61Q85 70 74 74.5" fill="none" stroke="#c9974d" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>` +
      `<path d="M14 58l3 1.4M18 70l3.4 .6M33 76l3.5 .2M58 77l3.4-.4M80 68l3-1.4" stroke="#c9974d" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>` +
      `<path d="M22 60C21 39 32 28 48 28C64 28 75 39 74 60Q48 68.5 22 60Z" fill="${straw}" ${S(W)}/>` +
      `<path d="M30 38l2.6-2M40 32.4l3-.8M56 32.6l3 1M64 38.4l2.4 2.2M27 46.4l2.8-.6M66 45.6l2.8 .8" stroke="#c9974d" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>` +
      `<path d="M22.4 48.5Q48 57.5 73.6 48.5L74 60Q48 68.5 22 60Z" fill="${red}" ${S(2.6)}/>` +
      `<path d="M33 34.5Q39 30.5 46 30.5" fill="none" stroke="#fff4d6" stroke-width="3" stroke-linecap="round" opacity=".6"/>` +
      // 리본 꼬리 (챙 위로 늘어짐) → 고리 → 매듭
      `<path d="M69 57.5Q76 64 80.5 75L77 73.6L75.2 77.6Q71.5 67 65.6 60Z" fill="${red}" ${S(2.4)}/>` +
      `<path d="M72 58Q75 67 73.6 79L70.8 76.2L67.6 78.6Q69.4 68 67.8 59.5Z" fill="${red}" ${S(2.4)}/>` +
      `<path d="${roundPoly([[71, 55], [86, 42.5], [91.5, 56.5]], 5.5)}" fill="${red}" ${S(2.6)}/>` +
      `<path d="M73.5 54.6Q81 51 88 48" fill="none" stroke="#b5332b" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="${roundPoly([[70, 55.5], [50.5, 45], [50, 60]], 5.5)}" fill="${red}" ${S(2.6)}/>` +
      `<path d="M67.5 55.4Q60 52.6 53.5 51" fill="none" stroke="#b5332b" stroke-width="1.8" stroke-linecap="round"/>` +
      `<ellipse cx="70.6" cy="56" rx="5.4" ry="5" fill="${red}" ${S(2.4)}/>` +
      `</g>`
    );
  },

  // 설정: 따뜻한 회갈색 톱니바퀴 (짧고 둥근 톱니)
  settings: (c) => {
    const pts: [number, number][] = [];
    const n = 8, step = (Math.PI * 2) / n, ro = 36, ri = 29.5;
    for (let i = 0; i < n; i++) {
      const a = i * step - Math.PI / 2;
      for (const [da, r] of [[-0.3, ri], [-0.17, ro], [0.17, ro], [0.3, ri]] as const)
        pts.push([48 + Math.cos(a + da * step) * r, 48 + Math.sin(a + da * step) * r]);
    }
    return (
      `<path d="${roundPoly(pts, 2.6)}" fill="${rad(c, "#a69d96", { hi: "#d6cfc8", sh: "#8a817a" })}" ${S(W)}/>` +
      `<circle cx="48" cy="48" r="13" fill="${lin(c, ["#e6dccc", "#f6efe2", "#fffaf2"], 1, 1)}" ${S(W)}/>` +
      gloss(34, 27, 7, 3, -40, 0.3)
    );
  },

  // 레벨: 금빛 왕관 (오목하게 휜 뾰족 끝, 얕은 U자 골, 휘어진 띠, 가운데 주황 마름모)
  level: (c) => {
    const g = rad(c, GOLD, { hi: "#ffe98a", sh: "#e2a426" });
    return (
      `<path d="M19 66L13.5 31Q22 42.5 28.5 45Q31.5 46.5 34.5 45Q43 40 48 21Q53 40 61.5 45Q64.5 46.5 67.5 45Q74 42.5 82.5 31L77 66Z" fill="${g}" ${S(W)}/>` +
      `<circle cx="13.5" cy="29.5" r="5.2" fill="${g}" ${S(2.8)}/>` +
      `<circle cx="82.5" cy="29.5" r="5.2" fill="${g}" ${S(2.8)}/>` +
      `<circle cx="48" cy="18" r="5.8" fill="${g}" ${S(2.8)}/>` +
      `<path d="M48 46L52 52.5L48 59L44 52.5Z" fill="${lin(c, ["#ffc061", "#f28a24", "#d96e16"])}" ${S(2)}/>` +
      `<path d="M18 61Q48 67 78 61L78.5 70.5Q48 78 17.5 70.5Z" fill="${lin(c, ["#f8cf55", "#eeae2e", "#d9951f"])}" ${S(W)}/>` +
      `<path d="M23 65.2Q48 70.4 73 65.2" fill="none" stroke="#fff1b0" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`
    );
  },

  // 경고: 산호빛 빨간 동그라미에 흰 느낌표 (아래로 갈수록 가늘어짐)
  alert: (c) =>
    `<circle cx="48" cy="48" r="36" fill="${rad(c, "#e85a50", { hi: "#f99a8c", sh: "#d44a41" })}" ${S(W)}/>` +
    `<path d="M41.6 26.5Q41.2 19.5 48 19.5Q54.8 19.5 54.4 26.5L51.2 52Q50.9 55.6 48 55.6Q45.1 55.6 44.8 52Z" fill="#fffaf2" stroke="#a8302a" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="48" cy="66.5" r="6.2" fill="#fffaf2" stroke="#a8302a" stroke-width="1.6"/>` +
    gloss(29, 31, 8, 4, -45, 0.3) +
    spec(26.5, 33, 2.2),

  // 새 소식: 짧은 줄기의 새싹 (통통한 둥근 잎 둘이 Y자로)
  news: (c) => {
    const leaf = rad(c, LEAF, { hi: "#b4e08a", sh: "#5f9f48" });
    return (
      shadow(48, 80, 13, 3) +
      tube("M48 78Q45.6 68 47.8 58", "#62a046", 5, 3.2) +
      `<path d="${leafPath(47, 59, 20, 44, 10.5, 0.55)}" fill="${leaf}" ${S(3.2)}/>` +
      `<path d="M45 57.6Q36 51 25.5 46.6" fill="none" stroke="#4f8d3c" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
      `<path d="${leafPath(48.5, 58, 81, 36, 13, 0.55)}" fill="${leaf}" ${S(3.2)}/>` +
      `<path d="M51 56Q63 47 75 40" fill="none" stroke="#4f8d3c" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
      gloss(31, 47, 5, 2.4, 30, 0.3) + gloss(62, 41, 6, 2.6, -32, 0.3)
    );
  },

  // 업적/이벤트: 파란 리본 메달 (매끈한 원, 두꺼운 연파랑 테, 진한 파랑 가운데)
  achievement: (c) => {
    const tail = lin(c, ["#5f9fe6", "#4386d8", "#3470c2"], 1, 0);
    // 꼬리: 원 바로 아래에서 ±28° 벌어져 y≈80에서 V자로 끝남 (폭 14)
    const tailPath = (s: number) => {
      const ang = (28 * Math.PI) / 180;
      const ux = s * Math.sin(ang), uy = Math.cos(ang); // 아래로 향하는 축
      const nx = uy, ny = -ux; // 폭 방향
      const x0 = 48 + s * 6.5, y0 = 53, hw = 8, yEnd = 81;
      const ax = x0 + nx * hw, ay = y0 + ny * hw, bx = x0 - nx * hw, by = y0 - ny * hw;
      const ta = (yEnd - ay) / uy, tb = (yEnd - by) / uy;
      const mx = x0 + (ux * (yEnd - y0)) / uy;
      const P = (x: number, y: number) => `${n1(x)} ${n1(y)}`;
      return `M${P(ax, ay)}L${P(ax + ux * ta, yEnd)}L${P(mx, yEnd - 6.5)}L${P(bx + ux * tb, yEnd)}L${P(bx, by)}Z`;
    };
    return (
      `<path d="${tailPath(-1)}" fill="${tail}" ${S(W)}/>` +
      `<path d="${tailPath(1)}" fill="${tail}" ${S(W)}/>` +
      `<circle cx="48" cy="38" r="27" fill="${rad(c, "#7ab6f0", { hi: "#b9dbfa", sh: "#64a2e2" })}" ${S(W)}/>` +
      `<circle cx="48" cy="38" r="17" fill="${rad(c, "#3f86dc", { hi: "#6aa6ea", sh: "#2f6fc4" })}" stroke="#2a5fae" stroke-width="2.2"/>` +
      gloss(36, 25, 7, 3.4, -35, 0.35) +
      gloss(43, 31, 4.6, 2.4, -35, 0.25)
    );
  },

  // 내 집/프로필: 빨간 지붕 오두막, 뒤로 잎 덤불, 가운데 파란 쌍여닫이 문, 박공 아래 금빛 등
  home: (c) => {
    const roof = rad(c, "#e0553f", { hi: "#f4876f", sh: "#c4402f" });
    return (
      shrub(c, [[10, 72.5, 5.5], [8.5, 63, 5.5], [10, 53.5, 6], [15.5, 45.5, 6], [23.5, 42, 6], [21, 52, 6], [26, 66, 6.5], [22, 73, 5]], 78) +
      shrub(c, [[74, 73, 5], [70, 66, 6.5], [75, 52, 6], [72.5, 42, 6], [80.5, 45.5, 6], [86, 53.5, 6], [87.5, 63, 5.5], [86, 72.5, 5.5]], 78) +
      `<path d="M8 86Q8 79 15 78.5Q22 76.4 30 78Q40 76.6 48 77.6Q57 76.4 66 78Q74 76.4 81 78.5Q88 79 88 86Z" fill="${lin(c, ["#a9cf73", PALETTE.grass, PALETTE.grassShade])}"/>` +
      `<path d="M25 79V46L48 27L71 46V79Z" fill="${lin(c, ["#fff1cf", "#f7e1b0", "#e9cb90"], 1, 1)}" ${S(W)}/>` +
      `<path d="M13 52L48 19L83 52Q84.5 56.5 79.5 57.5L48 29L16.5 57.5Q11.5 56.5 13 52Z" fill="${roof}" ${S(W)}/>` +
      `<path d="M20 50L48 24" stroke="#f8a08a" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>` +
      // 금빛 등
      `<path d="M48 33.5V37" ${S(1.8)}/>` +
      `<rect x="44.2" y="36.5" width="7.6" height="9.6" rx="2.6" fill="${lin(c, ["#ffe58a", "#f6c445", "#e09b22"])}" ${S(2)}/>` +
      `<path d="M44 37.4H52" ${S(1.8)}/><circle cx="48" cy="41.6" r="1.6" fill="#fff6c8"/>` +
      // 갈색 문틀 + 파란 쌍여닫이 문
      `<path d="M37 79V61Q37 54.5 48 54.5Q59 54.5 59 61V79Z" fill="${lin(c, ["#a77042", "#8d5d34", "#744a28"], 1, 0)}" ${S(2.6)}/>` +
      `<path d="M40 79V62Q40 57.6 48 57.6Q56 57.6 56 62V79Z" fill="${lin(c, ["#86b0e2", "#5f8fcc", "#4a78b6"], 1, 0)}" ${S(1.8)}/>` +
      `<path d="M48 57.6V79" ${S(1.8)}/>` +
      `<rect x="42" y="62" width="4" height="5" rx="1" fill="#bfe0f4" opacity=".85"/><rect x="50" y="62" width="4" height="5" rx="1" fill="#bfe0f4" opacity=".85"/>` +
      `<circle cx="46" cy="71" r="1.1" fill="${GOLD}"/><circle cx="50" cy="71" r="1.1" fill="${GOLD}"/>` +
      flower(16, 79, 6, "#f6a5bb") + flower(81, 79, 6, "#fffaf0")
    );
  },

  // 알: 연한 점무늬가 있는 동물 알
  egg: (c) =>
    shadow(48, 86, 22, 3.6) +
    `<path d="M48 11C64 11 77 38 77 57C77 73 64 85 48 85C32 85 19 73 19 57C19 38 32 11 48 11Z" fill="${rad(c, "#fbf0d8", { hi: "#ffffff", sh: "#e8d2aa", cx: 0.36, cy: 0.3 })}" ${S(W)}/>` +
    `<ellipse cx="57" cy="34" rx="5.5" ry="4.5" fill="#a9d47e"/><ellipse cx="38" cy="50" rx="6.5" ry="5" fill="#f5b3c4"/>` +
    `<ellipse cx="60" cy="61" rx="7" ry="5.5" fill="#a9d47e"/><ellipse cx="41" cy="72" rx="4.5" ry="3.5" fill="#f5b3c4"/>` +
    gloss(35, 33, 4.5, 8, 25, 0.5),

  // 물약: 초록 물이 든 둥근 병과 코르크 마개
  potion: (c) => {
    const clip = c.id("clip");
    c.defs.push(`<clipPath id="${clip}"><circle cx="48" cy="60" r="24"/></clipPath>`);
    const glass = "#eef8f6";
    return (
      shadow(48, 86, 22, 3.4) +
      `<rect x="39" y="22" width="18" height="20" fill="${glass}" ${S(W)}/>` +
      `<path d="M40 22V12Q40 7.5 44.5 7.5H51.5Q56 7.5 56 12V22Z" fill="${rad(c, WOOD, { hi: PALETTE.logHi, sh: PALETTE.logShade })}" ${S(W)}/>` +
      `<rect x="35.5" y="19.5" width="25" height="7.5" rx="3.6" fill="${glass}" ${S(2.8)}/>` +
      `<circle cx="48" cy="60" r="25" fill="${glass}" ${S(W)}/>` +
      `<g clip-path="url(#${clip})"><path d="M18 58Q33 52 48 58Q63 64 78 57V90H18Z" fill="${rad(c, "#5cbc5e", { hi: "#9fe08a", sh: "#44a04f", cy: 0.15 })}"/>` +
      `<path d="M18 58Q33 52 48 58Q63 64 78 57" fill="none" stroke="#3f8f45" stroke-width="2" opacity=".6"/></g>` +
      `<circle cx="48" cy="60" r="25" fill="none" ${S(W)}/>` +
      `<circle cx="42" cy="71" r="3.2" fill="#fff" opacity=".7"/><circle cx="55" cy="66" r="2.2" fill="#fff" opacity=".7"/><circle cx="52" cy="77" r="2.4" fill="#fff" opacity=".55"/>` +
      `<path d="M30 54Q31.5 45 40 40" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`
    );
  },

  // 먹이: 당근
  carrot: (c) => {
    const leaf = rad(c, LEAF, { hi: "#b4e08a", sh: "#5f9f48" });
    return (
      `<g transform="rotate(35 48 52)">` +
      `<path d="M47 28C39 21 33 13 36 5C43 8 48 17 47 28Z" fill="${leaf}" ${S(2.8)}/>` +
      `<path d="M49 28C49 17 54 7 61 5C62 14 57 21 49 28Z" fill="${leaf}" ${S(2.8)}/>` +
      `<path d="M48 28C43 18 44 9 49 2C54 10 53 19 48 28Z" fill="${leaf}" ${S(2.8)}/>` +
      `<path d="M33 32Q33 24 48 24Q63 24 63 32Q61 52 50.5 84Q48 89 45.5 84Q35 52 33 32Z" fill="${rad(c, "#f28a2e", { hi: "#ffc07a", sh: "#da7020" })}" ${S(W)}/>` +
      `<path d="M37 42H44M52 51H59M40 61H46M50 69H54" stroke="#c4621c" stroke-width="2.4" stroke-linecap="round"/>` +
      gloss(40, 34, 3, 6, 0, 0.35) +
      `</g>`
    );
  },

  // 쓰다듬기: 펼친 손 (손가락 사이 틈, 바깥으로 벌린 엄지)과 작은 하트
  hand: (c) => {
    const skinId = c.id("r");
    c.defs.push(
      `<radialGradient id="${skinId}" gradientUnits="userSpaceOnUse" cx="38" cy="30" r="62">` +
        `<stop offset="0" stop-color="#fff1e4"/><stop offset=".5" stop-color="${PALETTE.skin}"/><stop offset="1" stop-color="#efbd9c"/></radialGradient>`,
    );
    const skin = `url(#${skinId})`;
    const parts: Part[] = [
      ["path", `d="M38 69Q24.5 66.5 16 56.5Q12 51.5 15.6 47.6Q19.4 44.4 24.4 48.6L38 58Z"`, skin],
      ["rect", `x="30" y="22" width="11" height="36" rx="5.5"`, skin],
      ["rect", `x="43" y="15" width="11.5" height="42" rx="5.75"`, skin],
      ["rect", `x="56.5" y="19" width="11" height="38" rx="5.5"`, skin],
      ["rect", `x="69.5" y="30" width="9.5" height="29" rx="4.75"`, skin],
      ["rect", `x="30" y="42" width="49" height="40" rx="16"`, skin],
    ];
    return (
      `<g transform="rotate(-10 48 50)">` +
      solid(parts, 0) +
      `<path d="M42 41V50M55.5 41V50M68.5 43V51" fill="none" ${S(2.2)}/>` +
      `<rect x="31" y="78" width="47" height="11" rx="3.5" fill="${lin(c, ["#9cc8f2", BLUE, "#4a84cc"])}" ${S(W)}/>` +
      gloss(46.5, 23, 2.4, 5, 0, 0.35) +
      `</g>` +
      heart(c, 81, 17, 9, 2.6)
    );
  },

  // 출석: 달력과 빨간 출석 도장
  calendar: (c) => {
    let grid = "";
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) grid += `<rect x="${21 + k * 14}" y="${45 + r * 11}" width="9" height="7" rx="2" fill="#eadbc0"/>`;
    const metal = lin(c, ["#f0ece6", "#c9c3bb", "#a59e96"], 1, 0);
    return (
      `<rect x="12" y="19" width="72" height="66" rx="9" fill="${rad(c, PAPER, { hi: "#ffffff", sh: PAPER_SH })}" ${S(W)}/>` +
      `<path d="M12 37V28Q12 19 21 19H75Q84 19 84 28V37Z" fill="${rad(c, "#e0564c", { hi: "#f58a7d", sh: "#c4463c" })}" ${S(W)}/>` +
      grid +
      `<rect x="26.5" y="10" width="8" height="17" rx="4" fill="${metal}" ${S(2.6)}/>` +
      `<rect x="61.5" y="10" width="8" height="17" rx="4" fill="${metal}" ${S(2.6)}/>` +
      `<g transform="rotate(-12 59 65)"><circle cx="59" cy="65" r="15" fill="#ffe3dd" fill-opacity=".85" stroke="#d9433b" stroke-width="4.4"/>` +
      `<path d="M51.5 65.5L57 71L67 59.5" fill="none" stroke="#d9433b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>` +
      gloss(22, 25, 5, 2, 0, 0.35)
    );
  },

  // 비공개: 금빛 자물쇠
  lock: (c) =>
    tube("M32 46V32Q32 15 48 15Q64 15 64 32V46", "#bdb8b1", 7) +
    `<path d="M33.6 40V32Q33.6 21 42 17.6" fill="none" stroke="#efece7" stroke-width="2.2" stroke-linecap="round"/>` +
    `<rect x="20" y="40" width="56" height="45" rx="10" fill="${rad(c, GOLD, { hi: "#ffe68a", sh: "#df9f26" })}" ${S(W)}/>` +
    `<path d="M27 47H69" stroke="#fff2b8" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>` +
    `<circle cx="48" cy="59" r="6" fill="${ink}"/><path d="M44.8 61L43.2 74Q43 75.6 44.6 75.6H51.4Q53 75.6 52.8 74L51.2 61Z" fill="${ink}"/>`,

  // 로그아웃: 나무 문과 나가는 화살표
  logout: (c) =>
    `<rect x="8" y="80" width="56" height="7" rx="3" fill="${lin(c, [PALETTE.stoneHi, PALETTE.stone, PALETTE.stoneShade])}" ${S(2.6)}/>` +
    `<path d="M13 82V28Q13 11 36 11Q59 11 59 28V82Z" fill="${lin(c, ["#8d5d34", "#7a4d2c", "#664024"], 1, 0)}" ${S(W)}/>` +
    `<path d="M18.5 82V29Q18.5 16.5 36 16.5Q53.5 16.5 53.5 29V82Z" fill="${rad(c, WOOD, { hi: PALETTE.logHi, sh: "#b67a42" })}" ${S(2.4)}/>` +
    `<path d="M30 18.5V82M42 18.5V82" stroke="${PALETTE.logShade}" stroke-width="2.2"/>` +
    `<circle cx="24.5" cy="52" r="3.6" fill="${GOLD}" ${S(2)}/>` +
    `<path d="M49 43H65V33L88 51L65 69V59H49Q45 59 45 55V47Q45 43 49 43Z" fill="${rad(c, "#79bf55", { hi: "#b9e48c", sh: "#62a846" })}" ${S(W)}/>`,

  // 뒤로: 굵은 왼쪽 화살표
  back: (c) =>
    `<path d="M11 48L39.5 19.5Q44.5 15.5 48.8 19.6Q52 22.8 52 27V36H76Q86 36 86 45.5V50.5Q86 60 76 60H52V69Q52 73.2 48.8 76.4Q44.5 80.5 39.5 76.5Z" fill="${rad(c, "#dd9d55", { hi: "#f7cd8f", sh: "#c4854a", cx: 0.3, cy: 0.3 })}" ${S(W)}/>` +
    `<path d="M57 42H76" stroke="#fde3b5" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,

  // 캠프파이어: 돌, 엇갈린 통나무, 불꽃
  campfire: (c) => {
    const stone = rad(c, PALETTE.stone, { hi: PALETTE.stoneHi, sh: PALETTE.stoneShade });
    const log = lin(c, [PALETTE.logHi, WOOD, PALETTE.logShade]);
    const st = (x: number, y: number, rx: number, ry: number) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${stone}" ${S(2.8)}/>`;
    return (
      shadow(48, 84, 38, 5) +
      st(20, 69, 8, 6) + st(76, 69, 8, 6) +
      `<path d="M48 9C55 21 71 30 69 50C68 62 59 71 48 71C37 71 28 62 27 50C26 40 33 34 37 25C39.5 31 43 33 45 29C46.5 23 46.5 17 48 9Z" fill="${rad(c, "#f2722c", { hi: "#ffb24a", sh: "#e05a28", cx: 0.45, cy: 0.35 })}" ${S(W)}/>` +
      `<path d="M48 30C52.5 38 61 44 59 55C58 63 53.5 67 48 67C42.5 67 37.5 63 37.5 56C37.5 49 43 45 44.5 38.5C46.5 42 47.5 38.5 48 30Z" fill="${rad(c, "#ffc63e", { hi: "#fff2b0", sh: "#f39a2c", cy: 0.5 })}"/>` +
      `<ellipse cx="48" cy="59" rx="5.5" ry="7.5" fill="#fff4c4"/>` +
      `<g transform="rotate(-17 48 72)"><rect x="21" y="66" width="54" height="12" rx="6" fill="${log}" ${S(W)}/><ellipse cx="71" cy="72" rx="4.4" ry="6" fill="${PALETTE.logEnd}" ${S(2.2)}/><ellipse cx="71" cy="72" rx="1.8" ry="2.6" fill="none" stroke="${PALETTE.logRing}" stroke-width="1.4"/></g>` +
      `<g transform="rotate(17 48 72)"><rect x="21" y="66" width="54" height="12" rx="6" fill="${log}" ${S(W)}/><ellipse cx="25" cy="72" rx="4.4" ry="6" fill="${PALETTE.logEnd}" ${S(2.2)}/><ellipse cx="25" cy="72" rx="1.8" ry="2.6" fill="none" stroke="${PALETTE.logRing}" stroke-width="1.4"/></g>` +
      st(32, 82, 9, 6) + st(64, 82, 9, 6) + st(48, 85, 8, 5.5)
    );
  },
};

function draw(name: IconName, size: number, id: (p: string) => string): string {
  const c: Ctx = { id, defs: [] };
  const fn = ICONS[name] ?? ICONS.alert;
  ink = INKS[name] ?? INK;
  let body: string;
  try {
    body = fn(c);
  } finally {
    ink = INK;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">` +
    (c.defs.length ? `<defs>${c.defs.join("")}</defs>` : "") +
    body +
    `</svg>`
  );
}

/** 아이콘 SVG 문자열. 한 페이지에 직접 여러 번 넣어도 gradient id가 겹치지 않는다 (uid) */
export function iconSvg(name: IconName, size = 48): string {
  return draw(name, size, uid);
}

const uriCache = new Map<string, string>();
/** <img src>용 data URI. 그림마다 따로 문서가 되므로 id를 고정해 서버·브라우저 결과가 같다 (hydration) */
export function iconDataUri(name: IconName, size = 48): string {
  const key = `${name}:${size}`;
  let uri = uriCache.get(key);
  if (!uri) {
    let n = 0;
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(draw(name, size, (p) => `${p}${n++}`))}`;
    uriCache.set(key, uri);
  }
  return uri;
}
