// 미니룸 가구 그림 (SHOP-05). 외부 그림 없이 코드로 그린 SVG (2026-10-08 디자인 시안 ② 꾸미기 아이템).
// 3/4 내려다보기, 빛은 왼쪽 위: 바탕·그늘(오른쪽 아래)·밝은 면(왼쪽 위) 세 톤. 칠은 무광(흰 반사점은 흰 사기 화분에만).
// 선: 그림의 바깥 테두리는 굵은 짙은 갈색(OUTLINE, LW), 한 물건 안의 면 경계(의자 판 윗면·앞면, 서랍, 시트·이불 접힘)는
// 가늘고 옅은 갈색(INNER, LW_IN). 그래야 작게 보여도 면이 한 덩어리로 뭉개지지 않고, 스티커를 겹친 것처럼 보이지 않는다.
// 좌표는 화면 크기(w·h)의 2배 단위로 그린다 (style.ts 규칙, 선 굵기도 2배 기준).
// 가구마다 상자 크기가 다르고, 미니룸 높이에 대한 비율(heightPct)로 크기를 정한다.
// 그래서 휴대폰처럼 좁은 화면에서도 미니룸 높이가 같으면 같은 크기로 보인다.
// 미니룸은 상자의 가운데를 가구 위치(x·y)에 놓는다 (components/character.tsx의 MiniRoom). 상자 비율 = (w+4)/(h+4).
// DB의 asset_key("furn.chair" 등)로 고른다.
// gradient·clipPath id는 가구 이름으로 고정한다: 서버와 브라우저가 같은 data URI를 만들어야 hydration이 어긋나지 않는다
// (style.ts의 uid()는 모듈 전체 순번이라 서버와 브라우저에서 값이 달라질 수 있다).
import { OUTLINE, S, lighten } from "./style";

type P = [number, number];
type Tone = { hi: string; base: string; sh: string };
/** 그림 하나를 그리는 동안의 defs(그라디언트·흐림) 모음과 고정 id 생성기 */
type Ctx = { id: (p: string) => string; defs: string[]; blur: (sd: number) => string; grass: boolean };
type Furniture = { w: number; h: number; heightPct: number; draw: (c: Ctx) => string };

/* ───────────── 공통 도우미 ───────────── */
const n1 = (v: number) => Math.round(v * 10) / 10;
const pt = (q: P) => `${n1(q[0])} ${n1(q[1])}`;
const LW = 2.8; // 바깥 테두리
const LW_IN = 1.6; // 안쪽 선
const INNER = "#7a4f30"; // 안쪽 선 색 (테두리보다 밝은 갈색)

/** 모서리를 둥글린 다각형 경로 */
function roundPoly(pts: P[], r: number | number[] = 3): string {
  const N = pts.length;
  let d = "";
  for (let i = 0; i < N; i++) {
    const p = pts[(i - 1 + N) % N], v = pts[i], q = pts[(i + 1) % N];
    const rr = Array.isArray(r) ? r[i] : r;
    const l1 = Math.hypot(p[0] - v[0], p[1] - v[1]) || 1, l2 = Math.hypot(q[0] - v[0], q[1] - v[1]) || 1;
    const k1 = Math.min(rr, l1 / 2) / l1, k2 = Math.min(rr, l2 / 2) / l2;
    const a = [v[0] + (p[0] - v[0]) * k1, v[1] + (p[1] - v[1]) * k1];
    const b = [v[0] + (q[0] - v[0]) * k2, v[1] + (q[1] - v[1]) * k2];
    d += `${i === 0 ? "M" : "L"}${n1(a[0])} ${n1(a[1])} Q${n1(v[0])} ${n1(v[1])} ${n1(b[0])} ${n1(b[1])} `;
  }
  return d + "Z";
}
const rectD = (x: number, y: number, w: number, h: number, r: number | number[] = 3) =>
  roundPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
const poly = (pts: P[]) => "M" + pts.map(pt).join("L") + "Z";

/** 점들을 부드럽게 잇는 곡선 (Catmull-Rom → 3차 베지어). 현재 점이 pts[0]이라고 보고 C 명령만 만든다 */
function smooth(pts: P[]): string {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
  }
  return d;
}

function newCtx(key: string, grass: boolean): Ctx {
  const prefix = key.replace(/[^a-z0-9]/gi, "") + (grass ? "g" : "");
  let n = 0;
  const defs: string[] = [];
  const blurs = new Map<number, string>();
  return {
    defs,
    grass,
    id: (p) => `${prefix}-${p}${(n++).toString(36)}`,
    blur(sd) {
      let id = blurs.get(sd);
      if (!id) {
        id = `${prefix}-b${blurs.size}`;
        blurs.set(sd, id);
        defs.push(`<filter id="${id}" filterUnits="userSpaceOnUse" x="-40" y="-40" width="320" height="260" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${sd}"/></filter>`);
      }
      return `filter="url(#${id})"`;
    },
  };
}

const stopsOf = (stops: [number, string][]) => stops.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join("");
/** 선형 그라디언트 (도형 상자 기준 0~1 좌표) */
function lin(c: Ctx, stops: [number, string][], x1 = 0, y1 = 0, x2 = 1, y2 = 1): string {
  const id = c.id("g");
  c.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsOf(stops)}</linearGradient>`);
  return `url(#${id})`;
}
/** 선형 그라디언트 (그림 좌표 기준: 잎처럼 방향이 제각각인 면) */
function linAt(c: Ctx, stops: [number, string][], a: P, b: P): string {
  const id = c.id("g");
  c.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}">${stopsOf(stops)}</linearGradient>`);
  return `url(#${id})`;
}
/** 원형 그라디언트 (도형 상자 기준) */
function rad(c: Ctx, stops: [number, string][], cx = 0.35, cy = 0.3, r = 0.8): string {
  const id = c.id("g");
  c.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stopsOf(stops)}</radialGradient>`);
  return `url(#${id})`;
}
/** 세 톤: 왼쪽(밝은 면) → 바탕 → 오른쪽(그늘) */
const across = (c: Ctx, t: Tone, mid = 0.42) => lin(c, [[0, t.hi], [mid, t.base], [1, t.sh]], 0, 0, 1, 0);
/** 세 톤: 왼쪽 위 → 오른쪽 아래 */
const diag = (c: Ctx, t: Tone, mid = 0.5) => lin(c, [[0, t.hi], [mid, t.base], [1, t.sh]], 0, 0, 1, 1);
/** 세 톤: 위 → 아래 */
const down = (c: Ctx, t: Tone, mid = 0.5) => lin(c, [[0, t.hi], [mid, t.base], [1, t.sh]], 0, 0, 0, 1);

