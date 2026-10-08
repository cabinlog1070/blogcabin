// 미니룸 배경 (SVG 장면). 2026-10-08 디자인 시안 ③ "배경 프리셋" 그림체를 옮겼다.
// 좌표: 높이 180, 너비 W. 너비에 따라 두 가지 배치로 그린다.
//  - 넓은 배치 (W > 400, 블로그 미니룸 760): 땅은 y≈120~128부터, 캐릭터는 가운데 아래(발 y≈170)에 선다.
//    넓게 그릴 때도 확대하지 않고 구름·나무·집을 더 놓는다. 좁은 화면에서는 가운데 ±150만 보이므로
//    가운데 가까이(캐릭터 자리 ±40은 비우고)에도 소품을 둔다.
//  - 작은 칸 배치 (W ≤ 400, 상점·꾸미기·알림의 ItemArt 320): 칸이 1:1~1.25:1이라 bg-cover로 가운데 ±90~112만 보인다.
//    캐릭터를 올리지 않으므로 주인공 소품(나무·야자수·오두막·해·빌딩·행성)을 가운데 ±90 안에 1.3~1.5배로 크게 둔다.
//    0.36~0.62배로 줄어 보이므로 선은 1.8배 굵게(SK), 잔 무늬(점·풀 포기·조개·꽃잎)는 빼거나 크고 적게 그린다.
// 하늘·언덕·구름은 외곽선 없는 부드러운 그라데이션, 앞쪽 소품(나무·집·야자수·건물·행성)은 외곽선 + 세 톤 명암
// (바탕, 오른쪽 아래 그늘, 왼쪽 위 밝은 면). 빛은 왼쪽 위.
// 외곽선: 목재(나무 줄기·통나무 벽)는 공통 짙은 갈색(OUTLINE), 잎·꽃·눈·건물·행성은 제 색을 짙게 한 선 (props.ts와 같은 규칙).
// DB의 asset_key("bg.meadow" 등)로 고른다. accent는 광장 집 지붕 기본 색으로도 쓴다 (scripts/test-batch-d.ts가 초원 값을 확인한다).
import { OUTLINE, PALETTE as P, S, darken, lighten, rng } from "./style";

const H = 180;
/** 캐릭터·가구가 서는 땅의 윗선 */
const GROUND = 128;

type Rand = () => number;
type Pt = [number, number];
type Stop = [offset: number, color: string, opacity?: number];
type Tone = { base: string; sh: string; hi: string };

const n1 = (v: number) => Math.round(v * 10) / 10;

/** 선 굵기 배율. 작은 칸 그림은 0.36~0.62배로 줄어 보여서 1.8배로 그린다.
 *  backgroundSvg가 장면 하나를 그리는 동안만 바뀐다 (동기 함수라 다른 그림과 섞이지 않는다) */
let SK = 1;
/** 제 색 외곽선. 둥근 이음·끝은 <svg>에 한 번 걸어 둔다 */
const SO = (c: string, w = 1.1) => `stroke="${c}" stroke-width="${n1(w * SK)}"`;
/** 공통 짙은 갈색 외곽선 */
const SB = (w = 1.1) => S(n1(w * SK));

/** 그림 하나를 그리는 동안 쓰는 defs(그라데이션·흐림·자르기)와 id.
 *  id는 (장면, 너비)와 순서로만 정해진다: 같은 배경은 서버와 브라우저에서 같은 문자열이 되어야 해서
 *  (상점·꾸미기 화면은 클라이언트 컴포넌트) 전역 카운터 uid() 대신 그림마다 0부터 센다. data URI 그림은 문서가 따로라 겹치지 않는다 */
function makeCanvas(W: number, prefix: string) {
  const defs: string[] = [];
  const blurs = new Map<string, string>();
  const grads = new Map<string, string>();
  let n = 0;
  const id = (p: string) => `${prefix}${p}${(n++).toString(36)}`;
  /** 같은 그라데이션은 한 번만 정의한다 (창문 빛·반짝이처럼 여러 번 쓰는 것) */
  const grad = (tag: string) => {
    let i = grads.get(tag);
    if (!i) {
      i = id("g");
      grads.set(tag, i);
      defs.push(tag.replace(/^<(\w+)/, `<$1 id="${i}"`));
    }
    return `url(#${i})`;
  };
  const stopTags = (stops: Stop[]) =>
    stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? "" : ` stop-opacity="${a}"`}/>`).join("");
  return {
    W,
    /** 가운데 x */
    m: W / 2,
    /** 작은 칸 배치 (상점·꾸미기 미리보기) */
    thumb: W <= 400,
    defs,
    id,
    /** 세로(기본) 선형 그라데이션 → fill 값 */
    linear(stops: Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
      return grad(`<linearGradient x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopTags(stops)}</linearGradient>`);
    },
    radial(stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5) {
      return grad(`<radialGradient cx="${cx}" cy="${cy}" r="${r}">${stopTags(stops)}</radialGradient>`);
    },
    /** 부드러운 명암·빛 번짐용 흐림. 영역은 화면 전체(userSpace)로 잡는다 → 흐림을 건 요소는 transform 없이 그린다 */
    blur(sd: number) {
      const k = String(n1(sd));
      let i = blurs.get(k);
      if (!i) {
        i = id("b");
        blurs.set(k, i);
        defs.push(`<filter id="${i}" filterUnits="userSpaceOnUse" x="-40" y="-40" width="${W + 80}" height="${H + 80}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${k}"/></filter>`);
      }
      return `filter="url(#${i})"`;
    },
    /** 칠한 면 하나: 바탕색 → (모양 안으로 잘라낸) 명암 → 외곽선 (ol이 빈 문자열이면 선 없음). 선 굵기에는 SK가 곱해진다.
     *  명암이 있으면 경로를 defs에 한 번만 두고 <use>로 칠·자르기·외곽선에 다시 쓴다 (data URI 크기를 줄이려고) */
    part(d: string, fill: string, inner: string, ol: string, w = 1.1) {
      const stroke = ol ? ` ${ol === OUTLINE ? SB(w) : SO(ol, w)}` : "";
      if (!inner) return `<path d="${d}" fill="${fill}"${stroke}/>`;
      const pid = id("p");
      const cid = id("c");
      defs.push(`<path id="${pid}" d="${d}"/><clipPath id="${cid}"><use href="#${pid}"/></clipPath>`);
      return `<use href="#${pid}" fill="${fill}"/><g clip-path="url(#${cid})">${inner}</g>${ol ? `<use href="#${pid}" fill="none"${stroke}/>` : ""}`;
    },
  };
}
type Cv = ReturnType<typeof makeCanvas>;

/* ───────────── 모양 도우미 ───────────── */

/** 점들을 부드럽게 잇는 선 (중점 사이를 2차 곡선으로) */
function smooth(pts: Pt[]): string {
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += `Q${n1(x)} ${n1(y)} ${n1((x + nx) / 2)} ${n1((y + ny) / 2)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return d + `L${n1(lx)} ${n1(ly)}`;
}

/** 너비 전체에 걸친 언덕 (윗선이 부드럽게 오르내리고 아래는 화면 끝까지) */
function ridge(W: number, base: number, amp: number, step: number, rand: Rand): string {
  const pts: Pt[] = [];
  for (let x = -step; x <= W + step; x += step * (0.7 + rand() * 0.6)) pts.push([x, base - amp * (0.2 + rand() * 0.8)]);
  pts.push([W + step * 1.5, base - amp * 0.5]);
  return smooth(pts) + `L${n1(W + step * 2)} ${H + 4}L${-step * 2} ${H + 4}Z`;
}

/** 또렷한 봉우리가 번갈아 오는 먼 언덕 (높은 점과 낮은 점을 번갈아 둬서 평평한 띠가 되지 않는다) */
function hills(W: number, base: number, amp: number, step: number, rand: Rand): string {
  const pts: Pt[] = [];
  let i = 0;
  for (let x = -step * (0.3 + rand() * 0.6); x <= W + step; x += step * (0.4 + rand() * 0.25), i++) pts.push([x, base - amp * (i % 2 ? 0.15 + rand() * 0.25 : 0.7 + rand() * 0.3)]);
  pts.push([W + step * 1.5, base - amp * 0.4]);
  return smooth(pts) + `L${n1(W + step * 2)} ${H + 4}L${-step * 2} ${H + 4}Z`;
}

/** 모서리를 둥글린 다각형 (화면에서 시계 방향으로 점을 주면 원·다른 면과 합쳐 칠해진다) */
function roundPoly(pts: Pt[], r = 2): string {
  const N = pts.length;
  let d = "";
  for (let i = 0; i < N; i++) {
    const p = pts[(i - 1 + N) % N];
    const v = pts[i];
    const q = pts[(i + 1) % N];
    const l1 = Math.hypot(p[0] - v[0], p[1] - v[1]) || 1;
    const l2 = Math.hypot(q[0] - v[0], q[1] - v[1]) || 1;
    const k1 = Math.min(r, l1 / 2) / l1;
    const k2 = Math.min(r, l2 / 2) / l2;
    d += `${i ? "L" : "M"}${n1(v[0] + (p[0] - v[0]) * k1)} ${n1(v[1] + (p[1] - v[1]) * k1)}Q${n1(v[0])} ${n1(v[1])} ${n1(v[0] + (q[0] - v[0]) * k2)} ${n1(v[1] + (q[1] - v[1]) * k2)}`;
  }
  return d + "Z";
}
const rectD = (x: number, y: number, w: number, h: number, r = 1.5) => roundPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
/** 원 (시계 방향이라 rectD·다른 원과 겹쳐도 구멍이 나지 않는다) */
const circD = (cx: number, cy: number, r: number) =>
  `M${n1(cx - r)} ${n1(cy)}a${n1(r)} ${n1(r)} 0 1 1 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 1 ${n1(-2 * r)} 0Z`;

/** 잎 뭉치처럼 울퉁불퉁한 타원 (바깥으로 볼록한 호 n개). pts = 호 사이 꼭짓점 (주름 자리) */
function scallop(cx: number, cy: number, rx: number, ry: number, n = 8, rot = 0, bulge = 1.25, rand?: Rand, jit = 0): { d: string; pts: Pt[] } {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const j = rand ? 1 + (rand() - 0.5) * jit : 1;
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    const r = (Math.hypot(x2 - x1, y2 - y1) / 2) * bulge;
    d += `A${n1(r)} ${n1(r)} 0 0 1 ${n1(x2)} ${n1(y2)}`;
  }
  return { d: d + "Z", pts };
}

/** 가운데(캐릭터 자리)에서 off만큼 떨어진 x 들. 그림 밖은 버린다 */
const at = (W: number, offs: number[], margin = -10) => offs.map((o) => W / 2 + o).filter((x) => x > margin && x < W - margin);

/** 너비에 비례한 개수 */
const per = (W: number, n: number) => Math.max(1, Math.round((n * W) / 320));

/** 흐린 얼룩 여러 개 (풀밭·모래·눈밭의 밝은/어두운 결) */
const patches = (c: Cv, rand: Rand, n: number, y0: number, y1: number, color: string, a: number, sd = 4) =>
  `<g ${c.blur(sd)}>${Array.from({ length: n }, () => `<ellipse cx="${n1(rand() * c.W)}" cy="${n1(y0 + rand() * (y1 - y0))}" rx="${n1(24 + rand() * 26)}" ry="${n1(4 + rand() * 4)}" fill="${color}" opacity="${a}"/>`).join("")}</g>`;

/* ───────────── 하늘·빛 ───────────── */

const sky = (c: Cv, stops: Stop[]) => `<rect x="-2" y="-2" width="${c.W + 4}" height="${H + 4}" fill="${c.linear(stops)}"/>`;

