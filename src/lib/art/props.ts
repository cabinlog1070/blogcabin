// 광장 자연·소품 그림 (SVG, 2026-10-08 디자인 시안 nature.mjs 를 옮김).
// 3/4 내려다보기, 빛은 왼쪽 위. 좌표는 2배 viewBox 단위. 크기 상수(…_SIZE)는 화면에 놓을 크기(px).
// 외곽선: 나무(목재)만 공통 짙은 갈색(OUTLINE). 잎·꽃·바위·풀은 제 색을 짙게 한 선을 쓴다.
// 명암: 밝은 면·바탕·그늘 세 톤을 흐림(blur)으로 부드럽게 잇고, 작은 붓 자국(결, 반점)을 얹는다.
import { OUTLINE, darken, lighten, groundShadow, uid, rng, svg } from "./style";

type Vec = number[];
type Rand = () => number;
type Tone = { base: string; hi: string; sh: string };
type LeafTone = { stops: (number | string)[][]; ol: string; dk: string; gap: string; lightDab: string; midDab: string; darkDab: string; warm: string; cool: string };
type CrownExtra = (c: { x0: number; y0: number; w: number; h: number; Lt: (x: number, y: number) => number; inside: (x: number, y: number, m?: number) => boolean; R: Rand }) => string;
// BlogCabin 시안 — 자연·소품 오브젝트 (나무, 덤불, 꽃, 풀, 바위, 그루터기, 울타리, 벤치, 이정표, 통나무, 상자, 통, 우체통, 빨래대, 화분)
// 3/4 내려다보기, 빛은 왼쪽 위. 좌표는 2배 viewBox 단위.
// 외곽선: 나무(목재)만 공통 짙은 갈색(OUTLINE). 잎·꽃·바위·풀은 제 색을 짙게 한 선을 쓴다.
// 명암: 밝은 면·바탕·그늘 세 톤을 흐림(blur)으로 부드럽게 잇고, 작은 붓 자국(결, 반점)을 얹는다.


/* ───────────── 공통 도우미 ───────────── */
const n1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const SO = (c: string, w = 2.6) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const pts2d = (pts: Vec[]) => "M" + pts.map((p) => `${n1(p[0])} ${n1(p[1])}`).join(" L") + "Z";


/** 그림 하나에 쓰는 defs(흐림 필터·그라디언트) 모음. 그림 함수는 begin() → … → finish() */
let DEFS: { list: string[]; blur: Map<string, string> } | null = null;
function begin() { DEFS = { list: [], blur: new Map() }; return DEFS; }
const defs = () => DEFS ?? begin();
function addDef(s: string) { defs().list.push(s); }
/** 부드러운 명암용 흐림. 영역은 userSpace로 넉넉히 잡아 가는 선도 사라지지 않게 한다 */
function blur(sd: number) {
  const D = defs();
  const k = String(n1(sd));
  if (!D.blur.has(k)) {
    const id = uid("nb");
    D.blur.set(k, id);
    D.list.push(`<filter id="${id}" filterUnits="userSpaceOnUse" x="-80" y="-80" width="560" height="560" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${k}"/></filter>`);
  }
  return `filter="url(#${D.blur.get(k)})"`;
}
function finish(w: number, h: number, body: string) { const d = DEFS ? DEFS.list.join("") : ""; DEFS = null; return svg(w, h, body, d); }

/** 모서리를 둥글린 다각형 경로 */
function roundPoly(pts: Vec[], r: number | number[] = 4) {
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
const rectD = (x: number, y: number, w: number, h: number, r = 3) => roundPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);

/** 울퉁불퉁한(잎 뭉치) 원 경로 — 바깥으로 볼록한 호를 n개 잇는다 */
function scallop(cx: number, cy: number, rx: number, ry: number, n = 8, rot = 0, bulge = 1.25, rand: Rand | null = null, jit = 0) {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const j = rand ? 1 + (rand() - 0.5) * jit : 1;
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    const r = (Math.hypot(x2 - x1, y2 - y1) / 2) * bulge;
    d += ` A${n1(r)} ${n1(r)} 0 0 1 ${n1(x2)} ${n1(y2)}`;
  }
  return d + "Z";
}

/** 칠한 면 하나: 바탕색 → (잘라낸) 안쪽 명암·결 → 외곽선(재질 색) */
function part(d: string, fill: string, inner = "", w = 2.6, ol: string = OUTLINE) {
  const id = uid("np");
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${fill}"/>` +
    (inner ? `<g clip-path="url(#${id})">${inner}</g>` : "") +
    `<path d="${d}" fill="none" ${SO(ol, w)}/>`;
}

/* ───────────── 목재 ───────────── */
// 채도 있는 중간 적갈색 (밝은 면 · 바탕 · 그늘)
const W = { base: "#a2663a", hi: "#cf9459", sh: "#6e3d22", dk: "#4f2a16", fleck: "#5b311a", lite: "#dfa86a", end: "#b27648", endHi: "#c98f5c", ring: "#7e4a2a" };
const WT = { base: "#bb7c4a", hi: "#dba468", sh: "#8f5530" }; // 위를 향한 밝은 면 (의자 판 윗면 등)
const WS = { base: "#82492a", hi: "#9c6037", sh: "#5a2f19" }; // 그늘 면 (오른쪽 옆면 등)
const TRUNK = { base: "#7c4a2c", hi: "#a26a41", sh: "#53301c", dk: "#3a2011" };

/** 나뭇결 (가는 짙은 선, 반투명) */
function grain(x: number, y: number, w: number, h: number, { vertical = false, seed = 1, count = 3, color = W.dk as string, op = 0.45, sw = 1.2 } = {}) {
  const R = rng(seed);
  let d = "";
  for (let i = 0; i < count; i++) {
    if (!vertical) {
      const yy = y + h * (0.22 + (0.56 * (i + R() * 0.6)) / count);
      const x0 = x + w * (0.05 + R() * 0.3), x1 = x0 + w * (0.25 + R() * 0.45);
      d += `M${n1(x0)} ${n1(yy)} Q${n1((x0 + x1) / 2)} ${n1(yy + (R() - 0.5) * 3)} ${n1(Math.min(x1, x + w - 3))} ${n1(yy + (R() - 0.5) * 2)} `;
    } else {
      const xx = x + w * (0.2 + (0.6 * (i + R() * 0.6)) / count);
      const y0 = y + h * (0.05 + R() * 0.25), y1 = y0 + h * (0.3 + R() * 0.45);
      d += `M${n1(xx)} ${n1(y0)} Q${n1(xx + (R() - 0.5) * 3)} ${n1((y0 + y1) / 2)} ${n1(xx + (R() - 0.5) * 2)} ${n1(Math.min(y1, y + h - 2))} `;
    }
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`;
}

/** 붓 자국 같은 짧은 결 조각 (짙은 것·밝은 것 섞어서) */
function flecks(x: number, y: number, w: number, h: number, { n = 10, seed = 1, vertical = false, dark = W.fleck as string, light = W.lite as string, op = 0.4 } = {}) {
  const R = rng(seed);
  let dd = "", dl = "";
  for (let i = 0; i < n; i++) {
    const px = x + R() * w, py = y + R() * h, len = 1.5 + R() * 3.8;
    const seg = vertical ? `M${n1(px)} ${n1(py)} l${n1((R() - 0.5) * 0.8)} ${n1(len)} ` : `M${n1(px)} ${n1(py)} l${n1(len)} ${n1((R() - 0.5) * 0.8)} `;
    if (R() < 0.6) dd += seg; else dl += seg;
  }
  return (dd ? `<path d="${dd}" fill="none" stroke="${dark}" stroke-width="1.1" stroke-linecap="round" opacity="${op}"/>` : "") +
    (dl ? `<path d="${dl}" fill="none" stroke="${light}" stroke-width="1.1" stroke-linecap="round" opacity="${n1(op * 0.9)}"/>` : "");
}

/** 나무 판자 (가로 또는 세로). 위/왼쪽 밝게, 아래/오른쪽 어둡게 — 흐림으로 이음 */
function plank(x: number, y: number, w: number, h: number, { r = 3, T = W as Tone, vertical = false, seed = 1, sw = 2.6, grains = true, nfl = null as number | null } = {}) {
  const s = clamp((vertical ? w : h) * 0.13, 1, 4);
  let sh = "";
  if (!vertical) {
    sh += `<rect x="${x - 12}" y="${y - 12}" width="${w + 24}" height="${n1(h * 0.36 + 12)}" fill="${T.hi}"/>`;
    sh += `<rect x="${x - 12}" y="${n1(y + h * 0.7)}" width="${w + 24}" height="${n1(h * 0.3 + 12)}" fill="${T.sh}"/>`;
    sh += `<rect x="${n1(x + w - 5)}" y="${y - 12}" width="17" height="${h + 24}" fill="${T.sh}" opacity=".55"/>`;
  } else {
    sh += `<rect x="${x - 12}" y="${y - 12}" width="${n1(w * 0.32 + 12)}" height="${h + 24}" fill="${T.hi}"/>`;
    sh += `<rect x="${n1(x + w * 0.66)}" y="${y - 12}" width="${n1(w * 0.34 + 12)}" height="${h + 24}" fill="${T.sh}"/>`;
    sh += `<rect x="${x - 12}" y="${n1(y + h - 6)}" width="${w + 24}" height="18" fill="${T.sh}" opacity=".5"/>`;
  }
  let inner = `<g ${blur(s)}>${sh}</g>`;
  if (grains) inner += grain(x, y, w, h, { vertical, seed, count: vertical ? 2 : 3 });
  inner += flecks(x, y, w, h, { n: nfl ?? Math.round((w * h) / 110), seed: seed + 7, vertical });
  return part(rectD(x, y, w, h, r), T.base, inner, sw);
}

/** 통나무 끝면 (중간 갈색, 옅은 나이테, 작은 짙은 중심점) */
function logEnd(cx: number, cy: number, rx: number, ry: number, { fill = W.end as string, rim = W.base as string, seed = 1 } = {}) {
  const R = rng(seed);
  let out = `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${rim}" ${SO(OUTLINE)}/>`;
  const id = uid("le");
  const fx = cx - rx * 0.03, fy = cy - ry * 0.05, frx = rx * 0.82, fry = ry * 0.8;
  out += `<clipPath id="${id}"><ellipse cx="${n1(fx)}" cy="${n1(fy)}" rx="${n1(frx)}" ry="${n1(fry)}"/></clipPath>`;
  let inner = `<ellipse cx="${n1(fx)}" cy="${n1(fy)}" rx="${n1(frx)}" ry="${n1(fry)}" fill="${fill}"/>`;
  inner += `<g ${blur(Math.max(1, rx * 0.15))}><ellipse cx="${n1(fx - frx * 0.35)}" cy="${n1(fy - fry * 0.4)}" rx="${n1(frx * 0.6)}" ry="${n1(fry * 0.5)}" fill="${W.endHi}" opacity=".9"/>` +
    `<ellipse cx="${n1(fx + frx * 0.5)}" cy="${n1(fy + fry * 0.55)}" rx="${n1(frx * 0.7)}" ry="${n1(fry * 0.55)}" fill="${darken(fill, 0.16)}" opacity=".8"/></g>`;
  for (const k of [0.68, 0.4]) inner += `<ellipse cx="${n1(fx + (R() - 0.5) * 0.6)}" cy="${n1(fy + (R() - 0.5) * 0.6)}" rx="${n1(frx * k)}" ry="${n1(fry * k)}" fill="none" stroke="${W.ring}" stroke-width="1" opacity=".38"/>`;
  inner += `<circle cx="${n1(fx + 0.3)}" cy="${n1(fy + 0.3)}" r="${n1(Math.max(1, Math.min(frx, fry) * 0.1))}" fill="${W.dk}" opacity=".85"/>`;
  inner += `<path d="M${n1(fx + frx * 0.15)} ${n1(fy + fry * 0.1)} l${n1(frx * 0.45)} ${n1(fry * 0.2)}" stroke="${W.ring}" stroke-width="1" stroke-linecap="round" opacity=".45"/>`;
  return out + `<g clip-path="url(#${id})">${inner}</g>`;
}

/** 둥근 통나무 기둥. cap: "round"(둥근 윗머리, 밝고 옅은 나이테) | "cut"(잘린 끝면) | "none" */
function post(cx: number, top: number, bottom: number, w: number, { T = W as Tone, seed = 1, cap = "round" as "round" | "cut" | "none" } = {}) {
  const x = cx - w / 2, ry = w * 0.3;
  const d = `M${n1(x)} ${n1(top)} L${n1(x)} ${n1(bottom - 3)} Q${n1(x)} ${n1(bottom + 1)} ${n1(cx)} ${n1(bottom + 1)} Q${n1(x + w)} ${n1(bottom + 1)} ${n1(x + w)} ${n1(bottom - 3)} L${n1(x + w)} ${n1(top)}Z`;
  const sh = `<rect x="${n1(x - 10)}" y="${top - 10}" width="${n1(w * 0.3 + 10)}" height="${bottom - top + 20}" fill="${T.hi}"/>` +
    `<rect x="${n1(x + w * 0.62)}" y="${top - 10}" width="${n1(w * 0.38 + 10)}" height="${bottom - top + 20}" fill="${T.sh}"/>` +
    `<rect x="${n1(x - 10)}" y="${n1(bottom - 9)}" width="${w + 20}" height="20" fill="${T.sh}" opacity=".55"/>`;
  const inner = `<g ${blur(Math.max(1.2, w * 0.1))}>${sh}</g>` +
    grain(x, top, w, bottom - top, { vertical: true, seed, count: 3 }) +
    flecks(x, top + 4, w, bottom - top - 6, { n: Math.round((bottom - top) / 4), seed: seed + 3, vertical: true });
  let out = part(d, T.base, inner);
  if (cap === "round") {
    // 둥글게 다듬은 머리: 밝은 윗면 + 옅은 나이테 한 줄
    const capD = `M${n1(x)} ${n1(top)} Q${n1(x)} ${n1(top - ry * 1.5)} ${n1(cx)} ${n1(top - ry * 1.5)} Q${n1(x + w)} ${n1(top - ry * 1.5)} ${n1(x + w)} ${n1(top)} Q${n1(cx)} ${n1(top + ry * 0.9)} ${n1(x)} ${n1(top)}Z`;
    out += part(capD, W.endHi,
      `<g ${blur(1.4)}><ellipse cx="${n1(cx - w * 0.15)}" cy="${n1(top - ry * 0.9)}" rx="${n1(w * 0.28)}" ry="${n1(ry * 0.5)}" fill="${lighten(W.endHi, 0.3)}" opacity=".8"/>` +
      `<ellipse cx="${n1(cx + w * 0.3)}" cy="${n1(top)}" rx="${n1(w * 0.3)}" ry="${n1(ry * 0.8)}" fill="${W.end}" opacity=".9"/></g>` +
      `<ellipse cx="${n1(cx)}" cy="${n1(top - ry * 0.55)}" rx="${n1(w * 0.24)}" ry="${n1(ry * 0.42)}" fill="none" stroke="${W.ring}" stroke-width=".9" opacity=".3"/>`);
  } else if (cap === "cut") {
    out += logEnd(cx, top, w / 2, ry, { seed: seed + 5 });
  }
  return out;
}

/** 둥근 통나무 가로대 (두 점 사이, 굵기 th). 윗면에 밝은 줄 */
function railLog(x1: number, y1: number, x2: number, y2: number, th: number, seed = 1) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const r = th / 2;
  const d = `M0 ${n1(-r)} L${n1(L)} ${n1(-r)} A${n1(r * 0.6)} ${n1(r)} 0 0 1 ${n1(L)} ${n1(r)} L0 ${n1(r)} A${n1(r * 0.6)} ${n1(r)} 0 0 1 0 ${n1(-r)}Z`;
  const inner = `<g ${blur(1.3)}><rect x="-10" y="${n1(-r - 8)}" width="${n1(L + 20)}" height="${n1(r * 0.75 + 8)}" fill="${W.hi}"/>` +
    `<rect x="-10" y="${n1(r * 0.3)}" width="${n1(L + 20)}" height="${n1(r + 8)}" fill="${W.sh}"/></g>` +
    `<path d="M${n1(r)} ${n1(-r * 0.52)} L${n1(L - r)} ${n1(-r * 0.52)}" stroke="${W.lite}" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>` +
    grain(0, -r, L, th, { seed, count: 2, op: 0.4 }) + flecks(2, -r + 1, L - 4, th - 2, { n: Math.round(L / 5), seed: seed + 9 });
  return `<g transform="translate(${n1(x1)} ${n1(y1)}) rotate(${n1(ang)})">${part(d, W.base, inner)}</g>`;
}

