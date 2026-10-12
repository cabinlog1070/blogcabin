// 크레용 그림체 (2026-10-11 정지원 님 시안). 거친 검은 크레용 외곽선(가는 심을 깔아 끊기지 않게) + 단색 면 + 옅은 종이 결.
// 모든 그림은 "내보낼 크기"(화면 크기의 2배) 좌표로 그린다. 그림은 data URI <img>·Phaser 텍스처로 쓰여 각자 따로 그려진다.
// 서버·브라우저가 같은 문자열을 만들어야 하므로(hydration) 그림 안 id는 그림마다 0부터 다시 센다 (make).

import type { T as T_ } from "@/lib/i18n";

export const INK = "#262220";
export const SKIN = "#fbd9b8";

type P = [number, number];

// 파스텔 크레용 그림체 (2026-10-12 정지원 님 시안): 검은 외곽선 대신 같은 색 계열의 진한 크레용 테두리, 면은 결이 보이게 문지른다.
// pastel(() => 그림) 안에서 그리면 S·F·L·dot이 이 그림체로 바뀐다. 글자(T)는 읽기 쉽게 그대로 둔다
let PASTEL = false;
export function pastel<R>(draw: () => R): R {
  const before = PASTEL;
  PASTEL = true;
  try {
    return draw();
  } finally {
    PASTEL = before;
  }
}
const hex2 = (h: string) => (/^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : null);
/** 색 섞기 (t = 0이면 a, 1이면 b). #rrggbb가 아니면 a 그대로 */
const mixHex = (a: string, b: string, t: number) => {
  const x = hex2(a), y = hex2(b);
  if (!x || !y) return a;
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const PASTEL_LINE = "#7b5a44";

// 가구 색 바꾸기 (SHOP-05): withPaint(색 바꿈표, () => 그림) 안에서 그리면 F·S·L이 표에 있는 색을 바꿔 칠한다
let PAINT: Record<string, string> | null = null;
export function withPaint<R>(paint: Record<string, string> | null, draw: () => R): R {
  const before = PAINT;
  PAINT = paint;
  try {
    return draw();
  } finally {
    PAINT = before;
  }
}
const paint = (c: string) => PAINT?.[c.toLowerCase()] ?? c;

let seq = 0;
/** 그림 하나 안에서만 쓰는 id */
export const nid = (p: string) => `${p}${(seq++).toString(36)}`;

/** 크레용 선(cr)·반투명 종이 결(fg)·그림 전체 종이 결(grain)·불빛(glow) 필터. 필터 영역을 그림 크기로 잡아 가로·세로 직선도 지워지지 않게 한다.
 *  필터는 그리는 데 시간이 걸려서(광장 그림 35장) 면마다 따로 걸지 않고 종이 결은 그림 전체에 한 번만 입힌다 */
const defs = (w: number, h: number) =>
  `<defs><filter id="cr" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${w + 40}" height="${h + 40}"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3.2 -0.9" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="g"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="w"/><feDisplacementMap in="g" in2="w" scale="2.5"/></filter>` +
  `<filter id="fg" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${w + 40}" height="${h + 40}"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="12" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 0.25" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>` +
  `<filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="12" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.227  0 0 0 0 0.165  0 0 0 0 0.102  0 0 0 0.112 0.0175" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in" result="g"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="g"/></feMerge></filter>` +
  `<filter id="pz" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${w + 40}" height="${h + 40}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.6 -0.45" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="g"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="w"/><feDisplacementMap in="g" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>` +
  `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter></defs>`;

/** 완성 SVG (viewBox = 그린 좌표). dw·dh = 그림의 width/height 속성 (기본은 그린 크기 그대로) */
export function svg(w: number, h: number, body: string, opts: { bg?: string; dw?: number; dh?: number; attrs?: string } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${opts.dw ?? w}" height="${opts.dh ?? h}"${opts.attrs ?? ""}>${defs(w, h)}<g filter="url(#grain)">${opts.bg ? `<rect width="${w}" height="${h}" fill="${opts.bg}"/>` : ""}${body}</g></svg>`;
}
/** id를 0부터 세며 그린다 (같은 그림은 늘 같은 문자열) */
export function make(w: number, h: number, draw: () => string, opts: Parameters<typeof svg>[3] = {}): string {
  seq = 0;
  return svg(w, h, draw(), opts);
}

// ───────── 붓 ─────────
/** 면: 단색 (종이 결은 그림 전체에 한 번에 입힌다 — svg의 grain). op < 1 이면 반투명 덧칠 */
export const F = (d: string, c: string, op = 1) => Fill(d, paint(c), op);
const Fill = (d: string, c: string, op: number) =>
  PASTEL && op >= 1
    ? `<path d="${d}" fill="${mixHex(c, "#ffffff", 0.12)}" opacity=".6"/><path d="${d}" fill="${mixHex(c, "#ffffff", 0.12)}" filter="url(#pz)"/>`
    : op < 1 ? `<path d="${d}" fill="${c}" opacity="${op}" filter="url(#fg)"/>` : `<path d="${d}" fill="${c}"/>`;
/** 크레용 선: 가는 심(끊기지 않는 선) + 거친 크레용 결 두 번(한 묶음으로 한 번에 거칠게 해 필터 수를 줄인다) */
export const L = (d: string, w = 5, color = INK) => {
  color = paint(color);
  if (PASTEL) {
    const c = color === INK ? PASTEL_LINE : color;
    // 가는 선(눈썹·입·무늬)은 결을 넣으면 끊겨서 또렷하게 그린다
    if (w <= 3) return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${+(w * 0.9).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".8" filter="url(#pz)"/>`;
  }
  const st = (sw: number) => `fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  return `<path d="${d}" ${st(+(w * 0.45).toFixed(1))}/>` +
    `<g filter="url(#cr)"><path d="${d}" ${st(w)}/><path d="${d}" ${st(+(w * 0.5).toFixed(1))} opacity=".8" transform="translate(.7 .5)"/></g>`;
};
/** 면 + (그늘) + 외곽선. 그늘은 면 모양 안에서만 칠한다 */
export const S = (d: string, c: string, w = 5, shade?: string) => {
  let o = F(d, c);
  if (shade) {
    const id = nid("s");
    o += `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${F(shade, "#000", PASTEL ? 0.07 : 0.13)}</g>`;
  }
  // 파스텔: 테두리는 면 색을 조금 진하게 한 크레용
  if (PASTEL) return o + `<path d="${d}" fill="none" stroke="${mixHex(paint(c), "#3a2a1a", 0.28)}" stroke-width="${+(w * 1.5).toFixed(1)}" stroke-linejoin="round" filter="url(#pz)"/>`;
  return o + L(d, w);
};
/** 모양 안에만 그리기 */
export const clip = (d: string, body: string) => {
  const id = nid("c");
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${body}</g>`;
};
export const E = (cx: number, cy: number, rx: number, ry = rx) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
export const Rc = (x: number, y: number, w: number, h: number, r = 0) =>
  r
    ? `M${x + r} ${y}h${w - 2 * r}q${r} 0 ${r} ${r}v${h - 2 * r}q0 ${r} ${-r} ${r}h${-(w - 2 * r)}q${-r} 0 ${-r} ${-r}v${-(h - 2 * r)}q0 ${-r} ${r} ${-r}Z`
    : `M${x} ${y}h${w}v${h}h${-w}Z`;
export const Pg = (pts: (P | [string, string])[]) => "M" + pts.map((p) => p.join(" ")).join(" L") + "Z";
export const dot = (x: number, y: number, r = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${PASTEL ? "#4a3628" : INK}"/>`; // 파스텔에서도 눈은 또렷하게
export const blush = (x: number, y: number, rx = 7, ry = 4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#f59a9a" opacity=".85" filter="url(#fg)"/>`;
// 일본어(가나)가 든 글자는 일본어 글꼴로 그린다. 그림(SVG)은 이미지로 그려져 웹 글꼴을 못 쓰므로 기기 글꼴을 고른다
const SVG_FONT_KO = "'Apple SD Gothic Neo','Noto Sans KR',sans-serif";
const SVG_FONT_JA = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Noto Sans CJK JP','Yu Gothic','Meiryo',sans-serif";
export const T = (x: number, y: number, s: number, txt: string, c = INK) =>
  `<text x="${x}" y="${y}" font-size="${s}" font-weight="900" text-anchor="middle" fill="${c}" font-family="${/[\u3040-\u30ff]/.test(txt) ? SVG_FONT_JA : SVG_FONT_KO}">${txt}</text>`;
export const shadow = (cx: number, cy: number, rx: number, ry = rx * 0.18) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#3b2a1a" opacity=".15"/>`;
const scallops = (x0: number, x1: number, y: number, n: number, h = 10, w = 3.5) => {
  const st = (x1 - x0) / n;
  let d = "";
  for (let i = 0; i < n; i++) d += `M${x0 + i * st} ${y} q${st / 2} ${h * 2} ${st} 0 `;
  return L(d, w);
};
/** 다섯 꽃잎 꽃 여러 송이 (가로로) */
export const flowers = (x: number, y: number, cols: string[], r = 7) =>
  cols
    .map((c, i) => {
      const cx = x + i * r * 2.4;
      return `<g filter="url(#fg)">${[0, 1, 2, 3, 4].map((k) => `<circle cx="${(cx + r * 0.75 * Math.cos(k * 1.256)).toFixed(1)}" cy="${(y + r * 0.75 * Math.sin(k * 1.256)).toFixed(1)}" r="${(r * 0.62).toFixed(1)}" fill="${c}"/>`).join("")}</g>` +
        L(E(cx, y, r * 1.35), 2.5) + `<circle cx="${cx}" cy="${y}" r="${(r * 0.3).toFixed(1)}" fill="#f6d54a"/>`;
    })
    .join("");

// ───────── 1. 광장 건물 ─────────
/** 지붕은 회색으로 그리고 고른 색을 곱해(multiply) 칠한다 */
const ROOF = "#E6E6E6", ROOF2 = "#C9C9C9";
const tintG = (body: string, hex?: string) => {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return body;
  const id = nid("t");
  const ch = (i: number) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3);
  return `<filter id="${id}"><feColorMatrix type="matrix" values="${ch(1)} 0 0 0 0  0 ${ch(3)} 0 0 0  0 0 ${ch(5)} 0 0  0 0 0 1 0"/></filter><g filter="url(#${id})">${body}</g>`;
};

/** 집 (단계 1~3, 둥근 지붕). 크기는 HOUSE_STAGES의 2배 */
export function house(stage: 1 | 2 | 3, roof?: string): string {
  const [W, H] = ([[300, 280], [364, 336], [428, 408]] as const)[stage - 1];
  return make(W, H, () => {
    const g = H - 10, wl = W * 0.18, wr = W * 0.82, cx = W / 2, ex = W * 0.07;
    const rh = W * 0.34, base = H * (stage === 3 ? 0.5 : 0.52), top = base - rh, wt = base - 6;
    const rl = wl - ex, rr = wr + ex;
    const RP = `M${rl} ${base}C${rl - 6} ${base - rh * 0.55} ${cx - W * 0.3} ${top} ${cx} ${top}C${cx + W * 0.3} ${top} ${rr + 6} ${base - rh * 0.55} ${rr} ${base}Z`;
    let o = shadow(cx, g, W * 0.36, 10);
    if (stage >= 2) {
      const chx = cx + W * 0.17, cw = W * 0.08, cy = top + rh * 0.2 - 30;
      o += S(Rc(chx, cy, cw, base - cy), "#b5654a", 5) + L(`M${chx} ${cy + 16}h${cw}M${chx} ${cy + 32}h${cw}`, 2.5) + S(Rc(chx - 5, cy - 10, cw + 10, 12), "#8e4a35", 4);
    }
    const wall = Rc(wl, wt, wr - wl, g - wt);
    o += S(wall, "#E2B47C", 5, Rc(wr - (wr - wl) * 0.2, wt, (wr - wl) * 0.2, g - wt));
    let planks = "";
    for (let y = wt + 30; y < g - 8; y += 24) planks += L(`M${wl + 6} ${y}h${wr - wl - 12}`, 2);
    o += clip(wall, planks);
    // 벽 판자 위로 문·창을 그려 판자 선이 문·창 뒤로 숨게
    const dw = W * 0.15, dh = Math.min((g - wt) * 0.62, W * 0.3);
    o += S(`M${cx - dw / 2} ${g}V${g - dh + dw / 2}a${dw / 2} ${dw / 2} 0 0 1 ${dw} 0V${g}Z`, "#a0683d", 5) + dot(cx + dw * 0.25, g - dh * 0.45, 4);
    const ww = W * (stage >= 2 ? 0.14 : 0.12), wy = wt + (g - wt) * 0.18;
    const wins = stage >= 2 ? [wl + W * 0.06, wr - W * 0.06 - ww] : [wl + W * 0.07];
    for (const x of wins) {
      o += S(Rc(x, wy, ww, ww), "#8ccfe8", 5) + L(`M${x + ww / 2} ${wy}v${ww}` + (stage >= 2 ? `M${x} ${wy + ww / 2}h${ww}` : ""), 3.5);
      if (stage >= 2) o += S(Rc(x - 3, wy + ww + 8, ww + 6, 14), "#8a5a3a", 4) + flowers(x + 8, wy + ww + 4, ["#e8433a", "#d652b8", "#f2c230"], 6);
    }
    o += tintG(F(RP, ROOF) + clip(RP, F(`M${cx + W * 0.08} ${top - 20}C${cx + W * 0.3} ${top} ${rr + 10} ${base - rh * 0.55} ${rr + 10} ${base + 4}H${cx + W * 0.12}Z`, ROOF2)), roof);
    // 비늘 무늬는 지붕 안쪽에만
    let sc = "";
    for (let r = 1; r <= 3; r++) sc += scallops(rl - 10, rr + 10, top + rh * (r / 3.6) + 6, Math.round((rr - rl) / 34), 8, 3.2);
    o += clip(RP, sc);
    if (stage === 3) {
      const dwid = W * 0.17, dx = cx - dwid / 2, dy = top + rh * 0.38;
      const DR = `M${dx - 8} ${dy + 10}Q${dx - 6} ${dy - 24} ${cx} ${dy - 26}Q${dx + dwid + 6} ${dy - 24} ${dx + dwid + 8} ${dy + 10}Z`;
      o += S(Rc(dx, dy + 4, dwid, dwid * 0.72), "#E2B47C", 4.5) + S(Rc(dx + dwid * 0.2, dy + 12, dwid * 0.6, dwid * 0.48), "#8ccfe8", 4) + tintG(F(DR, ROOF), roof) + L(DR, 5);
    }
    return o + L(RP, 5.5);
  });
}

/** 동물 농장 (헛간·울타리·건초) 520×340 */
/** 광장의 동물 농장 520×340 (2026-10-12 정지원 님 시안): 동그란 나무 울타리 안에 작은 헛간, 건초, 통, 물통, 병아리와 돼지 */
export function farm(): string {
  return make(520, 340, () => {
    const cx = 260, cy = 232, rx = 236, ry = 92;
    const WOOD = "#a8743f", RED = "#d9534a", TRIM = "#f4efe6";
    // 손으로 그린 듯 조금씩 흔들리는 값 (같은 그림은 늘 같은 모양)
    const wob = (i: number, k = 1) => Math.sin(i * 12.9898 + 4.1) * k;
    const at = (a: number, r = 1) => [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r] as const;
    /** 점들을 부드러운 곡선으로 잇는다 (Catmull-Rom) */
    const smooth = (pts: (readonly [number, number])[], closed = true) => {
      const n = pts.length, get = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const [p0, p1, p2, p3] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C${c1.map((v) => v.toFixed(1)).join(" ")} ${c2.map((v) => v.toFixed(1)).join(" ")} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return closed ? d + "Z" : d;
    };
    const ring = (r: number, n: number, k: number, seed: number, dx = 0, dy = 0, sx = 1, sy = 1) =>
      smooth(Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2, q = 1 + wob(i + seed, k);
        return [cx + dx + Math.cos(a) * rx * r * sx * q, cy + dy + Math.sin(a) * ry * r * sy * q] as const;
      }));
    // 울타리 반쪽 (뒤: 위쪽 반원, 앞: 아래쪽 반원). 기둥 사이 가로대는 살짝 처진다
    const fence = (front: boolean) => {
      const posts = Array.from({ length: 15 }, (_, i) => {
        const [x, y] = at(Math.PI + (i / 14) * Math.PI * (front ? -1 : 1));
        return { x, y, h: 36 + wob(i * 3 + (front ? 7 : 1), 4), tilt: wob(i * 5 + (front ? 2 : 9), 3) };
      });
      const gate = (x: number) => front && Math.abs(x - cx) < 40; // 앞쪽 가운데는 드나드는 입구
      let rails = "";
      for (let i = 0; i < posts.length - 1; i++) {
        const p = posts[i], q = posts[i + 1];
        if (gate(p.x) || gate(q.x)) continue;
        for (const dy of [-26, -12]) rails += `M${p.x.toFixed(1)} ${(p.y + dy).toFixed(1)}Q${((p.x + q.x) / 2).toFixed(1)} ${((p.y + q.y) / 2 + dy + 3).toFixed(1)} ${q.x.toFixed(1)} ${(q.y + dy).toFixed(1)}`;
      }
      let o = L(rails, 7, WOOD);
      for (const p of posts) {
        if (gate(p.x)) continue;
        const { x, y, h } = p;
        o += `<g transform="rotate(${p.tilt.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">` +
          S(`M${x - 6} ${y + 2}L${x - 5.5} ${y - h + 6}Q${x - 5} ${y - h} ${x} ${y - h - 1}Q${x + 5} ${y - h} ${x + 5.5} ${y - h + 6}L${x + 6} ${y + 2}Q${x} ${y + 4} ${x - 6} ${y + 2}Z`, WOOD, 3.5) + "</g>";
      }
      return o;
    };
    // 바닥 그림자를 두지 않는다: 울타리가 광장 풀밭 위에 그대로 서 있게 (2026-10-12 정지원 님)
    let o = fence(false);
    // 울타리 안 풀밭과 흙: 가장자리가 울퉁불퉁하고 반쯤 비쳐서 광장 풀밭과 이어진다
    o += F(ring(0.96, 18, 0.025, 1), "#c2e39a", 0.55) + F(ring(0.5, 12, 0.08, 4, 34, 26, 1, 0.9), "#e2c99a", 0.85);
    o += L("M70 214q4-8 2-14M76 214q-2-8 4-12M402 210q2-8 0-12M408 210q4-6 2-12M150 262q2-6 0-10", 2.5, "#8cbf62");
    // 헛간: 벽은 아래로 살짝 퍼지고, 지붕 끝은 부드럽게 휘어 내려온다
    const wall = "M124 124C122 160 120 200 118 232Q194 238 270 232C268 200 266 160 264 124Z";
    o += S(wall, RED, 5, "M232 120h50v120h-50Z");
    o += clip(wall, [142, 162, 182, 206, 226, 246].map((x, i) => L(`M${x} 124q${wob(i, 2).toFixed(1)} 56 ${(-1 + wob(i + 3, 1)).toFixed(1)} 112`, 2, "#b5443c")).join(""));
    o += S("M194 60Q160 92 124 124H264Q228 92 194 60Z", RED, 4);
    o += S("M98 136Q96 128 104 124Q150 92 194 50Q238 92 284 124Q292 128 290 136Q284 142 272 136Q232 104 194 68Q156 104 116 136Q104 142 98 136Z", "#8a5a3a", 4);
    o += L("M114 132Q154 100 194 62Q234 100 274 132", 3, TRIM);
    o += S("M180 108V96Q180 86 194 86Q208 86 208 96V108Q194 112 180 108Z", TRIM, 3) + S("M184 106V97Q184 90 194 90Q204 90 204 97V106Q194 109 184 106Z", "#8cc4ea", 2) + L("M194 90v17", 2, TRIM);
    // 문: 위가 둥근 문 + 흰 X
    o += S("M158 234V182Q158 160 194 158Q230 160 230 182V234Z", TRIM, 4);
    const door = "M165 234V184Q165 167 194 166Q223 167 223 184V234Z";
    o += S(door, RED, 3) + clip(door, L("M166 170Q192 200 222 234M222 170Q196 200 166 234", 5, TRIM));
    // 건초 더미: 둥근 빵 모양 + 지푸라기 결
    o += S("M50 236C46 216 50 198 66 192Q88 188 110 190C124 194 128 216 124 236Q88 242 50 236Z", "#f0c95a", 4.5, "M104 186h30v60h-30Z");
    o += L("M58 206q20-4 46 0M56 222q24-3 50 0M114 202q4 10 0 22", 2.5, "#c89a2e") + L("M62 192q-4-6-2-10M92 189q2-7 6-9M122 214q6 0 8-4", 2.5, "#e0b23e");
    // 나무통: 가운데가 볼록 + 휜 테
    o += S("M286 240C278 222 278 210 286 194Q302 189 318 194C326 210 326 222 318 240Q302 245 286 240Z", "#b07a48", 4.5, "M308 186h24v64h-24Z");
    o += L("M282 208Q302 213 322 208M282 226Q302 231 322 226", 3);
    // 물통: 가장자리가 둥근 여물통
    o += S("M370 236Q412 230 454 236Q452 252 442 258Q412 263 382 258Q372 252 370 236Z", "#9a6a40", 4.5) + S("M378 237Q412 232 446 237Q412 244 378 237Z", "#8cc4ea", 2.5);
    // 병아리: 머리와 몸이 이어진 물방울 모양 + 날개 + 머리깃
    const chick = (x: number, y: number) =>
      shadow(x, y + 20, 18, 4) +
      S(`M${x - 20} ${y + 6}C${x - 22} ${y - 6} ${x - 14} ${y - 10} ${x - 6} ${y - 10}C${x - 6} ${y - 22} ${x + 16} ${y - 26} ${x + 18} ${y - 8}C${x + 22} ${y + 6} ${x + 14} ${y + 18} ${x - 2} ${y + 18}C${x - 14} ${y + 18} ${x - 20} ${y + 14} ${x - 20} ${y + 6}Z`, "#f6d54a", 4) +
      L(`M${x - 12} ${y + 2}q4 10 14 6`, 2.5, "#e0b02e") + L(`M${x + 4} ${y - 20}q-2-8 4-8M${x + 8} ${y - 20}q2-6 7-4`, 2.5, "#e0b02e") +
      dot(x + 9, y - 10, 2.8) + S(`M${x + 17} ${y - 9}Q${x + 26} ${y - 7} ${x + 17} ${y - 3}Z`, "#f29a3a", 2) + blush(x + 6, y - 3, 4, 2.5) +
      L(`M${x - 6} ${y + 17}q-1 4-3 6M${x + 6} ${y + 17}q1 4 3 6`, 2.5, "#f29a3a");
    // 돼지: 콩 모양 몸 + 둥근 머리 + 접힌 귀 + 동그랗게 말린 꼬리
    const pig = (x: number, y: number) =>
      shadow(x + 6, y + 22, 36, 5) +
      [-20, -8, 10, 22].map((d) => S(`M${x + d - 5} ${y + 10}Q${x + d - 5} ${y + 24} ${x + d} ${y + 24}Q${x + d + 5} ${y + 24} ${x + d + 5} ${y + 10}Z`, "#f2a7b5", 2.5)).join("") +
      S(`M${x - 34} ${y + 2}C${x - 36} ${y - 16} ${x - 16} ${y - 22} ${x + 4} ${y - 20}C${x + 22} ${y - 20} ${x + 28} ${y - 6} ${x + 26} ${y + 6}C${x + 24} ${y + 18} ${x + 8} ${y + 20} ${x - 8} ${y + 20}C${x - 26} ${y + 20} ${x - 34} ${y + 14} ${x - 34} ${y + 2}Z`, "#f7b8c4", 4) +
      S(`M${x + 16} ${y - 4}C${x + 14} ${y - 20} ${x + 30} ${y - 26} ${x + 42} ${y - 18}C${x + 54} ${y - 10} ${x + 52} ${y + 8} ${x + 38} ${y + 12}C${x + 26} ${y + 14} ${x + 16} ${y + 8} ${x + 16} ${y - 4}Z`, "#f7b8c4", 4) +
      S(`M${x + 24} ${y - 18}Q${x + 22} ${y - 32} ${x + 32} ${y - 30}Q${x + 34} ${y - 22} ${x + 30} ${y - 16}Z`, "#f2a7b5", 2.5) +
      S(`M${x + 40} ${y + 1}Q${x + 40} ${y - 6} ${x + 47} ${y - 6}Q${x + 54} ${y - 6} ${x + 54} ${y + 1}Q${x + 54} ${y + 7} ${x + 47} ${y + 7}Q${x + 40} ${y + 7} ${x + 40} ${y + 1}Z`, "#f29aaa", 2.5) +
      dot(x + 45, y + 1, 1.6) + dot(x + 50, y + 1, 1.6) + dot(x + 34, y - 7, 2.6) + blush(x + 30, y + 3, 4, 2.5) +
      L(`M${x - 33} ${y - 2}c-8 0-9-8-4-9c5-1 5 6 0 6`, 2.5, "#e88a9c");
    o += chick(214, 258) + pig(300, 262);
    o += flowers(84, 262, ["#f28fa8", "#fff"], 6) + flowers(430, 280, ["#f2c230", "#f28fa8"], 6);
    o += fence(true);
    return o;
  });
}

/** 상점 420×360 (2026-10-12 정지원 님 시안: 둥근 간판, 빨강·흰 줄무늬 차양, 큰 창문 두 개, 가운데 문과 계단, 양옆 덤불) */
export function shop(t: T_ = (k) => k): string {
  return make(420, 360, () => {
    const WALL = "#f4c070", RED = "#e0573f", CREAM = "#f6e6c8", GLASS = "#86aec0", FRAME = "#b8603e";
    // 덤불 (가게 뒤에서 양옆으로 삐져나온다)
    const bush = (x: number, w: number) => S(`M${x} 334C${x - 6} 310 ${x + 4} 290 ${x + w * 0.3} 288C${x + w * 0.36} 268 ${x + w * 0.7} 266 ${x + w * 0.78} 286C${x + w + 4} 288 ${x + w + 8} 316 ${x + w} 334Z`, "#6fb24a", 4);
    let o = bush(18, 66) + bush(336, 66);
    // 벽 + 바닥 받침
    o += S("M62 140H358L362 324H58Z", WALL, 5, "M330 130h40v200h-40Z");
    o += S("M48 322Q210 316 372 322L374 340Q210 346 46 340Z", CREAM, 4);
    // 창문: 크림색 틀 + 푸른 유리 + 갈색 창살 + 빛 빗금
    const win = (x: number) => {
      const glass = `M${x + 8} 196H${x + 90}V296H${x + 8}Z`;
      return S(`M${x} 188Q${x + 49} 184 ${x + 98} 188V304H${x}Z`, CREAM, 4) + S(glass, GLASS, 3) +
        clip(glass, L(`M${x + 20} 290l30-90M${x + 36} 290l30-90M${x + 64} 270l18-56`, 4, "#d6eaf2")) +
        L(`M${x + 49} 196V296M${x + 8} 226H${x + 90}`, 3.5, FRAME);
    };
    o += win(76) + win(246);
    // 가운데 문: 위에 유리, 걸린 작은 팻말, 손잡이
    o += S("M178 324V178Q210 172 242 178V324Z", CREAM, 4) + S("M186 324V186H234V324Z", "#c9563f", 4);
    o += S("M194 196H226V250H194Z", GLASS, 3) + clip("M194 196H226V250H194Z", L("M200 244l14-44M210 244l12-36", 3, "#d6eaf2"));
    o += L("M200 214L210 202L220 214", 2, "#7b5a44") + S("M196 214H224V230H196Z", CREAM, 2.5) + L("M202 222h16", 2.5, "#c9563f");
    o += S("M194 264H226V310H194Z", "#b44a36", 2.5) + dot(229, 272, 3.5);
    // 계단 두 칸
    o += S("M172 336H248L252 348H168Z", "#ecd7ae", 3.5) + S("M182 324H238L242 336H178Z", "#f3e2bf", 3.5);
    // 차양: 위가 좁고 아래가 넓은 줄무늬 + 둥글게 늘어진 끝
    const n = 9, top = [72, 348], bot = [38, 382];
    let stripes = "", scal = "";
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const tx0 = top[0] + (top[1] - top[0]) * t0, tx1 = top[0] + (top[1] - top[0]) * t1;
      const bx0 = bot[0] + (bot[1] - bot[0]) * t0, bx1 = bot[0] + (bot[1] - bot[0]) * t1;
      const c = i % 2 ? "#fbf3ea" : RED;
      stripes += F(`M${tx0.toFixed(1)} 98L${tx1.toFixed(1)} 98L${bx1.toFixed(1)} 144L${bx0.toFixed(1)} 144Z`, c);
      scal += S(`M${bx0.toFixed(1)} 142L${bx1.toFixed(1)} 142V160Q${((bx0 + bx1) / 2).toFixed(1)} 182 ${bx0.toFixed(1)} 160Z`, c, 3);
    }
    o += stripes + L(`M${top[0]} 98L${top[1]} 98L${bot[1]} 144L${bot[0]} 144Z`, 4, "#b5443c") + scal;
    // 노란 띠 + 위가 둥근 간판
    o += S("M64 80H356V100H64Z", "#f2b84b", 4);
    o += S("M80 82V50Q80 40 96 40H150Q160 12 210 10Q260 12 270 40H324Q340 40 340 50V82Z", "#c8644a", 5);
    return o + T(210, 72, 34, t("상점"), "#fff8ec");
  });
}

/** 마을 소식 게시판 340×340 */
export function board(t: T_ = (k) => k): string {
  return make(340, 340, () => {
    const g = 330;
    let o = shadow(170, g, 140, 10);
    o += S(Rc(48, 120, 18, g - 120, 4), "#9a6a40", 4.5) + S(Rc(274, 120, 18, g - 120, 4), "#9a6a40", 4.5);
    o += S(Rc(30, 110, 280, 160, 10), "#c98f5a", 5.5) + S(Rc(46, 126, 248, 128, 6), "#e8c48e", 4);
    o += S(Pg([[20, 116], [170, 40], [320, 116]]), "#8a5a3a", 5.5);
    const notes: [number, number, string][] = [[62, 138, "#fff8e8"], [150, 146, "#ffe0e6"], [226, 134, "#e3f2ff"], [96, 196, "#eaf7da"], [196, 198, "#fff8e8"]];
    for (const [x, y, c] of notes) o += S(Rc(x, y, 62, 48, 3), c, 3.5) + L(`M${x + 10} ${y + 18}h40M${x + 10} ${y + 30}h30`, 2.5) + `<circle cx="${x + 31}" cy="${y + 5}" r="5" fill="#e8433a"/>`;
    return o + S(Rc(118, 62, 104, 36, 8), "#fff6dc", 4.5) + T(170, 88, 22, t("마을 소식"));
  });
}

/** 출석판 220×300 */
export function attendance(t: T_ = (k) => k): string {
  return make(220, 300, () => {
    const g = 290;
    let o = shadow(110, g, 70, 8);
    o += S(Rc(100, 170, 20, g - 170, 4), "#9a6a40", 4.5);
    o += S(Rc(24, 60, 172, 130, 10), "#7fb26a", 5.5) + S(Rc(38, 74, 144, 102, 6), "#fff8e8", 4);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 5; c++) {
        const x = 46 + c * 27, y = 82 + r * 31;
        o += L(Rc(x, y, 22, 24, 3), 2.5);
        if (r * 5 + c < 8) o += `<circle cx="${x + 11}" cy="${y + 12}" r="8" fill="#e8433a" opacity=".85" filter="url(#fg)"/>` + L(E(x + 11, y + 12, 8), 2);
      }
    o += S(Pg([[14, 66], [110, 16], [206, 66]]), "#d9534a", 5.5);
    return o + S(Rc(64, 196, 92, 30, 8), "#fff6dc", 4) + T(110, 218, 18, t("출석"));
  });
}

// ───────── 2. 캠프파이어·소품·나무 ─────────
const CF = { W: 360, H: 300, cx: 180, cy: 198 };
const stoneRing = (front: boolean) => {
  let o = "";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.283;
    if (Math.sin(a) < 0 === front) continue;
    o += S(E(CF.cx + 82 * Math.cos(a), CF.cy + 30 * Math.sin(a), 18, 13), i % 2 ? "#a9a49c" : "#bdb8ae", 4);
  }
  return o;
};
const log = (x1: number, y1: number, x2: number, y2: number, c: string) => {
  const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, l = Math.hypot(x2 - x1, y2 - y1);
  return `<g transform="translate(${x1} ${y1}) rotate(${a.toFixed(1)})">${S(Rc(0, -9, l, 18, 9), c, 4.5)}${S(E(l - 8, 0, 6, 8), "#e2b47c", 3)}</g>`;
};
/** 모닥불 전체 (불꽃 없음): 뒤쪽 + 장작·앞 돌 */
export function campfireBase(): string {
  return make(CF.W, CF.H, () => shadow(CF.cx, CF.cy + 30, 110, 20) + F(E(CF.cx, CF.cy, 70, 26), "#5a3a28") + stoneRing(false) + campfireFrontBody());
}
/** 불꽃 한 프레임 (0,1,2) + 불빛 */
export function flame(frame: number): string {
  return make(CF.W, CF.H, () => {
    const { cx, cy } = CF, k = [0, 6, -6][frame % 3];
    return `<ellipse cx="${cx}" cy="${cy - 40}" rx="60" ry="60" fill="#ffb347" opacity=".35" filter="url(#glow)"/>` +
      S(`M${cx - 34} ${cy + 2}q-6-50 ${20 + k} -96q8 30 22 40q10-20 ${8 - k} -36q30 40 18 92Z`, "#f28a2e", 5) +
      F(`M${cx - 16} ${cy - 8}q-2-30 ${14 + k} -56q10 30 ${18 - k} 56Z`, "#ffd34d");
  });
}
/** 모닥불 앞쪽: 장작 + 앞 돌 (불꽃 밑동이 장작 뒤로 숨는다) */
const campfireFrontBody = () => log(CF.cx - 58, CF.cy - 12, CF.cx + 52, CF.cy + 6, "#9a6a40") + log(CF.cx + 58, CF.cy - 14, CF.cx - 50, CF.cy + 8, "#b07a48") + stoneRing(true);
export function campfireFront(): string {
  return make(CF.W, CF.H, campfireFrontBody);
}