/** 둥근 빛 번짐 (해·가로등·창문 빛) */
const glow = (c: Cv, x: number, y: number, r: number, color: string, a = 0.6) =>
  `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${c.radial([[0, color, a], [0.45, color, n1(a * 0.45 * 10) / 10], [1, color, 0]])}"/>`;

const CLOUD_PUFFS: [number, number, number][] = [[-15, 1, 7.5], [-5, -4, 10.5], [9, -7.5, 12], [22, -2.5, 9.5], [31, 2, 6.5]];
/** 뭉게구름. (cx, y) = 가운데, 너비 약 60s. 몽실한 바탕 + 아래쪽에 흐린 푸른 배 + 위쪽 밝은 면 (외곽선 없음).
 *  아래 납작한 띠는 바깥 두 뭉치 가운데까지만 둬서 뭉치 밖으로 삐져나오지 않는다 */
function cloud(c: Cv, cx: number, y: number, s: number, t: Tone): string {
  const x = cx - 7.5 * s;
  const d = CLOUD_PUFFS.map(([px, py, r]) => circD(x + px * s, y + py * s, r * s)).join("") + rectD(x - 15 * s, y - 1 * s, 46 * s, 9.5 * s, 4.6 * s);
  const inner =
    `<ellipse cx="${n1(x + 10 * s)}" cy="${n1(y + 9.5 * s)}" rx="${n1(30 * s)}" ry="${n1(7 * s)}" fill="${t.sh}" ${c.blur(2.4 * s)}/>` +
    `<ellipse cx="${n1(x + 3 * s)}" cy="${n1(y - 11 * s)}" rx="${n1(14 * s)}" ry="${n1(5 * s)}" fill="${t.hi}" opacity=".9" ${c.blur(2 * s)}/>`;
  return `<g ${c.blur(0.3 * s)}>${c.part(d, t.base, inner, "")}</g>`;
}

/** 가로로 길게 뜬 구름 띠 (해 앞을 지나가는 얇은 구름) */
const streak = (x: number, y: number, w: number, h: number, color: string, a = 0.85) =>
  `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(h / 2)}" fill="${color}" opacity="${a}"/>`;

/** 네 갈래 반짝이 별. k = 갈래 굵기 (작을수록 길고 가는 갈래). halo = 둘레 빛 번짐 */
function sparkle(c: Cv, x: number, y: number, r: number, color: string, halo = true, k = 0.2): string {
  const q = r * k;
  const d = `M${n1(x)} ${n1(y - r)}Q${n1(x + q)} ${n1(y - q)} ${n1(x + r)} ${n1(y)}Q${n1(x + q)} ${n1(y + q)} ${n1(x)} ${n1(y + r)}Q${n1(x - q)} ${n1(y + q)} ${n1(x - r)} ${n1(y)}Q${n1(x - q)} ${n1(y - q)} ${n1(x)} ${n1(y - r)}Z`;
  return (halo ? glow(c, x, y, r * 1.5, color, 0.35) : "") + `<path d="${d}" fill="${color}"/>` + (halo ? "" : `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * 0.17)}" fill="${color}"/>`);
}

/** 작은 점 여러 개 (별·눈송이·모래알) */
function dots(W: number, rand: Rand, n: number, y0: number, y1: number, colors: string[], r0: number, r1: number, a0 = 1, a1 = 1): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = rand() * W;
    const y = y0 + rand() * (y1 - y0);
    const col = colors[Math.floor(rand() * colors.length)];
    const r = r0 + rand() * (r1 - r0);
    const a = a0 + rand() * (a1 - a0);
    out += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${col}"${a < 1 ? ` opacity="${n1(a)}"` : ""}/>`;
  }
  return out;
}

/* ───────────── 땅 위 소품 ───────────── */

const shadow = (x: number, y: number, rx: number, ry: number, color = "#2c3a18", a = 0.2) =>
  `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${color}" opacity="${a}"/>`;

const LEAF: Tone = { base: P.leaf, sh: P.leafShade, hi: P.leafHi2 };
const BLOSSOM: Tone = { base: "#f6afc5", sh: "#e48aa9", hi: "#fdd8e3" };

/** 동글동글한 나무 (짧고 굵은 줄기 + 큰 잎 뭉치 6개). (x, y) = 줄기 아래 가운데.
 *  blossom = 벚나무 (잎 위에 흐린 밝은 꽃 뭉치) */
function roundTree(c: Cv, x: number, y: number, s: number, t: Tone, rand: Rand, blossom = false): string {
  const X = (v: number) => n1(x + v * s);
  const Y = (v: number) => n1(y + v * s);
  // 줄기: 14s 높이 × 8s 너비, 아래가 퍼진다 (위쪽은 잎 뭉치 안으로 들어간다)
  const trunk = `M${X(-3.6)} ${Y(-18)}L${X(-3.9)} ${Y(-4.5)}Q${X(-4.1)} ${Y(-0.8)} ${X(-6.6)} ${Y(0.4)}L${X(6.6)} ${Y(0.4)}Q${X(4.1)} ${Y(-0.8)} ${X(3.9)} ${Y(-4.5)}L${X(3.6)} ${Y(-18)}Z`;
  const cy = y - 28 * s;
  const { d: crown, pts } = scallop(x, cy, 15.5 * s, 13 * s, 6, (-Math.PI * 2) / 3 + 0.12, 1.16, rand, 0.2);
  // 잎 뭉치 사이 주름: 꼭짓점에서 안쪽으로 짧게 휘는 선 두 개
  let creases = "";
  for (const i of [2, 4]) {
    const [vx, vy] = pts[i];
    const ex = vx + (x - vx) * 0.36;
    const ey = vy + (cy - vy) * 0.36;
    // 안쪽으로 들어가며 아래로 처지게 휜다 (위 잎 뭉치의 아랫선이 이어지는 모양)
    let px = -(ey - vy);
    let py = ex - vx;
    if (py < 0) {
      px = -px;
      py = -py;
    }
    creases += `M${n1(vx)} ${n1(vy)}Q${n1((vx + ex) / 2 + px * 0.3)} ${n1((vy + ey) / 2 + py * 0.3)} ${n1(ex)} ${n1(ey)}`;
  }
  let flowers = "";
  if (blossom) {
    // 꽃 뭉치: 흐린 밝은 덩어리 4개 (+ 넓은 그림에서만 작은 점 몇 개)
    flowers = `<g fill="${t.hi}" ${c.blur(1.1 * s)}>${[[-8, -6, 6.5, 4.6], [3.5, -10.5, 5.5, 3.8], [-12, 3, 4.6, 3.4], [8, -1, 4.8, 3.4]]
      .map(([dx, dy, rx, ry]) => `<ellipse cx="${X(dx)}" cy="${n1(cy + dy * s)}" rx="${n1(rx * s)}" ry="${n1(ry * s)}"/>`)
      .join("")}</g>`;
    if (!c.thumb)
      for (let i = 0; i < 6; i++) {
        const a = rand() * Math.PI * 2;
        const rr = 0.3 + rand() * 0.6;
        flowers += `<circle cx="${n1(x + Math.cos(a) * rr * 13 * s)}" cy="${n1(cy + Math.sin(a) * rr * 10 * s)}" r="${n1(0.75 * s)}" fill="#fff4f7" opacity=".9"/>`;
      }
  }
  return (
    shadow(x + 2 * s, y + 0.6 * s, 14 * s, 3.2 * s) +
    c.part(trunk, P.wood, `<rect x="${X(0.8)}" y="${Y(-20)}" width="${n1(4.5 * s)}" height="${n1(22 * s)}" fill="${P.woodShade}" ${c.blur(1 * s)}/>`, OUTLINE, 1.1 * s) +
    c.part(
      crown,
      t.base,
      `<ellipse cx="${X(7)}" cy="${n1(cy + 10 * s)}" rx="${n1(17 * s)}" ry="${n1(10 * s)}" fill="${t.sh}" ${c.blur(3 * s)}/>` +
        (blossom ? "" : `<ellipse cx="${X(-6)}" cy="${n1(cy - 7 * s)}" rx="${n1(10 * s)}" ry="${n1(6.5 * s)}" fill="${t.hi}" opacity=".9" ${c.blur(2.6 * s)}/>`) +
        flowers +
        `<path d="${creases}" fill="none" ${SO(darken(t.sh, 0.22), 1.1 * s)} opacity=".8"/>` +
        `<path d="M${X(0)} ${Y(-11)}Q${X(-0.5)} ${Y(-17)} ${X(-5)} ${Y(-22)}M${X(0.3)} ${Y(-14)}Q${X(1.5)} ${Y(-19)} ${X(6)} ${Y(-21)}" fill="none" ${SO(darken(t.sh, 0.3), 1.2 * s)} opacity=".75"/>`,
      darken(t.sh, 0.38),
      1.1 * s,
    )
  );
}

/** 멀리 보이는 덤불 */
function bush(c: Cv, x: number, y: number, s: number, t: Tone, rand: Rand): string {
  const { d } = scallop(x, y, 11 * s, 6.5 * s, 7, -Math.PI / 2, 1.3, rand, 0.15);
  return c.part(
    d,
    t.base,
    `<ellipse cx="${n1(x + 4 * s)}" cy="${n1(y + 4 * s)}" rx="${n1(10 * s)}" ry="${n1(5 * s)}" fill="${t.sh}" ${c.blur(2 * s)}/><ellipse cx="${n1(x - 4 * s)}" cy="${n1(y - 4 * s)}" rx="${n1(5 * s)}" ry="${n1(2.6 * s)}" fill="${t.hi}" opacity=".8" ${c.blur(1.4 * s)}/>`,
    darken(t.sh, 0.3),
    0.9 * s,
  );
}

/** 들꽃 (다섯 꽃잎). r = 꽃잎이 놓인 반지름, ow = 꽃잎 선 굵기 */
function bloom(x: number, y: number, r: number, petal: string, center = "#f6c445", ow = 0.5): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * (Math.PI / 180);
    out += `<circle cx="${n1(x + Math.cos(a) * r * 0.95)}" cy="${n1(y + Math.sin(a) * r * 0.95)}" r="${n1(r * 0.72)}" fill="${petal}" ${SO(darken(petal, 0.4), ow)}/>`;
  }
  return out + `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * 0.5)}" fill="${center}" ${SO(darken(center, 0.35), ow * 0.8)}/><circle cx="${n1(x - r * 0.15)}" cy="${n1(y - r * 0.15)}" r="${n1(r * 0.16)}" fill="#fff" opacity=".8"/>`;
}

/** 앞쪽 모서리의 꽃 덤불: 넓은 잎 네 장 + 줄기 위 꽃 2~3송이. (x, y) = 덤불 아래 가운데, 높이 약 25s */
function flowerClump(x: number, y: number, s: number, petals: string[], leaf = "#5f9a3f"): string {
  const lo = darken(leaf, 0.38);
  const hi = lighten(leaf, 0.28);
  const leafD = (deg: number, len: number, wid: number) => {
    const a = (deg * Math.PI) / 180;
    const tx = x + Math.cos(a) * len * s;
    const ty = y + Math.sin(a) * len * s;
    const mx = (x + tx) / 2;
    const my = (y + ty) / 2;
    const nx = -Math.sin(a) * wid * s;
    const ny = Math.cos(a) * wid * s;
    return (
      `<path d="M${n1(x)} ${n1(y)}Q${n1(mx + nx)} ${n1(my + ny)} ${n1(tx)} ${n1(ty)}Q${n1(mx - nx)} ${n1(my - ny)} ${n1(x)} ${n1(y)}Z" fill="${leaf}" ${SO(lo, 0.7 * s)}/>` +
      `<path d="M${n1(x)} ${n1(y)}Q${n1(mx + nx * 0.25)} ${n1(my + ny * 0.25)} ${n1(tx)} ${n1(ty)}" fill="none" ${SO(hi, 0.6 * s)} opacity=".8"/>`
    );
  };
  const heads: Pt[] = [[-2, -22], [8, -15], [-10.5, -13]];
  let stems = "";
  let flowers = "";
  petals.slice(0, 3).forEach((petal, i) => {
    const [hx, hy] = heads[i];
    const r = (4.4 - i * 0.5) * s;
    const d = `M${n1(x + hx * 0.15 * s)} ${n1(y)}Q${n1(x + hx * 0.2 * s)} ${n1(y + hy * 0.55 * s)} ${n1(x + hx * s)} ${n1(y + hy * s)}`;
    stems += `<path d="${d}" fill="none" ${SO(lo, 1.9 * s)}/><path d="${d}" fill="none" ${SO(leaf, 0.9 * s)}/>`;
    flowers += bloom(x + hx * s, y + hy * s, r, petal, i ? "#f3b13c" : "#f6c445", 0.55 * s);
  });
  return leafD(-158, 13, 3.6) + leafD(-22, 13, 3.6) + stems + leafD(-122, 10.5, 3.2) + leafD(-60, 11, 3.2) + flowers;
}