/* ───────────── 풀 ───────────── */
const GR = { base: "#9cc55a", hi: "#b9d977", sh: "#7eac47", blade: "#5f913a", ol: "#6f9a3f", dot: "#f3d24e" };

/** 땅에 깔린 풀 조각: 테두리 선 없이 부드러운 연두, 가장자리는 잔풀이 들쭉날쭉 */
function grassPatch(cx: number, cy: number, rx: number, ry: number, seed = 3, { dots = 3, blades = null as number | null } = {}) {
  const R = rng(seed);
  const N = Math.max(30, Math.round((rx + ry) * 1.5)) & ~1;
  const pts: Vec[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const up = Math.max(0, -Math.sin(a));
    const spike = i % 2 === 0;
    const k = spike ? 1.03 + R() * 0.1 : 0.93 - R() * 0.05;
    pts.push([cx + Math.cos(a) * rx * k + (R() - 0.5) * 1.2, cy + Math.sin(a) * ry * k - (spike ? up * (1 + R() * 3.5) : 0)]);
  }
  const d = pts2d(pts);
  const id = uid("gp");
  let inner = `<g ${blur(Math.max(1.5, ry * 0.35))}><ellipse cx="${n1(cx - rx * 0.3)}" cy="${n1(cy - ry * 0.35)}" rx="${n1(rx * 0.55)}" ry="${n1(ry * 0.55)}" fill="${GR.hi}"/>` +
    `<ellipse cx="${n1(cx + rx * 0.25)}" cy="${n1(cy + ry * 0.75)}" rx="${n1(rx * 0.85)}" ry="${n1(ry * 0.6)}" fill="${GR.sh}" opacity=".8"/></g>`;
  let bl = "";
  const nb = blades ?? Math.round(rx / 5);
  for (let k = 0; k < nb; k++) {
    const bx = cx + (R() * 2 - 1) * rx * 0.8, by = cy + (R() * 2 - 1) * ry * 0.5;
    bl += `M${n1(bx)} ${n1(by)} l${n1(-1 - R())} ${n1(-2.5 - R() * 1.5)} M${n1(bx + 0.8)} ${n1(by)} l${n1(1 + R())} ${n1(-3 - R() * 1.5)} `;
  }
  inner += `<path d="${bl}" fill="none" stroke="${GR.blade}" stroke-width="1" stroke-linecap="round" opacity=".45"/>`;
  for (let k = 0; k < dots; k++) {
    const px = cx + (R() * 2 - 1) * rx * 0.75, py = cy + (R() - 0.5) * ry * 0.8;
    inner += `<circle cx="${n1(px)}" cy="${n1(py)}" r="1.2" fill="${GR.dot}"/>`;
  }
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${GR.base}"/><g clip-path="url(#${id})">${inner}</g>` +
    `<path d="${d}" fill="none" stroke="${GR.ol}" stroke-width="1" stroke-linejoin="round" opacity=".3"/>`;
}

/** 부드러운 풀 포기: 가는 연두 잎 8~10가닥이 부채꼴로 퍼진다 (짙은 외곽선 없음) */
function tuft(x: number, y: number, h: number, w: number, seed = 5, n = 9) {
  const R = rng(seed);
  const cols = ["#76a743", "#8cbb50", "#9cc55a", "#b2d470"];
  const blades: { ci: number; d: string }[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const lean = (t - 0.5) * 2;
    const bx = x - w * 0.28 + w * 0.56 * t + (R() - 0.5) * 2;
    const hh = h * (0.5 + 0.5 * (1 - Math.abs(lean))) * (0.75 + R() * 0.4);
    const tx = bx + lean * w * 0.42 + (R() - 0.5) * 3, ty = y - hh;
    const bw = 1.3 + R() * 1.1;
    const ci = Math.floor(R() * cols.length);
    blades.push({ ci, d: `M${n1(bx - bw)} ${n1(y)} Q${n1(bx - bw * 0.4 + (tx - bx) * 0.25)} ${n1(y - hh * 0.55)} ${n1(tx)} ${n1(ty)} Q${n1(bx + bw * 0.5 + (tx - bx) * 0.35)} ${n1(y - hh * 0.5)} ${n1(bx + bw)} ${n1(y)}Z` });
  }
  blades.sort((a, b) => a.ci - b.ci);
  return `<g>${blades.map((b) => `<path d="${b.d}" fill="${cols[b.ci]}" stroke="${GR.blade}" stroke-width=".7" stroke-opacity=".35"/>`).join("")}</g>`;
}

/** 다섯 꽃잎 꽃 — 외곽선은 꽃잎 색을 짙게 한 색 */
function flower5(cx: number, cy: number, r: number, petal: string, ol: string, center = "#f7c948", rot = -90) {
  let circ = "";
  const pr = r * 0.47;
  for (let i = 0; i < 5; i++) {
    const a = ((rot + i * 72) * Math.PI) / 180;
    circ += `<circle cx="${n1(cx + Math.cos(a) * r * 0.58)}" cy="${n1(cy + Math.sin(a) * r * 0.58)}" r="${n1(pr)}"/>`;
  }
  let out = `<g fill="${ol}" stroke="${ol}" stroke-width="2" stroke-linejoin="round">${circ}</g><g fill="${petal}">${circ}</g>`;
  // 왼쪽 위 꽃잎엔 밝은 붓자국, 오른쪽 아래엔 살짝 그늘
  out += `<circle cx="${n1(cx - r * 0.42)}" cy="${n1(cy - r * 0.45)}" r="${n1(pr * 0.5)}" fill="${lighten(petal, 0.45)}" opacity=".75"/>`;
  out += `<circle cx="${n1(cx + r * 0.45)}" cy="${n1(cy + r * 0.4)}" r="${n1(pr * 0.6)}" fill="${darken(petal, 0.12)}" opacity=".5"/>`;
  out += `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r * 0.3)}" fill="${center}" stroke="${darken(center, 0.25)}" stroke-width=".8"/>`;
  out += `<circle cx="${n1(cx - r * 0.09)}" cy="${n1(cy - r * 0.1)}" r="${n1(r * 0.1)}" fill="#fff6d0"/>`;
  return out;
}
const FL = {
  coral: ["#f2706e", "#c9474b"], pink: ["#f79ab3", "#d0607e"], white: ["#fff8ef", "#cbb3a8"],
  yellow: ["#f8c845", "#cf8a1f"], peach: ["#fbc4a6", "#d98a68"],
};
const fl = (cx: number, cy: number, r: number, k: keyof typeof FL, center?: string) => flower5(cx, cy, r, FL[k][0], FL[k][1], center ?? (k === "yellow" ? "#f08a2e" : k === "white" ? "#f6b93a" : "#ffe9a8"));

/* ───────────── 잎 덩어리 (활엽수·벚나무·덤불·화분) ───────────── */
// stops: 왼쪽 위(밝음) → 오른쪽 아래(그늘) 대각 그라디언트. ol: 제 색을 짙게 한 외곽선
const LEAF_T = {
  stops: [[0, "#c2d24c"], [0.3, "#93ba48"], [0.55, "#6ea446"], [0.8, "#4a8a4a"], [1, "#2f6a52"]],
  ol: "#2c5a3c", dk: "#2f6448", gap: "#1e4636",
  lightDab: "#d2dc62", midDab: "#a2c650", darkDab: "#3e7a4c", warm: "#f2ee7a", cool: "#1d5450",
};
const BUSH_T = {
  stops: [[0, "#b4c84a"], [0.25, "#7aac46"], [0.5, "#4f8f43"], [0.78, "#3a7a45"], [1, "#24584a"]],
  ol: "#2c5a3c", dk: "#295c42", gap: "#1b4234",
  lightDab: "#c4d65a", midDab: "#86b64c", darkDab: "#357046", warm: "#e8ea70", cool: "#1a4c46",
};
const BLOSSOM_T = {
  stops: [[0, "#ffd3e2"], [0.3, "#fbacc8"], [0.55, "#f590b4"], [0.8, "#ea74a0"], [1, "#d6558a"]],
  ol: "#b8426e", dk: "#dc5f8e", gap: "#b8426e",
  lightDab: "#ffe3ec", midDab: "#fbb8cf", darkDab: "#e2689a", warm: "#fff3f7", cool: "#b73b6c",
};

/** masses: [x, y, r] 6~8개의 큰 덩어리. 하나의 부드러운 돔으로 칠하고,
 *  위 덩어리 아래에는 짙은 초승달(U자 가장자리), 잎결은 작은 잎 붓자국, 덩어리 사이엔 별 모양 틈 */
function crown(masses: Vec[], T: LeafTone, seed = 1, { bump = 11, dabs = 70, gaps = 4, strength = 0.5, extra = null as CrownExtra | null, crescent = 0.17 } = {}) {
  const R = rng(seed);
  const shapes = masses.map(([x, y, r]) => {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / bump));
    return { x, y, r, d: scallop(x, y, r, r * 0.95, n, R() * 6, 1.2, R, 0.07) };
  });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of shapes) { x0 = Math.min(x0, s.x - s.r); y0 = Math.min(y0, s.y - s.r); x1 = Math.max(x1, s.x + s.r); y1 = Math.max(y1, s.y + s.r); }
  const w = x1 - x0, h = y1 - y0;
  const Lt = (x: number, y: number) => clamp(((x - x0) / w) * 0.45 + ((y - y0) / h) * 0.7, 0, 1.2);
  const inside = (x: number, y: number, m = 0) => shapes.some((s) => Math.hypot(x - s.x, y - s.y) < s.r - m);
  const cid = uid("cr"), gid = uid("crg"), oid = uid("cro");
  const paths = shapes.map((s) => `<path d="${s.d}"/>`).join("");
  addDef(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${n1(x0 + w * 0.2)}" y1="${n1(y0)}" x2="${n1(x1 - w * 0.15)}" y2="${n1(y1)}">${T.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`);
  addDef(`<radialGradient id="${oid}" gradientUnits="userSpaceOnUse" cx="${n1(x0 + w * 0.32)}" cy="${n1(y0 + h * 0.18)}" r="${n1(Math.max(w, h) * 0.98)}">` +
    `<stop offset="0" stop-color="${T.warm}" stop-opacity="${strength}"/><stop offset=".34" stop-color="${T.warm}" stop-opacity="0"/>` +
    `<stop offset=".6" stop-color="${T.cool}" stop-opacity="0"/><stop offset="1" stop-color="${T.cool}" stop-opacity="${strength}"/></radialGradient>`);
  let out = `<clipPath id="${cid}">${paths}</clipPath>`;
  out += `<g fill="${T.ol}" stroke="${T.ol}" stroke-width="5.2" stroke-linejoin="round">${paths}</g>`;
  let inner = `<rect x="${n1(x0 - 6)}" y="${n1(y0 - 6)}" width="${n1(w + 12)}" height="${n1(h + 12)}" fill="url(#${gid})"/>`;
  // 아래 덩어리부터 칠하고, 위 덩어리는 아래로 짙은 초승달 그림자를 드리운다
  const order = [...shapes].sort((a, b) => b.y - a.y);
  for (const s of order) {
    const l = Lt(s.x, s.y);
    inner += `<path d="${s.d}" transform="translate(${n1(s.r * 0.04)} ${n1(s.r * crescent)})" fill="${T.dk}" opacity="${n1(0.45 + l * 0.35)}" ${blur(1.3)}/>`;
    inner += `<path d="${s.d}" fill="url(#${gid})"/>`;
    inner += `<path d="${scallop(s.x - s.r * 0.2, s.y - s.r * 0.3, s.r * 0.6, s.r * 0.45, 8, R() * 6, 1.3, R, 0.2)}" fill="${l < 0.6 ? T.lightDab : T.midDab}" opacity="${l < 0.6 ? 0.55 : 0.3}" ${blur(2.6)}/>`;
  }
  // 잎결: 작은 잎 뭉치마다 위쪽은 밝은 ∩ 초승달(빛 받는 가장자리), 아래쪽은 짙은 U 초승달
  const capD = (x: number, y: number, r: number, t: number) => `M${n1(x - r)} ${n1(y)} A${n1(r)} ${n1(r * 0.8)} 0 0 1 ${n1(x + r)} ${n1(y)} A${n1(r)} ${n1(r * 0.8 * (1 - t))} 0 0 0 ${n1(x - r)} ${n1(y)}Z`;
  const cupD = (x: number, y: number, r: number, t: number) => `M${n1(x - r)} ${n1(y)} A${n1(r)} ${n1(r * 0.75)} 0 0 0 ${n1(x + r)} ${n1(y)} A${n1(r)} ${n1(r * 0.75 * (1 - t))} 0 0 1 ${n1(x - r)} ${n1(y)}Z`;
  let litD = "", midD = "", cups = "", soft = "";
  for (let k = 0, tries = 0; k < dabs && tries < dabs * 6; tries++) {
    const px = x0 + R() * w, py = y0 + R() * h;
    if (!inside(px, py, 3)) continue;
    k++;
    const l = Lt(px, py) + (R() - 0.5) * 0.12;
    const rr = 2.6 + R() * 2.8;
    if (l < 0.5) { litD += capD(px, py, rr, 0.55 + R() * 0.2); if (R() < 0.5) cups += cupD(px + rr * 0.3, py + rr * 0.55, rr * 0.8, 0.6); }
    else if (l < 0.85) { midD += capD(px, py, rr, 0.6); cups += cupD(px, py + rr * 0.5, rr * 0.9, 0.55); }
    else cups += cupD(px, py, rr, 0.5);
    if (R() < 0.25) soft += `<circle cx="${n1(px)}" cy="${n1(py)}" r="${n1(rr * 1.4)}" fill="${l < 0.55 ? T.lightDab : T.darkDab}" opacity=".35"/>`;
  }
  inner += `<g ${blur(1.6)}>${soft}</g>`;
  inner += `<path d="${cups}" fill="${T.dk}" opacity=".5"/>`;
  inner += `<path d="${midD}" fill="${T.midDab}" opacity=".6"/>`;
  inner += `<path d="${litD}" fill="${T.lightDab}" opacity=".85"/>`;
  // 덩어리 사이의 짙은 틈: 작고 불규칙한 별 모양, 살짝 번지게
  for (let k = 0, tries = 0; k < gaps && tries < 200; tries++) {
    const px = x0 + w * (0.25 + R() * 0.6), py = y0 + h * (0.35 + R() * 0.5);
    if (!inside(px, py, 8)) continue;
    k++;
    const rr = 3 + R() * 2, rot = R() * Math.PI, np = 4 + Math.floor(R() * 2);
    let d = "";
    for (let i = 0; i < np * 2; i++) {
      const a = rot + (i * Math.PI) / np, q = i % 2 ? rr * (0.3 + R() * 0.15) : rr * (0.7 + R() * 0.5);
      d += `${i ? "L" : "M"}${n1(px + Math.cos(a) * q)} ${n1(py + Math.sin(a) * q * 0.8)} `;
    }
    inner += `<path d="${d}Z" fill="${T.gap}" opacity=".75" stroke="${T.gap}" stroke-width="1.2" stroke-linejoin="round" ${blur(0.5)}/>`;
  }
  if (extra) inner += extra({ x0, y0, w, h, Lt, inside, R });
  inner += `<rect x="${n1(x0 - 6)}" y="${n1(y0 - 6)}" width="${n1(w + 12)}" height="${n1(h + 12)}" fill="url(#${oid})"/>`;
  return out + `<g clip-path="url(#${cid})">${inner}</g>`;
}