/** 경로 d 안으로 잘라 그리기 */
function clipTo(c: Ctx, d: string, inner: string): string {
  const id = c.id("c");
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`;
}
/** 칠한 면 하나: 바탕 → (면 안으로 잘라낸) 명암·결 → 바깥 테두리 (w = 0이면 테두리 없이) */
function face(c: Ctx, d: string, fill: string, inner = "", w = LW): string {
  return `<path d="${d}" fill="${fill}"/>` + (inner ? clipTo(c, d, inner) : "") + (w ? `<path d="${d}" fill="none" ${S(w)}/>` : "");
}
/** 안쪽 선 (가늘고 옅은 갈색) */
const inl = (d: string, w = LW_IN, opacity = 0.85) =>
  `<path d="${d}" fill="none" stroke="${INNER}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
/** 바깥 테두리를 먼저 두 배 굵기로 깐다. 뒤에 칠하는 면들이 안쪽 절반을 덮어서 겹친 면들의 바깥 둘레에만 굵은 선이 남는다 */
const sil = (ds: string[], w = LW) =>
  ds.map((d) => `<path d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${w * 2}" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
/** 흐림으로 부드럽게 얹는 명암 조각 */
const dab = (c: Ctx, d: string, color: string, opacity: number, sd = 2.4) =>
  `<path d="${d}" fill="${color}" opacity="${opacity}" ${c.blur(sd)}/>`;
/** 작은 흰 반사점 (흰 사기 화분에만) */
const spec = (x: number, y: number, r = 1.4) =>
  `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.8)}" fill="#fff" opacity=".9"/>`;
/** 흐린 붓 자국 (곡선도 된다) */
const softLine = (c: Ctx, d: string, color: string, w: number, opacity: number, sd = 0.8) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${opacity}" ${c.blur(sd)}/>`;