/** 풀 포기 (짧은 선 세 개) */
const tuft = (x: number, y: number, color: string) =>
  `<path d="M${n1(x - 2.5)} ${n1(y)}q.6-3 1.6-4.4M${n1(x)} ${n1(y)}q0-3.6.4-5.6M${n1(x + 2.5)} ${n1(y)}q-.4-3-1.4-4.2" fill="none" ${SO(color, 0.9)}/>`;

/** 멀리 언덕 위 작은 집 */
function tinyHouse(c: Cv, x: number, y: number, s: number, roof: string): string {
  const w = 12 * s;
  const wall = rectD(x - w / 2, y - 9 * s, w, 9 * s, 1 * s);
  const roofD = roundPoly([[x - w / 2 - 2.5 * s, y - 8.5 * s], [x, y - 17 * s], [x + w / 2 + 2.5 * s, y - 8.5 * s]], 1.2 * s);
  return (
    shadow(x + 1 * s, y + 0.5, 9 * s, 1.8 * s) +
    c.part(wall, P.white, `<rect x="${n1(x + 1 * s)}" y="${n1(y - 10 * s)}" width="${n1(6 * s)}" height="${n1(11 * s)}" fill="${P.stone}" ${c.blur(1 * s)}/>`, OUTLINE, 0.8 * s) +
    `<rect x="${n1(x - 1.6 * s)}" y="${n1(y - 5.5 * s)}" width="${n1(3.2 * s)}" height="${n1(5.5 * s)}" rx=".6" fill="${P.wood}" ${SB(0.6 * s)}/>` +
    c.part(roofD, roof, `<rect x="${n1(x)}" y="${n1(y - 18 * s)}" width="${n1(w)}" height="${n1(10 * s)}" fill="${darken(roof, 0.2)}" ${c.blur(1.2 * s)}/>`, OUTLINE, 0.8 * s)
  );
}

/* ───────────── 장면 ───────────── */

type Scene = { accent: string; draw: (c: Cv) => string };

// 초원 (기본 마을): 옅은 파란 하늘, 뭉게구름, 차분한 초록 먼 언덕, 풀밭, 동글동글한 나무, 들꽃, 앞 모서리 꽃 덤불
function meadow(c: Cv): string {
  const { W, m, thumb } = c;
  const r = rng(11);
  let out = sky(c, [[0, "#86c3f0"], [0.5, "#b3dbf6"], [0.75, "#e0f1fb"]]);
  const ct: Tone = { base: "#fbfdff", sh: "#d3e2f1", hi: "#ffffff" };
  if (thumb) {
    out += cloud(c, m - 62, 40, 0.92, ct) + cloud(c, m + 58, 22, 1, ct) + cloud(c, m + 168, 42, 0.75, ct) + cloud(c, m - 170, 18, 0.7, ct);
  } else {
    for (let x = 30 + r() * 30, i = 0; x < W + 30; x += 125 + r() * 70, i++)
      out += cloud(c, x, i % 2 ? 22 + r() * 6 : 36 + r() * 8, 0.78 + r() * 0.3, ct);
  }
  out += `<path d="${hills(W, 116, 24, 130, r)}" fill="${c.linear([[0, "#8fbf88"], [1, "#7fb27a"]])}"/>`;
  out += `<path d="${ridge(W, 120, 7, 90, r)}" fill="${c.linear([[0, "#9fcf7f"], [1, "#8bbf69"]])}"/>`;
  if (!thumb) for (const x of at(W, [-186, 292], 14)) out += tinyHouse(c, x, 121, 1.6, x < m ? P.red : P.roofBlue);
  const bt: Tone = { base: "#7db95a", sh: "#62a046", hi: "#a3d47a" };
  if (thumb) for (const x of at(W, [-128, -96, 104, 140])) out += bush(c, x, 124, 0.8, bt, r);
  else
    for (let x = 6 + r() * 20; x < W; x += 48 + r() * 50)
      if (Math.abs(x - m) > 40) out += bush(c, x, 123, 0.55 + r() * 0.3, bt, r);
  out += `<path d="${ridge(W, 124, 4, 90, r)}" fill="${c.linear([[0, "#98ce6a"], [0.4, "#82bd57"], [1, "#6ca848"]])}"/>`;
  out += patches(c, r, per(W, 5), 138, 172, "#b1dc82", 0.5);
  if (thumb) {
    out += roundTree(c, m - 55, 141, 1.36, LEAF, r) + roundTree(c, m + 55, 142, 1.32, LEAF, r);
    out += dots(W, r, 14, 146, 176, [P.yellowFlower, "#ffe27a", P.whiteFlower], 1.5, 2.1);
    out += flowerClump(m - 84, 180, 1.25, ["#f4a873", P.yellowFlower, "#f7c08a"]) + flowerClump(m + 92, 181, 0.95, [P.yellowFlower, "#f4a873"]);
    return out;
  }
  for (let i = 0; i < per(W, 14); i++) out += tuft(r() * W, 132 + r() * 46, i % 2 ? "#5f9a3f" : "#6aa746");
  for (const x of [...at(W, [-104, -238, -352]), ...at(W, [96, 224, 338])].sort((a, b) => a - b))
    out += roundTree(c, x, 136 + r() * 4, 1 + r() * 0.12, LEAF, r);
  out += dots(W, r, per(W, 26), 134, 178, [P.yellowFlower, P.whiteFlower, "#ffe9a0"], 0.9, 1.5);
  for (let i = 0; i < per(W, 6); i++) {
    const x = r() * W;
    if (Math.abs(x - m) > 36) out += bloom(x, 146 + r() * 30, 1.5 + r() * 0.6, [P.whiteFlower, P.yellowFlower, P.pinkFlower][i % 3]);
  }
  for (const x of at(W, [-150, 158, -300, 304], 4)) out += flowerClump(x, 179, 0.95, x < m ? ["#f4a873", P.yellowFlower] : [P.pinkFlower, P.yellowFlower]);
  return out;
}

/** 야자수. (x, y) = 줄기 아래. dir=1이면 꼭대기가 왼쪽으로 기운다 (오른쪽에 둘 때).
 *  잎은 넓고 끝이 둥근 7장이 양옆으로 늘어져 우산 모양 (위로 솟은 잎은 없다). 줄기 아래에 밝은 모래 둔덕 */
function palm(c: Cv, x: number, y: number, s: number, dir: 1 | -1): string {
  const p0: Pt = [x, y];
  const p1: Pt = [x + 5 * s * dir, y - 52 * s];
  const p2: Pt = [x - 15 * s * dir, y - 88 * s];
  const bz = (t: number): Pt => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  // 줄기: 아래가 굵고 위로 가늘어지는 곡선 띠
  const L: Pt[] = [];
  const R: Pt[] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = bz(Math.max(0, t - 0.01));
    const b = bz(Math.min(1, t + 0.01));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const w = (5.6 - 2.4 * t) * s;
    const [px, py] = bz(t);
    L.push([px + nx * w, py + ny * w]);
    R.push([px - nx * w, py - ny * w]);
  }
  const line = (pts: Pt[]) => pts.map((p) => `${n1(p[0])} ${n1(p[1])}`).join("L");
  const trunk = `M${line(L)}L${line([...R].reverse())}Z`;
  let rings = "";
  for (let i = 1; i < N; i++) {
    const [ax, ay] = L[i];
    const [bx, by] = R[i];
    rings += `M${n1(ax)} ${n1(ay)}Q${n1((ax + bx) / 2)} ${n1((ay + by) / 2 + 1.6 * s)} ${n1(bx)} ${n1(by)}`;
  }
  // L은 진행 방향의 왼쪽(위로 자라므로 화면 오른쪽) 가장자리 → 그늘
  const wood = "#a8743f";
  let out =
    shadow(x - 2 * s * dir, y + 2.5 * s, 22 * s, 3.6 * s, "#9c7a3a", 0.2) +
    c.part(
      trunk,
      wood,
      `<path d="M${line(L)}" fill="none" stroke="${darken(wood, 0.28)}" stroke-width="${n1(5 * s)}" ${c.blur(1.4 * s)}/>` +
        `<path d="M${line(R)}" fill="none" stroke="${lighten(wood, 0.35)}" stroke-width="${n1(3 * s)}" opacity=".8" ${c.blur(1.2 * s)}/>` +
        `<path d="${rings}" fill="none" ${SO(darken(wood, 0.32), 0.8 * s)} opacity=".7"/>`,
      OUTLINE,
      1.1 * s,
    );
  // 모래 둔덕 (줄기 밑동을 덮는다)
  const X = (v: number) => n1(x + v * s);
  const Y = (v: number) => n1(y + v * s);
  const bump = `M${X(-21)} ${Y(3.5)}Q${X(-15)} ${Y(-4.5)} ${X(-2)} ${Y(-4.2)}Q${X(13)} ${Y(-4.8)} ${X(21)} ${Y(3.5)}`;
  out +=
    c.part(`${bump}Z`, "#f8e5b6", `<ellipse cx="${X(9)}" cy="${Y(3)}" rx="${n1(14 * s)}" ry="${n1(4 * s)}" fill="#ecd096" ${c.blur(1.6 * s)}/>`, "") +
    `<path d="${bump}" fill="none" ${SO("#d9b877", 0.9 * s)}/>`;
  const [tx, ty] = p2;
  out += [[-3, 3.5], [2.6, 4.4], [-0.2, 6.6]]
    .map(([dx, dy]) => `<circle cx="${n1(tx + dx * s)}" cy="${n1(ty + dy * s)}" r="${n1(2.9 * s)}" fill="#8a5a33" ${SB(0.9 * s)}/><circle cx="${n1(tx + (dx - 1) * s)}" cy="${n1(ty + (dy - 1) * s)}" r="${n1(0.8 * s)}" fill="#c8915c"/>`)
    .join("");
  // 잎: [각도(도, 0=오른쪽 90=아래 -90=위), 길이]. 뒤쪽 잎은 어둡게
  const green = "#3a9068";
  const frond = ([deg, len]: [number, number], back: boolean) => {
    const a = ((dir === 1 ? 180 - deg : deg) * Math.PI) / 180;
    const Lx = len * s;
    const droop = Math.abs(Math.cos(a)) * Lx * 0.6;
    const tip: Pt = [tx + Math.cos(a) * Lx, ty + Math.sin(a) * Lx + droop];
    const mx = (tx + tip[0]) / 2;
    const my = (ty + tip[1]) / 2 - Lx * 0.26;
    const dx = tip[0] - tx;
    const dy = tip[1] - ty;
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    // 위쪽(하늘 쪽) 법선
    let nx = -uy;
    let ny = ux;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const up: Pt = [mx + nx * 12 * s, my + ny * 12 * s];
    const dn: Pt = [mx - nx * 6.5 * s, my - ny * 6.5 * s];
    // 둥근 잎 끝
    const tU: Pt = [tip[0] + nx * 3 * s - ux * 2.6 * s, tip[1] + ny * 3 * s - uy * 2.6 * s];
    const tD: Pt = [tip[0] - nx * 2.2 * s - ux * 2.6 * s, tip[1] - ny * 2.2 * s - uy * 2.6 * s];
    const tE: Pt = [tip[0] + ux * 2 * s, tip[1] + uy * 2 * s];
    const P2 = (p: Pt) => `${n1(p[0])} ${n1(p[1])}`;
    const d = `M${n1(tx)} ${n1(ty)}Q${P2(up)} ${P2(tU)}Q${P2(tE)} ${P2(tD)}Q${P2(dn)} ${n1(tx)} ${n1(ty)}Z`;
    const base = back ? "#2f7a59" : green;
    return c.part(
      d,
      base,
      `<path d="M${n1(tx)} ${n1(ty)}Q${P2(dn)} ${P2(tD)}" fill="none" stroke="${darken(base, 0.25)}" stroke-width="${n1(3.4 * s)}" ${c.blur(1 * s)}/>` +
        `<path d="M${n1(tx)} ${n1(ty)}Q${P2(up)} ${P2(tU)}" fill="none" stroke="${lighten(base, 0.3)}" stroke-width="${n1(2.6 * s)}" ${c.blur(0.9 * s)}/>` +
        `<path d="M${n1(tx)} ${n1(ty)}Q${n1(mx)} ${n1(my)} ${P2(tip)}" fill="none" ${SO(darken(base, 0.3), 0.7 * s)}/>`,
      darken(green, 0.45),
      1 * s,
    );
  };
  const back: [number, number][] = [[-160, 30], [-22, 30]];
  const front: [number, number][] = [[174, 36], [136, 29], [102, 22], [8, 36], [46, 29]];
  return out + back.map((f) => frond(f, true)).join("") + front.map((f) => frond(f, false)).join("");
}