/** 나무 기둥: 짧고 굵게, 아래는 3~4갈래 뿌리 발가락이 기둥 폭의 약 1.6배로 벌어짐 */
function trunk(cx: number, top: number, base: number, wt: number, seed = 1, T = TRUNK) {
  const wb = wt * 1.62, L = cx - wt / 2, Rt = cx + wt / 2, fh = Math.min(18, (base - top) * 0.45);
  const d = `M${n1(L)} ${n1(top)} L${n1(L)} ${n1(base - fh)} C${n1(L)} ${n1(base - fh * 0.4)} ${n1(cx - wb / 2 + 3)} ${n1(base - 5)} ${n1(cx - wb / 2)} ${n1(base - 0.5)}` +
    ` Q${n1(cx - wb * 0.47)} ${n1(base + 3.5)} ${n1(cx - wb * 0.3)} ${n1(base + 1)}` +
    ` Q${n1(cx - wb * 0.22)} ${n1(base - 3)} ${n1(cx - wb * 0.14)} ${n1(base + 0.5)}` +
    ` Q${n1(cx - wb * 0.02)} ${n1(base + 4.5)} ${n1(cx + wb * 0.1)} ${n1(base + 0.5)}` +
    ` Q${n1(cx + wb * 0.18)} ${n1(base - 3)} ${n1(cx + wb * 0.26)} ${n1(base + 0.5)}` +
    ` Q${n1(cx + wb * 0.44)} ${n1(base + 3.5)} ${n1(cx + wb / 2)} ${n1(base - 0.5)}` +
    ` C${n1(cx + wb / 2 - 3)} ${n1(base - 5)} ${n1(Rt)} ${n1(base - fh * 0.4)} ${n1(Rt)} ${n1(base - fh)} L${n1(Rt)} ${n1(top)}Z`;
  const R = rng(seed);
  let sh = `<rect x="${n1(cx + wt * 0.12)}" y="${top - 10}" width="${n1(wb)}" height="${n1(base - top + 20)}" fill="${T.sh}"/>`;
  sh += `<path d="M${n1(L - 12)} ${top - 10} L${n1(L + wt * 0.3)} ${top - 10} L${n1(L + wt * 0.26)} ${n1(base - fh)} L${n1(cx - wb * 0.3)} ${n1(base + 6)} L${n1(L - 20)} ${n1(base + 6)}Z" fill="${T.hi}"/>`;
  sh += `<rect x="${n1(L - 10)}" y="${top - 10}" width="${wt + 20}" height="${n1((base - top) * 0.28 + 10)}" fill="${T.dk}" opacity=".75"/>`;
  let inner = `<g ${blur(Math.max(2, wt * 0.12))}>${sh}</g>`;
  let bark = "";
  for (let i = 0; i < 4; i++) {
    const bx = L + wt * (0.18 + i * 0.22) + (R() - 0.5) * 2;
    bark += `M${n1(bx)} ${n1(top + 4 + R() * 8)} Q${n1(bx + (R() - 0.5) * 4)} ${n1((top + base) / 2)} ${n1(bx + (i - 1.5) * 5)} ${n1(base - 4 - R() * 6)} `;
  }
  inner += `<path d="${bark}" fill="none" stroke="${T.dk}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>`;
  // 뿌리 발가락 사이 홈
  inner += `<path d="M${n1(cx - wb * 0.22)} ${n1(base - 2)} q1 -5 3 -8 M${n1(cx + wb * 0.18)} ${n1(base - 2)} q-1 -5 -3 -8" fill="none" stroke="${T.dk}" stroke-width="1.3" stroke-linecap="round" opacity=".6"/>`;
  inner += flecks(L, top + 6, wt, base - top - 8, { n: 16, seed: seed + 4, vertical: true, dark: T.dk, light: T.hi, op: 0.55 });
  return part(d, T.base, inner);
}

/* ───────────── 나무 ───────────── */
function roundTree() {
  begin();
  const masses = [
    [80, 40, 35], [48, 54, 29], [112, 54, 29], [80, 78, 36],
    [33, 88, 28], [127, 88, 28], [57, 114, 27], [103, 114, 27],
  ];
  const body = groundShadow(80, 188, 46, 9) + trunk(80, 128, 186, 38, 3) + crown(masses, LEAF_T, 7, { dabs: 95, gaps: 4 });
  return finish(80, 100, body);
}

function blossomTree() {
  begin();
  const masses = [
    [80, 38, 32], [50, 52, 28], [110, 52, 28], [80, 74, 34],
    [36, 86, 26], [124, 86, 26], [59, 110, 26], [101, 110, 26],
  ];
  const extra: CrownExtra = ({ x0, y0, w, h, Lt, inside, R }) => {
    let s = "";
    // 왼쪽 위 2/3에 모인 연한 꽃잎 덩어리 (불규칙한 밝은 무늬)
    for (let k = 0, t = 0; k < 16 && t < 400; t++) {
      const px = x0 + R() * w * 0.8, py = y0 + R() * h * 0.75;
      if (!inside(px, py, 6) || Lt(px, py) > 0.62) continue;
      k++;
      const rr = 3 + R() * 4, rot = Math.round(-30 + R() * 60);
      s += `<g transform="rotate(${rot} ${n1(px)} ${n1(py)})"><path d="${scallop(px, py, rr * 1.5, rr * 0.6, 5 + Math.floor(R() * 3), R() * 6, 1.35, R, 0.6)}" fill="#ffe6ef" opacity="${n1(0.55 + R() * 0.35)}" ${blur(0.7)}/></g>`;
      if (R() < 0.7) s += `<path d="M${n1(px - 1)} ${n1(py - 1)} l${n1(1.5 + R() * 2)} ${n1(-1 - R())}" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`;
    }
    // 그늘진 오른쪽 아래엔 진분홍 '^' 꽃잎 자국
    let caret = "";
    for (let k = 0, t = 0; k < 9 && t < 400; t++) {
      const px = x0 + w * (0.35 + R() * 0.6), py = y0 + h * (0.45 + R() * 0.5);
      if (!inside(px, py, 5) || Lt(px, py) < 0.72) continue;
      k++;
      caret += `M${n1(px - 2.6)} ${n1(py + 1.6)} L${n1(px)} ${n1(py - 1.6)} L${n1(px + 2.6)} ${n1(py + 1.6)} `;
    }
    s += `<path d="${caret}" fill="none" stroke="#d93f78" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`;
    // 오른쪽 아래 가장자리를 따라 짙은 장미색 띠
    s += `<ellipse cx="${n1(x0 + w * 0.78)}" cy="${n1(y0 + h * 0.92)}" rx="${n1(w * 0.5)}" ry="${n1(h * 0.3)}" fill="#c8487a" opacity=".35" ${blur(5)}/>`;
    return s;
  };
  const body = groundShadow(80, 190, 40, 7) + grassPatch(80, 185, 38, 7, 11) +
    trunk(80, 124, 184, 32, 5) + crown(masses, BLOSSOM_T, 9, { dabs: 55, gaps: 0, extra });
  return finish(80, 100, body);
}