/* ───────────── 바닥 ───────────── */
/** 풀밭 조각: 시안 썸네일처럼 물건 발자국보다 1.3~2배 넓은 연둣빛 타원, 그 가운데 물건이 선다 */
type Patch = { cx: number; cy: number; rx: number; ry: number; rot?: number; tufts?: [number, number, number][]; dots?: P[] };
const shadowEl = (c: Ctx, cx: number, cy: number, rx: number, ry: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#3b2a1a" opacity=".2" ${c.blur(2.2)}/>`;
/** 바닥: 기본은 흐린 그림자(shadow), grass면 풀밭 조각 */
function floor(c: Ctx, shadow: string, p: Patch): string {
  if (!c.grass) return shadow;
  const tf = p.rot ? ` transform="rotate(${p.rot} ${p.cx} ${p.cy})"` : "";
  const g = rad(c, [[0, "#d4dc8c"], [0.7, "#c8d77e"], [1, "#bccf72"]], 0.45, 0.4, 0.62);
  // 둥근 풀잎 (테두리 없이)
  const blade = (x: number, y: number, s: number, dx: number, h: number, lean: number, col: string) =>
    `<path d="M${n1(x + dx * s)} ${y}q${n1(lean * s * 0.2)} ${n1(-h * s * 0.6)} ${n1(lean * s)} ${n1(-h * s)}" fill="none" stroke="${col}" stroke-width="${n1(3.2 * s)}" stroke-linecap="round"/>`;
  const tuft = ([x, y, s]: [number, number, number]) =>
    blade(x, y, s, -3.4, 5.5, -1.8, "#a6cb6e") + blade(x, y, s, 0, 8.5, 0.6, "#98c264") + blade(x, y, s, 3.2, 6.5, 2, "#a9cd72");
  const dots = (p.dots ?? []).map(([x, y], i) =>
    `<ellipse cx="${x}" cy="${y}" rx="1.5" ry="1.2" fill="${i % 3 === 2 ? "#b8975f" : "#8fb45c"}" opacity=".85"/>`).join("");
  return (
    `<g${tf}><ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${g}" ${c.blur(0.6)}/>` +
    `<ellipse cx="${p.cx}" cy="${n1(p.cy + p.ry * 0.12)}" rx="${n1(p.rx * 0.6)}" ry="${n1(p.ry * 0.5)}" fill="#9dbb5e" opacity=".5" ${c.blur(2.6)}/></g>` +
    (p.tufts ?? []).map(tuft).join("") +
    dots
  );
}

/* ───────────── 잎 ───────────── */
type LeafOpt = {
  /** 잎맥(3차 곡선)의 조절점: 끝 쪽 조절점으로 잎 끝을 말아 내릴 수 있다 */
  c1: P;
  c2: P;
  /** 가장 넓은 곳의 반폭 */
  w: number;
  /** 가장 넓은 곳의 위치 (밑동 0 ~ 끝 1) */
  peak?: number;
  /** 끝 모양: 1 이상은 뾰족, 0.5쯤이면 둥근 끝 */
  blunt?: number;
  /** 밑동 줄기의 반폭 */
  stalk?: number;
  lit?: Tone;
  dim?: Tone;
  line?: number;
};
// 잎: 빛 받는 반쪽은 노란 연두, 그늘 반쪽은 짙은 청록 (시안 #8ec05f / #2b834d)
const LEAF_LIT: Tone = { hi: "#acd472", base: "#8ec05f", sh: "#5a9444" };
const LEAF_DIM: Tone = { hi: "#46985a", base: "#2f7f45", sh: "#1c5631" };

/** 잎 하나. B 밑동, T 끝. 잎맥을 경계로 왼쪽 위를 보는 반쪽을 밝게 칠한다 */
function leaf(c: Ctx, B: P, T: P, o: LeafOpt): string {
  const { c1, c2, w, peak = 0.58, blunt = 1.15, stalk = 1.5, lit = LEAF_LIT, dim = LEAF_DIM, line = 2.4 } = o;
  const cub = (t: number): P => {
    const u = 1 - t;
    return [u * u * u * B[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * T[0], u * u * u * B[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * T[1]];
  };
  const der = (t: number): P => {
    const u = 1 - t;
    return [3 * u * u * (c1[0] - B[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (T[0] - c2[0]), 3 * u * u * (c1[1] - B[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (T[1] - c2[1])];
  };
  const pw = Math.log(0.5) / Math.log(peak);
  const width = (t: number) => stalk * (1 - t) ** 2 + w * Math.sin(Math.PI * t ** pw) ** blunt;
  const N = 26;
  const mid: P[] = [], A: P[] = [], Bs: P[] = [];
  let litA = true;
  for (let i = 0; i <= N; i++) {
    const t = (1 - Math.cos((Math.PI * i) / N)) / 2; // 양 끝을 촘촘하게
    const m = cub(t), d = der(t), L = Math.hypot(d[0], d[1]) || 1;
    const nx = -d[1] / L, ny = d[0] / L, f = width(t);
    if (i === N / 2) litA = nx * -0.45 + ny * -1 > 0;
    mid.push(m);
    A.push([m[0] + nx * f, m[1] + ny * f]);
    Bs.push([m[0] - nx * f, m[1] - ny * f]);
  }
  const rev = (a: P[]) => [...a].reverse();
  const outline = `M${pt(A[0])}${smooth(A)}${smooth(rev(Bs))}Z`;
  const halfA = `M${pt(A[0])}${smooth(A)}${smooth(rev(mid))}Z`;
  const halfB = `M${pt(mid[0])}${smooth(mid)}${smooth(rev(Bs))}Z`;
  const fillLit = linAt(c, [[0, lit.sh], [0.42, lit.base], [1, lit.hi]], B, T);
  const fillDim = linAt(c, [[0, dim.sh], [0.45, dim.base], [1, dim.hi]], B, T);
  const side = litA ? A : Bs;
  const glow = [0.45, 0.6, 0.75].map((k) => {
    const i = Math.round(N * k);
    return [mid[i][0] + (side[i][0] - mid[i][0]) * 0.45, mid[i][1] + (side[i][1] - mid[i][1]) * 0.45] as P;
  });
  return (
    `<path d="${litA ? halfB : halfA}" fill="${fillDim}"/><path d="${litA ? halfA : halfB}" fill="${fillLit}"/>` +
    clipTo(
      c,
      outline,
      `<circle cx="${n1(B[0])}" cy="${n1(B[1])}" r="${n1(w * 1.5)}" fill="#123d22" opacity=".45" ${c.blur(2.4)}/>` + // 밑동 그늘
        softLine(c, `M${pt(glow[0])}${smooth(glow)}`, lighten(lit.hi, 0.3), 2, 0.4, 0.6),
    ) +
    `<path d="M${pt(mid[3])}${smooth(mid.slice(3, N - 2))}" fill="none" stroke="#215a35" stroke-width="1.1" stroke-linecap="round" opacity=".5"/>` +
    `<path d="${outline}" fill="none" ${S(line)}/>`
  );
}

/** 둥근 기둥(침대 기둥): 몸통 + 조금 넓은 둥근 머리(돔) */
function post(c: Ctx, cx: number, top: number, bottom: number, w: number, t: Tone): string {
  const body = rectD(cx - w / 2, top + 3, w, bottom - top - 3, [0, 0, 3, 3]);
  const r = w / 2 + 1.8;
  const cap = `M${n1(cx - r)} ${top + 4.5}L${n1(cx - r)} ${top + 0.5}Q${n1(cx - r)} ${top - 4} ${cx} ${top - 4}Q${n1(cx + r)} ${top - 4} ${n1(cx + r)} ${top + 0.5}L${n1(cx + r)} ${top + 4.5}Q${cx} ${top + 7} ${n1(cx - r)} ${top + 4.5}Z`;
  return (
    sil([body, cap]) +
    face(c, body, across(c, t, 0.38), softLine(c, `M${cx - w / 2 + 3} ${top + 10}V${bottom - 5}`, t.hi, 2.4, 0.7) + dab(c, rectD(cx + w / 2 - 3.5, top, 5, bottom - top), t.sh, 0.55, 1.6), 0) +
    face(c, cap, rad(c, [[0, lighten(t.hi, 0.2)], [0.45, t.hi], [0.8, t.base], [1, t.sh]], 0.38, 0.25, 0.85), dab(c, `M${cx + r - 4} ${top - 6}h8v14h-8z`, t.sh, 0.45, 1.6), 0) +
    inl(`M${n1(cx - w / 2 + 0.6)} ${top + 5.6}Q${cx} ${top + 7.4} ${n1(cx + w / 2 - 0.6)} ${top + 5.6}`, 1.4, 0.7)
  );
}

/* ───────────── 색 ───────────── */
// 원목 (시안의 밝은 캐러멜 나무색)
const WOOD: Tone = { hi: "#e9b878", base: "#d29858", sh: "#ae6f3b" };
const WOOD_TOP: Tone = { hi: "#f0c68a", base: "#ddaa68", sh: "#c38a4f" }; // 위를 보는 면 (의자 판, 책상 윗면)
const WOOD_SIDE: Tone = { hi: "#c08048", base: "#ac6c3a", sh: "#8c552d" }; // 그늘진 옆면
const WOOD_BACK: Tone = { hi: "#b9794a", base: "#a3683b", sh: "#86522c" }; // 뒤쪽 다리
const POT: Tone = { hi: "#efa56c", base: "#e3925c", sh: "#c4724a" }; // 테라코타
const SHADE: Tone = { hi: "#fff7dc", base: "#fde9b6", sh: "#f5cf8c" }; // 램프 갓
const METAL: Tone = { hi: "#c4ae9f", base: "#a58f81", sh: "#7a6151" }; // 램프 기둥
const PINK: Tone = { hi: "#fbb2a6", base: "#f49a92", sh: "#e5807f" }; // 침대 이불 (산호빛 분홍)
const LINEN: Tone = { hi: "#ffffff", base: "#fcf6ea", sh: "#eadfcf" }; // 침대 시트·베개
const CERAMIC: Tone = { hi: "#ffffff", base: "#f3f3f0", sh: "#c9d0d4" }; // 책상 위 흰 화분 (차가운 회색 그늘)

/* ───────────── 가구 ───────────── */
// 화분: 위에서 내려다본 원통형 테라코타 화분, 굽은 잎맥으로 부채처럼 펼친 넓은 잎 네 장 (상자 80×112)
function plant(c: Ctx): string {
  let o = floor(c, shadowEl(c, 40, 109.5, 23, 4), { cx: 40, cy: 103.5, rx: 41, ry: 11.5, tufts: [[6, 101, 1], [74, 100.5, 0.9]], dots: [[12, 108.5], [15.5, 109.8], [67, 109.5]] });
  // 화분 몸통: 아래가 좁고 바닥이 둥글게 처진다
  const body = "M16.3 75L63.7 75L59.4 104.5Q58.8 107.8 55 108.6Q40 111.8 25 108.6Q21.2 107.8 20.6 104.5Z";
  // 화분 테: 윗면은 타원, 아랫변도 앞으로 둥글게 처진다
  const rim = "M11.5 68A28.5 6 0 0 1 68.5 68L68.5 77.5Q40 85.5 11.5 77.5Z";
  o += sil([body, rim]);
  o += face(
    c,
    body,
    across(c, POT, 0.42),
    dab(c, "M10 72H70V84Q40 90 10 84Z", POT.sh, 0.6, 2.2) + // 테 아래 그늘
      dab(c, poly([[53, 74], [70, 74], [64, 114], [50, 114]]), POT.sh, 0.7, 2.8) + // 오른쪽 그늘
      dab(c, poly([[47, 86], [51, 86], [49.5, 104], [46, 104]]), POT.hi, 0.25, 1.6) + // 반사광
      dab(c, "M14 103Q40 108 66 103V114H14Z", POT.sh, 0.35, 2) + // 바닥 쪽 그늘
      softLine(c, "M25.5 87L27.5 102", lighten(POT.hi, 0.2), 3, 0.6, 0.9),
    0,
  );
  o += face(
    c,
    rim,
    lin(c, [[0, "#eba066"], [0.45, "#dc884b"], [1, "#c27646"]], 0, 0, 1, 0),
    dab(c, "M8 76Q40 84 72 76V90H8Z", POT.sh, 0.55, 1.8) + dab(c, rectD(59, 60, 14, 26), POT.sh, 0.45, 2.2) + softLine(c, "M17 77Q24 79.5 31 80", lighten(POT.hi, 0.2), 2.2, 0.55),
    0,
  );
  o += inl("M16 78.7Q40 84.3 64 78.7"); // 테와 몸통 사이
  // 테 윗면 (뒤쪽 테두리가 밝게 보이고, 입구는 그 안쪽으로 들어가 있다)
  o += `<ellipse cx="40" cy="68" rx="28.5" ry="6" fill="${lin(c, [[0, "#f3b47c"], [0.5, "#e69a60"], [1, "#cd7f4c"]], 0, 0, 1, 0)}"/>`;
  o += inl("M11.5 68A28.5 6 0 0 0 68.5 68", 1.3, 0.45); // 윗면과 테 앞면 사이
  // 입구 (그늘진 흙)
  o += `<ellipse cx="40" cy="69.6" rx="21" ry="3.8" fill="${lin(c, [[0, "#4f2b17"], [0.6, "#673a21"], [1, "#82502f"]], 0, 0, 0, 1)}"/>`;
  o += inl("M19 69.6A21 3.8 0 0 1 61 69.6A21 3.8 0 0 1 19 69.6", 1.9, 0.95);
  // 잎: 좁은 줄기가 흙 가운데에서 나오고, 입구 앞쪽 테 뒤로 밑동이 들어간다
  o += clipTo(
    c,
    "M-10 -10H94V69.6H61A21 3.8 0 0 1 19 69.6H-10Z",
    leaf(c, [39.5, 72], [37, 2.5], { c1: [40.5, 50], c2: [35, 22], w: 12, peak: 0.55 }) + // 가운데
      leaf(c, [37, 72.5], [1.5, 35], { c1: [33, 55], c2: [17, 35], w: 11.5 }) + // 왼쪽 (45°)
      leaf(c, [41.5, 72], [73, 22], { c1: [44, 54], c2: [59, 31], w: 11 }) + // 오른쪽 위 (55°)
      leaf(c, [43, 73], [81, 61], { c1: [49, 50], c2: [71, 49], w: 10 }), // 오른쪽 아래: 거의 눕고 끝이 아래로 말린다
  );
  return o;
}

// 의자: 둥근 등받이에 판자 결, 두꺼운 방석 판, 바깥으로 살짝 벌어진 네 다리 (상자 88×120)
function chair(c: Ctx): string {
  let o = floor(c, shadowEl(c, 45, 113.5, 38, 5.5), { cx: 45, cy: 109.5, rx: 46, ry: 12, tufts: [[5.5, 106, 1], [85, 104.5, 0.85]], dots: [[11, 116], [14.5, 117.2], [79, 116.5]] });
  // 등받이
  const back = roundPoly([[19, 1], [72, 1], [72, 62], [19, 62]], [14, 14, 0, 0]);
  o += face(
    c,
    back,
    diag(c, WOOD, 0.55),
    dab(c, rectD(61, -4, 16, 70), WOOD.sh, 0.5, 3) +
      dab(c, rectD(14, 42, 64, 30), WOOD.sh, 0.3, 4) +
      softLine(c, "M24.5 12V46", WOOD.hi, 3, 0.55) +
      inl("M37 5V59M55 5V59", 1.2, 0.42), // 판자 사이 (가늘고 옅게)
  );
  // 뒷다리 (그늘 쪽이라 어둡게, 아래가 바깥으로 살짝 벌어진다)
  const bleg = (x: number, dx: number, h: number) =>
    face(c, roundPoly([[x, 76], [x + 9.5, 76], [x + 9.5 + dx, 76 + h], [x + dx, 76 + h]], [0, 0, 3, 3]), across(c, WOOD_BACK));
  o += bleg(27, -0.8, 26) + bleg(72.5, 0.8, 28);
  // 앞다리 (아래로 조금 가늘어지고 바깥으로 1.5만큼 벌어진다)
  const leg = (x: number, dx: number) =>
    face(
      c,
      roundPoly([[x, 76], [x + 15, 76], [x + 13.5 + dx, 116], [x + 1.5 + dx, 116]], [0, 0, 3.5, 3.5]),
      across(c, WOOD, 0.4),
      softLine(c, `M${x + 4.3} 86L${n1(x + 4.3 + dx * 0.8)} 110`, WOOD.hi, 2.2, 0.6) + dab(c, rectD(x + 11 + dx / 2, 70, 7, 50), WOOD.sh, 0.55, 1.8) + dab(c, rectD(x - 2, 72, 20, 12), WOOD_SIDE.sh, 0.6, 2.4),
    );
  o += leg(8, -1.5) + leg(62, 1.5);
  // 방석 판: 한 덩어리 테두리 안에 윗면(밝게)과 앞면(조금 어둡게), 둘 사이는 둥근 모서리라 가는 선
  const slab = roundPoly([[11, 54], [79, 54], [85, 68], [85, 81], [4, 81], [4, 68]], [8, 8, 3, 6, 6, 3]);
  const top = roundPoly([[11, 54], [79, 54], [85.5, 69], [3.5, 69]], [8, 8, 6, 6]);
  o += face(
    c,
    slab,
    lin(c, [[0, "#dba264"], [0.5, "#cb8c50"], [1, "#a96c3c"]], 0, 0, 1, 0),
    dab(c, rectD(0, 77, 90, 9), WOOD.sh, 0.6, 2.2) + dab(c, rectD(76, 60, 14, 26), WOOD.sh, 0.5, 2.2) + softLine(c, "M11 72.2Q44 73.6 77 72.2", lighten(WOOD.hi, 0.15), 2.4, 0.45, 1),
    0,
  );
  o += face(
    c,
    top,
    lin(c, [[0, WOOD_TOP.hi], [0.55, WOOD_TOP.base], [1, WOOD_TOP.sh]], 0, 0, 1, 0.4),
    dab(c, poly([[72, 50], [92, 50], [92, 72], [74, 72]]), WOOD.sh, 0.45, 2.6) +
      softLine(c, "M15 60L30 59.6", lighten(WOOD_TOP.hi, 0.3), 2.2, 0.6) +
      inl("M30 63.5h8M50 59.5h6", 1.1, 0.35),
    0,
  );
  o += inl("M4.4 66Q5.4 69.4 10.5 69.4L78.5 69.4Q83.6 69.4 84.6 66");
  o += `<path d="${slab}" fill="none" ${S(LW)}/>`;
  return o;
}

// 램프: 크림색 갓(위 구멍에 밝은 테), 기둥, 줄 손잡이, 두꺼운 받침 (상자 80×168)
function lamp(c: Ctx): string {
  let o = floor(c, shadowEl(c, 40, 161, 28, 4.5), { cx: 40, cy: 156, rx: 41, ry: 12, tufts: [[6, 152, 1], [74, 151, 0.9]], dots: [[12, 162], [15.5, 163.2], [68, 162.5]] });
  // 줄 손잡이 (갓 아래에서 나온다)
  o += `<path d="M58.2 80L58.6 99" stroke="${OUTLINE}" stroke-width="1.8" stroke-linecap="round"/>`;
  const bead = "M58.6 98.2C60.2 101.4 64.3 103.8 64.3 108C64.3 111.6 61.7 113.9 58.6 113.9C55.5 113.9 52.9 111.6 52.9 108C52.9 103.8 57 101.4 58.6 98.2Z";
  o += face(c, bead, rad(c, [[0, "#f6c06a"], [0.5, "#e39b42"], [1, "#b56d29"]], 0.35, 0.45, 0.75), `<ellipse cx="56.4" cy="106.6" rx="1.6" ry="2.4" fill="#fbd99a" opacity=".6" ${c.blur(0.6)}/>`, 2);
  // 받침: 옆면(어둡게) → 윗면, 둘 사이는 가는 선
  const baseSil = "M13 146A27 7 0 0 1 67 146L67 156A27 7 0 0 1 13 156Z";
  o += face(
    c,
    baseSil,
    across(c, { hi: "#8f7565", base: "#7a6152", sh: "#5f4b3f" }, 0.4),
    `<ellipse cx="40" cy="146" rx="27" ry="7" fill="${lin(c, [[0, "#ad9585"], [0.5, "#937969"], [1, "#765f51"]], 0, 0, 1, 1)}"/>` +
      softLine(c, "M20 145.5Q26 142 34 141.2", lighten(METAL.hi, 0.1), 2.2, 0.5) +
      inl("M13 146A27 7 0 0 0 67 146", LW_IN, 0.8),
    0,
  );
  o += `<ellipse cx="40" cy="146.6" rx="9.5" ry="2.8" fill="#4d3a2f" opacity=".35" ${c.blur(0.8)}/>`; // 기둥이 받침에 닿는 그늘
  o += `<path d="${baseSil}" fill="none" ${S(LW)}/>`;
  // 기둥
  o += face(
    c,
    "M33 76H47V146.2Q40 149.2 33 146.2Z", // 아랫변은 받침 윗면을 따라 둥글게
    across(c, METAL, 0.4),
    softLine(c, "M37 88V140", METAL.hi, 2.4, 0.7) + dab(c, rectD(43.5, 70, 6, 80), METAL.sh, 0.65, 1.4) + dab(c, rectD(28, 72, 24, 14), METAL.sh, 0.8, 2.4),
  );
  // 갓: 위는 좁고 아래는 넓은 원뿔, 아랫단은 가운데가 둥글게 처진다
  const shadeD = "M17 6A23 5.5 0 0 1 63 6L78.2 69.5Q80.2 75.5 74.3 76.5Q40 91 5.7 76.5Q-0.2 75.5 1.8 69.5Z";
  o += face(
    c,
    shadeD,
    across(c, SHADE, 0.38),
    dab(c, poly([[57, 0], [84, 0], [84, 90], [66, 90]]), SHADE.sh, 0.75, 3.2) + // 오른쪽 그늘
      dab(c, "M0 69Q40 84 80 69L80 96L0 96Z", SHADE.sh, 0.55, 2.6) + // 아랫단 그늘
      dab(c, poly([[15, 11], [23, 11], [11, 70], [4, 70]]), SHADE.hi, 0.95, 2) + // 왼쪽 밝은 면
      `<path d="M31 12.5L26 80M49 12.5L54 82M60 14L69.5 76" fill="none" stroke="#efcf8e" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>` +
      // 위 테 (밝은 띠) → 구멍 (안쪽은 따뜻한 주황 그늘)
      `<ellipse cx="40" cy="6" rx="23" ry="5.5" fill="#fff3d2"/>` +
      `<ellipse cx="40" cy="6.7" rx="19" ry="3.6" fill="${lin(c, [[0, "#d98f43"], [1, "#f2c374"]], 0, 0, 0, 1)}"/>` +
      inl("M21 6.7A19 3.6 0 0 1 59 6.7A19 3.6 0 0 1 21 6.7", 1.5, 0.75) +
      inl("M17 6A23 5.5 0 0 0 63 6", 1.3, 0.5),
  );
  return o;
}

// 책상: 두꺼운 원목 상판, 왼쪽 다리, 오른쪽 서랍 두 칸, 위에 작은 흰 화분 (상자 180×120)
function desk(c: Ctx): string {
  let o = floor(c, shadowEl(c, 88, 116, 76, 5.5), { cx: 88, cy: 111, rx: 90, ry: 12.5, tufts: [[8, 109, 1], [170, 106, 0.9]], dots: [[24, 119], [27.5, 120.2], [150, 119.5]] });
  // 왼쪽 뒷다리 (어둡게, 가로대 뒤)
  o += face(c, rectD(38.5, 70, 11, 32, [0, 0, 3, 3]), across(c, WOOD_BACK));
  // 앞쪽 가로대 (다리와 서랍장 사이, 상판 아래로 들어가 있어 어둡다)
  o += face(c, rectD(30, 62, 60, 12.5, 0), down(c, { hi: "#c78a52", base: "#b77745", sh: "#9c6137" }, 0.45), dab(c, rectD(26, 59, 68, 6), WOOD_SIDE.sh, 0.75, 2));
  // 서랍장 옆면 (아래는 앞발·뒷발 사이가 파였다)
  const side = "M137 64L158.3 44.8L158.3 99L155 102Q150.5 100.2 144.5 106.6Q142.2 109.2 142.2 113.2L137 117.6Z";
  o += face(c, side, down(c, WOOD_SIDE, 0.45), dab(c, poly([[137, 64], [160, 43], [160, 54], [137, 75]]), WOOD_SIDE.sh, 0.7, 2.4) + softLine(c, "M140.5 68V111", WOOD_SIDE.hi, 2, 0.5));
  // 서랍장 앞면 → 서랍 두 칸 (서랍 테두리는 가는 선) → 받침 발
  o += face(c, rectD(124.5, 112.5, 13, 5.5, [0, 0, 2, 2]), across(c, WOOD_SIDE), "", 2.4);
  o += face(c, rectD(89.5, 112.5, 9, 5.5, [0, 0, 2, 2]), across(c, WOOD_SIDE), "", 2.4);
  const front = rectD(88.5, 62, 48.5, 51.5, [0, 0, 2, 2]);
  o += face(c, front, diag(c, WOOD, 0.55), dab(c, rectD(84, 59, 58, 9), WOOD.sh, 0.75, 2.4) + dab(c, rectD(131, 58, 10, 60), WOOD.sh, 0.4, 2));
  const drawer = (y: number, h: number, hw: number) =>
    face(c, rectD(91.5, y, 42.5, h, 2.5), diag(c, WOOD, 0.5), softLine(c, `M95 ${y + 4.5}V${y + h - 4}`, WOOD.hi, 2, 0.55) + dab(c, rectD(88, y + h - 4, 50, 8), WOOD.sh, 0.45, 2), 0) +
    inl(rectD(91.5, y, 42.5, h, 2.5)) +
    `<rect x="${n1(112.75 - hw / 2)}" y="${n1(y + h / 2 - 2.6)}" width="${hw}" height="5.2" rx="2.6" fill="#7b4a2a" ${S(1.8)}/>` +
    `<path d="M${n1(112.75 - hw / 2 + 2.6)} ${n1(y + h / 2 + 1.2)}h${n1(hw - 5.2)}" stroke="${WOOD.hi}" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>`;
  o += drawer(65.5, 21, 12.5) + drawer(89, 22, 11);
  // 왼쪽 앞다리
  o += face(
    c,
    roundPoly([[19.8, 60], [33.6, 60], [33.2, 116], [20.2, 116]], [0, 0, 3.5, 3.5]),
    across(c, WOOD, 0.4),
    softLine(c, "M24 72L24.3 110", WOOD.hi, 2.4, 0.65) + dab(c, rectD(30.5, 56, 6, 64), WOOD.sh, 0.6, 1.6) + dab(c, rectD(16, 58, 22, 12), WOOD.sh, 0.7, 2.2),
  );
  // 상판: 한 덩어리 테두리 안에 윗면·앞면·오른쪽 옆면 (면 사이는 가는 선, 모서리 둥글기가 맞물린다)
  const FL: P = [15, 53.7], FR: P = [140, 53.7], BR: P = [161.3, 34.5], BL: P = [38.5, 34.5], dz = 10.3;
  const slab = roundPoly([BL, BR, [BR[0], BR[1] + dz], [FR[0], FR[1] + dz], [FL[0], FL[1] + dz], FL], [4, 3, 2.5, 2, 2.5, 3]);
  o += clipTo(
    c,
    slab,
    face(c, poly([FR, BR, [BR[0], BR[1] + dz], [FR[0], FR[1] + dz]]), down(c, WOOD_SIDE), "", 0) +
      face(
        c,
        poly([FL, FR, [FR[0], FR[1] + dz], [FL[0], FL[1] + dz]]),
        across(c, WOOD, 0.5),
        dab(c, rectD(0, 61, 155, 6), WOOD.sh, 0.45, 1.6) + softLine(c, "M20 58.5L52 58.5", WOOD.hi, 2, 0.6) + inl("M60 59.5h9", 1.2, 0.45),
        0,
      ) +
      face(
        c,
        poly([BL, BR, FR, FL]),
        lin(c, [[0, WOOD_TOP.hi], [0.5, WOOD_TOP.base], [1, WOOD_TOP.sh]], 0, 0, 1, 0.3),
        dab(c, poly([[128, 30], [170, 30], [152, 58], [118, 58]]), WOOD.sh, 0.3, 3) +
          softLine(c, "M24 49.5L58 49", lighten(WOOD_TOP.hi, 0.3), 2.2, 0.6) +
          inl("M66 40.5h20M126 46h12M44 44h9", 1.1, 0.4),
        0,
      ),
  );
  o += inl(`M${FL[0] + 1.5} ${FL[1]}L${FR[0]} ${FR[1]}L${BR[0] - 1.2} ${BR[1] + 1.1}M${FR[0]} ${FR[1]}V${FR[1] + dz - 0.8}`, 1.9, 0.9);
  o += `<path d="${slab}" fill="none" ${S(LW)}/>`;
  // 흰 화분의 그림자
  o += `<ellipse cx="104.5" cy="45" rx="15" ry="3" fill="${WOOD.sh}" opacity=".55" ${c.blur(1.2)}/>`;
  // 잎: 짧고 넓은 둥근 잎이 돔처럼 모인다 (양옆 뒤는 올리브빛)
  const OLIVE_L: Tone = { hi: "#d6cd6c", base: "#bdb85a", sh: "#7d8a3a" }, OLIVE_D: Tone = { hi: "#9fa64c", base: "#8a9443", sh: "#5e6c2f" };
  const SIDE_L: Tone = { hi: "#a3d17a", base: "#86c068", sh: "#4f8c43" }, SIDE_D: Tone = { hi: "#5ea558", base: "#4c9450", sh: "#2c6a37" };
  const MID_L: Tone = { hi: "#78bb64", base: "#5ea85a", sh: "#2f7340" }, MID_D: Tone = { hi: "#3f8c4d", base: "#337f45", sh: "#1d5a30" };
  const r = { blunt: 0.55, stalk: 2.5, peak: 0.6, line: 2.1 };
  o +=
    leaf(c, [100.5, 27], [87.5, 9], { ...r, c1: [97, 20], c2: [90, 13], w: 4.8, lit: OLIVE_L, dim: OLIVE_D }) +
    leaf(c, [108.5, 27], [121.5, 9], { ...r, c1: [112, 20], c2: [119, 13], w: 4.8, lit: OLIVE_L, dim: OLIVE_D }) +
    leaf(c, [100, 28], [83.5, 19.5], { ...r, c1: [94, 22], c2: [87, 18], w: 5.4, lit: SIDE_L, dim: SIDE_D }) +
    leaf(c, [109, 28], [125.5, 19.5], { ...r, c1: [115, 22], c2: [122, 18], w: 5.4, lit: SIDE_L, dim: SIDE_D }) +
    leaf(c, [104.5, 28], [104, 1.5], { ...r, c1: [104.5, 18], c2: [104, 8], w: 6.2, peak: 0.55, lit: MID_L, dim: MID_D }) +
    leaf(c, [102, 29], [92.5, 22.5], { ...r, c1: [98.5, 25], c2: [95, 23], w: 4.4, lit: SIDE_L, dim: SIDE_D }) +
    leaf(c, [107, 29], [116.5, 22.5], { ...r, c1: [110.5, 25], c2: [114, 23], w: 4.4, lit: SIDE_L, dim: SIDE_D });
  // 흰 화분: 테 없이 아래로 좁아지는 컵
  const pot = "M89.5 24L119.5 24L116.6 40.6Q115.8 45 111.6 45.2L97.4 45.2Q93.2 45 92.4 40.6Z";
  o += face(
    c,
    pot,
    across(c, CERAMIC, 0.42),
    dab(c, rectD(110, 20, 13, 30), CERAMIC.sh, 0.85, 2.2) + dab(c, rectD(86, 20, 38, 6), "#dfe4e6", 0.7, 1.4) + softLine(c, "M94.5 28.5L95.8 40", "#fff", 2.6, 0.9, 0.6) + spec(95, 27.8),
    2.4,
  );
  return o;
}

// 침대: 둥근 머리 기둥 네 개, 비어 있는 아치형 머리판, 폭신한 베개 하나, 오른쪽으로 흘러내리는 하얀 시트, 산호빛 분홍 이불 (상자 220×128)
function bed(c: Ctx): string {
  // 매트리스 윗면 위의 점: u = 너비(왼→오), t = 길이(발치→머리), dy = 아래로 내린 만큼
  const F: P = [26, 78], Wv: P = [108, 3], Dv: P = [60, -54];
  const at = (u: number, t: number, dy = 0): P => [F[0] + Wv[0] * u + Dv[0] * t, F[1] + Wv[1] * u + Dv[1] * t + dy];
  const off = (q: P, dx = 0, dy = 0) => pt([q[0] + dx, q[1] + dy]);
  // 접힌 시트 띠: 뒤 가장자리(fold1)는 베개 바로 앞, 앞 가장자리(f0)는 오른쪽으로 갈수록 발치 쪽으로 내려와 오른쪽 옆이 거의 하얗게 덮인다
  const fold1 = 0.74, f0 = (u: number) => 0.45 - 0.15 * u, fR = f0(1);
  let o = floor(
    c,
    `<path d="${poly([[14, 120], [138, 124], [198, 70], [74, 66]])}" fill="#3b2a1a" opacity=".2" ${c.blur(3.5)}/>`,
    { cx: 108, cy: 92, rx: 104, ry: 25, rot: -15, tufts: [[9, 101, 1], [207, 60, 0.9]], dots: [[34, 124], [37.5, 125.3], [196, 96]] },
  );
  // 머리판: 뒤 기둥 사이의 두꺼운 아치 (아래는 비어서 베개 위로 틈이 보인다)
  const arch = "M86 12Q137 -12 186 15L186 24Q137 -3 86 21Z";
  o += face(c, arch, lin(c, [[0, WOOD.hi], [0.5, WOOD.base], [1, WOOD.sh]], 0, 0, 1, 0.3), dab(c, "M80 19Q137 -5 192 23L192 32L80 32Z", WOOD.sh, 0.5, 2) + softLine(c, "M95 10.5Q137 -7 172 8", WOOD.hi, 2.2, 0.65));
  o += post(c, 82, 1, 46, 14, WOOD);
  // 오른쪽 옆 가로대 (시트·이불 자락이 위로 덮는다)
  o += face(c, poly([[137, 101], [190, 53], [190, 64], [137, 113]]), down(c, WOOD_SIDE), softLine(c, "M141 103.5L185 63.5", WOOD_SIDE.hi, 1.6, 0.55));

  // ── 이불·시트·매트리스: 바깥 둘레만 굵은 선, 안쪽 경계는 가는 선 ──
  const mTop = poly([at(0, 0), at(1, 0), at(1, 1), at(0, 1)]);
  const mSide = poly([at(1, 0), at(1, 1), at(1, 1, 20), at(1, 0, 20)]);
  // 분홍 이불: 윗면 → 둥글게 부푼 앞면, 오른쪽으로 늘어진 자락 (시트 띠 밑으로 들어간다)
  const A = at(-0.035, f0(-0.035) + 0.03), FLq = at(-0.035, -0.03), FRq = at(1.035, -0.03), RB = at(1.035, f0(1.035) + 0.03);
  const midF: P = [(FLq[0] + FRq[0]) / 2, (FLq[1] + FRq[1]) / 2];
  const quilt =
    `M${pt(A)}L${off(FLq, 3.4, -4.6)}Q${off(FLq, -1.4, 0.4)} ${off(FLq, -0.9, 6.5)}L${off(FLq, 0, 20)}Q${off(FLq, 0.6, 25.5)} ${off(FLq, 7, 25.8)}` +
    `Q${off(midF, 0, 29.5)} ${off(FRq, -6, 26.5)}L${off(FRq, 1.5, 27.5)}L${off(RB, -1, 30)}Q${off(RB, 1.4, 30)} ${off(RB, 1.4, 27)}` +
    `L${off(RB, 1.4, 3)}Q${off(RB, 1.4, -1)} ${off(RB, -4, -1)}Z`;
  const quiltTop =
    `M${pt(A)}L${off(FLq, 3.4, -4.6)}Q${off(FLq, -1.2, 0.4)} ${off(FLq, 1.6, 2.6)}Q${off(midF, 0, 5)} ${off(FRq, -3, 2.8)}` +
    `Q${off(FRq, 1.6, 2.6)} ${off(FRq, 1.4, -2.5)}L${off(RB, 1.4, 3)}Q${off(RB, 1.4, -1)} ${off(RB, -4, -1)}Z`;
  // 접힌 하얀 시트 띠 (이불 위) + 오른쪽 모서리를 감싸고 옆 가로대까지 늘어진 큰 자락
  const bandEdge = `Q${pt(at(0.5, f0(0.5) - 0.045))} ${pt(at(-0.036, f0(-0.036), 0.8))}`; // 앞 가장자리는 발치 쪽으로 살짝 부푼다
  const band = `M${pt(at(0, fold1))}L${pt(at(1.01, fold1))}L${pt(at(1.01, f0(1.01)))}${bandEdge}Z`;
  const flap =
    `M${pt(at(1, fR))}Q${off(at(1.045, fR), 0, 0.5)} ${pt(at(1.04, fR - 0.01, 6))}L${pt(at(1.04, fR - 0.045, 28))}` +
    `Q${pt(at(1.04, fR - 0.045, 31.5))} ${pt(at(1.04, fR, 31.2))}L${pt(at(1.04, fold1 + 0.07, 30.5))}L${pt(at(1.04, fold1, 4))}` +
    `Q${off(at(1.045, fold1), 0, 0)} ${pt(at(1, fold1))}Z`;
  o += sil([mTop, mSide, quilt, band, flap]);
  // 매트리스 (머리 쪽에 하얀 시트가 조금 보인다)
  o += face(c, mTop, diag(c, LINEN, 0.6), "", 0);
  o += face(c, mSide, down(c, { hi: "#f7f0e4", base: "#efe4d4", sh: "#dfcfba" }, 0.4), "", 0);
  o += inl(`M${pt(at(1, 0.6))}L${pt(at(1, 1))}`, 1.4, 0.6);
  // 베개: 하나, 폭신하게 부풀고 살짝 기울었다 (침대 폭의 60%쯤, 가운데보다 조금 왼쪽)
  const pillow = "M104.5 13.5Q134 11 163.5 16Q171.8 17.5 171.8 25.5L171.4 35Q171 43 162.5 43.6Q134 46.2 105.5 42.6Q97 41.6 97 33.5L97 22Q97 14 104.5 13.5Z";
  o +=
    `<g transform="rotate(3.5 134 28)">` +
    face(
      c,
      pillow,
      lin(c, [[0, "#ffffff"], [0.5, "#fdf4e4"], [1, "#efdcc0"]], 0, 0, 0.6, 1),
      dab(c, "M90 31Q134 42 178 32L178 52L90 52Z", "#eed8ba", 0.8, 2.6) +
        dab(c, rectD(162, 10, 18, 38), "#eed8ba", 0.6, 2.6) +
        softLine(c, "M105 17.5Q120 14 134 13.8", "#fff", 2.6, 0.9, 0.6) +
        `<path d="M131 20q5 .6 8 3" stroke="#ecd0aa" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".7"/>`,
      0,
    ) +
    `<path d="${pillow}" fill="none" stroke="#6e4528" stroke-width="2.2" stroke-linejoin="round"/></g>`;
  // 이불: 앞면 색이 윗면과 거의 같고, 사이는 부드럽게 둥글다
  o += `<path d="${quilt}" fill="${lin(c, [[0, "#f59a93"], [0.6, "#ef908c"], [1, "#e98585"]], 0, 0, 0, 1)}"/>`;
  o += clipTo(
    c,
    quilt,
    dab(c, poly([at(0.93, 0.1, 6), at(1.2, 0.1, 6), at(1.2, fR + 0.1, 40), at(0.93, fR + 0.1, 40)]), PINK.sh, 0.75, 2.4) + // 오른쪽 자락 그늘
      dab(c, `M0 ${n1(FLq[1] + 22)}L${n1(FRq[0] + 4)} ${n1(FRq[1] + 23)}L${n1(FRq[0] + 4)} ${n1(FRq[1] + 34)}L0 ${n1(FLq[1] + 34)}Z`, "#dc7676", 0.45, 2.2) + // 아랫단
      `<path d="${quiltTop}" fill="${lin(c, [[0, PINK.hi], [0.55, "#f7a59b"], [1, PINK.base]], 0, 0, 1, 0.5)}" ${c.blur(1)}/>` +
      dab(c, poly([at(0.8, -0.1), at(1.1, -0.1), at(1.1, fR), at(0.8, f0(0.8))]), PINK.sh, 0.3, 3.2) +
      softLine(c, `M${off(FLq, 4, 5.5)}Q${off(midF, 0, 8)} ${off(FRq, -6, 6)}`, "#fcbcb2", 2.6, 0.55, 1.2), // 부푼 앞 모서리의 밝은 띠
  );
  o += inl(`M${off(FLq, 2, 2.4)}Q${off(midF, 0, 5)} ${off(FRq, -3, 2.8)}Q${off(FRq, 1.6, 2.6)} ${off(FRq, 1.4, -2.5)}L${off(RB, 1.4, 3)}`, 1.3, 0.28);
  // 시트 띠 + 오른쪽 자락
  o += dab(c, poly([at(-0.03, f0(-0.03) - 0.005), at(1.02, f0(1.02) - 0.005), at(1.02, f0(1.02) - 0.075), at(-0.03, f0(-0.03) - 0.075)]), "#c8606a", 0.35, 1.4); // 띠 앞 그늘
  o += face(c, flap, lin(c, [[0, "#fbf5ec"], [0.5, "#f1e7da"], [1, "#e2d2c0"]], 0, 0, 1, 0.6), dab(c, poly([at(1.04, fold1 - 0.05, 2), at(1.1, fold1 - 0.05, 2), at(1.1, fold1 + 0.1, 32), at(1.04, fold1 + 0.1, 32)]), "#dccab4", 0.6, 2.2), 0);
  o += face(
    c,
    band,
    diag(c, LINEN, 0.6),
    dab(c, poly([at(-0.1, f0(-0.1) + 0.015), at(1.1, f0(1.1) + 0.015), at(1.1, f0(1.1) + 0.06), at(-0.1, f0(-0.1) + 0.06)]), LINEN.sh, 0.6, 1.4) + // 접힌 테두리 그늘
      dab(c, poly([at(0.85, f0(0.85)), at(1.1, f0(1.1)), at(1.1, fold1), at(0.85, fold1)]), LINEN.sh, 0.4, 2.4),
    0,
  );
  // 띠의 앞뒤 경계, 모서리를 감싸는 접힘, 자락 앞 가장자리 (가는 선)
  o += inl(`M${pt(at(1.005, f0(1.005)))}${bandEdge}M${pt(at(-0.025, fold1))}L${pt(at(1.005, fold1))}`, 1.8, 0.9);
  o += inl(`M${off(at(1.012, fR + 0.02), 0, 0.4)}L${off(at(1.012, fold1 - 0.02), 0, 0.4)}`, 1.2, 0.45);
  o += inl(`M${pt(at(1.04, fR - 0.008, 5.5))}L${pt(at(1.04, fR - 0.043, 27.5))}`, 1.6, 0.8);
  // 뒤 오른쪽 기둥 → 발치 가로대 → 앞 기둥 두 개
  o += post(c, 190, 5, 70, 14, WOOD);
  o += face(
    c,
    roundPoly([[24, 100], [128, 103], [128, 114], [24, 111]], 2),
    down(c, WOOD, 0.45),
    softLine(c, "M31 103.6L121 106.1", WOOD.hi, 2.2, 0.65) + dab(c, poly([[20, 108.5], [132, 111.5], [132, 118], [20, 115]]), WOOD.sh, 0.65, 2),
  );
  o += post(c, 22, 71, 120, 16, WOOD);
  o += post(c, 130, 74, 123, 16, WOOD);
  return o;
}

// 처음 보는 asset_key: 작은 나무 상자
function fallback(c: Ctx): string {
  const box = roundPoly([[8, 22], [72, 22], [72, 74], [8, 74]], 4);
  return (
    floor(c, shadowEl(c, 40, 76, 30, 4), { cx: 40, cy: 72, rx: 41, ry: 9 }) +
    face(
      c,
      box,
      diag(c, WOOD, 0.5),
      dab(c, rectD(60, 26, 16, 52), WOOD.sh, 0.55, 2.4) + `<path d="${rectD(6, 18, 68, 13, 3)}" fill="${down(c, WOOD_TOP)}"/>` + inl("M8 31H72M8 52H72"),
    )
  );
}

const FURNITURE: Record<string, Furniture> = {
  "furn.plant": { w: 40, h: 56, heightPct: 26, draw: plant },
  "furn.chair": { w: 44, h: 60, heightPct: 32, draw: chair },
  "furn.lamp": { w: 40, h: 84, heightPct: 44, draw: lamp },
  "furn.desk": { w: 90, h: 60, heightPct: 34, draw: desk },
  "furn.bed": { w: 110, h: 64, heightPct: 34, draw: bed },
};

const FALLBACK: Furniture = { w: 40, h: 40, heightPct: 24, draw: fallback };

export function furnitureInfo(assetKey: string) {
  const f = FURNITURE[assetKey] ?? FALLBACK;
  return { heightPct: f.heightPct, aspect: (f.w + 4) / (f.h + 4) };
}

/** 같은 가구는 한 번만 그린다 (id가 고정이라 다시 써도 된다) */
const cache = new Map<string, string>();

/** 가구 SVG 문자열. height는 픽셀 높이 (너비는 비율에 맞춘다).
 *  grass: 시안 썸네일처럼 발밑에 풀밭 조각을 깐다 (기본은 어느 배경에도 어울리는 흐린 그림자) */
export function furnitureSvg(assetKey: string, height = 120, { grass = false }: { grass?: boolean } = {}): string {
  const key = FURNITURE[assetKey] ? assetKey : "fallback";
  const f = FURNITURE[assetKey] ?? FALLBACK;
  const cacheKey = `${key}|${grass ? 1 : 0}`;
  let inner = cache.get(cacheKey);
  if (inner === undefined) {
    const c = newCtx(key, grass);
    const body = f.draw(c);
    inner = (c.defs.length ? `<defs>${c.defs.join("")}</defs>` : "") + body;
    cache.set(cacheKey, inner);
  }
  const vw = f.w * 2 + 8, vh = f.h * 2 + 8;
  const width = Math.round((height * vw) / vh);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${vw} ${vh}" width="${width}" height="${height}">${inner}</svg>`;
}

export function furnitureDataUri(assetKey: string, height = 120, opts: { grass?: boolean } = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(furnitureSvg(assetKey, height, opts))}`;
}