/** 조개 껍데기 */
const shell = (x: number, y: number, s: number, color: string) =>
  `<path d="M${n1(x - 3 * s)} ${n1(y)}Q${n1(x)} ${n1(y - 5 * s)} ${n1(x + 3 * s)} ${n1(y)}Q${n1(x)} ${n1(y + 1.2 * s)} ${n1(x - 3 * s)} ${n1(y)}Z" fill="${color}" ${SO(darken(color, 0.35), 0.6)}/>` +
  `<path d="M${n1(x)} ${n1(y + 0.4)}V${n1(y - 3.4 * s)}M${n1(x - 1.4 * s)} ${n1(y + 0.2)}L${n1(x - 0.8 * s)} ${n1(y - 2.8 * s)}M${n1(x + 1.4 * s)} ${n1(y + 0.2)}L${n1(x + 0.8 * s)} ${n1(y - 2.8 * s)}" ${SO(darken(color, 0.25), 0.4)}/>`;

/** 먼 섬: 낮고 한쪽(peak 쪽)이 더 높은 비대칭 실루엣. (x, y) = 가운데 아래 */
function island(c: Cv, x: number, y: number, w: number, h: number, peak = -0.12): string {
  const pts: Pt[] = [[x - w / 2, y], [x - w * 0.3, y - h * 0.42], [x + w * peak, y - h], [x + w * (peak + 0.16), y - h * 0.72], [x + w * 0.3, y - h * 0.4], [x + w / 2, y]];
  return `<path d="${smooth(pts)}Z" fill="${c.linear([[0, "#b9d4ef"], [1, "#9cc0e6"]])}"/>`;
}

// 바닷가 (해변): 옅은 하늘, 해와 구름 띠, 먼 섬, 청록 바다와 물결, 하얀 파도, 모래사장과 붉은 조약돌, 야자수
function beach(c: Cv): string {
  const { W, m, thumb } = c;
  const r = rng(23);
  const horizon = 86;
  let out = sky(c, [[0, "#78c2ef"], [0.3, "#a8d9f6"], [0.48, "#dff2fb"]]);
  const sx = thumb ? m - 45 : m - 80;
  const sy = thumb ? 44 : 46;
  const sr = thumb ? 19.5 : 16;
  out += glow(c, sx, sy, sr * 2.4, "#fff6c8", 0.75);
  out += `<circle cx="${n1(sx)}" cy="${sy}" r="${sr}" fill="${c.linear([[0, "#fde99a"], [1, "#f8d873"]])}"/>`;
  const k = sr / 14;
  out += `<g ${c.blur(0.5)}>${streak(sx - 34 * k, sy + 1, 66 * k, 4 * k, "#fdf3d2")}${streak(sx - 12 * k, sy + 8 * k, 44 * k, 3.2 * k, "#fdf6dd", 0.8)}${streak(sx + 10 * k, sy - 5 * k, 30 * k, 2.6 * k, "#fffaf0", 0.7)}</g>`;
  if (thumb) out += `<g ${c.blur(0.6)}>${streak(m + 4, 20, 46, 3.4, "#ffffff", 0.7)}${streak(m + 16, 26, 30, 2.6, "#ffffff", 0.55)}</g>`;
  else {
    for (let x = 60 + r() * 40, i = 0; x < W; x += 150 + r() * 90, i++)
      if (Math.abs(x - sx) > 70) out += `<g ${c.blur(0.6)}>${streak(x, 22 + (i % 3) * 9, 34 + r() * 30, 3, "#ffffff", 0.7)}${streak(x + 12, 27 + (i % 3) * 9, 24, 2.4, "#ffffff", 0.55)}</g>`;
    const t: Tone = { base: "#fbfdff", sh: "#d4e6f4", hi: "#fff" };
    out += cloud(c, m + 240, 30, 0.6, t) + cloud(c, m - 290, 24, 0.55, t);
  }
  // 먼 섬
  if (thumb) out += island(c, m + 46, horizon + 0.5, 96, 15, 0.08) + island(c, m - 112, horizon + 0.5, 56, 8);
  else for (const [o, w, h, pk] of [[118, 80, 13, 0.1], [-250, 70, 10, -0.15], [330, 60, 9, 0.05]] as const) if (Math.abs(o) < m + 40) out += island(c, m + o, horizon + 0.5, w, h, pk);
  // 바다와 물결
  out += `<rect x="-2" y="${horizon}" width="${W + 4}" height="${GROUND - horizon + 6}" fill="${c.linear([[0, "#1aa6dc"], [0.4, "#26b9e4"], [1, "#72d8ed"]])}"/>`;
  out += `<rect x="-2" y="${horizon}" width="${W + 4}" height="2.2" fill="#7fd0f0" opacity=".8"/>`;
  out += `<g ${c.blur(1.6)}>${Array.from({ length: per(W, 5) }, () => streak(r() * W - 30, horizon + 8 + r() * 26, 50 + r() * 60, 3, "#ffffff", 0.28)).join("")}</g>`;
  for (let i = 0; i < (thumb ? 9 : per(W, 16)); i++) {
    const x = r() * W;
    const y = horizon + 6 + r() * 32;
    out += thumb ? streak(x, y, 10 + r() * 10, 2.4, "#ffffff", 0.85) : streak(x, y, 5 + r() * 10 + (y - horizon) * 0.2, 1.5, "#ffffff", n1(0.55 + r() * 0.35));
  }
  // 파도 거품, 젖은 모래, 마른 모래
  const wave = (y: number, amp: number, step: number) => {
    const pts: Pt[] = [];
    for (let x = -20; x <= W + 40; x += step) pts.push([x, y + (pts.length % 2 ? amp : -amp) * (0.6 + r() * 0.4)]);
    return smooth(pts);
  };
  const foam = wave(GROUND - 4, 1.4, 26);
  out += `<path d="${foam}L${W + 40} ${H + 4}L-20 ${H + 4}Z" fill="#e9d3a0"/>`;
  out += `<path d="${wave(GROUND - 1, 1.6, 34)}L${W + 40} ${H + 4}L-20 ${H + 4}Z" fill="${c.linear([[0, "#f5dfab"], [0.5, "#f3d79c"], [1, "#efcf8f"]])}"/>`;
  out += `<path d="${foam}" fill="none" stroke="#ffffff" stroke-width="${n1(2.6 * SK)}" opacity=".95"/>`;
  out += `<path d="${wave(GROUND - 7.5, 1, 22)}" fill="none" stroke="#ffffff" stroke-width="${n1(1.2 * SK)}" stroke-dasharray="14 9" opacity=".7"/>`;
  out += patches(c, r, per(W, 4), 146, 174, "#fbe9c0", 0.7, 3);
  // 붉은 조약돌 (작은 칸에서는 적고 크게)
  const pebbles = ["#e58f6a", "#d9775c", "#f0a983"];
  if (thumb) {
    for (const [dx, dy, rr] of [[-70, 150, 1.8], [-22, 168, 1.6], [12, 146, 1.4], [-50, 174, 1.5], [38, 172, 1.7], [-95, 162, 1.4]])
      out += `<ellipse cx="${n1(m + dx)}" cy="${dy}" rx="${n1(rr * 1.3)}" ry="${rr}" fill="${pebbles[Math.abs(dx) % 3]}" opacity=".85"/>`;
    return out + palm(c, m + 80, 151, 1.3, 1);
  }
  out += dots(W, r, per(W, 14), 136, 178, pebbles, 0.8, 1.3, 0.75, 0.95);
  for (let i = 0; i < per(W, 4); i++) {
    const x = r() * W;
    if (Math.abs(x - m) > 40) out += shell(x, 146 + r() * 28, 1 + r() * 0.3, ["#f7b8a8", "#f9d2c4", "#f3a6a0"][i % 3]);
  }
  for (const x of at(W, [-172, -326])) out += palm(c, x, 140, 0.9, -1);
  for (const x of at(W, [130, 318])) out += palm(c, x, 142, 1, 1);
  return out;
}