/** 꽃 덤불 (화면 70×50px, 아랫변 가운데가 발 닿는 곳) */
export const BUSH_SIZE = { width: 70, height: 50 };
/** 침엽수 한 층: 옆변은 곧은 비탈(작은 홈 하나), 아랫변은 둥글게 처진 잎끝 n개 */
function pineTier(cx: number, top: number, bot: number, hwTop: number, hwBot: number, n: number, { notch = true, flare = 7 } = {}) {
  const yTip = bot - 5, ySide = bot - 13;
  const side = (s: number) => {
    const p0 = [cx + s * hwTop, top];
    const p2 = [cx + s * (hwBot - flare), ySide];
    const m = 0.5, pm = [p0[0] + (p2[0] - p0[0]) * m, p0[1] + (p2[1] - p0[1]) * m];
    return { p0, p2, n1: [pm[0] + s * 2.2, pm[1]], n2: [pm[0] - s * 1.6, pm[1] + 3], tip: [cx + s * hwBot, yTip] };
  };
  const r = side(1), l = side(-1);
  const P2 = (p: Vec) => `${n1(p[0])} ${n1(p[1])}`;
  let d = hwTop < 3 ? `M${n1(cx - 2.5)} ${n1(top + 3)} Q${n1(cx)} ${n1(top - 2.5)} ${n1(cx + 2.5)} ${n1(top + 3)}` : `M${P2(l.p0)} L${P2(r.p0)}`;
  if (notch) d += ` L${P2(r.n1)} L${P2(r.n2)}`;
  d += ` L${P2(r.p2)} Q${n1(r.p2[0] + flare * 0.5)} ${n1(bot - 8)} ${P2(r.tip)}`;
  // 아랫변: 오른쪽 → 왼쪽, 가운데가 더 처진 곡선 위에 둥근 잎끝
  const tips: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    tips.push([cx + hwBot - 2 * hwBot * t, yTip + 7 * Math.sin(Math.PI * t)]);
  }
  const droop = 7;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = tips[i], [bx, by] = tips[i + 1], sw = ax - bx;
    d += ` C${n1(ax - sw * 0.05)} ${n1(ay + droop * 1.25)} ${n1(bx + sw * 0.15)} ${n1(by + droop * 1.25)} ${n1(bx)} ${n1(by)}`;
  }
  d += ` Q${n1(l.p2[0] - flare * 0.5)} ${n1(bot - 8)} ${P2(l.p2)}`;
  if (notch) d += ` L${P2(l.n2)} L${P2(l.n1)}`;
  d += hwTop < 3 ? ` L${n1(cx - 2.5)} ${n1(top + 3)}Z` : ` L${P2(l.p0)}Z`;
  return { d, tips, cx, top, bot, hwTop, hwBot, droop };
}

const PINE_T = { base: "#2f7a62", sh: "#24604f", dk: "#184437", hi: "#4f9a72", hi2: "#9fd08a", mint: "#7cc092", ol: "#1f4f44" };

function pineTree() {
  begin();
  const T = PINE_T;
  const tiers = [
    pineTier(80, 4, 52, 0, 27, 4, { notch: false, flare: 5 }),
    pineTier(80, 38, 90, 19, 41, 5),
    pineTier(80, 72, 126, 30, 53, 6),
    pineTier(80, 104, 160, 41, 66, 7),
  ];
  let body = groundShadow(80, 188, 42, 9) + trunk(80, 146, 186, 30, 4);
  for (let k = tiers.length - 1; k >= 0; k--) {
    const t = tiers[k], up = tiers[k - 1];
    const h = t.bot - t.top;
    let sh = "";
    // 오른쪽 그늘 (청록 그늘), 왼쪽 비탈을 따라 민트·연두 하이라이트
    sh += `<path d="M${n1(t.cx + t.hwBot * 0.05)} ${t.top - 10} L${n1(t.cx + t.hwBot + 12)} ${t.top - 10} L${n1(t.cx + t.hwBot + 12)} ${t.bot + 14} L${n1(t.cx + t.hwBot * 0.25)} ${t.bot + 14}Z" fill="${T.sh}"/>`;
    sh += `<path d="M${n1(t.cx - 1)} ${t.top - 6} L${n1(t.cx - t.hwTop - 14)} ${t.top - 6} L${n1(t.cx - t.hwBot - 14)} ${t.bot - 4} L${n1(t.cx - t.hwBot * 0.3)} ${n1(t.bot - h * 0.32)}Z" fill="${T.hi}" opacity=".95"/>`;
    sh += `<path d="M${n1(t.cx - t.hwTop * 0.3 - 3)} ${n1(t.top + h * 0.12)} L${n1(t.cx - t.hwBot * 0.82)} ${n1(t.bot - 14)} L${n1(t.cx - t.hwBot * 0.55)} ${n1(t.bot - 16)} L${n1(t.cx - t.hwTop * 0.15)} ${n1(t.top + h * 0.2)}Z" fill="${T.hi2}" opacity=".55"/>`;
    let inner = `<g ${blur(3.2)}>${sh}</g>`;
    // 위층이 드리운 그림자
    if (up) inner += `<path d="${up.d}" transform="translate(2 6)" fill="${T.dk}" opacity=".7" ${blur(2.2)}/>`;
    // 잎끝 바로 위의 밝은 술: 아래로 뻗은 짧은 바늘잎 붓질 (왼쪽은 민트, 오른쪽은 차분하게)
    let needL = "", needR = "", seams = "";
    for (let i = 0; i < t.tips.length - 1; i++) {
      const [xa, ya] = t.tips[i], [xb, yb] = t.tips[i + 1];
      const mx = (xa + xb) / 2, my = (ya + yb) / 2 + t.droop * 0.9, cw = Math.abs(xb - xa);
      const left = mx < t.cx + 2;
      let s = "";
      for (let j = -1; j <= 1; j++) {
        const nx = mx + j * cw * 0.22;
        s += `M${n1(nx)} ${n1(my - 11 + Math.abs(j) * 1.5)} l${n1(j * 0.8)} ${n1(5.5 - Math.abs(j))} `;
      }
      if (left) needL += s; else needR += s;
      // 잎끝 사이 갈라진 홈
      if (i > 0) seams += `M${n1(xa)} ${n1(ya + 1)} l${n1((t.cx - xa) * 0.04)} -7 `;
    }
    inner += `<path d="${needL}" fill="none" stroke="${T.hi2}" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>`;
    inner += `<path d="${needR}" fill="none" stroke="${T.mint}" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`;
    inner += `<path d="${seams}" fill="none" stroke="${T.dk}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`;
    // 비탈 위 작은 바늘잎 붓자국
    const R = rng(300 + k);
    let ndl = "";
    for (let j = 0; j < 9; j++) {
      const yy = t.top + h * (0.25 + R() * 0.45), span = t.hwTop + (t.hwBot - t.hwTop) * ((yy - t.top) / h);
      const xx = t.cx + (R() * 2 - 1) * span * 0.75;
      ndl += `M${n1(xx)} ${n1(yy)} l${n1(xx < t.cx ? -1.2 : 1.2)} 3.5 `;
    }
    inner += `<path d="${ndl}" fill="none" stroke="${T.hi2}" stroke-width="1.3" stroke-linecap="round" opacity=".35"/>`;
    body += part(t.d, T.base, inner, 2.6, T.ol);
  }
  return finish(80, 100, body);
}

export function natureTreeSvg(kind: "round" | "pine" | "blossom" = "round"): string {
  if (kind === "pine") return pineTree();
  if (kind === "blossom") return blossomTree();
  return roundTree();
}

/* ───────────── 덤불·꽃·풀 ───────────── */
function bushBody(): string {
  const masses = [[70, 30, 26], [45, 40, 23], [95, 40, 23], [70, 56, 28], [36, 64, 21], [104, 64, 21], [53, 74, 20], [87, 74, 20]];
  let body = groundShadow(70, 92, 56, 6) + grassPatch(70, 88, 58, 8, 21, { dots: 2 }) + crown(masses, BUSH_T, 13, { bump: 8, dabs: 70, gaps: 3 });
  body += fl(48, 22, 6.5, "coral") + fl(64, 46, 7, "coral") + fl(94, 42, 7.5, "coral") + fl(44, 60, 7.5, "coral") + fl(82, 76, 6.5, "white") + fl(104, 62, 5.5, "pink") + fl(88, 20, 5, "pink");
  return body;
}
export function bushSvg(): string {
  begin();
  return finish(BUSH_SIZE.width, BUSH_SIZE.height, bushBody());
}
/** 덤불을 더 큰 틀(w×h px) 아래 가운데에 놓는다 (광장 나무 자리 80×100 에 덤불을 심을 때) */
export function bushInFrameSvg(w: number, h: number): string {
  begin();
  return finish(w, h, `<g transform="translate(${w - BUSH_SIZE.width} ${(h - BUSH_SIZE.height) * 2})">${bushBody()}</g>`);
}

/** 넓고 둥근 잎 (짙은 초록에 밝은 가장자리) */
function broadLeaf(x: number, y: number, len: number, wid: number, ang: number, { fill = "#3f7d3c", edge = "#88bf5e", ol = "#2c5a3c", wavy = true } = {}) {
  const wv = wavy ? 1.6 : 0;
  const d = `M0 0 C${n1(wid * 0.9)} ${n1(-len * 0.08)} ${n1(wid * 1.15 + wv)} ${n1(-len * 0.55)} ${n1(wid * 0.35)} ${n1(-len * 0.88)} Q0 ${n1(-len * 1.04)} ${n1(-wid * 0.35)} ${n1(-len * 0.88)} C${n1(-wid * 1.15 - wv)} ${n1(-len * 0.55)} ${n1(-wid * 0.9)} ${n1(-len * 0.08)} 0 0Z`;
  const id = uid("bl");
  return `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${ang})"><clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${fill}"/>` +
    `<g clip-path="url(#${id})"><path d="${d}" fill="none" stroke="${edge}" stroke-width="3.6" opacity=".9" ${blur(0.8)}/>` +
    `<ellipse cx="${n1(wid * 0.35)}" cy="${n1(-len * 0.4)}" rx="${n1(wid * 0.45)}" ry="${n1(len * 0.3)}" fill="${darken(fill, 0.25)}" opacity=".5" ${blur(1.5)}/>` +
    `<path d="M0 -2 Q${n1(-wid * 0.1)} ${n1(-len * 0.45)} 0 ${n1(-len * 0.8)}" fill="none" stroke="${edge}" stroke-width="1.1" stroke-linecap="round" opacity=".7"/></g>` +
    `<path d="${d}" fill="none" ${SO(ol, 1.6)}/></g>`;
}

const stem = (x0: number, y0: number, x1: number, y1: number, bend = 2) => {
  const d = `M${x0} ${y0} Q${n1((x0 + x1) / 2 + bend)} ${n1((y0 + y1) / 2)} ${x1} ${y1}`;
  return `<path d="${d}" fill="none" stroke="#2c5a3c" stroke-width="3.4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#6aa346" stroke-width="1.6" stroke-linecap="round"/>`;
};

/** 꽃 포기 (화면 40×30px, 아랫변 가운데가 발 닿는 곳) */
export const FLOWERS_SIZE = { width: 40, height: 30 };
export function flowersSvg(): string {
  begin();
  let body = groundShadow(40, 55, 32, 4) + grassPatch(40, 52, 34, 5, 31, { dots: 2 });
  // 짧은 줄기 (잎 무더기 위로 살짝 솟음)
  body += stem(30, 40, 24, 18, 1) + stem(36, 40, 46, 26, 1) + stem(32, 42, 32, 34, 0);
  // 넓고 둥근 잎 무더기 (뒤 → 앞)
  body += broadLeaf(33, 52, 22, 8.5, -78) + broadLeaf(33, 52, 22, 8.5, 76) + broadLeaf(32, 52, 24, 9, -46, { fill: "#3a7438" }) +
    broadLeaf(35, 52, 24, 9, 44, { fill: "#3a7438" });
  body += fl(24, 15, 8.5, "coral") + fl(47, 24, 8, "white");
  body += broadLeaf(31, 53, 21, 8.5, -16, { fill: "#468a40" }) + broadLeaf(37, 53, 20, 8.5, 18, { fill: "#468a40" });
  body += fl(31, 33, 7.5, "yellow");
  // 오른쪽의 작은 노란 꽃 한 포기 (넓은 잎 두 장)
  body += stem(66, 48, 66, 25, 1) + broadLeaf(66, 49, 14, 6.5, -52, { fill: "#468a40" }) + broadLeaf(66, 49, 14, 6.5, 52, { fill: "#3f7d3c" });
  body += fl(66, 21, 6.5, "yellow");
  return finish(FLOWERS_SIZE.width, FLOWERS_SIZE.height, body);
}