export const bench = () => make(180, 80, () => shadow(90, 72, 80, 8) + S("M18 34h140a12 22 0 0 1 0 36H18Z", "#b07a48", 5) + S(E(20, 52, 12, 18), "#e2b47c", 4.5) + L("M20 46a5 6 0 1 1 0 12", 2.5) + L("M50 44h60M60 58h70", 2.5));
export const lamp = () =>
  make(80, 220, () =>
    shadow(30, 212, 24, 5) + S(Rc(22, 40, 14, 172, 3), "#7a5236", 4.5) + S(Rc(14, 200, 30, 12, 3), "#5e3f2a", 4) + L("M29 46h30v20", 4.5) +
    `<circle cx="59" cy="98" r="22" fill="#ffd56a" opacity=".55" filter="url(#glow)"/>` + S(Rc(46, 74, 26, 40, 6), "#ffe08a", 4.5) + S(Pg([[42, 76], [59, 62], [76, 76]]), "#4a3626", 4) + L("M52 84v22M66 84v22", 2.5));

/** 나무 160×200 (bush = 같은 틀 아래 가운데 꽃 덤불) */
export function tree(kind: "round" | "pine" | "blossom" | "bush"): string {
  return make(160, 200, () => {
    let o = shadow(80, 192, 46, 7);
    if (kind === "bush") return o + S("M30 190q-10-40 22-46q8-24 34-14q26-10 34 16q26 8 14 44Z", "#6fb34f", 5, "M90 140q26 0 36 50H90Z") + flowers(54, 160, ["#f28fa8", "#fff", "#f2c230"], 7);
    o += S(Rc(68, 120, 24, 72, 5), "#9a6a40", 4.5);
    if (kind === "pine") return o + S(Pg([[80, 10], [124, 70], [104, 70], [140, 124], [20, 124], [56, 70], [36, 70]]), "#4f9a5a", 5, Pg([[80, 10], [124, 70], [104, 70], [140, 124], [80, 124]]));
    const c = kind === "blossom" ? "#f7b6c8" : "#6fb34f";
    let d = "M30 110";
    for (const [x, y] of [[18, 82], [30, 46], [62, 24], [100, 24], [132, 46], [144, 82], [130, 112]]) d += `Q${(x + 80) / 2 + (x - 80) * 0.6} ${(y + 70) / 2 + (y - 70) * 0.6} ${x} ${y}`;
    d += "Q80 132 30 110Z";
    o += S(d, c, 5, "M84 30Q140 30 144 82Q140 120 84 124Z");
    for (const [x, y] of [[52, 62], [96, 56], [70, 92]]) o += L(`M${x} ${y}q8-8 16 0`, 3);
    if (kind === "blossom") o += [[48, 50], [110, 70], [76, 40], [120, 98], [44, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" filter="url(#fg)"/>`).join("");
    return o;
  });
}

/** 광장 소품 (크기는 props.ts의 *_SIZE 2배) */
export const PROPS = {
  mailbox: () => make(72, 128, () => shadow(36, 122, 22, 4) + S(Rc(30, 60, 12, 62, 3), "#9a6a40", 4) + S("M8 30a28 26 0 0 1 56 0v34H8Z", "#e8574b", 5) + L("M8 30h56", 3) + S(Rc(54, 10, 6, 30), "#f2c230", 3.5) + S(Rc(52, 8, 16, 12, 3), "#f2c230", 3.5)),
  laundry: () =>
    make(180, 140, () =>
      shadow(90, 134, 80, 6) + S(Rc(12, 30, 10, 104, 3), "#9a6a40", 4) + S(Rc(158, 30, 10, 104, 3), "#9a6a40", 4) + L("M17 40Q90 56 163 40", 3) +
      S("M36 46l28 4l2 10l-6 2v34h-22v-34l-6-2Z", "#8ccfe8", 4) + S("M86 50h30v40h-30Z", "#f28fa8", 4) + S("M128 48l22 2v30l-11 10l-11-10Z", "#f2c230", 4)),
  crate: () => make(88, 88, () => shadow(44, 84, 36, 5) + S(Rc(8, 14, 72, 70, 4), "#c8955c", 5, Rc(62, 14, 18, 70)) + clip(Rc(8, 14, 72, 70, 4), L("M8 38h72M8 60h72M14 18l60 62", 3.5))),
  barrel: () => make(80, 92, () => shadow(40, 88, 32, 5) + S("M14 12h52q10 38 0 76H14q-10-38 0-76Z", "#b07a48", 5, "M54 12h12q10 38 0 76H54Z") + L("M10 30h60M10 70h60", 4) + L("M14 12h52", 4)),
  planter: () => make(120, 80, () => shadow(60, 76, 48, 5) + flowers(28, 26, ["#e8433a", "#f2c230", "#d652b8", "#e8433a"], 8) + L("M30 34l-2 10M50 34v10M70 34v10M90 34l2 10", 3) + S("M10 40h100l-8 36H18Z", "#c0703f", 5, "M84 40h26l-8 36H80Z")),
  signpost: () => make(100, 160, () => shadow(50, 154, 26, 5) + S(Rc(42, 30, 14, 124, 3), "#9a6a40", 4.5) + S("M10 30h66l14 14l-14 14H10Z", "#e2b47c", 4.5) + S("M90 72H26l-14 14l14 14h64Z", "#e2b47c", 4.5) + L("M22 44h40M36 86h40", 2.5)),
  stump: () => make(88, 80, () => shadow(44, 74, 38, 6) + S("M10 30v38q34 14 68 0V30Z", "#9a6a40", 5, "M60 30h18v38q-8 4-18 6Z") + S(E(44, 30, 34, 12), "#e2b47c", 4.5) + L(E(44, 30, 18, 6), 2.5) + L("M10 68l-6 6M78 68l6 6", 4)),
  fence: () => make(180, 92, () => shadow(90, 88, 82, 4) + [14, 84, 154].map((x) => S(`M${x} 88V22l7-10l7 10v66Z`, "#c08a5a", 4.5)).join("") + S(Rc(6, 34, 168, 12, 4), "#c08a5a", 4) + S(Rc(6, 60, 168, 12, 4), "#c08a5a", 4)),
  rock: () => make(92, 68, () => shadow(46, 64, 40, 5) + S("M8 60q-6-26 14-40q20-16 44-6q24 14 18 46Z", "#b9b4aa", 5, "M62 14q24 14 22 46H56Z") + L("M30 30q8-6 16-2", 2.5)),
  flowers: () => make(80, 60, () => L("M20 58l2-24M40 58v-30M60 58l-2-24", 3) + flowers(20, 30, ["#f28fa8"], 8) + flowers(40, 22, ["#f2c230"], 8) + flowers(60, 32, ["#ffffff"], 8) + F("M14 58q6-14 12 0M50 58q6-12 12 0", "#6fb34f")),
  grass: () => make(68, 44, () => S("M8 42q2-18 10-30q0 16 6 30q4-26 12-36q2 22 4 36q6-20 14-28q-2 16 0 28Z", "#6fb34f", 4)),
};

// ───────── 6. 농장 화면 ─────────
// 광장 풀밭과 같은 한 가지 색 + 드문드문 풀 포기 (체크무늬·점 꽃 없이, 2026-10-12)
export const grassTile = () =>
  make(240, 240, () => {
    let o = "";
    for (let i = 0; i < 6; i++) {
      const x = 20 + ((i * 71) % 200), y = 24 + ((i * 113) % 196);
      o += L(`M${x - 8} ${y - 10}l6 10l4-14l4 14l6-8`, 3, "#6f9c46");
    }
    return o;
  }, { bg: "#8dbc5f", dw: 120, dh: 120 });
export const fenceHTile = () => make(112, 88, () => S(Rc(-6, 26, 124, 14, 4), "#c08a5a", 4) + S(Rc(-6, 56, 124, 14, 4), "#c08a5a", 4) + S(Rc(47, 10, 18, 78, 4), "#c08a5a", 4.5), { dw: 56, dh: 44 });
export const fenceVTile = () => make(44, 104, () => S(Rc(13, -6, 18, 116, 4), "#c08a5a", 4.5) + S(E(22, 52, 14, 10), "#c08a5a", 4), { dw: 22, dh: 52 });
export const barn = () =>
  make(280, 256, () =>
    shadow(140, 246, 120, 10) + S(Pg([[30, 240], [30, 110], [90, 50], [190, 50], [250, 110], [250, 240]]), "#d9534a", 5, Pg([[210, 60], [250, 110], [250, 240], [210, 240]])) +
    S(Pg([[18, 116], [90, 40], [190, 40], [262, 116], [250, 124], [190, 58], [90, 58], [30, 124]]), "#f4efe6", 4.5) + S(Rc(100, 140, 80, 100), "#f4efe6", 5) + L("M100 140L180 240M180 140L100 240", 4) + S(Rc(118, 74, 44, 36), "#f4efe6", 4.5), { dw: 120, dh: 110 });
export const hay = () => make(140, 92, () => shadow(70, 86, 60, 6) + S("M10 84q-4-60 60-64q66 0 62 64Z", "#f0c95a", 5, "M90 22q44 10 42 62H90Z") + L("M30 84q2-34 38-40M76 84q0-30 32-36", 2.5), { dw: 70, dh: 46 });
export const nest = () =>
  make(440, 160, () =>
    shadow(220, 146, 200, 11) + S(E(220, 88, 200, 58), "#c9a04a", 5.5) + F(E(220, 78, 154, 31), "#8a6420") + L(E(220, 78, 154, 31), 4) +
    L("M40 100q28 18 56 22M130 136q46 8 92 6M276 140q54-4 100-22M56 64q18-12 46-18M338 46q28 6 46 18", 3) + L("M22 82l-12-6M418 84l12-8", 3.5), { dw: 220, dh: 80 });

// ───────── 7. 가구 ─────────
export const FURN_CANVAS: Record<string, [number, number]> = {
  "furn.plant": [160, 224], "furn.chair": [176, 240], "furn.lamp": [160, 336], "furn.desk": [360, 240], "furn.bed": [440, 256],
  // 2026-10-13 새 가구 9종
  "furn.bookshelf": [240, 320], "furn.tv": [280, 260], "furn.teddy": [200, 220], "furn.rug": [440, 140], "furn.console": [260, 200],
  "furn.rocket": [220, 360], "furn.basket": [220, 220], "furn.cloud": [320, 200], "furn.rainbow": [400, 240],
};
/** 바닥에 닿지 않고 떠 있는 가구 (발밑 그림자·풀밭을 깔지 않는다) */
const FURN_FLOATING = new Set(["furn.cloud", "furn.rainbow"]);
/** 바닥에 까는 가구 (그림자 없이 납작하게) */
export const FURN_FLAT = new Set(["furn.rug"]);
/** 책 여러 권을 바닥선(yb)에 세워 꽂는다: [너비, 높이, 색] */
const books = (x: number, yb: number, list: [number, number, string][]) => {
  let o = "";
  for (const [w, h, c] of list) {
    o += S(Rc(x, yb - h, w, h, 3), c, 3.5) + L(`M${x + 4} ${yb - h + 10}h${w - 8}`, 2.5);
    x += w + 2;
  }
  return o;
};
/** 뭉게구름 한 덩이 (가운데 아래 cx·cy, 너비 약 2w) */
const puff = (cx: number, cy: number, w: number) => {
  const k = w / 56;
  return S(`M${cx - w} ${cy}q${-20 * k} 0 ${-18 * k} ${-20 * k}q${2 * k} ${-20 * k} ${24 * k} ${-18 * k}q${6 * k} ${-26 * k} ${34 * k} ${-24 * k}q${26 * k} ${2 * k} ${30 * k} ${24 * k}q${24 * k} ${-4 * k} ${28 * k} ${18 * k}q${2 * k} ${20 * k} ${-20 * k} ${20 * k}Z`, "#ffffff", 4.5);
};
/** 반지름 R~r 무지개 띠 하나 (가운데 cx, 바닥 cy) */
const arcBand = (cx: number, cy: number, R: number, r: number, c: string) =>
  S(`M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}H${cx + r}A${r} ${r} 0 0 0 ${cx - r} ${cy}Z`, c, 3.5);
/** 반짝이 별 */
const twinkle = (x: number, y: number, r: number, c = "#f6d54a") => F(`M${x} ${y - r}q${r * 0.2} ${r * 0.8} ${r} ${r}q${-r * 0.8} ${r * 0.2} ${-r} ${r}q${-r * 0.2} ${-r * 0.8} ${-r} ${-r}q${r * 0.8} ${-r * 0.2} ${r} ${-r}Z`, c);

/** 색을 바꿀 수 있는 가구의 칠할 자리: 그림에 쓴 색 → 고른 색의 어느 톤(main 본색·dark 진한 색·light 옅은 색)으로 바꿀지 */
export const FURN_PAINT: Record<string, Record<string, "main" | "dark" | "light">> = {
  "furn.plant": { "#e0784a": "main", "#c9603a": "dark" },
  "furn.chair": { "#f28fa8": "main" },
  "furn.lamp": { "#fff1b8": "main" },
  "furn.desk": { "#c98f5a": "main", "#b07a48": "dark" },
  "furn.bed": { "#8ccfe8": "main", "#4f8fe0": "dark" },
  "furn.bookshelf": { "#b07a48": "main", "#c98f5a": "light" },
  "furn.tv": { "#f2a7a0": "main" },
  "furn.teddy": { "#c98f5a": "main", "#b07a48": "dark" },
  "furn.rug": { "#f5b8c8": "main", "#b9dcf0": "light" },
  "furn.console": { "#d9ccf2": "main" },
  "furn.rocket": { "#f28fa8": "main", "#8ccfe8": "dark" },
  "furn.basket": { "#e2b47c": "main", "#c98f5a": "dark" },
  "furn.cloud": { "#ffffff": "main" },
  "furn.rainbow": { "#ffffff": "main" },
};

const FURN_DRAW: Record<string, () => string> = {
  // 책장: 세 칸에 알록달록한 책, 맨 아래 칸엔 작은 화분
  "furn.bookshelf": () =>
    S(Rc(20, 20, 200, 288, 10), "#b07a48", 5) + F(Rc(38, 38, 164, 254, 4), "#7a5236") +
    books(44, 112, [[20, 64, "#f28fa8"], [16, 70, "#8ccfe8"], [22, 58, "#fff1b8"], [18, 66, "#a8d88a"], [20, 62, "#c6b0ec"]]) + S("M168 112l14-60 16 4-14 56Z", "#f5a35a", 3.5) +
    S(Rc(30, 112, 180, 14, 4), "#c98f5a", 4.5) +
    books(44, 200, [[18, 60, "#c6b0ec"], [22, 66, "#f59a9a"], [16, 56, "#fbe39a"], [20, 70, "#9fd0f0"]]) + S(E(170, 186, 22, 14), "#f2a7a0", 3.5) + L("M156 182q14-8 28 0", 2.5) +
    S(Rc(30, 200, 180, 14, 4), "#c98f5a", 4.5) +
    books(44, 292, [[22, 68, "#a8d88a"], [18, 60, "#f28fa8"], [20, 64, "#8ccfe8"]]) +
    S("M166 248q-22-18-14-40q16 8 14 40q8-30 30-34q-2 28-30 34Z", "#6fb34f", 4) + S("M146 248h44l-6 44h-32Z", "#e0784a", 4.5) +
    S(Rc(30, 290, 180, 14, 4), "#c98f5a", 4.5),
  // 티비: 옛날 텔레비전(더듬이 안테나)과 낮은 나무 장
  "furn.tv": () =>
    S(Rc(46, 226, 16, 22, 4), "#9a6a40", 4) + S(Rc(218, 226, 16, 22, 4), "#9a6a40", 4) +
    S(Rc(30, 168, 220, 64, 10), "#c98f5a", 5, "M190 168h60v64h-60Z") + L("M140 176v48", 2.5) + dot(128, 200, 4) + dot(152, 200, 4) +
    L("M126 58l-34-40M154 58l30-42", 4) + S(E(92, 18, 7), "#f28fa8", 3.5) + S(E(184, 16, 7), "#f28fa8", 3.5) +
    S(Rc(54, 56, 172, 116, 20), "#f2a7a0", 5, "M190 56h36v116h-36Z") + S(Rc(70, 70, 116, 88, 16), "#9fd6e8", 4) +
    L("M84 88q8-8 22-8", 3, "#ffffff") + L("M84 102v-4", 3, "#ffffff") +
    S(E(206, 92, 9), "#fff1b8", 3.5) + S(E(206, 124, 9), "#fff1b8", 3.5),
  // 곰인형: 다리를 앞으로 뻗고 앉은 갈색 곰, 목에 작은 분홍 리본
  "furn.teddy": () =>
    S(E(60, 44, 20), "#c98f5a", 4.5) + S(E(140, 44, 20), "#c98f5a", 4.5) + S(E(60, 46, 10), "#f6d4b0", 3) + S(E(140, 46, 10), "#f6d4b0", 3) +
    S(E(100, 152, 50, 50), "#c98f5a", 5) + S(E(100, 162, 26, 28), "#f6d4b0", 3.5) +
    S("M58.9 121.6A15 26 20 1 0 41.1 170.4A15 26 20 1 0 58.9 121.6Z", "#b07a48", 4.5) + S("M141.1 121.6A15 26 -20 1 1 158.9 170.4A15 26 -20 1 1 141.1 121.6Z", "#b07a48", 4.5) +
    S(E(66, 190, 22, 22), "#c98f5a", 4.5) + S(E(134, 190, 22, 22), "#c98f5a", 4.5) + S(E(66, 194, 11, 12), "#f6d4b0", 3) + S(E(134, 194, 11, 12), "#f6d4b0", 3) +
    S(E(100, 80, 52, 44), "#c98f5a", 5) + S(E(100, 96, 20, 14), "#f6d4b0", 3.5) +
    `<ellipse cx="100" cy="90" rx="7" ry="5" fill="#4a3628"/>` + L("M100 95v5M93 102q7 5 14 0", 2.5) + dot(80, 76, 5) + dot(120, 76, 5) + blush(70, 92, 6, 3.5) + blush(130, 92, 6, 3.5) +
    S("M100 126l-16-9v18Z", "#f28fa8", 3.5) + S("M100 126l16-9v18Z", "#f28fa8", 3.5) + S(E(100, 126, 6), "#f59ab4", 3),
  // 러그: 바닥에 까는 동그란 러그 (양 끝에 술)
  "furn.rug": () =>
    L("M30 58h-20M26 70h-22M30 82h-20M410 58h20M414 70h22M410 82h20", 3, "#c98f5a") +
    S(E(220, 70, 192, 54), "#f5b8c8", 5) + S(E(220, 70, 148, 38), "#fde3c0", 4) + S(E(220, 70, 96, 22), "#b9dcf0", 4) +
    flowers(196, 70, ["#f28fa8", "#ffffff", "#f28fa8"], 7) +
    [70, 120, 320, 370].map((x) => `<circle cx="${x}" cy="70" r="6" fill="#ffffff" opacity=".9"/>`).join(""),
  // 게임기: 보라색 게임기와 줄 달린 패드 두 개
  "furn.console": () =>
    L("M78 128q-24 8-30 26M182 128q24 8 30 26", 3) +
    S(Rc(56, 64, 148, 72, 18), "#d9ccf2", 5, "M170 64h34v72h-34Z") + `<circle cx="82" cy="86" r="6" fill="#7bd389"/>` + L("M150 84h32M150 96h32", 2.5) + L("M92 118h76", 3) +
    S(Rc(12, 148, 84, 42, 20), "#f28fa8", 4.5) + F("M34 162h6v-6h6v6h6v6h-6v6h-6v-6h-6Z", "#4a3628") + dot(70, 164, 4.5) + dot(80, 174, 4.5) +
    S(Rc(164, 148, 84, 42, 20), "#8ccfe8", 4.5) + F("M186 162h6v-6h6v6h6v6h-6v6h-6v-6h-6Z", "#4a3628") + dot(222, 164, 4.5) + dot(232, 174, 4.5),
  // 우주선: 동그란 창이 달린 로켓, 아래로 불꽃
  "furn.rocket": () =>
    `<ellipse cx="110" cy="318" rx="34" ry="30" fill="#ffd56a" opacity=".5" filter="url(#glow)"/>` +
    S("M88 300q22 70 44 0Z", "#ffb04a", 4) + S("M99 300q11 38 22 0Z", "#fff1b8", 3) +
    S("M66 226l-42 64h52Z", "#f28fa8", 5) + S("M154 226l42 64h-52Z", "#f28fa8", 5) +
    S("M110 20q58 62 50 270H60q-8-208 50-270Z", "#f4efe6", 5, "M134 30q38 80 26 260h-26Z") +
    S("M110 20q32 34 42 76H68q10-42 42-76Z", "#f28fa8", 5) +
    S(Rc(62, 216, 96, 18, 6), "#8ccfe8", 4) + S(E(110, 152, 32), "#c9c9d6", 5) + S(E(110, 152, 21), "#9fd6e8", 4) + L("M98 142q6-6 14-6", 3, "#ffffff") +
    S("M84 290h52l-8 14H92Z", "#9a9aa8", 4.5) +
    twinkle(30, 60, 12) + twinkle(196, 120, 10) + twinkle(28, 190, 8, "#c6b0ec"),
  // 꽃바구니: 엮은 바구니에 알록달록한 꽃
  "furn.basket": () =>
    S("M40 124q70-150 140 0h-16q-54-122-108 0Z", "#c98f5a", 4.5) +
    S("M64 124q-24-30-2-54q16 26 2 54Z", "#6fb34f", 4) + S("M156 124q24-30 2-54q-16 26-2 54Z", "#5aa040", 4) +
    flowers(80, 84, ["#ffffff", "#f28fa8", "#8ccfe8"], 12) + flowers(62, 108, ["#f5a35a", "#f28fa8", "#fff1b8", "#c6b0ec"], 13) +
    S("M30 120h160l-18 84H48Z", "#e2b47c", 5, "M150 120h40l-18 84h-30Z") + L("M40 148h140M46 176h128", 2.5) + L("M72 126l6 76M110 126v78M148 126l-6 76", 2.5) +
    S(Rc(22, 110, 176, 18, 8), "#c98f5a", 4.5),
  // 구름: 방 안에 둥실 떠 있는 웃는 구름
  "furn.cloud": () =>
    S("M70 170q-52 0-48-42q4-34 46-32q8-52 62-52q40 0 58 36q16-24 48-16q40 10 34 52q34 6 30 32q-4 22-34 22Z", "#ffffff", 5, "M30 152q130 22 270-6v30H30Z") +
    dot(134, 124, 5) + dot(190, 124, 5) + L("M152 136q10 10 20 0", 3) + blush(118, 140) + blush(206, 140) +
    twinkle(40, 40, 12) + twinkle(290, 56, 10, "#c6b0ec"),
  // 무지개: 양 끝에 뭉게구름
  "furn.rainbow": () =>
    arcBand(200, 206, 180, 158, "#f59a9a") + arcBand(200, 206, 158, 136, "#f8c08a") + arcBand(200, 206, 136, 114, "#fbe39a") +
    arcBand(200, 206, 114, 92, "#a8d88a") + arcBand(200, 206, 92, 70, "#9fd0f0") + arcBand(200, 206, 70, 48, "#c6b0ec") +
    puff(64, 222, 40) + puff(336, 222, 40),
};

export function furniture(key: string, grass: boolean): string {
  const [W, H] = FURN_CANVAS[key] ?? [168, 168];
  return make(W, H, () => {
    let o = FURN_FLOATING.has(key) || FURN_FLAT.has(key) ? "" : grass ? F(`M${W * 0.1} ${H - 4}q${W * 0.4} -22 ${W * 0.8} 0Z`, "#a8d07a") : shadow(W / 2, H - 8, W * 0.4, 8);
    if (FURN_DRAW[key]) o += FURN_DRAW[key]();
    else if (key === "furn.plant") o += S("M80 140q-50-30-56-90q40 6 56 70q10-80 50-104q8 60-40 120Z", "#6fb34f", 5) + S("M80 140q30-40 64-30q-14 40-64 40Z", "#5aa040", 4.5) + S("M34 140h92l-12 76H46Z", "#e0784a", 5, "M100 140h26l-12 76h-18Z") + S(Rc(28, 132, 104, 16, 6), "#c9603a", 4.5);
    else if (key === "furn.chair") o += S(Rc(38, 154, 16, 78, 4), "#9a6a40", 4.5) + S(Rc(122, 154, 16, 78, 4), "#9a6a40", 4.5) + S(Rc(40, 20, 96, 120, 16), "#e2b47c", 5) + S(Rc(56, 36, 64, 84, 10), "#f28fa8", 4) + S(Rc(30, 130, 116, 26, 8), "#c98f5a", 5);
    else if (key === "furn.lamp") o += `<ellipse cx="80" cy="80" rx="60" ry="50" fill="#ffd56a" opacity=".5" filter="url(#glow)"/>` + S(Rc(74, 104, 12, 196, 4), "#7a5236", 4.5) + S(E(80, 312, 44, 12), "#7a5236", 4.5) + S("M40 110l20-90h40l20 90Z", "#fff1b8", 5);
    else if (key === "furn.desk") o += S(Rc(34, 120, 18, 112, 4), "#9a6a40", 4.5) + S(Rc(308, 120, 18, 112, 4), "#9a6a40", 4.5) + S(Rc(210, 120, 98, 76, 4), "#b07a48", 4.5) + dot(259, 160, 5) + S(Rc(20, 100, 320, 26, 6), "#c98f5a", 5) + S(Rc(70, 40, 90, 60, 6), "#4a4a4a", 4.5) + S(Rc(80, 48, 70, 44, 3), "#8ccfe8", 3.5) + S(Rc(240, 60, 40, 40, 4), "#f4efe6", 4) + L("M246 74h28M246 86h20", 2.5);
    else if (key === "furn.bed") o += S(Rc(20, 40, 40, 200, 8), "#b07a48", 5) + S(Rc(380, 100, 40, 140, 8), "#b07a48", 5) + S(Rc(50, 120, 340, 80, 10), "#ffffff", 5) + S(Rc(62, 94, 80, 40, 16), "#fff8ec", 4.5) + S("M150 112h236v90H150Z", "#8ccfe8", 5, "M330 112h56v90h-56Z") + L("M190 140h160M190 170h160", 2.5, "#4f8fe0") + S(Rc(50, 196, 340, 20, 6), "#9a6a40", 4.5);
    else o += S(Rc(30, 40, W - 60, H - 60, 12), "#e2b47c", 5);
    return o;
  });
}

// ───────── 8. 미니룸 배경 (1040×520, 실내: 벽지 + 바닥, 바닥선 y≈370, 가운데 아래 비움) ─────────
type Room = { wall: string; pat: string; floor: string; plank: string; view: string; dark?: boolean };
const ROOMS: Record<string, Room> = {
  meadow: { wall: "#dff0d2", pat: "#a9d38a", floor: "#d9a86c", plank: "#b98648", view: "#bfe3f2" },
  beach: { wall: "#e3f3fb", pat: "#9fd2ec", floor: "#e8c896", plank: "#c9a46c", view: "#a9dcf0" },
  snow: { wall: "#eef2f7", pat: "#c3d3e4", floor: "#e9ddd0", plank: "#c8b6a2", view: "#d6e4ee" },
  sakura: { wall: "#fdeaf0", pat: "#f5b3c7", floor: "#dcae7c", plank: "#bb8a58", view: "#fde4ea" },
  night: { wall: "#3b4677", pat: "#ffe9a0", floor: "#7a5a44", plank: "#5e4434", view: "#2c3566", dark: true },
  space: { wall: "#3a2d5e", pat: "#c9b6ff", floor: "#8c86a8", plank: "#6e6890", view: "#231a3d", dark: true },
};
export const ROOM_KINDS = Object.keys(ROOMS);
export function room(kind: string, attrs = ""): string {
  const W = 1040, H = 520, G = 370, R = ROOMS[kind] ?? ROOMS.meadow;
  return make(W, H, () => {
    let o = F(`M0 0H${W}V${G}H0Z`, R.wall);
    // 벽지 무늬
    if (kind === "beach") for (let x = 20; x < W; x += 60) o += `<rect x="${x}" y="0" width="24" height="${G}" fill="${R.pat}" opacity=".55"/>`;
    else
      for (let y = 30, r = 0; y < G - 20; y += 56, r++)
        for (let x = r % 2 ? 50 : 20; x < W; x += 64) {
          if (kind === "meadow") o += `<path d="M${x} ${y}q-8-10 0-16q8 6 0 16Zm0 0q10-6 16 2q-8 6-16-2Zm0 0q-10-6-16 2q8 6 16-2Z" fill="${R.pat}"/>`;
          else if (kind === "snow") o += `<path d="M${x - 8} ${y}h16M${x} ${y - 8}v16M${x - 6} ${y - 6}l12 12M${x + 6} ${y - 6}l-12 12" stroke="${R.pat}" stroke-width="3" stroke-linecap="round"/>`;
          else if (kind === "sakura") o += [0, 1, 2, 3, 4].map((k) => `<circle cx="${(x + 6 * Math.cos(k * 1.256)).toFixed(1)}" cy="${(y + 6 * Math.sin(k * 1.256)).toFixed(1)}" r="4.5" fill="${R.pat}"/>`).join("") + `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff"/>`;
          else if (kind === "night") o += `<path d="M${x} ${y - 8}l2.5 5.5l5.5 2.5l-5.5 2.5l-2.5 5.5l-2.5-5.5l-5.5-2.5l5.5-2.5Z" fill="${R.pat}" opacity=".8"/>`;
          else if (kind === "space")
            o += (r + x) % 3
              ? `<circle cx="${x}" cy="${y}" r="3" fill="${R.pat}" opacity=".7"/>`
              : `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${R.pat}" stroke-width="2.5" opacity=".7"/><ellipse cx="${x}" cy="${y}" rx="14" ry="4" fill="none" stroke="${R.pat}" stroke-width="2" opacity=".7"/>`;
        }
    // 나무 바닥
    o += F(`M0 ${G}H${W}V${H}H0Z`, R.floor);
    let pl = "";
    for (let y = G + 42; y < H; y += 46) pl += `M0 ${y}H${W}`;
    for (let y = G, r = 0; y < H; y += 46, r++) for (let x = r % 2 ? 90 : 220; x < W; x += 260) pl += `M${x} ${y + 4}v38`;
    o += L(pl, 2.5, R.plank) + S(`M-10 ${G - 16}H${W + 10}V${G}H-10Z`, R.dark ? "#5a4f80" : "#f6efe2", 4.5);
    // 창문 (왼쪽 벽) — 테마 풍경
    const wx = 70, wy = 70, ww = 200, wh = 170;
    if (kind === "space") {
      o += S(E(170, 150, 92), "#b8b0d0", 5) + F(E(170, 150, 72), R.view) + [[130, 120], [200, 110], [150, 190], [220, 170]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff"/>`).join("") + S(E(176, 150, 28), "#f0a3e8", 4) + L(E(176, 150, 46, 9), 3) + L(E(170, 150, 72), 5);
    } else {
      let v = F(Rc(wx, wy, ww, wh), R.view);
      if (kind === "meadow") v += S(`M${wx} ${wy + wh}V${wy + 110}q50-30 100 0t100 0V${wy + wh}Z`, "#a8d07a", 3.5) + S(`M${wx + 40} ${wy + 40}q-4-14 12-14q6-10 18-4q14-4 16 10q12 2 8 12Z`, "#fff", 3);
      if (kind === "beach") v += S(`M${wx} ${wy + 100}H${wx + ww}V${wy + wh}H${wx}Z`, "#4fa6d8", 3.5) + `<circle cx="${wx + 150}" cy="${wy + 50}" r="22" fill="#ffd34d"/>`;
      if (kind === "snow") v += S(`M${wx} ${wy + wh}V${wy + 120}q100-30 200 0V${wy + wh}Z`, "#fff", 3.5) + S(`M${wx + 60} ${wy + 50}l26 50h-52Z`, "#4f9a5a", 3.5) + [...Array(8)].map((_, i) => `<circle cx="${wx + 20 + i * 23}" cy="${wy + 20 + ((i * 37) % 80)}" r="3" fill="#fff"/>`).join("");
      if (kind === "sakura") v += S(`M${wx} ${wy + wh}V${wy + 130}H${wx + ww}V${wy + wh}Z`, "#b6dc8c", 3.5) + S(E(wx + 120, wy + 70, 56, 40), "#f7b6c8", 3.5) + S(Rc(wx + 114, wy + 104, 12, 30, 3), "#9a6a40", 3);
      if (kind === "night") v += S(`M${wx + 150} ${wy + 30}a26 26 0 1 0 20 42a20 20 0 1 1 -20-42Z`, "#ffe9a0", 3) + [...Array(6)].map((_, i) => `<circle cx="${wx + 20 + i * 25}" cy="${wy + 30 + ((i * 41) % 110)}" r="2.5" fill="#fff6c8"/>`).join("");
      const curtain = kind === "night" ? "#8a6ad0" : "#f6a8a0";
      o += clip(Rc(wx, wy, ww, wh), v) + L(Rc(wx, wy, ww, wh), 6) + L(`M${wx + ww / 2} ${wy}v${wh}M${wx} ${wy + wh / 2}h${ww}`, 5) + S(Rc(wx - 12, wy + wh, ww + 24, 16, 4), "#f6efe2", 4.5);
      o += S(`M${wx - 24} ${wy - 14}h40q-8 90 8 ${wh + 10}h-48Z`, curtain, 4.5) + S(`M${wx + ww + 24} ${wy - 14}h-40q8 90-8 ${wh + 10}h48Z`, curtain, 4.5) + S(Rc(wx - 34, wy - 22, ww + 68, 10, 4), "#9a6a40", 4);
    }
    // 액자 (오른쪽 벽)
    o += S(Rc(820, 90, 130, 100, 6), "#c98f5a", 5) + S(Rc(834, 104, 102, 72, 3), "#fff8ec", 3.5) + S("M840 170l26-30l20 20l14-14l30 24Z", "#8cc163", 3) + `<circle cx="910" cy="122" r="9" fill="#f2c230"/>` + L("M855 90l30-26l30 26", 3);
    return o;
  }, { attrs });
}

// ───────── 9. 아이콘 (128) ─────────
const gear = (cx: number, cy: number, r1: number, r2: number, n: number) => {
  const p: [string, string][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * 6.283, r = i % 2 ? r1 : r2;
    for (const da of [-0.15, 0.15]) p.push([(cx + r * Math.cos(a + da)).toFixed(1), (cy + r * Math.sin(a + da)).toFixed(1)]);
  }
  return Pg(p);
};
export const ICON: Record<string, () => string> = {
  mail: () => S(Rc(14, 32, 100, 68, 8), "#fff4dc") + L("M18 36l46 36l46-36", 5),
  coin: () => S(E(64, 64, 46), "#f2c230", 5.5, "M64 18a46 46 0 0 1 0 92Z") + S(E(64, 64, 30), "#f6d54a", 3.5) + T(64, 78, 38, "C"),
  exp: () => S("M64 12l15 32l35 4l-26 24l7 35l-31-17l-31 17l7-35l-26-24l35-4Z", "#8fd36a", 5) + T(64, 80, 24, "XP"),
  heart: () => S("M64 110q-52-34-52-66q0-28 26-30q18 0 26 18q8-18 26-18q26 2 26 30q0 32-52 66Z", "#f2577a", 5.5) + `<ellipse cx="40" cy="42" rx="8" ry="5" fill="#fff" opacity=".8"/>`,
  comment: () => S("M14 24h100v64H54l-24 22v-22H14Z", "#8ccfe8", 5) + dot(44, 56, 5) + dot(64, 56, 5) + dot(84, 56, 5),
  guestbook: () => S(Rc(18, 16, 92, 98, 6), "#e8574b", 5) + S(Rc(32, 28, 66, 74, 4), "#fff4dc", 4) + L("M42 48h46M42 64h46M42 80h30", 3),
  notice: () => S(Rc(36, 76, 18, 32, 4), "#e0843a", 4) + S("M20 52h20l50-30v84L40 76H20Z", "#f29a4a", 5) + L("M100 48q10 16 0 32", 5),
  inquiry: () => S(E(64, 60, 48, 44), "#a8d07a", 5) + L("M48 48q0-18 16-18q16 0 16 16q0 12-16 16v10", 6) + dot(64, 90, 5),
  write: () => S("M22 106l8-28l60-60l20 20l-60 60Z", "#f2c230", 5) + S("M90 18l20 20l8-8q4-6 0-12l-8-8q-6-4-12 0Z", "#f28fa8", 4.5) + S("M22 106l8-28l20 20Z", "#fbd9b8", 4),
  search: () => S("M80 80l30 30q4 8-4 10l-30-28Z", "#9a6a40", 5) + S(E(54, 54, 34), "#bfe6f7", 6),
  category: () => ([[16, 16, "#f2577a"], [68, 16, "#f2c230"], [16, 68, "#8ccfe8"], [68, 68, "#8fd36a"]] as const).map(([x, y, c]) => S(Rc(x, y, 44, 44, 8), c, 5)).join(""),
  invite: () => S(E(52, 40, 22), "#fbd9b8", 5) + S("M14 112q0-44 38-44q38 0 38 44Z", "#8ccfe8", 5) + L("M96 46v36M78 64h36", 8),
  pet: () => S(E(64, 82, 26, 22), "#c98f5a", 5) + [[30, 52], [50, 32], [78, 32], [98, 52]].map(([x, y]) => S(E(x, y, 12, 14), "#c98f5a", 4.5)).join(""),
  shop: () => S(Rc(20, 50, 88, 62), "#f6e2b8", 5) + [0, 1, 2, 3].map((i) => F(`M${16 + i * 24} 34h24v20q-12 10-24 0Z`, i % 2 ? "#fff" : "#e8574b")).join("") + L("M16 34h96v20M16 54q12 10 24 0q12 10 24 0q12 10 24 0q12 10 24 0", 4) + S(Rc(52, 76, 24, 36), "#a0683d", 4),
  background: () => S(Rc(14, 20, 100, 88, 8), "#bfe3f2", 5) + clip(Rc(14, 20, 100, 88, 8), S("M10 108l38-44l22 26l14-14l34 32Z", "#8fd36a", 4.5)) + L(Rc(14, 20, 100, 88, 8), 5) + S(E(88, 44, 10), "#f2c230", 4),
  furniture: () => S(Rc(22, 90, 10, 20, 3), "#9a6a40", 4) + S(Rc(96, 90, 10, 20, 3), "#9a6a40", 4) + S(Rc(26, 30, 76, 30, 10), "#f6a6bc", 4.5) + S(Rc(14, 50, 100, 40, 12), "#f28fa8", 5),
  clothes: () => S("M44 16l-30 20l14 24l12-8v60h48V52l12 8l14-24l-30-20q-10 14-20 14q-10 0-20-14Z", "#8ccfe8", 5),
  hat: () => S(E(64, 88, 54, 14), "#f2d27a", 5) + S("M28 88q2-56 36-56q34 0 36 56Z", "#f2d27a", 5) + S("M30 72h68v12H30Z", "#e8574b", 4),
  settings: () => S(gear(64, 64, 34, 48, 8), "#b9b4aa", 5) + S(E(64, 64, 14), "#fff8ec", 4.5),
  level: () => S("M64 10l46 26v56l-46 26l-46-26V36Z", "#8f6ad6", 5) + L("M64 88V44M44 62l20-20l20 20", 7),
  alert: () => S("M64 14l52 94H12Z", "#f2c230", 5.5) + L("M64 48v30", 8) + dot(64, 94, 5) + `<ellipse cx="54" cy="36" rx="5" ry="3" fill="#fff" opacity=".8"/>`,
  news: () => S(E(64, 104, 12, 10), "#e0a020", 4.5) + S("M64 14q-34 0-34 40v24l-12 16h92l-12-16V54q0-40-34-40Z", "#f2c230", 5) + S(E(98, 26, 12), "#e8433a", 4),
  achievement: () => L("M36 26H18q0 26 22 30M92 26h18q0 26-22 30", 5) + S(Rc(52, 76, 24, 20), "#e0a020", 4) + S("M36 16h56v30q0 30-28 34q-28-4-28-34Z", "#f2c230", 5) + S(Rc(36, 94, 56, 18, 4), "#9a6a40", 4.5),
  home: () => S(Rc(26, 58, 76, 54), "#e2b47c", 5) + S("M14 62l50-46l50 46Z", "#e8574b", 5.5) + S(Rc(54, 80, 20, 32), "#a0683d", 4),
  egg: () => S("M64 14q40 0 42 60q0 44-42 44q-42 0-42-44q2-60 42-60Z", "#fff4dc", 5.5) + [[52, 52, 6], [78, 72, 8], [58, 92, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8c48e"/>`).join(""),
  potion: () => {
    const B = "M50 16h28v26q32 14 32 44q0 30-46 30q-46 0-46-30q0-30 32-44Z";
    return F(B, "#d6c8f2") + clip(B, F("M10 80H118V120H10Z", "#e8574b")) + L(B, 5) + S(Rc(46, 8, 36, 12, 4), "#9a6a40", 4);
  },
  carrot: () => S("M84 44q-4-26 16-32q-4 18 4 24q14-14 18 0q-16 2-24 12Z", "#6fb34f", 4.5) + S("M40 46q30-14 46 6q-30 60-66 60q20-30 20-66Z", "#f29a2e", 5) + L("M50 70l10 4M38 90l10 4", 3),
  hand: () => S("M36 114q-18-24-18-44q0-8 8-8q8 0 12 16V26q0-8 8-8q8 0 8 8v34V16q0-8 8-8q8 0 8 8v44V24q0-8 8-8q8 0 8 8v40V40q0-8 8-8q8 0 8 8v40q0 34-30 34Z", "#fbd9b8", 5),
  calendar: () => S(Rc(14, 24, 100, 90, 8), "#fff4dc", 5) + S("M14 32q0-8 8-8h84q8 0 8 8v18H14Z", "#e8574b", 5) + L("M40 14v20M88 14v20", 6) + [[36, 66], [64, 66], [92, 66], [36, 92], [64, 92]].map(([x, y], i) => (i === 4 ? `<circle cx="${x}" cy="${y}" r="10" fill="#e8574b" opacity=".85"/>` : dot(x, y, 4))).join(""),
  lock: () => L("M40 58V40q0-24 24-24q24 0 24 24v18", 8) + S(Rc(24, 56, 80, 58, 10), "#f2c230", 5.5) + S(E(64, 80, 8), "#9a6a40", 4) + L("M64 86v12", 5),
  logout: () => S(Rc(16, 14, 56, 100, 6), "#a0683d", 5) + dot(58, 66, 5) + L("M70 64h44M98 46l18 18l-18 18", 7),
  back: () => L("M104 64H28M54 34L24 64l30 30", 10),
  campfire: () => S("M38 66q-4-34 18-58q6 20 16 24q8-12 6-24q28 28 14 58Z", "#f28a2e", 5) + F("M54 64q0-20 10-34q8 20 12 34Z", "#ffd34d") + S("M14 92l96 22l4-14l-96-22Z", "#b07a48", 4.5) + S("M114 92l-96 22l-4-14l96-22Z", "#9a6a40", 4.5),
};
export const icon = (name: string, size: number) => make(128, 128, ICON[name] ?? ICON.alert, { dw: size, dh: size });