/** 눈 덮인 통나무 오두막. (x, y) = 앞 박공 아래 가운데. side = 옆벽 길이(s 단위) */
function cabin(c: Cv, x: number, y: number, s: number, side: number, doorLeft: boolean): string {
  const fw = 30 * s;
  const wh = 19 * s;
  const ph = 14 * s;
  const sw = side * s;
  const Lx = x - fw / 2;
  const Rx = x + fw / 2;
  const ey = y - wh;
  const py = ey - ph;
  const wall = "#ad6a3c";
  const wallSh = "#8a4f2b";
  const snowC = "#fbfdff";
  const snowSh = "#c9d7ec";
  const snowOl = "#8796b6";
  const lit = "#f8d36a";
  const p = (px: number, py2: number) => `${n1(px)} ${n1(py2)}`;
  const planks = (x0: number, x1: number, y0: number) => {
    let d = "";
    for (let yy = y0 + 4.2 * s; yy < y - 1; yy += 4.2 * s) d += `M${n1(x0)} ${n1(yy)}H${n1(x1)}`;
    return `<path d="${d}" fill="none" ${SO(darken(wall, 0.3), 0.6 * s)} opacity=".5"/>`;
  };
  const win = (cx: number, cy: number, w: number, h: number) =>
    glow(c, cx, cy, w * 1.6, "#ffd36e", 0.5) +
    `<rect x="${n1(cx - w / 2)}" y="${n1(cy - h / 2)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(0.8 * s)}" fill="${lit}" ${SB(0.8 * s)}/>` +
    `<path d="M${n1(cx)} ${n1(cy - h / 2)}V${n1(cy + h / 2)}M${n1(cx - w / 2)} ${n1(cy)}H${n1(cx + w / 2)}" ${SO("#7a4a2b", 0.7 * s)}/>` +
    `<rect x="${n1(cx - w / 2 + 0.6 * s)}" y="${n1(cy - h / 2 + 0.6 * s)}" width="${n1(w * 0.3)}" height="${n1(h * 0.3)}" fill="#fff5d0" opacity=".8"/>`;
  /** 처진 눈 가장자리: (x0,y0)→(x1,y1)를 n개 방울로 (조절점을 sag만큼 아래로) */
  const drips = (x0: number, y0: number, x1: number, y1: number, n: number, sag: number) => {
    let d = "";
    for (let i = 0; i < n; i++) {
      const ax = x0 + ((x1 - x0) * i) / n;
      const ay = y0 + ((y1 - y0) * i) / n;
      const bx = x0 + ((x1 - x0) * (i + 1)) / n;
      const by = y0 + ((y1 - y0) * (i + 1)) / n;
      d += `Q${p((ax + bx) / 2, (ay + by) / 2 + sag * (0.85 + ((i * 37) % 10) / 30))} ${p(bx, by)}`;
    }
    return d;
  };
  let out = shadow(x + sw / 2, y + 0.8, fw / 2 + sw / 2 + 4 * s, 3 * s, "#5d6f99", 0.18);
  // 옆벽
  out += c.part(
    rectD(Rx - 1, ey, sw + 1, wh, 0.8 * s),
    wallSh,
    planks(Rx, Rx + sw, ey) + `<rect x="${n1(Rx)}" y="${n1(ey)}" width="${n1(sw)}" height="${n1(5 * s)}" fill="#5e3720" opacity=".35" ${c.blur(1.5 * s)}/>`,
    OUTLINE,
    1.1 * s,
  );
  if (sw > 14 * s) out += win(Rx + sw * 0.55, ey + wh * 0.5, 6.5 * s, 6 * s);
  // 옆 지붕: 눈 덮인 비탈면 + 처마 끝 두툼한 눈 턱 (한 덩어리. 턱 윗선에 옅은 그늘 줄을 둬서 두께가 보이게)
  const ov = 5 * s;
  const eL = Rx + ov - 1 * s;
  const eR = Rx + sw + 4 * s;
  const lipY = ey + 3.6 * s;
  out += c.part(
    `M${p(x, py - 2 * s)}L${p(x + sw, py - 2 * s)}L${p(eR - 1 * s, ey - 2.4 * s)}C${p(eR + 2 * s, ey - 2 * s)} ${p(eR + 2 * s, lipY)} ${p(eR - 1 * s, lipY)}` +
      drips(eR - 1 * s, lipY, eL, lipY, Math.max(1, Math.round(sw / (6 * s))), 2.6 * s) +
      "Z",
    snowC,
    `<path d="M${p(x, py)}L${p(x + sw, py)}L${p(eR, ey - 2 * s)}L${p(eL, ey - 2 * s)}Z" fill="#edf2fa"/>` +
      `<path d="M${p(eL, ey - 2 * s)}H${p(eR, ey - 2 * s)}" stroke="${snowSh}" stroke-width="${n1(1.6 * s)}" ${c.blur(0.6 * s)}/>` +
      `<path d="M${p(eL, lipY + 2.4 * s)}H${p(eR, lipY + 2.4 * s)}" stroke="${snowSh}" stroke-width="${n1(3 * s)}" ${c.blur(1 * s)}/>`,
    snowOl,
    1 * s,
  );
  // 굴뚝 (지붕 비탈 위에 선다)과 연기
  const chx = x + sw * 0.5 + 6 * s;
  const chy = py + 3 * s;
  out += c.part(rectD(chx - 2.8 * s, chy - 9 * s, 5.6 * s, 10 * s, 0.8 * s), "#b9786a", `<rect x="${n1(chx + 0.5 * s)}" y="${n1(chy - 10 * s)}" width="${n1(3 * s)}" height="${n1(12 * s)}" fill="#8f5548" ${c.blur(0.8 * s)}/>`, OUTLINE, 1 * s);
  out += c.part(rectD(chx - 3.6 * s, chy - 11 * s, 7.2 * s, 3.2 * s, 1.6 * s), snowC, "", snowOl, 0.8 * s);
  out += c.part(`M${p(chx - 4 * s, chy + 1.5 * s)}Q${p(chx, chy - 2 * s)} ${p(chx + 4 * s, chy + 1.5 * s)}Z`, snowC, "", "", 0);
  out +=
    `<g fill="#d9cdd9" opacity=".9" ${c.blur(0.5 * s)}>` +
    [[0.5, -15, 2.4], [-1.5, -20, 3], [1.5, -26, 3.6]].map(([dx, dy, rr]) => `<circle cx="${n1(chx + dx * s)}" cy="${n1(chy + dy * s)}" r="${n1(rr * s)}"/>`).join("") +
    `</g>`;
  // 앞 박공
  out += c.part(
    roundPoly([[Lx, y], [Lx, ey], [x, py], [Rx, ey], [Rx, y]], 1 * s),
    wall,
    planks(Lx, Rx, ey) +
      `<rect x="${n1(Rx - 7 * s)}" y="${n1(py)}" width="${n1(9 * s)}" height="${n1(wh + ph)}" fill="${wallSh}" opacity=".75" ${c.blur(2 * s)}/>` +
      `<rect x="${n1(Lx - 2 * s)}" y="${n1(ey)}" width="${n1(6 * s)}" height="${n1(wh)}" fill="${lighten(wall, 0.25)}" opacity=".7" ${c.blur(1.6 * s)}/>`,
    OUTLINE,
    1.1 * s,
  );
  // 문, 창, 다락 둥근 창
  const dx = doorLeft ? x - 6 * s : x + 6 * s;
  out += c.part(rectD(dx - 4 * s, y - 11.5 * s, 8 * s, 11.5 * s, 1.2 * s), "#4f6872", `<rect x="${n1(dx + 1 * s)}" y="${n1(y - 12 * s)}" width="${n1(4 * s)}" height="${n1(13 * s)}" fill="#3b525c" ${c.blur(0.8 * s)}/>`, OUTLINE, 0.9 * s);
  out += `<circle cx="${n1(dx + 2.2 * s)}" cy="${n1(y - 5.5 * s)}" r="${n1(0.7 * s)}" fill="${P.gold}"/>`;
  out += win(doorLeft ? x + 7 * s : x - 7 * s, ey + wh * 0.45, 7 * s, 6.5 * s);
  const oy = py + ph * 0.8;
  const orr = 2.7 * s;
  out +=
    glow(c, x, oy, 5.5 * s, "#ffd36e", 0.5) +
    `<circle cx="${n1(x)}" cy="${n1(oy)}" r="${n1(orr)}" fill="${lit}" ${SB(0.8 * s)}/>` +
    `<path d="M${n1(x - orr)} ${n1(oy)}H${n1(x + orr)}M${n1(x)} ${n1(oy - orr)}V${n1(oy + orr)}" ${SO("#7a4a2b", 0.6 * s)}/>`;
  // 앞 박공 위 두툼한 눈: 윗선은 박공선보다 2s 위, 아랫선은 4.5~7.5s 아래로 처지며 비탈마다 방울 3개, 처마 끝은 둥근 덩어리
  const slope = ph / (fw / 2);
  const gy = (px: number) => py + Math.abs(px - x) * slope;
  const xl = Lx - ov;
  const xr = Rx + ov;
  const cd = 4.5 * s;
  const sag = 5.6 * s;
  const cap =
    `M${p(xl, gy(xl) - 2 * s)}L${p(x - 3 * s, gy(x - 3 * s) - 2 * s)}Q${p(x, py - 2.6 * s)} ${p(x + 3 * s, gy(x + 3 * s) - 2 * s)}L${p(xr, gy(xr) - 2 * s)}` +
    `C${p(xr + 3.4 * s, gy(xr) - 1 * s)} ${p(xr + 2.6 * s, gy(xr) + 5.6 * s)} ${p(xr - 1 * s, gy(xr - 1 * s) + cd)}` +
    drips(xr - 1 * s, gy(xr - 1 * s) + cd, x, py + cd, 3, sag) +
    drips(x, py + cd, xl + 1 * s, gy(xl + 1 * s) + cd, 3, sag) +
    `C${p(xl - 2.6 * s, gy(xl) + 5.6 * s)} ${p(xl - 3.4 * s, gy(xl) - 1 * s)} ${p(xl, gy(xl) - 2 * s)}Z`;
  const under = `M${p(xr - 1 * s, gy(xr - 1 * s) + cd)}` + drips(xr - 1 * s, gy(xr - 1 * s) + cd, x, py + cd, 3, sag) + drips(x, py + cd, xl + 1 * s, gy(xl + 1 * s) + cd, 3, sag);
  out += c.part(
    cap,
    snowC,
    `<path d="${under}" fill="none" stroke="${snowSh}" stroke-width="${n1(4 * s)}" ${c.blur(1 * s)}/>` +
      `<path d="M${p(x + 1 * s, py)}L${p(xr + 2 * s, gy(xr) + 2 * s)}L${p(xr + 2 * s, gy(xr) + 9 * s)}L${p(x, py + 9 * s)}Z" fill="${snowSh}" opacity=".45" ${c.blur(1.4 * s)}/>`,
    snowOl,
    1 * s,
  );
  return out;
}

/** 눈 쌓인 전나무. (x, y) = 줄기 아래 */
function snowPine(c: Cv, x: number, y: number, s: number): string {
  let out = shadow(x + 1.5 * s, y + 0.6, 10 * s, 2.4 * s, "#5d6f99", 0.18);
  out += c.part(rectD(x - 2 * s, y - 7 * s, 4 * s, 7.5 * s, 0.8 * s), P.wood, "", OUTLINE, 0.9 * s);
  const tiers: [number, number, number][] = [[y - 5 * s, 13 * s, 15 * s], [y - 15 * s, 10.5 * s, 13 * s], [y - 24 * s, 8 * s, 12 * s]];
  for (const [ty, w, h] of tiers) {
    const cap = `M${n1(x - w)} ${n1(ty - h * 0.42)}Q${n1(x - w * 0.5)} ${n1(ty - h * 0.25)} ${n1(x - w * 0.15)} ${n1(ty - h * 0.42)}Q${n1(x + w * 0.3)} ${n1(ty - h * 0.2)} ${n1(x + w)} ${n1(ty - h * 0.4)}`;
    out += c.part(
      roundPoly([[x - w, ty], [x, ty - h], [x + w, ty]], 2 * s),
      P.pine,
      `<path d="M${n1(x + 1 * s)} ${n1(ty - h)}L${n1(x + w + 2 * s)} ${n1(ty + 1)}L${n1(x + 1 * s)} ${n1(ty + 1)}Z" fill="${P.pineShade}" ${c.blur(1.2 * s)}/>` +
        `<path d="${cap}L${n1(x + w)} ${n1(ty - h - 2)}L${n1(x - w)} ${n1(ty - h - 2)}Z" fill="#f7faff"/>` +
        `<path d="${cap}" fill="none" stroke="#c9d7ec" stroke-width="${n1(1 * s)}"/>`,
      darken(P.pine, 0.4),
      1 * s,
    );
  }
  return out;
}