/** 풀(잔디) 조각 (화면 34×22px, 아랫변 가운데가 발 닿는 곳) */
export const GRASS_SIZE = { width: 34, height: 22 };
/** 풀(잔디) — 위에서 본 둥근 사각 잔디 조각: 보송한 테두리, 풀잎 자국, 작은 노란 꽃 두 무더기 */
export function grassSvg(): string {
  begin();
  const cx = 34, cy = 22, a = 30, b = 18, N = 120, R = rng(41);
  const pts: Vec[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const ex = 2 / 5; // 둥근 사각 (superellipse)
    const k = i % 2 === 0 ? 1.03 + R() * 0.05 : 0.97 - R() * 0.02;
    pts.push([cx + Math.sign(c) * Math.abs(c) ** ex * a * k, cy + Math.sign(s) * Math.abs(s) ** ex * b * k]);
  }
  const d = pts2d(pts);
  const id = uid("gt");
  let inner = `<g ${blur(4)}><ellipse cx="${cx - 10}" cy="${cy - 7}" rx="18" ry="10" fill="${GR.hi}" opacity=".9"/>` +
    `<ellipse cx="${cx + 12}" cy="${cy + 10}" rx="22" ry="9" fill="${GR.sh}" opacity=".75"/>` +
    `<ellipse cx="${cx + 8}" cy="${cy - 6}" rx="8" ry="5" fill="#a8cc62" opacity=".8"/></g>`;
  // 풀잎 자국 (짙은 v자와 밝은 획)
  let bd = "", bl = "";
  for (let k = 0; k < 16; k++) {
    const px = cx + (R() * 2 - 1) * a * 0.8, py = cy + (R() * 2 - 1) * b * 0.75;
    const seg = `M${n1(px)} ${n1(py)} l${n1(-1 - R())} ${n1(-2.6 - R() * 1.6)} M${n1(px + 0.8)} ${n1(py)} l${n1(0.8 + R())} ${n1(-3 - R() * 1.6)} `;
    if (R() < 0.6) bd += seg; else bl += seg;
  }
  inner += `<path d="${bd}" fill="none" stroke="${GR.blade}" stroke-width="1.1" stroke-linecap="round" opacity=".5"/>`;
  inner += `<path d="${bl}" fill="none" stroke="#c4de84" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>`;
  // 작은 노란 꽃 무더기 두 개
  const cluster = (x: number, y: number) => [[0, 0], [3, -1.2], [1.4, 2.4]].map(([dx, dy]) => `<circle cx="${n1(x + dx)}" cy="${n1(y + dy)}" r="1.9" fill="#f6d65a" stroke="#d6a632" stroke-width=".6"/><circle cx="${n1(x + dx - 0.5)}" cy="${n1(y + dy - 0.5)}" r=".6" fill="#fff7c8"/>`).join("");
  inner += cluster(cx - 10, cy + 2) + cluster(cx + 4, cy - 2);
  // 아래 가장자리는 살짝 짙게 (두께감)
  inner += `<path d="${d}" transform="translate(0 -2.5)" fill="none" stroke="${GR.sh}" stroke-width="3" opacity=".0"/>`;
  const body = `<ellipse cx="${cx + 1}" cy="${cy + 3}" rx="${a + 1}" ry="${b + 1}" fill="#3b2a1a" opacity=".08" ${blur(1.5)}/>` +
    `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${GR.base}"/><g clip-path="url(#${id})">${inner}</g>` +
    `<path d="${d}" fill="none" stroke="${GR.ol}" stroke-width=".9" stroke-linejoin="round" opacity=".3"/>`;
  return finish(GRASS_SIZE.width, GRASS_SIZE.height, body);
}

/* ───────────── 바위·그루터기 ───────────── */
const RK = { top: "#cac2b0", topHi: "#ddd6c6", front: "#9f9888", side: "#6c675e", ol: "#5a544c", speck: "#5f5a52" };
const MOSS = { base: "#98b84a", hi: "#c2d666", sh: "#6f943a" };

/** 깎인 면이 있는 바위: 밝은 윗면, 따뜻한 회갈색 앞면, 어두운 오른쪽·아랫면 */
function rockBody(sil: Vec[], top: Vec[], side: Vec[], seed: number, extra = "") {
  const d = roundPoly(sil, 5);
  const xs = sil.map((p) => p[0]), ys = sil.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = x1 - x0, h = y1 - y0;
  const R = rng(seed);
  let inner = `<g ${blur(3)}><rect x="${x0 - 10}" y="${n1(y0 + h * 0.62)}" width="${w + 20}" height="${n1(h * 0.5)}" fill="${darken(RK.front, 0.14)}"/>` +
    `<ellipse cx="${n1(x0 + w * 0.25)}" cy="${n1(y0 + h * 0.45)}" rx="${n1(w * 0.18)}" ry="${n1(h * 0.18)}" fill="${lighten(RK.front, 0.15)}"/></g>`;
  inner += `<g ${blur(0.7)}><path d="${roundPoly(side, 3)}" fill="${RK.side}"/><path d="${roundPoly(top, 4)}" fill="${RK.top}"/></g>`;
  inner += `<g ${blur(2.5)}><path d="${roundPoly(side.map(([x, y]) => [x + 4, y + 6]), 3)}" fill="${darken(RK.side, 0.18)}" opacity=".8"/>` +
    `<ellipse cx="${n1(top[1][0] + 4)}" cy="${n1(top[1][1] + 5)}" rx="${n1(w * 0.18)}" ry="${n1(h * 0.08)}" fill="${RK.topHi}" opacity=".9"/></g>`;
  // 면 경계의 옅은 선, 금
  inner += `<path d="M${top.slice(-3).map((p) => `${n1(p[0])} ${n1(p[1])}`).join(" L")}" fill="none" stroke="${darken(RK.front, 0.3)}" stroke-width="1.1" opacity=".35"/>`;
  inner += `<path d="M${n1(x0 + w * 0.3)} ${n1(y1 - 3)} l2 -7 l-1.5 -5" fill="none" stroke="${RK.speck}" stroke-width="1.1" stroke-linecap="round" opacity=".45"/>`;
  // 반점 (짙은·밝은 작은 점)
  for (let k = 0; k < Math.round(w * h / 60); k++) {
    const px = x0 + R() * w, py = y0 + R() * h, dark = R() < 0.55;
    inner += `<circle cx="${n1(px)}" cy="${n1(py)}" r="${n1(0.6 + R() * 0.9)}" fill="${dark ? RK.speck : RK.topHi}" opacity="${dark ? 0.4 : 0.55}"/>`;
  }
  return part(d, RK.front, inner + extra, 2.6, RK.ol);
}

/** 이끼: 테두리 없는 연두 얼룩, 아래로 흘러내림 */
function mossDrape(pts: Vec[], seed: number) {
  const R = rng(seed);
  let base = "", hi = "", sh = "";
  for (const [x, y, r] of pts) {
    base += `<path d="${scallop(x, y, r, r * 0.8, 6, R() * 6, 1.3, R, 0.3)}"/>`;
    sh += `<circle cx="${n1(x + r * 0.2)}" cy="${n1(y + r * 0.45)}" r="${n1(r * 0.55)}"/>`;
    hi += `<circle cx="${n1(x - r * 0.25)}" cy="${n1(y - r * 0.3)}" r="${n1(r * 0.4)}"/>`;
  }
  return `<g fill="${MOSS.base}" opacity=".95">${base}</g><g fill="${MOSS.sh}" opacity=".55" ${blur(1)}>${sh}</g><g fill="${MOSS.hi}" opacity=".75" ${blur(0.8)}>${hi}</g>`;
}

