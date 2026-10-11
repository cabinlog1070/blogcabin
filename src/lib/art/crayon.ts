// 크레용 그림체 (2026-10-11 정지원 님 시안). 끊기지 않는 또렷한 바탕 선 + 그 위 거친 크레용 결 + 단색 면 + 옅은 종이 결.
// 모든 그림은 "내보낼 크기"(화면 크기의 2배) 좌표로 그린다. 그림은 data URI <img>·Phaser 텍스처로 쓰여 각자 따로 그려진다.
// 서버·브라우저가 같은 문자열을 만들어야 하므로(hydration) 그림 안 id는 그림마다 0부터 다시 센다 (make).

export const INK = "#262220";
export const SKIN = "#fbd9b8";

type P = [number, number];

let seq = 0;
/** 그림 하나 안에서만 쓰는 id */
export const nid = (p: string) => `${p}${(seq++).toString(36)}`;

/** 크레용 선(cr)·종이 결(fg)·불빛(glow) 필터. 필터 영역을 그림 크기로 잡아 가로·세로 직선도 지워지지 않게 한다 */
const defs = (w: number, h: number) =>
  `<defs><filter id="cr" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${w + 40}" height="${h + 40}"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -0.2" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="g"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="w"/><feDisplacementMap in="g" in2="w" scale="2.5"/></filter>` +
  `<filter id="cs" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${w + 40}" height="${h + 40}"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="2.5"/></filter>` +
  `<filter id="fg" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${w + 40}" height="${h + 40}"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="12" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 0.25" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>` +
  `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter></defs>`;

/** 완성 SVG (viewBox = 그린 좌표). dw·dh = 그림의 width/height 속성 (기본은 그린 크기 그대로) */
export function svg(w: number, h: number, body: string, opts: { bg?: string; dw?: number; dh?: number; attrs?: string } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${opts.dw ?? w}" height="${opts.dh ?? h}"${opts.attrs ?? ""}>${defs(w, h)}${opts.bg ? `<rect width="${w}" height="${h}" fill="${opts.bg}"/>` : ""}${body}</svg>`;
}
/** id를 0부터 세며 그린다 (같은 그림은 늘 같은 문자열) */
export function make(w: number, h: number, draw: () => string, opts: Parameters<typeof svg>[3] = {}): string {
  seq = 0;
  return svg(w, h, draw(), opts);
}

// ───────── 붓 ─────────
/** 면: 단색 + 옅은 종이 결. op < 1 이면 반투명 덧칠 */
export const F = (d: string, c: string, op = 1) =>
  op < 1
    ? `<path d="${d}" fill="${c}" opacity="${op}" filter="url(#fg)"/>`
    : `<path d="${d}" fill="${c}"/><path d="${d}" fill="#3a2a1a" opacity=".07" filter="url(#fg)"/>`;