/** 멀리 보이는 작은 두 단 전나무 (푸르스름, 끝에 눈) */
function miniPine(x: number, y: number, h: number): string {
  const w = h * 0.4;
  const col = "#7f9bc6";
  const tier = (t: number, b: number, hw: number) =>
    `<path d="${roundPoly([[x - hw, y - b], [x, y - t], [x + hw, y - b]], 1)}" fill="${col}"/>` +
    `<path d="${roundPoly([[x - hw * 0.4, y - t + (t - b) * 0.42], [x, y - t], [x + hw * 0.4, y - t + (t - b) * 0.42]], 0.6)}" fill="#eef3fb"/>`;
  return `<rect x="${n1(x - 0.8)}" y="${n1(y - h * 0.2)}" width="1.6" height="${n1(h * 0.2)}" fill="#8a7d8c"/>` + tier(h * 0.62, h * 0.12, w) + tier(h, h * 0.45, w * 0.72);
}

/** 눈 덮인 먼 산 하나: 둥근 봉우리, 오른쪽 비탈은 또렷한 푸른 그늘 */
function mountain(c: Cv, x: number, py: number, hw: number, base = 122): string {
  const h = base - py;
  const p = (a: number, b: number) => `${n1(a)} ${n1(b)}`;
  const d = `M${p(x - hw, base)}C${p(x - hw * 0.5, base - h * 0.45)} ${p(x - hw * 0.2, py)} ${p(x, py)}C${p(x + hw * 0.2, py)} ${p(x + hw * 0.5, base - h * 0.45)} ${p(x + hw, base)}Z`;
  const shade = `M${p(x + 1, py + 0.5)}C${p(x + hw * 0.2, py)} ${p(x + hw * 0.5, base - h * 0.45)} ${p(x + hw, base)}L${p(x + hw * 0.1, base)}Q${p(x + hw * 0.18, py + h * 0.45)} ${p(x + 1, py + 0.5)}Z`;
  return c.part(d, c.linear([[0, "#f6f8fd"], [0.6, "#e3eaf6"], [1, "#d3dcef"]]), `<path d="${shade}" fill="#a9bbde" opacity=".5" ${c.blur(1)}/>`, "#b5c3df", 0.8);
}

/** 오두막 아래 쌓인 눈 더미 */
function mound(x: number, y: number, rx: number): string {
  const top = `M${n1(x - rx)} ${n1(y + 3)}Q${n1(x - rx * 0.6)} ${n1(y - 3)} ${n1(x)} ${n1(y - 1.5)}Q${n1(x + rx * 0.6)} ${n1(y - 3.5)} ${n1(x + rx)} ${n1(y + 3)}`;
  return `<path d="${top}Z" fill="#fbfdff"/><path d="${top}" fill="none" stroke="#c3d0e6" stroke-width="${n1(0.8 * SK)}"/>`;
}

// 눈 마을 (겨울): 파르스름한 하늘, 눈송이, 크고 또렷한 눈 덮인 산, 굴뚝 연기 나는 통나무 오두막, 전나무, 눈밭
function snow(c: Cv): string {
  const { W, m, thumb } = c;
  const r = rng(37);
  let out = sky(c, [[0, "#6f8fcd"], [0.4, "#9bb1e0"], [0.7, "#d6e0f3"]]);
  const ct: Tone = { base: "#f4f7fd", sh: "#bccbe6", hi: "#ffffff" };
  if (thumb) out += cloud(c, m + 56, 24, 0.95, ct) + cloud(c, m - 150, 30, 0.7, ct);
  else
    for (let x = 50 + r() * 40, i = 0; x < W + 30; x += 150 + r() * 80, i++)
      out += cloud(c, x, i % 2 ? 20 + r() * 6 : 30 + r() * 8, 0.7 + r() * 0.25, ct);
  out += thumb ? dots(W, r, 16, 4, 90, ["#ffffff"], 1.3, 2.1, 0.75, 1) : dots(W, r, per(W, 22), 4, 100, ["#ffffff"], 0.7, 1.5, 0.6, 1);
  // 먼 산: 크고 높이가 다른 봉우리 몇 개 (높은 것을 뒤에)
  const peaks: [number, number, number][] = [];
  if (thumb) peaks.push([m - 88, 64, 70], [m + 104, 82, 62], [m + 28, 92, 52], [m - 172, 86, 50]);
  else for (let x = -30 + r() * 30; x < W + 60; x += 110 + r() * 40) peaks.push([x, 60 + r() * 35, 68 + r() * 28]);
  for (const [px, py, hw] of peaks.sort((a, b) => a[1] - b[1])) out += mountain(c, px, py, hw);
  out += `<path d="${ridge(W, 121, 7, 90, r)}" fill="${c.linear([[0, "#f6f8fd"], [1, "#e6ecf7"]])}"/>`;
  // 멀리 작은 두 단 전나무
  if (thumb) for (const x of at(W, [-118, -104, 96, 128])) out += miniPine(x, 122, 14);
  else
    for (let x = 10 + r() * 20; x < W; x += 26 + r() * 40)
      if (Math.abs(x - m) > 44) out += miniPine(x, 121, 11 + r() * 5);
  // 눈밭
  out += c.part(ridge(W, 127, 4, 70, r), c.linear([[0, "#fdfeff"], [1, "#eef2fa"]]), patches(c, r, per(W, 6), 146, 176, "#cfdbef", 0.8, 3.5), "#c3d0e6", 0.8);
  if (thumb) {
    // 겹쳐 선 큰 오두막 두 채 (오른쪽이 앞)
    out += cabin(c, m - 98, 132, 0.8, 8, true) + mound(m - 96, 132, 20);
    out += snowPine(c, m + 128, 138, 1.05);
    out += cabin(c, m - 32, 143, 1.5, 14, true) + mound(m - 26, 143, 30);
    out += cabin(c, m + 22, 148, 1.65, 17, false) + mound(m + 34, 148, 42);
    return out + dots(W, r, 10, 120, 178, ["#ffffff"], 1.4, 2, 0.8, 1);
  }
  // 오두막·전나무 (뒤에 선 것부터). 오두막 앞에는 눈 더미
  type Item = { x: number; y: number; draw: () => string };
  const items: Item[] = [
    ...at(W, [100, -240, 350], -40).map((x) => ({ x, y: 137, draw: () => cabin(c, x - 12, 137, 1.4, 22, r() > 0.5) + mound(x, 137, 40) })),
    ...at(W, [-104, 236, -352], -30).map((x) => ({ x, y: 134, draw: () => cabin(c, x, 134, 1.08, 10, r() > 0.5) + mound(x + 4, 134, 26) })),
    ...at(W, [-166, 172, -298, 296]).map((x) => ({ x, y: 139, draw: () => snowPine(c, x, 139, 1.12 + r() * 0.15) })),
  ];
  for (const it of items.sort((p, q) => p.y - q.y || p.x - q.x)) out += it.draw();
  out += dots(W, r, per(W, 10), 140, 178, ["#cfdbef"], 0.6, 1.1);
  out += dots(W, r, per(W, 26), 0, 178, ["#ffffff"], 0.8, 1.8, 0.7, 1);
  return out;
}

// 벚꽃길 (시안의 노을 마을 색): 노을 하늘, 크게 지는 해, 구름 띠, 분홍빛 먼 산, 황금빛 들판과 흙길, 벚나무, 꽃잎, 앞 모서리 꽃 덤불
function sakura(c: Cv): string {
  const { W, m, thumb } = c;
  const r = rng(53);
  let out = sky(c, [[0, "#f0876c"], [0.34, "#f4a089"], [0.62, "#f9c68e"]]);
  const sx = thumb ? m : m + 40;
  const sy = thumb ? 80 : 76;
  const sr = thumb ? 23 : 22;
  out += glow(c, sx, sy, sr * 2.6, "#ffe7a0", 0.7);
  out += `<circle cx="${n1(sx)}" cy="${sy}" r="${sr}" fill="${c.linear([[0, "#fdeaa0"], [1, "#fad57a"]])}"/>`;
  out += `<g ${c.blur(0.7)}>${streak(sx - sr * 2.1, sy + sr * 0.2, sr * 3.4, 4.6, "#fbd2a0", 0.9)}${streak(sx - sr * 0.7, sy + sr * 0.6, sr * 2.8, 3.8, "#fcd6a8", 0.85)}${streak(sx - sr * 2.8, sy - sr * 0.5, sr * 1.9, 3, "#fbd7a9", 0.6)}</g>`;
  const ct: Tone = { base: "#fbd5b5", sh: "#efa89a", hi: "#fde9d2" };
  if (thumb) out += cloud(c, m - 78, 48, 0.92, ct) + cloud(c, m + 72, 26, 0.88, ct) + cloud(c, m - 170, 22, 0.7, ct);
  else
    for (let x = 40 + r() * 30, i = 0; x < W + 30; x += 140 + r() * 80, i++)
      if (Math.abs(x - sx) > 60) out += cloud(c, x, i % 2 ? 24 + r() * 6 : 40 + r() * 6, 0.72 + r() * 0.25, ct);
  const bird = (bx: number, by: number, k: number) =>
    `<path d="M${n1(bx - 3 * k)} ${n1(by - 1.4 * k)}q${n1(1.6 * k)} ${n1(-0.4 * k)} ${n1(3 * k)} ${n1(1.2 * k)}q${n1(1.4 * k)} ${n1(-1.6 * k)} ${n1(3 * k)} ${n1(-1.2 * k)}" fill="none" ${SO("#c46f6c", 0.8)}/>`;
  if (thumb) out += bird(m - 34, 22, 1.4) + bird(m - 14, 15, 1.2) + bird(m + 12, 24, 1.1);
  else
    for (let i = 0; i < per(W, 3); i++) out += bird(m - 60 + r() * 120 + (i - 1) * 90, 20 + r() * 14, 1);
  const farHills = thumb
    ? smooth(([[-40, 100], [m - 115, 90], [m - 62, 113], [m - 18, 95], [m + 40, 115], [m + 100, 88], [m + 165, 110], [W + 50, 98]] as Pt[])) + `L${W + 60} ${H + 4}L-60 ${H + 4}Z`
    : hills(W, 118, 28, 130, r);
  out += `<path d="${farHills}" fill="${c.linear([[0, "#e7a09c"], [1, "#dc9096"]])}"/>`;
  out += `<path d="${ridge(W, 121, 10, 110, r)}" fill="${c.linear([[0, "#d58890"], [1, "#c97f88"]])}"/>`;
  out += `<path d="${ridge(W, 125, 4, 90, r)}" fill="${c.linear([[0, "#e2ab57"], [0.45, "#d29644"], [1, "#bd853a"]])}"/>`;
  out += patches(c, r, per(W, 5), 138, 172, "#efc274", 0.55);
  // 흙길: 앞에서 지평선으로 좁아진다 (캐릭터가 이 길 위에 선다). 들판과 대비를 낮게
  out += c.part(
    `M${n1(m - 40)} ${H + 2}C${n1(m - 26)} 160 ${n1(m - 5)} 138 ${n1(m - 6)} 126Q${n1(m)} 124 ${n1(m + 6)} 126C${n1(m + 6)} 138 ${n1(m + 27)} 160 ${n1(m + 42)} ${H + 2}Z`,
    c.linear([[0, "#efcb8f"], [1, "#e8bf80"]]),
    `<path d="M${n1(m + 3)} 127C${n1(m + 10)} 140 ${n1(m + 26)} 160 ${n1(m + 38)} ${H}" fill="none" stroke="#d9a868" stroke-width="4" opacity=".5" ${c.blur(2)}/>`,
    "#d3a061",
    0.8,
  );
  if (thumb) {
    out += roundTree(c, m + 62, 142, 1.4, BLOSSOM, r, true);
    out += flowerClump(m - 70, 179, 1.6, ["#f4877f", "#f6a07a", "#f8b878"], "#6f9c46");
    out += flowerClump(m + 98, 181, 1.1, ["#f6d36b", "#f4a261"], "#6f9c46");
    return out;
  }
  for (let i = 0; i < per(W, 14); i++) {
    const x = r() * W;
    if (Math.abs(x - m) > 50) out += tuft(x, 134 + r() * 44, i % 2 ? "#7c8f36" : "#97a23f");
  }
  for (const x of [...at(W, [-108, -232, -350]), ...at(W, [108, 236, 344])].sort((a, b) => a - b))
    out += roundTree(c, x, 137 + r() * 4, 1 + r() * 0.12, BLOSSOM, r, true);
  // 흩날리는 꽃잎
  for (let i = 0; i < per(W, 22); i++) {
    const x = r() * W;
    const y = 30 + r() * 146;
    out += `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="1.8" ry="1.1" transform="rotate(${Math.round(r() * 180)} ${n1(x)} ${n1(y)})" fill="${["#f9b6ca", "#fcd3df", "#f39bb4"][i % 3]}" opacity=".95"/>`;
  }
  for (const x of at(W, [-150, 160, -300, 306], 4)) out += flowerClump(x, 179, 1.25, x < m ? ["#f4877f", "#f6a07a", "#f8b878"] : ["#f6a3b9", "#f6d36b"], "#6f9c46");
  for (let i = 0; i < per(W, 5); i++) {
    const x = r() * W;
    if (Math.abs(x - m) > 70) out += bloom(x, 150 + r() * 24, 1.5, ["#f6d36b", "#fbe7a0", "#f4a261"][i % 3]);
  }
  return out;
}