/** 바위 (화면 46×34px, 아랫변 가운데가 발 닿는 곳) */
export const ROCK_SIZE = { width: 46, height: 34 };
export function rockSvg(): string {
  begin();
  let body = groundShadow(46, 62, 40, 5) + grassPatch(44, 59, 40, 6, 51, { dots: 2 });
  // 큰 바위: 폭/높이 ≈ 0.85, 평평한 밝은 윗면
  const big = [[12, 60], [8, 38], [12, 18], [24, 7], [42, 4], [56, 9], [62, 24], [64, 46], [58, 62]];
  const bigTop = [[12, 19], [24, 7], [42, 4], [56, 9], [60, 20], [46, 25], [26, 26]];
  const bigSide = [[46, 25], [60, 20], [62, 24], [64, 46], [58, 62], [48, 64], [50, 44]];
  const bigMoss = mossDrape([[58, 22, 5], [61, 30, 4], [60, 38, 3.5], [62, 45, 3], [52, 22, 3.5], [40, 26, 2.5]], 53);
  body += rockBody(big, bigTop, bigSide, 52, bigMoss);
  // 작은 바위: 오른쪽 아래 앞
  const small = [[42, 64], [40, 50], [48, 40], [64, 37], [78, 43], [82, 57], [74, 66]];
  const smallTop = [[40, 50], [48, 40], [64, 37], [76, 42], [64, 50], [46, 52]];
  const smallSide = [[64, 50], [76, 42], [78, 43], [82, 57], [74, 66], [66, 66]];
  const smallMoss = mossDrape([[52, 40, 5], [62, 39, 5], [71, 42, 4.5], [76, 48, 3.5], [79, 54, 3], [44, 46, 3]], 56);
  body += rockBody(small, smallTop, smallSide, 55, smallMoss);
  body += tuft(12, 62, 10, 14, 57, 8) + tuft(84, 64, 8, 10, 58, 6);
  body += [[30, 34], [20, 50], [36, 52], [70, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#f3d24e" stroke="#c9962a" stroke-width=".6"/>`).join("");
  body += fl(10, 54, 3.4, "yellow");
  return finish(ROCK_SIZE.width, ROCK_SIZE.height, body);
}

/** 통나무 울타리 한 칸 (화면 90×46px, 아랫변 가운데가 발 닿는 곳) */
export const FENCE_SIZE = { width: 90, height: 46 };
/** 나무 그루터기 (화면 44×40px, 아랫변 가운데가 발 닿는 곳) */
export const STUMP_SIZE = { width: 44, height: 40 };
export function stumpSvg(): string {
  begin();
  const cx = 42, top = 24;
  const BK = { base: "#8a5230", hi: "#b2743f", sh: "#5c321b", dk: "#3c2011" };
  let body = groundShadow(44, 73, 40, 6) + grassPatch(44, 70, 40, 7, 61, { dots: 1 });
  // 몸통 + 아래로 30%쯤 벌어지는 뿌리 혹
  const d = `M19 ${top} L19 44 C19 54 12 58 6 66 Q8 72 17 70 Q22 74 30 71 Q36 75 44 72 Q51 75 57 71 Q64 74 70 70 Q78 71 79 65 C72 59 65 54 65 44 L65 ${top}Z`;
  let sh = `<rect x="8" y="${top - 6}" width="18" height="70" fill="${BK.hi}"/>`;
  sh += `<path d="M50 ${top - 6} L90 ${top - 6} L90 84 L46 84Z" fill="${BK.sh}"/>`;
  sh += `<rect x="0" y="${top - 6}" width="90" height="12" fill="${BK.dk}" opacity=".55"/>`;
  sh += `<ellipse cx="12" cy="66" rx="7" ry="4" fill="${BK.hi}" opacity=".8"/><ellipse cx="74" cy="67" rx="7" ry="4" fill="${BK.sh}"/>`;
  let inner = `<g ${blur(3)}>${sh}</g>`;
  // 깊은 세로 홈 (짙은 홈 + 오른쪽 밝은 결)
  const grooves = [[27, 30, 25, 66], [36, 32, 35, 70], [48, 32, 50, 70], [58, 30, 61, 66]];
  for (const [xa, ya, xb, yb] of grooves) {
    inner += `<path d="M${xa} ${ya} Q${n1((xa + xb) / 2 - 1)} ${n1((ya + yb) / 2)} ${xb} ${yb}" fill="none" stroke="${BK.dk}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`;
    inner += `<path d="M${xa + 1.8} ${ya + 4} Q${n1((xa + xb) / 2 + 1)} ${n1((ya + yb) / 2)} ${xb + 1.8} ${yb - 6}" fill="none" stroke="${BK.hi}" stroke-width="1" stroke-linecap="round" opacity=".6"/>`;
  }
  inner += `<path d="M13 69 q4 -6 9 -8 M71 69 q-4 -6 -9 -8" fill="none" stroke="${BK.dk}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`;
  inner += flecks(20, 30, 44, 38, { n: 22, seed: 63, vertical: true, dark: BK.dk, light: BK.hi, op: 0.5 });
  // 아래 앞쪽의 옹이 구멍
  inner += `<ellipse cx="41" cy="60" rx="4.2" ry="5.4" fill="#2a1609" stroke="${BK.hi}" stroke-width="1.2" stroke-opacity=".7"/><ellipse cx="40" cy="58.6" rx="1.8" ry="2.2" fill="#4a2a16"/>`;
  body += part(d, BK.base, inner);
  // 윗면: 껍질 테두리 + 밝은 잘린 면(몸통보다 살짝 큼)
  body += `<ellipse cx="${cx}" cy="${top}" rx="25" ry="9.5" fill="${BK.hi}" ${SO(OUTLINE)}/>`;
  body += `<path d="M${cx - 25} ${top + 1} A25 9.5 0 0 0 ${cx + 25} ${top + 1}" fill="none" stroke="${BK.sh}" stroke-width="2" opacity=".6"/>`;
  const tid = uid("st");
  body += `<clipPath id="${tid}"><ellipse cx="${cx - 0.5}" cy="${top - 1}" rx="21.5" ry="7.4"/></clipPath>`;
  let ti = `<ellipse cx="${cx}" cy="${top}" rx="24" ry="9" fill="#d4a26b"/>`;
  ti += `<g ${blur(2)}><ellipse cx="${cx - 7}" cy="${top - 4}" rx="11" ry="3.6" fill="#ebc590" opacity=".85"/><ellipse cx="${cx + 9}" cy="${top + 4}" rx="14" ry="4" fill="#b98250" opacity=".8"/></g>`;
  ti += `<ellipse cx="${cx - 0.5}" cy="${top - 0.8}" rx="15" ry="5.1" fill="none" stroke="#a8703f" stroke-width="1.1" opacity=".55"/>`;
  ti += `<ellipse cx="${cx - 0.5}" cy="${top - 0.8}" rx="8" ry="2.8" fill="none" stroke="#a8703f" stroke-width="1" opacity=".55"/>`;
  ti += `<circle cx="${cx - 0.5}" cy="${top - 0.8}" r="1.1" fill="#7e4a2a"/>`;
  ti += `<path d="M${cx + 3} ${top - 1} l9 3.5" stroke="#8e5a32" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>`;
  body += `<g clip-path="url(#${tid})">${ti}</g>`;
  // 옆의 작은 돌, 노란 꽃
  const small = [[64, 70], [62, 60], [68, 54], [78, 54], [84, 60], [82, 70], [74, 73]];
  body += rockBody(small, [[62, 60], [68, 54], [78, 54], [83, 59], [74, 61], [64, 62]], [[74, 61], [83, 59], [84, 60], [82, 70], [74, 73]], 64);
  body += tuft(12, 70, 9, 12, 62, 7) + fl(14, 58, 3.6, "yellow") + fl(8, 63, 3, "yellow");
  return finish(STUMP_SIZE.width, STUMP_SIZE.height, body);
}

/* ───────────── 울타리·벤치·이정표 ───────────── */
export function fenceSvg(): string {
  begin();
  let body = groundShadow(92, 84, 86, 6) + grassPatch(92, 80, 86, 9, 71, { dots: 3 });
  // 3/4로 꺾여 들어가는 울타리: 앞 왼쪽 기둥이 가장 크고, 가운데로 갈수록 멀어지며 낮아졌다가 오른쪽 앞에서 다시 커진다
  const posts = [
    { x: 24, top: 10, bot: 80, w: 22 },
    { x: 72, top: 27, bot: 75, w: 20 },
    { x: 116, top: 38, bot: 71, w: 18 },
    { x: 158, top: 18, bot: 80, w: 21 },
  ];
  const at = (p: { top: number; bot: number }, f: number) => p.top + (p.bot - p.top) * f;
  for (let i = 0; i < 3; i++) {
    const a = posts[i], b = posts[i + 1];
    body += railLog(a.x, at(a, 0.3), b.x, at(b, 0.3), 10, 72 + i) + railLog(a.x, at(a, 0.64), b.x, at(b, 0.64), 10, 76 + i);
  }
  for (const [i, p] of [[2, posts[2]], [1, posts[1]], [3, posts[3]], [0, posts[0]]] as [number, (typeof posts)[number]][]) body += post(p.x, p.top, p.bot, p.w, { seed: 80 + i });
  body += tuft(12, 82, 9, 14, 77, 8) + tuft(64, 78, 8, 12, 78, 7) + tuft(126, 74, 7, 12, 88, 6) + tuft(170, 82, 9, 14, 79, 8);
  return finish(FENCE_SIZE.width, FENCE_SIZE.height, body);
}

/** 판자 벤치 (화면 90×50px, 아랫변 가운데가 발 닿는 곳) */
export const PLANK_BENCH_SIZE = { width: 90, height: 50 };
export function plankBenchSvg(): string {
  begin();
  let body = groundShadow(90, 94, 82, 6);
  // 등받이 양끝의 짧은 팔걸이 토막
  body += plank(8, 18, 18, 44, { vertical: true, seed: 81, r: 6 }) + plank(154, 18, 18, 44, { vertical: true, seed: 82, r: 6 });
  // 넓고 둥근 등받이 판 한 장
  body += plank(18, 10, 144, 34, { seed: 83, r: 10 });
  // 다리: 짧고 굵은 네모 블록
  body += plank(24, 80, 22, 17, { vertical: true, seed: 85, r: 3 }) + plank(134, 80, 22, 17, { vertical: true, seed: 86, r: 3 });
  // 앉는 판: 위에서 본 깊은 윗면(밝게) + 짙은 앞 모서리
  body += plank(8, 72, 164, 12, { seed: 87, r: 4, T: WS, grains: false });
  const seat = roundPoly([[16, 50], [164, 50], [170, 74], [10, 74]], [6, 6, 4, 4]);
  let si = `<g ${blur(3)}><rect x="0" y="40" width="180" height="12" fill="${WT.hi}"/><rect x="0" y="68" width="180" height="12" fill="${WT.sh}" opacity=".8"/><rect x="152" y="40" width="30" height="40" fill="${WT.sh}" opacity=".5"/></g>`;
  si += `<path d="M14 62 L166 62" stroke="${W.sh}" stroke-width="1.1" opacity=".35"/>`;
  si += grain(20, 50, 140, 24, { seed: 88, count: 4 }) + flecks(14, 52, 152, 20, { n: 34, seed: 89 });
  body += part(seat, WT.base, si);
  // 볼트 (짙은 점)
  const bolt = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${W.dk}"/><circle cx="${x - 0.7}" cy="${y - 0.7}" r=".8" fill="${W.lite}" opacity=".8"/>`;
  body += bolt(30, 20) + bolt(150, 20) + bolt(30, 34) + bolt(150, 34) + bolt(28, 61) + bolt(152, 61);
  return finish(PLANK_BENCH_SIZE.width, PLANK_BENCH_SIZE.height, body);
}

/** 누운 통나무 (화면 80×34px, 아랫변 가운데가 발 닿는 곳) */
export const LYING_LOG_SIZE = { width: 80, height: 34 };
/** 이정표 (화면 50×80px, 아랫변 가운데가 발 닿는 곳) */
export const SIGNPOST_SIZE = { width: 50, height: 80 };
export function signpostSvg(): string {
  begin();
  let body = groundShadow(46, 152, 22, 4.5);
  body += tuft(46, 152, 9, 26, 91, 9);
  // 기둥
  body += plank(38, 22, 16, 130, { vertical: true, seed: 92, r: 3 });
  // 꼭지: 고리(목) 위에 둥근 도토리 손잡이
  body += part(rectD(34, 20, 24, 8, 3.5), W.base, `<g ${blur(1.5)}><rect x="28" y="16" width="12" height="16" fill="${W.hi}"/><rect x="50" y="16" width="12" height="16" fill="${W.sh}"/></g>`);
  const knob = `M46 4 C55 4 58 10 56 16 Q55 21 46 21 Q37 21 36 16 C34 10 37 4 46 4Z`;
  body += part(knob, W.base, `<g ${blur(2)}><ellipse cx="42" cy="9" rx="6" ry="5" fill="${W.hi}"/><ellipse cx="53" cy="17" rx="7" ry="5" fill="${W.sh}"/></g>` +
    `<ellipse cx="41.5" cy="8.5" rx="2.2" ry="1.6" fill="${W.lite}" opacity=".8"/>`);
  body += part(`M43 5 Q46 0 49 5Z`, W.sh, "", 2);
  // 화살 판자: 높이 ≈ 폭의 45%, 짧고 뭉툭한 둥근 화살 끝, 두께 보임
  const arrow = (y: number, h: number, seed: number) => {
    const shape = (dy: number) => roundPoly([[6, y + dy], [80, y + dy], [94, y + h / 2 + dy], [80, y + h + dy], [6, y + h + dy]], [6, 6, 6, 6, 6]);
    let out = part(shape(5), WS.base, `<g ${blur(1.5)}><rect x="70" y="${y}" width="40" height="${h + 10}" fill="${WS.sh}"/></g>`);
    const inner = `<g ${blur(2.6)}><rect x="0" y="${y - 10}" width="110" height="${n1(h * 0.38 + 10)}" fill="${W.hi}"/>` +
      `<rect x="0" y="${n1(y + h * 0.72)}" width="110" height="20" fill="${W.sh}"/><rect x="78" y="${y - 10}" width="30" height="${h + 20}" fill="${W.sh}" opacity=".5"/></g>` +
      grain(10, y, 70, h, { seed, count: 3 }) + flecks(8, y + 2, 80, h - 4, { n: 26, seed: seed + 3 });
    out += part(shape(0), W.base, inner);
    for (const x of [24, 44, 64]) out += `<circle cx="${x}" cy="${n1(y + h / 2)}" r="3.2" fill="#f1dcc0" stroke="${W.dk}" stroke-width="1.1"/><circle cx="${x - 0.8}" cy="${n1(y + h / 2 - 0.9)}" r="1" fill="#ffffff"/>`;
    return out;
  };
  body += arrow(34, 36, 93) + arrow(82, 36, 94);
  return finish(SIGNPOST_SIZE.width, SIGNPOST_SIZE.height, body);
}

/* ───────────── 통나무·상자·통 ───────────── */
export function lyingLogSvg(): string {
  begin();
  const D = 32, L = 80, r = D / 2, ang = -17;
  let g = "";
  // 받침 혹 (아래로 삐죽 나온 가지 그루터기)
  g += part(rectD(16, r - 6, 14, 12, 5), W.sh, "") + part(rectD(62, r - 6, 14, 12, 5), W.sh, "");
  // 몸통 (오른쪽 끝은 둥글게)
  const d = `M0 ${-r} L${L} ${-r} A${n1(r * 0.55)} ${r} 0 0 1 ${L} ${r} L0 ${r}Z`;
  let inner = `<g ${blur(3)}><rect x="-10" y="${-r - 10}" width="${L + 30}" height="${n1(D * 0.32 + 10)}" fill="${W.hi}"/>` +
    `<rect x="-10" y="${n1(r * 0.3)}" width="${L + 30}" height="${r + 10}" fill="${W.sh}"/><rect x="${L - 4}" y="${-r - 10}" width="30" height="${D + 20}" fill="${W.sh}" opacity=".5"/></g>`;
  // 껍질 홈 (길게)
  const R = rng(101);
  let gr = "";
  for (let i = 0; i < 5; i++) {
    const yy = -r + D * (0.2 + i * 0.15) + (R() - 0.5) * 2, xa = 6 + R() * 18, xb = L - 4 - R() * 18;
    gr += `M${n1(xa)} ${n1(yy)} Q${n1((xa + xb) / 2)} ${n1(yy + (R() - 0.5) * 4)} ${n1(xb)} ${n1(yy + (R() - 0.5) * 2)} `;
  }
  inner += `<path d="${gr}" fill="none" stroke="${W.dk}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>`;
  inner += `<path d="M14 ${n1(-r * 0.6)} L${L - 10} ${n1(-r * 0.6)}" stroke="${W.lite}" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>`;
  inner += flecks(4, -r + 2, L, D - 4, { n: 40, seed: 102 });
  // 윗면 옹이 구멍 두 개
  inner += `<ellipse cx="${n1(L * 0.5)}" cy="${n1(-r * 0.55)}" rx="4.5" ry="2.4" fill="${W.dk}" stroke="${W.sh}" stroke-width="1.4"/><ellipse cx="${n1(L * 0.5 - 0.8)}" cy="${n1(-r * 0.62)}" rx="1.6" ry=".8" fill="#2a1609"/>`;
  inner += `<ellipse cx="${n1(L * 0.8)}" cy="${n1(-r * 0.2)}" rx="3" ry="1.8" fill="${W.dk}" stroke="${W.sh}" stroke-width="1.2"/>`;
  g += part(d, W.base, inner);
  // 잘린 면: 껍질보다 살짝 밝은 중간 갈색, 옅은 나이테, 작은 짙은 중심점
  g += logEnd(0, 0, r * 0.66, r, { seed: 103 });
  const body = groundShadow(82, 60, 58, 6) + `<g transform="translate(44 44) rotate(${ang})">${g}</g>`;
  return finish(LYING_LOG_SIZE.width, LYING_LOG_SIZE.height, body);
}

/** 나무 상자 (화면 44×44px, 아랫변 가운데가 발 닿는 곳) */
export const CRATE_SIZE = { width: 44, height: 44 };
/** 모서리를 앞으로 둔 3/4 상자. iso(px, py, pz) → 화면 */
export function crateSvg(): string {
  begin();
  const cx = 44, Y0 = 72, b = 0.34;
  const iso = (px: number, py: number, pz: number): Vec => [cx + (px - py), Y0 + (px + py) * b - pz];
  const quad = (A: Vec, B: Vec, C: Vec, D: Vec) => (u: number, v: number): Vec => {
    const top = [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u], bot = [D[0] + (C[0] - D[0]) * u, D[1] + (C[1] - D[1]) * u];
    return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
  };
  const poly = (M: (u: number, v: number) => Vec, uv: Vec[]) => pts2d(uv.map(([u, v]) => M(u, v)));
  const SQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // 테두리 틀 + 안으로 들어간 판 + X 버팀대
  const face = (M: (u: number, v: number) => Vec, T: Tone, seed: number, { brace = true, inset = 0.16 } = {}) => {
    const a = inset, z = 1 - inset;
    let inner = `<g ${blur(2.2)}><path d="${poly(M, [[-0.2, -0.2], [1.2, -0.2], [1.2, 0.22], [-0.2, 0.22]])}" fill="${T.hi}"/>` +
      `<path d="${poly(M, [[-0.2, 0.8], [1.2, 0.8], [1.2, 1.2], [-0.2, 1.2]])}" fill="${T.sh}" opacity=".8"/></g>`;
    inner += flecks(Math.min(M(0, 0)[0], M(0, 1)[0]), Math.min(M(0, 0)[1], M(1, 0)[1]), Math.abs(M(1, 0)[0] - M(0, 0)[0]), Math.abs(M(0, 1)[1] - M(0, 0)[1]) + 10, { n: 22, seed: seed + 5 });
    if (brace) {
      const pid = uid("cp");
      let pin = `<path d="${poly(M, [[a, a], [z, a], [z, z], [a, z]])}" fill="${T.sh}"/>`;
      pin += `<g ${blur(1.2)}><path d="${poly(M, [[a, a], [z, a], [z, a + 0.07], [a + 0.07, a + 0.07], [a + 0.07, z], [a, z]])}" fill="${darken(T.sh, 0.3)}"/></g>`;
      const bw = 0.07;
      pin += `<path d="${poly(M, [[a, a], [a + bw * 1.4, a], [z, z - bw * 1.4], [z, z], [z - bw * 1.4, z], [a, a + bw * 1.4]])}" fill="${T.base}" stroke="${darken(T.sh, 0.35)}" stroke-width="1" stroke-linejoin="round"/>`;
      pin += `<path d="${poly(M, [[z, a], [z, a + bw * 1.4], [a + bw * 1.4, z], [a, z], [a, z - bw * 1.4], [z - bw * 1.4, a]])}" fill="${T.base}" stroke="${darken(T.sh, 0.35)}" stroke-width="1" stroke-linejoin="round"/>`;
      inner += `<clipPath id="${pid}"><path d="${poly(M, [[a, a], [z, a], [z, z], [a, z]])}"/></clipPath><g clip-path="url(#${pid})">${pin}</g>`;
      inner += `<path d="${poly(M, [[a, a], [z, a], [z, z], [a, z]])}" fill="none" stroke="${OUTLINE}" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    return part(poly(M, SQ), T.base, inner);
  };
  const H = 30, s = 18;
  let body = groundShadow(46, 84, 40, 5);
  // 왼쪽 앞면(밝음), 오른쪽 앞면(그늘) — 폭이 같다
  body += face(quad(iso(-s, s, H), iso(s, s, H), iso(s, s, 0), iso(-s, s, 0)), W, 111);
  body += face(quad(iso(s, s, H), iso(s, -s, H), iso(s, -s, 0), iso(s, s, 0)), WS, 113);
  // 윗면 테두리 + 안쪽(어둡게)
  const ti = 4.5;
  body += part(pts2d([iso(-s, -s, H), iso(s, -s, H), iso(s, s, H), iso(-s, s, H)]), WT.base,
    `<path d="${pts2d([iso(-s + ti, -s + ti, H), iso(s - ti, -s + ti, H), iso(s - ti, s - ti, H), iso(-s + ti, s - ti, H)])}" fill="#4e2b17"/>` +
    `<path d="${pts2d([iso(-s + ti, -s + ti, H), iso(s - ti, -s + ti, H), iso(s - ti, -s + ti + 6, H - 6), iso(-s + ti + 6, -s + ti + 6, H - 6), iso(-s + ti, s - ti, H)])}" fill="#3a1f10" opacity=".6"/>`);
  // 위에 올린 큰 나무 토막 (밑동 폭의 약 50%, 폭보다 높음)
  const k = 9, zb = H - 8, zt = H + 33;
  body += face(quad(iso(-k, k, zt), iso(k, k, zt), iso(k, k, zb), iso(-k, k, zb)), W, 115, { brace: false });
  body += face(quad(iso(k, k, zt), iso(k, -k, zt), iso(k, -k, zb), iso(k, k, zb)), WS, 116, { brace: false });
  const top = pts2d([iso(-k, -k, zt), iso(k, -k, zt), iso(k, k, zt), iso(-k, k, zt)]);
  body += part(top, WT.hi, `<g ${blur(1.5)}><path d="${pts2d([iso(-k, -k, zt), iso(0, -k, zt), iso(0, k, zt), iso(-k, k, zt)])}" fill="${lighten(WT.hi, 0.2)}"/></g>` +
    `<ellipse cx="${n1(iso(0, 0, zt)[0])}" cy="${n1(iso(0, 0, zt)[1])}" rx="5" ry="2" fill="none" stroke="${W.ring}" stroke-width="1" opacity=".4"/>`);
  body += `<path d="M${n1(iso(k, k, zt)[0] - 6)} ${n1(iso(k, k, zt)[1] + 4)} l-2 10" stroke="${W.dk}" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>`;
  // 앞쪽 테두리 두 변을 토막 위에 다시 그려 '안에 들어앉은' 느낌
  const rim = pts2d([iso(-s, s, H), iso(s, s, H), iso(s, -s, H), iso(s - ti, -s + ti, H), iso(s - ti, s - ti, H), iso(-s + ti, s - ti, H)]);
  body += part(rim, WT.base, `<g ${blur(1)}><path d="${pts2d([iso(-s, s, H), iso(s, s, H), iso(s, s - ti, H), iso(-s, s - ti, H)])}" fill="${WT.hi}"/></g>` + flecks(10, 30, 70, 30, { n: 14, seed: 118 }));
  return finish(CRATE_SIZE.width, CRATE_SIZE.height, body);
}

/** 빨간 우체통 (화면 36×64px, 아랫변 가운데가 발 닿는 곳) */
export const MAILBOX_SIZE = { width: 36, height: 64 };
/** 나무 통 (화면 40×46px, 아랫변 가운데가 발 닿는 곳) */
export const BARREL_SIZE = { width: 40, height: 46 };
export function barrelSvg(): string {
  begin();
  const cx = 40, ty = 22, by = 84, rt = 25, rm = 32, ery = 8;
  let body = groundShadow(40, 87, 32, 4.5);
  const d = `M${cx - rt} ${ty} C${cx - rm - 3} ${ty + 18} ${cx - rm - 3} ${by - 18} ${cx - rt} ${by} A${rt} ${ery} 0 0 0 ${cx + rt} ${by} C${cx + rm + 3} ${by - 18} ${cx + rm + 3} ${ty + 18} ${cx + rt} ${ty}Z`;
  // 널판: 밝은 판·어두운 판을 번갈아
  const edge = (k: number) => {
    const e = Math.sqrt(Math.max(0, 1 - k * k));
    return { t: [cx + rt * k, ty + ery * e], b: [cx + rt * k, by + ery * e], m: [cx + (2 * rm - rt) * k, (ty + by) / 2 + ery * e] };
  };
  const ks = [-1, -0.74, -0.44, -0.14, 0.16, 0.46, 0.75, 1];
  let staves = "", lines = "";
  for (let i = 0; i < ks.length - 1; i++) {
    const A = edge(ks[i]), B = edge(ks[i + 1]);
    const p = `M${n1(A.t[0])} ${n1(A.t[1])} Q${n1(A.m[0])} ${n1(A.m[1])} ${n1(A.b[0])} ${n1(A.b[1])} L${n1(B.b[0])} ${n1(B.b[1])} Q${n1(B.m[0])} ${n1(B.m[1])} ${n1(B.t[0])} ${n1(B.t[1])}Z`;
    staves += `<path d="${p}" fill="${i % 2 ? "#3a1d0c" : "#f0b979"}" opacity="${i % 2 ? 0.16 : 0.14}"/>`;
    if (i > 0) lines += `M${n1(A.t[0])} ${n1(A.t[1])} Q${n1(A.m[0])} ${n1(A.m[1])} ${n1(A.b[0])} ${n1(A.b[1])} `;
  }
  let inner = staves + `<g ${blur(4)}><rect x="0" y="0" width="${cx - 14}" height="100" fill="${W.hi}" opacity=".75"/>` +
    `<path d="M${cx + 12} 0 L80 0 L80 100 L${cx + 8} 100Z" fill="${W.sh}"/><path d="M${cx + 26} 0 L80 0 L80 100 L${cx + 24} 100Z" fill="${W.dk}" opacity=".6"/></g>`;
  inner += `<path d="${lines}" fill="none" stroke="${W.dk}" stroke-width="1.5" opacity=".75"/>`;
  inner += flecks(cx - 28, ty + 6, 56, by - ty - 6, { n: 40, seed: 121, vertical: true });
  // 쇠테: 넓고 짙은 슬레이트 회색, 높이의 25%·78% 지점
  const band = (y: number) => {
    const dy = (y - ty) / (by - ty), rx = rt + (rm - rt) * 4 * dy * (1 - dy) + 2;
    const p = `M${n1(cx - rx - 3)} ${n1(y)} A${n1(rx + 3)} ${ery} 0 0 0 ${n1(cx + rx + 3)} ${n1(y)}`;
    return `<path d="${p}" fill="none" stroke="${OUTLINE}" stroke-width="10"/><path d="${p}" fill="none" stroke="#5c6370" stroke-width="7"/>` +
      `<path d="${p}" fill="none" stroke="#8a929e" stroke-width="1.8" transform="translate(-1.5 -2)" opacity=".85"/>` +
      `<path d="M${n1(cx + rx * 0.4)} ${n1(y + ery * 0.9)} A${n1(rx + 3)} ${ery} 0 0 0 ${n1(cx + rx + 3)} ${n1(y)}" fill="none" stroke="#3d424b" stroke-width="5" opacity=".6"/>`;
  };
  inner += band(ty + (by - ty) * 0.25) + band(ty + (by - ty) * 0.78);
  body += part(d, W.base, inner);
  // 윗 테두리 + 안을 덮은 둥근 초록 더미 (테두리 위로 살짝 솟음)
  body += `<ellipse cx="${cx}" cy="${ty}" rx="${rt}" ry="${ery}" fill="${W.hi}" ${SO(OUTLINE)}/>`;
  body += `<ellipse cx="${cx + 0.5}" cy="${ty + 0.8}" rx="${rt - 3.5}" ry="${ery - 2.6}" fill="#3a2010"/>`;
  const irx = rt - 4, iry = ery - 2.6;
  const R = rng(123);
  let top = `M${cx - irx} ${ty + 0.8}`;
  const nb = 9;
  const pts: Vec[] = [];
  for (let i = 0; i <= nb; i++) {
    const t = i / nb, a = Math.PI * (1 - t);
    pts.push([cx + Math.cos(a) * irx, ty + 0.8 - Math.sin(a) * (iry + 7) - (R() - 0.5) * 1.5]);
  }
  for (let i = 1; i <= nb; i++) {
    const [px, py] = pts[i - 1], [qx, qy] = pts[i];
    const r = (Math.hypot(qx - px, qy - py) / 2) * 1.25;
    top += ` A${n1(r)} ${n1(r)} 0 0 1 ${n1(qx)} ${n1(qy)}`;
  }
  top += ` A${irx} ${iry} 0 0 1 ${cx - irx} ${ty + 0.8}Z`;
  let mi = `<g ${blur(2.5)}><ellipse cx="${cx - 7}" cy="${ty - 5}" rx="10" ry="4" fill="#6f9a3e"/><ellipse cx="${cx + 10}" cy="${ty + 2}" rx="12" ry="4" fill="#24452a"/></g>`;
  for (let i = 0; i < 26; i++) {
    const px = cx - irx + 3 + R() * (irx * 2 - 6), py = ty - 6 + R() * 9;
    mi += `<circle cx="${n1(px)}" cy="${n1(py)}" r="${n1(0.7 + R() * 1.1)}" fill="${R() < 0.6 ? "#b8cc4c" : "#86b04a"}" opacity="${n1(0.6 + R() * 0.4)}"/>`;
  }
  body += part(top, "#3f6a35", mi, 1.8, "#2c5a3c");
  return finish(BARREL_SIZE.width, BARREL_SIZE.height, body);
}

/* ───────────── 우체통·빨래대·화분 ───────────── */
export function mailboxSvg(): string {
  begin();
  const RD = { base: "#d9433b", hi: "#ef6a5f", top: "#e9584e", sh: "#a8302a", dk: "#7e211c" };
  let body = groundShadow(38, 122, 20, 4);
  // 짧고 굵은 네모 기둥 (오른쪽 옆면 어둡게)
  body += part(pts2d([[41, 88], [48, 84], [48, 118], [41, 122]]), RD.dk, "");
  body += part(rectD(27, 86, 14, 36, 2), RD.base, `<g ${blur(2)}><rect x="20" y="80" width="10" height="50" fill="${RD.hi}"/><rect x="20" y="80" width="30" height="10" fill="${RD.dk}" opacity=".8"/><rect x="36" y="80" width="10" height="50" fill="${RD.sh}"/></g>`);
  // 통: 앞면을 오른쪽 위로 밀어 두께를 만든다 (둥근 윗면이 위에서 살짝 보임, 오른쪽 옆면은 좁고 어둡게)
  const front = `M10 90 L10 30 Q10 12 31 12 Q52 12 52 30 L52 90Z`;
  const steps = 8, dx = 8, dy = -6;
  const copies = Array.from({ length: steps + 1 }, (_, i) => `<path d="${front}" transform="translate(${n1((dx * i) / steps)} ${n1((dy * i) / steps)})"/>`).join("");
  const cid = uid("mb");
  body += `<g fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="5.2" stroke-linejoin="round">${copies}</g>`;
  body += `<clipPath id="${cid}">${copies}</clipPath><g clip-path="url(#${cid})"><rect x="0" y="0" width="72" height="100" fill="${RD.top}"/>` +
    `<g ${blur(1.2)}><path d="M52 30 L62 22 L62 86 L52 92Z" fill="${RD.sh}"/><path d="M50 18 Q56 14 60 20 L62 26 L54 31Z" fill="${RD.sh}" opacity=".7"/></g>` +
    `<ellipse cx="28" cy="10" rx="12" ry="3" fill="#ffd2c8" opacity=".55" ${blur(1.5)}/></g>`;
  let inner = `<g ${blur(3)}><rect x="0" y="0" width="18" height="100" fill="${RD.hi}"/><rect x="44" y="0" width="20" height="100" fill="${RD.sh}" opacity=".85"/>` +
    `<rect x="0" y="78" width="70" height="20" fill="${RD.sh}" opacity=".6"/></g>`;
  inner += `<ellipse cx="22" cy="24" rx="9" ry="6" fill="#ffffff" opacity=".45" ${blur(2.2)}/><ellipse cx="19" cy="21" rx="3.5" ry="2" fill="#ffffff" opacity=".7" ${blur(0.8)}/>`;
  body += part(front, RD.base, inner);
  // 투입구, 작은 문패, 옆 나사
  body += `<rect x="18" y="36" width="28" height="11" rx="3.5" fill="${RD.dk}" ${SO(OUTLINE, 1.8)}/><rect x="21" y="38" width="22" height="3.6" rx="1.6" fill="#fff4ea"/>`;
  body += `<rect x="24" y="56" width="16" height="5" rx="2" fill="#fff4ea" ${SO(OUTLINE, 1.4)}/>`;
  body += `<circle cx="14" cy="46" r="1.8" fill="${RD.dk}"/>`;
  return finish(MAILBOX_SIZE.width, MAILBOX_SIZE.height, body);
}

/** 빨래: 윗단이 막대 위로 접혀 넘어간 하얀 천 */
function cloth(x: number, w: number, len: number, barY: number, th: number, seed: number) {
  const R = rng(seed);
  const OLc = "#8c7a70";
  const top = barY + th / 2 - 1, bot = top + len;
  // 몸판 (아래 단은 물결)
  let d = `M${x} ${top} L${x + w} ${top} L${n1(x + w + 1)} ${n1(bot - 2)}`;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const xa = x + w + 1 - ((w + 2) * i) / n, xb = x + w + 1 - ((w + 2) * (i + 1)) / n;
    d += ` Q${n1((xa + xb) / 2)} ${n1(bot + 2 + (R() - 0.5) * 2)} ${n1(xb)} ${n1(bot - 1 + (R() - 0.5) * 2)}`;
  }
  d += "Z";
  let inner = `<g ${blur(2.5)}><rect x="${x + w * 0.65}" y="${top}" width="${w}" height="${len + 6}" fill="#ddd2dc"/>` +
    `<rect x="${x - 4}" y="${top - 2}" width="${w + 8}" height="7" fill="#cbbfc9"/>` +
    `<path d="M${n1(x + w * 0.38)} ${top + 8} Q${n1(x + w * 0.32)} ${n1(top + len * 0.5)} ${n1(x + w * 0.42)} ${bot - 4}" stroke="#e2d8e0" stroke-width="3" fill="none"/></g>`;
  inner += `<path d="M${n1(x + w * 0.7)} ${top + 12} Q${n1(x + w * 0.74)} ${n1(top + len * 0.6)} ${n1(x + w * 0.66)} ${bot - 3}" fill="none" stroke="#d3c6d1" stroke-width="1.3" stroke-linecap="round"/>`;
  let out = part(d, "#fbf6ef", inner, 2.2, OLc);
  // 막대 위로 넘어온 덮개
  const fy0 = barY - th / 2 - 2.5, fy1 = barY + th / 2 + 4;
  const fd = `M${x - 1} ${n1(fy0 + 1.5)} Q${n1(x + w / 2)} ${n1(fy0 - 1.5)} ${x + w + 1} ${n1(fy0 + 1.5)} L${x + w + 1.5} ${n1(fy1)} Q${n1(x + w * 0.75)} ${n1(fy1 + 2)} ${n1(x + w / 2)} ${n1(fy1)} Q${n1(x + w * 0.25)} ${n1(fy1 + 2)} ${x - 1.5} ${n1(fy1)}Z`;
  out += part(fd, "#fffaf3", `<g ${blur(1.5)}><rect x="${x + w * 0.6}" y="${fy0 - 4}" width="${w}" height="20" fill="#e6dce4"/></g>`, 2, OLc);
  return out;
}

/** 빨래대 (화면 90×70px, 아랫변 가운데가 발 닿는 곳) */
export const LAUNDRY_SIZE = { width: 90, height: 70 };
export function laundrySvg(): string {
  begin();
  let body = grassPatch(34, 128, 18, 4, 138, { dots: 0, blades: 2 }) + grassPatch(146, 128, 18, 4, 139, { dots: 0, blades: 2 });
  body += groundShadow(34, 129, 12, 3) + groundShadow(146, 129, 12, 3);
  // 기둥: 꼭대기는 잘린 통나무 끝면
  body += post(34, 18, 128, 17, { seed: 131, cap: "cut" }) + post(146, 18, 128, 17, { seed: 132, cap: "cut" });
  // 가로대: 굵기가 고르지 않은 둥근 가지, 가운데가 살짝 처지고 양끝이 기둥 밖으로 나온다
  const X0 = 6, X1 = 174, N = 24;
  const yc = (t: number) => 38 + 4 * Math.sin(Math.PI * t);
  const th = (t: number) => 10 + 1.6 * Math.sin(t * 17 + 1) + 1.1 * Math.sin(t * 31);
  const topP: Vec[] = [], botP: Vec[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = X0 + (X1 - X0) * t;
    topP.push([x, yc(t) - th(t) / 2]);
    botP.push([x, yc(t) + th(t) / 2]);
  }
  const bar = "M" + topP.map((p) => `${n1(p[0])} ${n1(p[1])}`).join(" L") +
    ` A4 ${n1(th(1) / 2)} 0 0 1 ${n1(botP[N][0])} ${n1(botP[N][1])} L` + botP.slice().reverse().map((p) => `${n1(p[0])} ${n1(p[1])}`).join(" L") +
    ` A4 ${n1(th(0) / 2)} 0 0 1 ${n1(topP[0][0])} ${n1(topP[0][1])}Z`;
  // 혹 (작은 가지 그루터기)
  body += `<ellipse cx="74" cy="${n1(yc(0.4) - th(0.4) / 2 + 0.5)}" rx="4.5" ry="3.2" fill="${W.hi}" ${SO(OUTLINE, 2.2)}/>` + `<ellipse cx="118" cy="${n1(yc(0.67) + th(0.67) / 2 - 0.5)}" rx="4" ry="3" fill="${W.sh}" ${SO(OUTLINE, 2.2)}/>`;
  const barIn = `<g ${blur(1.8)}><path d="M0 0 L180 0 L180 ${n1(yc(0.5) - 2)} L0 ${n1(yc(0) - 3)}Z" fill="${W.hi}"/><path d="M0 ${n1(yc(0) + 3)} L180 ${n1(yc(1) + 3)} L180 60 L0 60Z" fill="${W.sh}"/></g>` +
    `<path d="M10 ${n1(yc(0) - 3)} Q90 ${n1(yc(0.5) - 3.5)} 170 ${n1(yc(1) - 3)}" fill="none" stroke="${W.lite}" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>` +
    flecks(8, 30, 164, 14, { n: 40, seed: 134 });
  body += part(bar, W.base, barIn);
  body += logEnd(X0 + 1, yc(0), 3.5, th(0) / 2 - 0.5, { seed: 141 });
  // 기둥과 만나는 곳의 밧줄 감기
  const rope = (x: number) => {
    let s = "";
    for (const ox of [-5, 0, 5]) s += `<g transform="translate(${x + ox} ${n1(yc((x - X0) / (X1 - X0)))}) rotate(18)"><rect x="-1.8" y="-8" width="3.6" height="16" rx="1.6" fill="#d9bf88" stroke="#7a5a32" stroke-width="1"/><path d="M-0.6 -6 L-0.6 6" stroke="#f3e2b8" stroke-width=".9" opacity=".8"/></g>`;
    return s;
  };
  body += rope(34) + rope(146);
  body += cloth(56, 30, 58, yc(0.32), th(0.32), 134) + cloth(96, 30, 62, yc(0.55), th(0.55), 135);
  body += tuft(30, 130, 13, 26, 136, 10) + tuft(150, 130, 12, 26, 137, 9);
  return finish(LAUNDRY_SIZE.width, LAUNDRY_SIZE.height, body);
}

/** 끝이 뾰족한 잎 (화분 식물) */
function pointLeaf(x: number, y: number, len: number, wid: number, ang: number, fill: string, ol = "#2c5a3c") {
  const d = `M0 0 C${n1(wid)} ${n1(-len * 0.2)} ${n1(wid * 0.9)} ${n1(-len * 0.7)} 0 ${n1(-len)} C${n1(-wid * 0.9)} ${n1(-len * 0.7)} ${n1(-wid)} ${n1(-len * 0.2)} 0 0Z`;
  return `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${ang})"><path d="${d}" fill="${fill}" ${SO(ol, 1.5)}/>` +
    `<path d="M0 -2 L0 ${n1(-len * 0.78)}" stroke="${lighten(fill, 0.35)}" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M${n1(wid * 0.15)} ${n1(-len * 0.25)} Q${n1(wid * 0.75)} ${n1(-len * 0.5)} ${n1(wid * 0.1)} ${n1(-len * 0.85)}" fill="none" stroke="${darken(fill, 0.25)}" stroke-width="1.6" opacity=".5"/></g>`;
}

/** 꽃 화분 (화면 60×40px, 아랫변 가운데가 발 닿는 곳) */
export const PLANTER_SIZE = { width: 60, height: 40 };
export function planterSvg(): string {
  begin();
  let body = groundShadow(60, 75, 52, 4.5);
  // 모서리의 밝은 받침 블록
  body += plank(14, 66, 14, 10, { vertical: true, T: WT, seed: 140, r: 2.5 }) + plank(92, 66, 14, 10, { vertical: true, T: WT, seed: 141, r: 2.5 });
  // 위에서 본 길쭉한 화분: 앞면(끝이 둥글다) + 밝은 안쪽 테두리 고리
  const front = `M6 48 L114 48 Q115 66 104 70 L16 70 Q5 66 6 48Z`;
  let fi = `<g ${blur(2.5)}><rect x="0" y="40" width="120" height="14" fill="${W.hi}" opacity=".7"/><rect x="0" y="62" width="120" height="14" fill="${W.sh}"/><rect x="100" y="40" width="20" height="40" fill="${W.sh}" opacity=".6"/><rect x="0" y="40" width="14" height="40" fill="${W.hi}" opacity=".5"/></g>`;
  fi += `<path d="M8 59 L112 59" stroke="${W.dk}" stroke-width="1.2" opacity=".45"/>` + grain(14, 50, 92, 9, { seed: 142, count: 2 }) + grain(14, 59, 92, 10, { seed: 143, count: 2 });
  fi += flecks(10, 50, 100, 18, { n: 30, seed: 144 });
  body += part(front, W.base, fi);
  const rimO = rectD(4, 38, 112, 18, 9), rimI = rectD(12, 42, 96, 10, 5);
  body += part(rimO, WT.base, `<g ${blur(1.5)}><rect x="0" y="34" width="120" height="7" fill="${WT.hi}"/><rect x="100" y="34" width="20" height="30" fill="${WT.sh}" opacity=".6"/></g>` + flecks(8, 39, 104, 16, { n: 18, seed: 145 }));
  body += `<path d="${rimI}" fill="#4a2a17" ${SO(OUTLINE, 1.8)}/>`;
  // 식물: 둥근 잎 덩어리 + 실루엣을 깨는 뾰족한 잎
  const leaves: [number, number, number, number, number, string][] = [[14, 48, 18, 6, -70, "#4f9443"], [22, 44, 20, 7, -40, "#5d9e47"], [104, 48, 18, 6, 72, "#3f7d3c"], [98, 44, 20, 7, 42, "#467f3d"],
    [40, 40, 22, 7, -14, "#6aa84a"], [80, 40, 22, 7, 18, "#4f9443"], [60, 38, 22, 7, 4, "#5d9e47"]];
  for (const [x, y, l, w, a, c] of leaves) body += pointLeaf(x, y, l, w, a, c);
  const masses = [[38, 30, 15], [60, 24, 17], [84, 28, 15], [24, 40, 12], [96, 40, 12], [48, 42, 13], [72, 42, 13]];
  body += crown(masses, BUSH_T, 146, { bump: 8, dabs: 40, gaps: 2, crescent: 0.14 });
  body += pointLeaf(22, 50, 14, 5, -95, "#5d9e47") + pointLeaf(98, 50, 14, 5, 95, "#3f7d3c") + pointLeaf(58, 50, 12, 4.5, 170, "#467f3d");
  // 큰 꽃 (흰 꽃 ≈ 화분 폭의 20%), 테두리 위로 넘친다
  body += fl(60, 18, 12, "white") + fl(86, 34, 10, "coral") + fl(34, 32, 9.5, "peach") + fl(100, 22, 6.5, "pink") + fl(18, 36, 6, "yellow");
  return finish(PLANTER_SIZE.width, PLANTER_SIZE.height, body);
}