/** 크레용 선 (두 번 그어 거칠게) */
export const L = (d: string, w = 5, color = INK) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${(w * 0.8).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#cs)"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" filter="url(#cr)"/>`;
/** 면 + (그늘) + 외곽선. 그늘은 면 모양 안에서만 칠한다 */
export const S = (d: string, c: string, w = 5, shade?: string) => {
  let o = F(d, c);
  if (shade) {
    const id = nid("s");
    o += `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${F(shade, "#000", 0.13)}</g>`;
  }
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
export const dot = (x: number, y: number, r = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;
export const blush = (x: number, y: number, rx = 7, ry = 4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#f59a9a" opacity=".85" filter="url(#fg)"/>`;
export const T = (x: number, y: number, s: number, txt: string, c = INK) =>
  `<text x="${x}" y="${y}" font-size="${s}" font-weight="900" text-anchor="middle" fill="${c}" font-family="'Apple SD Gothic Neo','Noto Sans KR',sans-serif">${txt}</text>`;
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
export function farm(): string {
  return make(520, 340, () => {
    const g = 330;
    let o = shadow(260, g - 6, 240, 14);
    o += F(`M20 ${g}Q30 150 260 140Q490 150 500 ${g}Z`, "#a8d07a");
    o += barnBody(0, 0);
    o += S("M150 300q-6-46 44-50q52 0 48 50Z", "#f0c95a", 5) + L("M164 300q2-26 30-30M196 300q-2-24 26-28", 2.5);
    for (const x of [40, 95, 150, 205, 250]) o += S(Rc(x, 236, 16, g - 236, 4), "#c08a5a", 4.5);
    o += S(Rc(32, 250, 234, 14, 4), "#c08a5a", 4) + S(Rc(32, 284, 234, 14, 4), "#c08a5a", 4);
    o += [60, 120, 470, 490].map((x) => L(`M${x} ${g - 4}l4-14M${x + 8} ${g - 4}l2-12`, 3)).join("");
    return o;
  });
}
const barnBody = (dx: number, dy: number) => {
  const g = 330;
  let o = S(Pg([[280, g - 10], [280, 140], [340, 90], [400, 90], [460, 140], [460, g - 10]]), "#d9534a", 5, Pg([[420, 90], [460, 140], [460, g - 10], [420, g - 10]]));
  o += S(Pg([[268, 146], [340, 82], [400, 82], [472, 146], [460, 152], [400, 98], [340, 98], [280, 152]]), "#f4efe6", 4.5);
  o += S(Rc(330, 210, 80, g - 220), "#f4efe6", 5) + L(`M330 210L410 ${g - 10}M410 210L330 ${g - 10}M370 210V${g - 10}`, 4);
  o += S(Rc(352, 120, 36, 30), "#f4efe6", 4.5) + L("M370 120v30", 3);
  return dx || dy ? `<g transform="translate(${dx} ${dy})">${o}</g>` : o;
};

/** 상점 420×360 */
export function shop(): string {
  return make(420, 360, () => {
    const g = 350;
    let o = shadow(210, g, 180, 12);
    o += S(Rc(60, 150, 300, g - 150), "#f6e2b8", 5, Rc(310, 150, 50, g - 150));
    o += S(Pg([[40, 152], [100, 60], [320, 60], [380, 152]]), "#7fb26a", 5.5) + scallops(80, 340, 104, 7, 8, 3.2);
    let aw = "";
    for (let i = 0; i < 8; i++) {
      const x = 56 + i * 38.5;
      aw += F(`M${x} 160h38.5v34q-19 16-38.5 0Z`, i % 2 ? "#ffffff" : "#e8574b");
    }
    o += aw + L("M56 160h308", 5) + L(Array.from({ length: 8 }, (_, i) => `M${56 + i * 38.5} 194q19 16 38.5 0`).join(""), 4.5);
    o += S(Rc(130, 58, 160, 44, 10), "#fff6dc", 5) + T(210, 92, 30, "상점");
    o += S(Rc(90, 220, 110, 90), "#8ccfe8", 5) + L("M145 220v90", 3.5) + flowers(102, 300, ["#f2c230", "#e8433a", "#7fb26a"], 7);
    o += S(`M240 ${g}V232a40 40 0 0 1 80 0V${g}Z`, "#a0683d", 5) + dot(304, 290, 4.5);
    return o;
  });
}

/** 마을 소식 게시판 340×340 */
export function board(): string {
  return make(340, 340, () => {
    const g = 330;
    let o = shadow(170, g, 140, 10);
    o += S(Rc(48, 120, 18, g - 120, 4), "#9a6a40", 4.5) + S(Rc(274, 120, 18, g - 120, 4), "#9a6a40", 4.5);
    o += S(Rc(30, 110, 280, 160, 10), "#c98f5a", 5.5) + S(Rc(46, 126, 248, 128, 6), "#e8c48e", 4);
    o += S(Pg([[20, 116], [170, 40], [320, 116]]), "#8a5a3a", 5.5);
    const notes: [number, number, string][] = [[62, 138, "#fff8e8"], [150, 146, "#ffe0e6"], [226, 134, "#e3f2ff"], [96, 196, "#eaf7da"], [196, 198, "#fff8e8"]];
    for (const [x, y, c] of notes) o += S(Rc(x, y, 62, 48, 3), c, 3.5) + L(`M${x + 10} ${y + 18}h40M${x + 10} ${y + 30}h30`, 2.5) + `<circle cx="${x + 31}" cy="${y + 5}" r="5" fill="#e8433a"/>`;
    return o + S(Rc(118, 62, 104, 36, 8), "#fff6dc", 4.5) + T(170, 88, 22, "마을 소식");
  });
}

/** 출석판 220×300 */
export function attendance(): string {
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
    return o + S(Rc(64, 196, 92, 30, 8), "#fff6dc", 4) + T(110, 218, 18, "출석");
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
export const grassTile = () =>
  make(240, 240, () => {
    let o = "";
    for (let i = 0; i < 14; i++) {
      const x = 12 + ((i * 53) % 210), y = 12 + ((i * 97) % 210);
      o += L(`M${x} ${y + 10}l4-12M${x + 8} ${y + 10}l2-10`, 3, "#4f8a3a");
    }
    return o + ([[40, 60, "#fff"], [180, 40, "#f2c230"], [120, 180, "#f28fa8"], [200, 200, "#fff"]] as const).map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}" filter="url(#fg)"/>`).join("");
  }, { bg: "#9cc96e", dw: 120, dh: 120 });
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
export const FURN_CANVAS: Record<string, [number, number]> = { "furn.plant": [160, 224], "furn.chair": [176, 240], "furn.lamp": [160, 336], "furn.desk": [360, 240], "furn.bed": [440, 256] };
export function furniture(key: string, grass: boolean): string {
  const [W, H] = FURN_CANVAS[key] ?? [168, 168];
  return make(W, H, () => {
    let o = grass ? F(`M${W * 0.1} ${H - 4}q${W * 0.4} -22 ${W * 0.8} 0Z`, "#a8d07a") : shadow(W / 2, H - 8, W * 0.4, 8);
    if (key === "furn.plant") o += S("M80 140q-50-30-56-90q40 6 56 70q10-80 50-104q8 60-40 120Z", "#6fb34f", 5) + S("M80 140q30-40 64-30q-14 40-64 40Z", "#5aa040", 4.5) + S("M34 140h92l-12 76H46Z", "#e0784a", 5, "M100 140h26l-12 76h-18Z") + S(Rc(28, 132, 104, 16, 6), "#c9603a", 4.5);
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