/** 밤의 빌딩 하나 (앞면 + 오른쪽 옆면, 창). kind: 0 평평(처마) 1 뾰족 첨탑 2 두 단 3 계단 왕관 + 바늘.
 *  litOK=false면 창을 모두 끈다 (캐릭터 뒤). ws = 창 크기 배율 */
function building(c: Cv, x: number, w: number, h: number, kind: number, body: string, rand: Rand, base = GROUND, litOK = true, ws = 1): string {
  const top = base - h;
  const fw = w * 0.8;
  const side = darken(body, 0.28);
  const ol = darken(body, 0.5);
  const sideBlur = (bx: number, by: number, bw: number, bh: number) => `<rect x="${n1(bx)}" y="${n1(by)}" width="${n1(bw)}" height="${n1(bh)}" fill="${side}" ${c.blur(0.8)}/>`;
  let out = "";
  let lit = "";
  if (kind === 1) {
    const tw = fw * 0.56;
    const tx = x + (fw - tw) / 2;
    const th = Math.max(9, h * 0.13);
    const sh = h * 0.24;
    out += `<path d="M${n1(tx + tw / 2)} ${n1(top - th - sh - 11)}V${n1(top - th - sh + 2)}" ${SO(ol, 1)}/>`;
    out += c.part(roundPoly([[tx + 1, top - th], [tx + tw / 2, top - th - sh], [tx + tw - 1, top - th]], 1), body, `<path d="M${n1(tx + tw / 2)} ${n1(top - th - sh)}L${n1(tx + tw)} ${n1(top - th)}H${n1(tx + tw / 2)}Z" fill="${side}" ${c.blur(0.8)}/>`, ol, 1);
    out += c.part(rectD(tx, top - th, tw, th + 1, 0.8), body, sideBlur(tx + tw * 0.62, top - th, tw, th + 2), ol, 1);
    if (litOK && rand() > 0.3) lit += `<rect x="${n1(tx + tw / 2 - 2.2 * ws)}" y="${n1(top - th + 2.5)}" width="${n1(4.4 * ws)}" height="${n1(5 * ws)}" rx=".8"/>`;
  } else if (kind === 2) {
    const tw = fw * 0.62;
    const tx = x + (fw - tw) * 0.35;
    out += c.part(rectD(tx + tw * 0.25, top - 17, tw * 0.5, 8, 0.8), body, "", ol, 1);
    out += c.part(rectD(tx, top - 10, tw, 11, 0.8), body, sideBlur(tx + tw * 0.65, top - 12, tw, 14), ol, 1);
  } else if (kind === 3) {
    // 아래 단부터 줄어드는 세 단 + 바늘. 위 단을 먼저 그려 아래 단 윗선이 보이게 한다
    const tiers: string[] = [];
    let tw = fw * 0.74;
    let ty = top;
    for (let i = 0; i < 3; i++) {
      const th = 8 - i;
      const tx = x + (fw - tw) / 2;
      tiers.push(c.part(rectD(tx, ty - th, tw, th + 1, 0.8), body, sideBlur(tx + tw * 0.62, ty - th, tw, th + 2), ol, 1));
      ty -= th;
      tw *= 0.66;
    }
    out += `<path d="M${n1(x + fw / 2)} ${n1(ty - 14)}V${n1(ty + 1)}" ${SO(ol, 1.1)}/>` + tiers.reverse().join("");
  }
  // 옆면 (3/4 시점: 오른쪽으로 조금 보인다) → 앞면
  out += c.part(roundPoly([[x + fw - 1, top], [x + w, top + 3], [x + w, base + 1], [x + fw - 1, base + 1]], 0.8), side, "", ol, 1);
  out += c.part(
    rectD(x, top, fw, h + 1, 0.8),
    body,
    `<rect x="${n1(x - 2)}" y="${n1(top)}" width="5" height="${n1(h)}" fill="${lighten(body, 0.16)}" ${c.blur(1.4)}/>` +
      `<rect x="${n1(x + fw - 4)}" y="${n1(top)}" width="6" height="${n1(h)}" fill="${darken(body, 0.15)}" ${c.blur(1.4)}/>`,
    ol,
    1,
  );
  if (kind === 0) out += c.part(rectD(x - 1, top - 2.4, fw + 2, 3.4, 0.8), lighten(body, 0.1), "", ol, 0.9);
  // 창: 켜진 창은 노랗게 + 빛 번짐, 꺼진 창은 흐린 남색 (창 격자가 보이게)
  const pitch = 8 * ws;
  const cols = Math.max(1, Math.floor((fw - 6 * ws) / pitch));
  const gx = (fw - cols * pitch + 3.2 * ws) / 2;
  let dim = "";
  for (let wy = top + 7 * ws; wy < base - 9 * ws; wy += 10.5 * ws)
    for (let i = 0; i < cols; i++) {
      const tag = `<rect x="${n1(x + gx + i * pitch)}" y="${n1(wy)}" width="${n1(4.8 * ws)}" height="${n1(6 * ws)}" rx=".8"/>`;
      if (litOK && rand() < 0.62) lit += tag;
      else dim += tag;
    }
  let wins = dim ? `<g fill="#3d4378">${dim}</g>` : "";
  if (lit) {
    const litId = c.id("w");
    c.defs.push(`<g id="${litId}">${lit}</g>`);
    wins += `<use href="#${litId}" fill="#ffc94f" opacity=".55" ${c.blur(2.2)}/><use href="#${litId}" fill="#f9d36b"/>`;
  }
  return out + wins;
}

/** 가로등. (x, y) = 기둥 아래 */
function lamp(c: Cv, x: number, y: number): string {
  const ol = "#141834";
  const metal = "#3a3d6b";
  return (
    glow(c, x, y - 31, 16, "#ffd36e", 0.55) +
    `<ellipse cx="${n1(x)}" cy="${n1(y + 1)}" rx="14" ry="3" fill="#ffd36e" opacity=".18"/>` +
    c.part(rectD(x - 1, y - 30, 2, 30.5, 0.6), metal, "", ol, 0.9) +
    c.part(rectD(x - 3.2, y - 1.5, 6.4, 2.4, 0.8), metal, "", ol, 0.8) +
    c.part(roundPoly([[x - 4, y - 28], [x + 4, y - 28], [x + 2.6, y - 35], [x - 2.6, y - 35]], 1), "#ffe9a8", `<rect x="${n1(x + 0.6)}" y="${n1(y - 36)}" width="4" height="9" fill="#f6c255" ${c.blur(0.8)}/>`, ol, 0.9) +
    c.part(roundPoly([[x - 4.6, y - 34.6], [x + 4.6, y - 34.6], [x, y - 38.6]], 0.8), metal, "", ol, 0.9)
  );
}

// 밤의 도시 (야경): 남색 하늘, 별과 반짝이, 계단 지붕 먼 실루엣, 첨탑 빌딩 두 채가 이끄는 겹친 스카이라인, 풀밭, 가로등
function night(c: Cv): string {
  const { W, m, thumb } = c;
  const r = rng(71);
  const base = thumb ? 150 : GROUND;
  let out = sky(c, [[0, "#181d50"], [0.4, "#252d74"], [0.72, "#3c3f92"]]);
  if (thumb) {
    out += dots(W, r, 18, 4, 110, ["#ffffff", "#d7dcff", "#fff4c4"], 0.9, 1.6, 0.6, 1);
    out += sparkle(c, m - 72, 50, 6.5, "#ffffff", false, 0.13) + sparkle(c, m + 76, 24, 4.6, "#ffffff", false, 0.14);
  } else {
    out += dots(W, r, per(W, 30), 2, 100, ["#ffffff", "#d7dcff", "#fff4c4"], 0.5, 1.3, 0.5, 1);
    for (let i = 0; i < per(W, 5); i++) out += sparkle(c, r() * W, 10 + r() * 60, 2.6 + r() * 2, "#ffffff");
  }
  // 먼 빌딩 실루엣 (더 어둡게, 계단 지붕)
  for (let x = -10; x < W; ) {
    const w = 18 + r() * 26;
    const h = (thumb ? 34 : 22) + r() * 34;
    const sy = base - h;
    let d = rectD(x, sy, w, h + 2, 1);
    if (r() > 0.4) d += rectD(x + w * 0.2, sy - 6 - r() * 6, w * 0.55, 12, 1);
    out += `<path d="${d}" fill="#2b3274"/>`;
    for (let k = 0; k < 3; k++) {
      const wx = x + 3 + r() * (w - 8);
      const wy = sy + 4 + r() * (h - 12);
      if (r() > 0.4 && (thumb || Math.abs(wx - m) > 44)) out += `<rect x="${n1(wx)}" y="${n1(wy)}" width="2.6" height="3.2" fill="#c9a95a" opacity=".45"/>`;
    }
    x += w + 1 + r() * 6;
  }
  const bodies = ["#1f2559", "#242b63", "#1c2152", "#272f6b"];
  const body = () => bodies[Math.floor(r() * bodies.length)];
  if (thumb) {
    // 가운데 ±30에 첨탑 빌딩 두 채, 양옆에 낮은 빌딩
    const list: [number, number, number, number][] = [
      [-166, 34, 46, 0], [-134, 32, 60, 2], [-104, 38, 42, 0], [-74, 30, 54, 0], [-14, 30, 52, 2], [50, 34, 54, 0], [80, 30, 68, 2], [106, 40, 44, 0], [142, 34, 56, 0],
    ];
    for (const [dx, w, h, kind] of list) out += building(c, m + dx, w, h, kind, body(), r, base, true, 1.2);
    out += building(c, m - 50, 46, 84, 1, "#232a66", r, base, true, 1.2) + building(c, m + 10, 48, 96, 3, "#262e6c", r, base, true, 1.2);
    out += c.part(ridge(W, base + 3, 2, 60, r), c.linear([[0, "#24453f"], [0.5, "#1d3a3a"], [1, "#172f33"]]), "", "#122626", 0.9);
    for (const bx of at(W, [-80, -20, 62, 120])) out += bush(c, bx, base + 3, 0.7, { base: "#2a5245", sh: "#1d3d36", hi: "#3f6e57" }, r);
    return out;
  }
  // 겹쳐 선 빌딩: 캐릭터 뒤(가운데 ±40)는 낮고 창을 끈다
  for (let x = -8 - r() * 10; x < W; ) {
    const w = 30 + r() * 20;
    const low = x + w > m - 40 && x < m + 40;
    const kr = r();
    const kind = low ? 0 : kr < 0.42 ? 0 : kr < 0.74 ? 2 : kr < 0.88 ? 1 : 3;
    const h = low ? 18 + r() * 12 : 30 + r() * 48 + (Math.abs(x - m) > 200 && r() > 0.7 ? 14 : 0);
    out += building(c, x, w, h, kind, body(), r, GROUND, !low);
    x += w - 4 + r() * 6;
  }
  // 앞장선 첨탑 빌딩 두 채
  out += building(c, m - 98, 46, 86, 3, "#232a66", r) + building(c, m + 62, 46, 92, 1, "#262e6c", r);
  // 풀밭, 덤불, 가로등
  out += c.part(ridge(W, GROUND + 3, 2, 60, r), c.linear([[0, "#24453f"], [0.5, "#1d3a3a"], [1, "#172f33"]]), patches(c, r, per(W, 5), 146, 172, "#2c5546", 0.7, 3), "#122626", 0.9);
  for (let bx = 4 + r() * 10; bx < W; bx += 26 + r() * 30)
    if (Math.abs(bx - m) > 40) out += bush(c, bx, GROUND + 3, 0.55 + r() * 0.25, { base: "#2a5245", sh: "#1d3d36", hi: "#3f6e57" }, r);
  for (let i = 0; i < per(W, 10); i++) out += tuft(r() * W, 140 + r() * 38, "#2f5a4a");
  for (const lx of at(W, [-136, 140, -290, 300], 4)) out += lamp(c, lx, 150);
  return out;
}

/** 행성 (ring=true면 고리). tilt = 고리·줄무늬 기울기(도). 고리는 얇고 밝게, 뒤 반쪽 → 행성 → 앞 반쪽 (앞 반쪽을 몇 도 겹치고 끝은 butt) */
function planet(c: Cv, x: number, y: number, rad: number, t: Tone & { ring: string }, tilt: number, ring = true): string {
  const ol = darken(t.sh, 0.38);
  const a = (tilt * Math.PI) / 180;
  const rx = rad * 1.75;
  const ry = rad * 0.44;
  const at2 = (th: number) => {
    const px = Math.cos(th) * rx;
    const py = Math.sin(th) * ry;
    return `${n1(x + px * Math.cos(a) - py * Math.sin(a))} ${n1(y + px * Math.sin(a) + py * Math.cos(a))}`;
  };
  // 정확한 타원 호. 앞 반쪽(아래)은 온 타원의 첫 호와 같은 명령이라 두 곡선이 정확히 겹친다
  const half = `M${at2(0)}A${n1(rx)} ${n1(ry)} ${tilt} 1 1 ${at2(Math.PI)}`;
  const full = `${half}A${n1(rx)} ${n1(ry)} ${tilt} 1 1 ${at2(0)}Z`;
  const rw = rad * 0.16;
  const ringStroke = (d: string) =>
    `<path d="${d}" fill="none" stroke="${darken(t.ring, 0.3)}" stroke-width="${n1(rw + 1.2 * SK)}" stroke-linecap="butt"/>` +
    `<path d="${d}" fill="none" stroke="${t.ring}" stroke-width="${n1(rw)}" stroke-linecap="butt"/>`;
  let bands = "";
  for (const [dy, hh, col] of [[-0.62, 0.11, t.hi], [-0.3, 0.13, t.sh], [0.02, 0.11, t.hi], [0.34, 0.13, t.sh], [0.66, 0.1, t.hi]] as const)
    bands += `<ellipse cx="${n1(x)}" cy="${n1(y + dy * rad)}" rx="${n1(rad * 1.25)}" ry="${n1(hh * rad)}" fill="${col}" opacity=".7" transform="rotate(${tilt} ${n1(x)} ${n1(y)})"/>`;
  // 고리: 온 타원을 행성 뒤에 한 번 그리고, 앞 반쪽은 행성 원 안(외곽선 포함)으로만 잘라 다시 얹는다 → 끝 이음매가 없다
  let front = "";
  if (ring) {
    const cid = c.id("c");
    c.defs.push(`<clipPath id="${cid}"><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(rad + 1.2 * SK)}"/></clipPath>`);
    front = `<g clip-path="url(#${cid})">${ringStroke(half)}</g>`;
  }
  return (
    (ring ? ringStroke(full) : "") +
    c.part(
      circD(x, y, rad),
      t.base,
      bands +
        `<circle cx="${n1(x + rad * 0.5)}" cy="${n1(y + rad * 0.55)}" r="${n1(rad * 0.95)}" fill="${t.sh}" opacity=".8" ${c.blur(rad * 0.3)}/>` +
        `<ellipse cx="${n1(x - rad * 0.38)}" cy="${n1(y - rad * 0.42)}" rx="${n1(rad * 0.42)}" ry="${n1(rad * 0.3)}" fill="${t.hi}" opacity=".75" ${c.blur(rad * 0.2)}/>` +
        `<ellipse cx="${n1(x - rad * 0.48)}" cy="${n1(y - rad * 0.48)}" rx="${n1(rad * 0.14)}" ry="${n1(rad * 0.1)}" fill="#fff" opacity=".6" ${c.blur(rad * 0.05)}/>`,
      ol,
      1.1,
    ) +
    front
  );
}

// 우주: 짙은 남보라 하늘, 별과 큰 반짝이, 파란 고리 행성, 보라 고리 행성, 캐릭터가 서는 어두운 달 표면
function space(c: Cv): string {
  const { W, m, thumb } = c;
  const r = rng(89);
  let out = `<rect x="-2" y="-2" width="${W + 4}" height="${H + 4}" fill="${c.radial([[0, "#363b8e"], [0.55, "#282c74"], [1, "#1c2059"]], 0.5, 0.45, 0.75)}"/>`;
  out += `<g ${c.blur(14)}>${Array.from({ length: per(W, 3) }, (_, i) => `<ellipse cx="${n1(r() * W)}" cy="${n1(30 + r() * 80)}" rx="${n1(40 + r() * 40)}" ry="${n1(16 + r() * 14)}" fill="${i % 2 ? "#5a4cae" : "#3c66b4"}" opacity=".35"/>`).join("")}</g>`;
  const blue = { base: "#5d93dc", sh: "#3f6fbf", hi: "#a9cdf6", ring: "#a9cff4" };
  const purple = { base: "#b99bdc", sh: "#9273c2", hi: "#e3d2f6", ring: "#d8c4f2" };
  const hero = (list: [number, number, number, string][]) => list.map(([x, y, rr, col]) => sparkle(c, x, y, rr, col, false, 0.12)).join("");
  if (thumb) {
    out += dots(W, r, 20, 2, 166, ["#ffffff", "#d8dcff", "#ffe9b0"], 0.9, 1.6, 0.6, 1);
    out += hero([[m - 58, 44, 8.5, "#ffffff"], [m - 16, 24, 6, "#ffffff"], [m + 84, 96, 5.5, "#ffffff"], [m + 50, 132, 7.5, "#f7b8e4"]]);
    out += planet(c, m + 55, 40, 18, blue, -14) + planet(c, m - 50, 100, 21, purple, -16);
  } else {
    out += dots(W, r, per(W, 40), 2, 132, ["#ffffff", "#d8dcff", "#ffe9b0"], 0.5, 1.3, 0.5, 1);
    for (let i = 0; i < per(W, 6); i++) {
      const x = r() * W;
      const y = 8 + r() * 112;
      if (Math.abs(x - m) > 30 || y < 70) out += sparkle(c, x, y, 2.4 + r() * 2.2, i % 3 === 2 ? "#f7b8e4" : "#ffffff");
    }
    out += hero([[m - 172, 52, 7.5, "#ffffff"], [m + 30, 22, 6, "#ffffff"], [m - 44, 36, 5, "#ffffff"], [m + 196, 104, 7, "#f7b8e4"]]);
    out += `<path d="M${n1(m + 160)} 22l26 10" ${SO("#ffffff", 1.6)} opacity=".5"/><circle cx="${n1(m + 186)}" cy="32" r="2.2" fill="#fff"/>`;
    out += planet(c, m + 268, 92, 10, { base: "#f2a46b", sh: "#d77f4c", hi: "#fbd2a8", ring: "#f6d38e" }, -10, false);
    out += planet(c, m - 272, 40, 8, { base: "#c9cde6", sh: "#9aa0c8", hi: "#eef0fb", ring: "#fff" }, 0, false);
    out += planet(c, m + 96, 46, 18, blue, -14) + planet(c, m - 100, 90, 20, purple, -16);
  }
  // 달 표면 (가운데가 살짝 볼록, 어둡고 차분한 보라 + 가는 테두리 빛). 분화구는 빛 반대편(오른쪽 아래) 안쪽 벽이 밝다
  const edge = thumb ? 176 : GROUND + 14;
  const ctrl = thumb ? 160 : GROUND - 8;
  let craters = "";
  const crater = (x: number, y: number, rr: number) =>
    `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(rr)}" ry="${n1(rr * 0.36)}" fill="#3a3572" ${SO("#2f2a60", 0.7)}/>` +
    `<path d="M${n1(x - rr * 0.8)} ${n1(y + rr * 0.1)}Q${n1(x)} ${n1(y + rr * 0.4)} ${n1(x + rr * 0.85)} ${n1(y - rr * 0.05)}" fill="none" stroke="#8f86d0" stroke-width="${n1(SK)}"/>`;
  if (thumb) craters = crater(m - 62, 175, 8) + crater(m + 40, 173, 6.5);
  else
    for (let i = 0; i < per(W, 5); i++) {
      const x = r() * W;
      if (Math.abs(x - m) < 36) continue;
      craters += crater(x, 146 + r() * 26, 5 + r() * 6);
    }
  out += c.part(
    `M-10 ${edge}Q${n1(m)} ${ctrl} ${W + 10} ${edge}V${H + 4}H-10Z`,
    c.linear([[0, "#5c5499"], [0.5, "#4d4689"], [1, "#3f3a7a"]]),
    `<path d="M-10 ${edge + 1.2}Q${n1(m)} ${ctrl + 1.2} ${W + 10} ${edge + 1.2}" fill="none" stroke="#8f86d0" stroke-width="${n1(1.4 * SK)}" opacity=".9"/>` +
      (thumb ? "" : patches(c, r, per(W, 4), 150, 174, "#6a62a8", 0.5) + dots(W, r, per(W, 18), 140, 178, ["#3a3572", "#7f77c2"], 0.6, 1.2)) +
      craters,
    "#2f2a60",
    1,
  );
  return out;
}

const SCENES: Record<string, Scene> = {
  "bg.meadow": { accent: "#2f855a", draw: meadow },
  "bg.beach": { accent: "#0369a1", draw: beach },
  "bg.snow": { accent: "#475569", draw: snow },
  "bg.sakura": { accent: "#be185d", draw: sakura },
  "bg.night": { accent: "#a5b4fc", draw: night },
  "bg.space": { accent: "#f0abfc", draw: space },
};

/** 배경 장면 SVG. width: 그릴 너비 (작은 칸 320, 넓은 미니룸 760). 높이는 늘 180. 400 이하는 작은 칸 배치로 그린다 */
export function backgroundSvg(assetKey: string, width = 320): string {
  const key = SCENES[assetKey] ? assetKey : "bg.meadow";
  const W = Math.max(120, Math.round(width));
  const c = makeCanvas(W, `${key.slice(3, 5)}${W}`);
  SK = c.thumb ? 1.8 : 1;
  let body: string;
  try {
    body = SCENES[key].draw(c);
  } finally {
    SK = 1;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" stroke-linejoin="round" stroke-linecap="round"><defs>${c.defs.join("")}</defs>${body}</svg>`;
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
