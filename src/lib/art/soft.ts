// 파스텔 크레용 그림체 (2026-10-12 정지원 님 시안: 몽글몽글한 나무, 파란 꽃, 분홍 꽃 두 송이).
// crayon.ts의 굵은 검은 외곽선 대신, 같은 색의 진한 크레용으로 테두리를 칠하고 면은 옅은 색 위에 결이 보이게 문지른다.
// 광장 둘레 숲의 나무·꽃에 쓴다. 좌표는 crayon.ts처럼 화면 크기의 2배.
import { S, make, nid, pastel as pastelMode } from "./crayon";

/** 크레용으로 문지른 결: 군데군데 종이가 비치고(점 무늬 구멍) 가장자리가 보송보송하게 흔들린다 */
const pastel = (body: string, fuzz = 5, seed = 3) => {
  const id = nid("p");
  return (
    `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.6 -0.45" result="m"/>` +
    `<feComposite in="SourceGraphic" in2="m" operator="in" result="g"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${seed + 5}" result="w"/>` +
    `<feDisplacementMap in="g" in2="w" scale="${fuzz}" xChannelSelector="R" yChannelSelector="G"/></filter>` +
    `<g filter="url(#${id})">${body}</g>`
  );
};

/** 면 하나: 옅은 바탕(결 없이 반투명) + 문지른 색 + 같은 색 계열의 진한 크레용 테두리 */
const blob = (d: string, fill: string, edge: string, edgeW = 9, seed = 3) =>
  `<path d="${d}" fill="${fill}" opacity=".55"/>` +
  pastel(`<path d="${d}" fill="${fill}"/><path d="${d}" fill="none" stroke="${edge}" stroke-width="${edgeW}" stroke-linejoin="round"/>`, 5, seed);

/** 짧은 흰 빗금 (크레용 사이로 비친 종이) */
const streaks = (pts: [number, number, number][], color = "#ffffff", op = 0.45) =>
  pastel(
    pts.map(([x, y, l]) => `<path d="M${x} ${y}l${(l * 0.25).toFixed(1)} ${-l}" stroke="${color}" stroke-width="4" stroke-linecap="round" opacity="${op}"/>`).join(""),
    3,
    11,
  );

/** 동그라미들을 이은 구름 모양 둘레 */
const cloud = (cx: number, cy: number, rx: number, ry: number, bumps: number, depth = 0.16) => {
  let d = "";
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (i === 0) d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    else {
      const m = a - Math.PI / bumps;
      const k = 1 + depth * 2.2;
      d += `Q${(cx + Math.cos(m) * rx * k).toFixed(1)} ${(cy + Math.sin(m) * ry * k).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d + "Z";
};

const SOFT_TREE = {
  green: { fill: "#8fd27a", edge: "#5fc24f" },
  lime: { fill: "#b4dc7c", edge: "#8cc95a" },
  blossom: { fill: "#f7bfd0", edge: "#f095b3" },
} as const;
export type SoftTreeKind = keyof typeof SOFT_TREE;

/** 몽글몽글한 나무 (160×200, TREE_SIZE의 2배). 줄기에 나이테 소용돌이 */
export function softTree(kind: SoftTreeKind): string {
  const c = SOFT_TREE[kind];
  return make(160, 200, () => {
    let o = `<ellipse cx="80" cy="193" rx="42" ry="6" fill="#3b2a1a" opacity=".13"/>`;
    // 줄기: 아래로 넓어지는 사다리꼴 + 소용돌이
    const trunk = "M66 118L94 118L102 194L58 194Z";
    o += blob(trunk, "#b07a48", "#8a5a32", 6, 7);
    o += pastel(`<path d="M86 172c-8 0-10-10-3-12c8-2 12 8 6 14c-7 6-18-1-16-10" fill="none" stroke="#7a4e2a" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>`, 2, 9);
    // 잎: 구름 모양 둘레 (안쪽 동그라미 무늬는 넣지 않는다)
    o += blob(cloud(80, 70, 66, 58, 9), c.fill, c.edge, 10, 3);
    o += streaks([[46, 44, 14], [64, 34, 10], [92, 40, 12], [118, 60, 12], [56, 80, 14], [84, 74, 10], [104, 98, 12], [40, 96, 10], [74, 108, 8]]);
    return o;
  });
}

/** 파란 꽃 한 송이 + 넓은 잎 두 장 (80×60, FLOWERS_SIZE의 2배) */
export function softFlowerBlue(): string {
  return make(80, 60, () => {
    let o = blob("M40 58C30 52 22 40 24 30C34 34 40 44 40 58Z", "#6f8f42", "#5d7c34", 3, 4);
    o += blob("M40 58C50 50 58 38 56 28C46 32 40 44 40 58Z", "#6f8f42", "#5d7c34", 3, 6);
    o += pastel(`<path d="M40 56V30" stroke="#5d7c34" stroke-width="3" stroke-linecap="round"/>`, 2, 8);
    const petals = [0, 1, 2, 3, 4].map((k) => {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      const x = 40 + Math.cos(a) * 9, y = 20 + Math.sin(a) * 9;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="8" ry="9.5" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join("");
    o += `<g fill="#a8cdf2" opacity=".55">${petals}</g>` + pastel(`<g fill="#a8cdf2" stroke="#8dbcec" stroke-width="2.5">${petals}</g>`, 3, 3);
    o += pastel(`<circle cx="40" cy="20" r="5.5" fill="#f7f08c"/>`, 2, 12);
    return o;
  });
}

/** 분홍 꽃 두 송이 (80×60, FLOWERS_SIZE의 2배) */
export function softFlowerPink(): string {
  const flower = (cx: number, cy: number, r: number, fill: string, edge: string, seed: number) => {
    const petals = [0, 1, 2, 3, 4].map((k) => {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      return `<circle cx="${(cx + Math.cos(a) * r * 0.62).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.62).toFixed(1)}" r="${(r * 0.5).toFixed(1)}"/>`;
    }).join("");
    return `<g fill="${fill}" opacity=".55">${petals}</g>` + pastel(`<g fill="${fill}" stroke="${edge}" stroke-width="2">${petals}</g>`, 3, seed) + pastel(`<circle cx="${cx}" cy="${cy}" r="${(r * 0.26).toFixed(1)}" fill="#f6c27a"/>`, 2, seed + 4);
  };
  return make(80, 60, () => {
    let o = pastel(`<path d="M34 58C33 46 32 34 30 20M36 58C40 50 46 44 54 38" fill="none" stroke="#4f9a3c" stroke-width="2.6" stroke-linecap="round"/>`, 2, 4);
    o += blob("M35 58C28 52 20 50 12 50C20 50 30 52 35 58Z", "#4f9a3c", "#4f9a3c", 2, 6);
    o += flower(30, 18, 15, "#f58fb0", "#ef7ea2", 3) + flower(56, 36, 11, "#f7a9c0", "#f294b2", 7);
    return o;
  });
}

/** 파란 꽃 송이 (꽃잎 다섯 장) */
const blueBloom = (cx: number, cy: number, r: number, seed: number) => {
  const petals = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(r * 0.85).toFixed(1)}" ry="${(r * 1.05).toFixed(1)}" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join("");
  return `<g fill="#a8cdf2" opacity=".55">${petals}</g>` + pastel(`<g fill="#a8cdf2" stroke="#8dbcec" stroke-width="2.5">${petals}</g>`, 3, seed) +
    pastel(`<circle cx="${cx}" cy="${cy}" r="${(r * 0.6).toFixed(1)}" fill="#f7f08c"/>`, 2, seed + 4);
};
/** 분홍 꽃 송이 (둥근 꽃잎 다섯 장) */
const pinkBloom = (cx: number, cy: number, r: number, fill: string, edge: string, seed: number) => {
  const petals = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${(cx + Math.cos(a) * r * 0.62).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.62).toFixed(1)}" r="${(r * 0.5).toFixed(1)}"/>`;
  }).join("");
  return `<g fill="${fill}" opacity=".55">${petals}</g>` + pastel(`<g fill="${fill}" stroke="${edge}" stroke-width="2">${petals}</g>`, 3, seed) +
    pastel(`<circle cx="${cx}" cy="${cy}" r="${(r * 0.26).toFixed(1)}" fill="#f6c27a"/>`, 2, seed + 4);
};

/** 상점 앞 화분: 나무 화분에 파란 꽃·분홍 꽃 (120×80, PLANTER_SIZE의 2배) */
export function softPlanter(): string {
  return make(120, 80, () => {
    let o = blob("M22 42C18 28 30 20 40 26C44 14 60 12 66 24C74 14 92 18 96 30C104 30 106 40 100 44Z", "#8fd27a", "#5fc24f", 4, 5);
    o += pinkBloom(30, 26, 13, "#f58fb0", "#ef7ea2", 3) + blueBloom(60, 22, 7, 6) + pinkBloom(88, 28, 11, "#f7a9c0", "#f294b2", 9);
    o += pastelMode(() => S("M10 42Q60 38 110 42L102 76Q60 80 18 76Z", "#c0703f", 5, "M84 36h30v44h-30Z"));
    return o;
  });
}

/** 꽃 덤불: 몽글몽글한 초록 덤불에 분홍·파란 꽃 (160×200, 나무와 같은 틀의 아래쪽) */
export function softBush(): string {
  return make(160, 200, () => {
    let o = `<ellipse cx="80" cy="192" rx="54" ry="6" fill="#3b2a1a" opacity=".1"/>`;
    o += blob("M28 190C18 168 30 150 48 152C52 132 76 126 90 140C104 128 130 134 132 156C146 160 146 182 136 190Z", "#8fd27a", "#5fc24f", 8, 5);
    o += streaks([[46, 170, 10], [70, 150, 10], [104, 152, 10], [120, 176, 8]]);
    return o + pinkBloom(54, 166, 13, "#f58fb0", "#ef7ea2", 3) + blueBloom(84, 150, 6.5, 6) + pinkBloom(110, 170, 11, "#f7a9c0", "#f294b2", 9);
  });
}

/** 크레용 해: 동그라미 테두리 + 비스듬히 문지른 속 + 짧은 햇살 12개 (200×200, 정지원 님 시안) */
export function softSun(): string {
  return make(200, 200, () => {
    const C = "#f5b014";
    let rays = "";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.12;
      const r0 = 62 + (i % 2) * 3, r1 = 86 + (i % 3) * 3;
      rays += `M${(100 + Math.cos(a) * r0).toFixed(1)} ${(100 + Math.sin(a) * r0).toFixed(1)}L${(100 + Math.cos(a) * r1).toFixed(1)} ${(100 + Math.sin(a) * r1).toFixed(1)}`;
    }
    let o = pastel(`<path d="${rays}" stroke="${C}" stroke-width="12" stroke-linecap="round" fill="none"/>`, 4, 21);
    o += `<circle cx="100" cy="100" r="46" fill="${C}" opacity=".15"/>`;
    // 속: 비스듬한 빗금으로 문지르고 군데군데 비운다
    const hatch = [-34, -24, -14, -4, 6, 16, 26].map((d) => `M${100 - 40} ${100 + d + 14}L${100 + 40} ${100 + d - 14}`).join("");
    o += pastel(`<clipPath id="sunc"><circle cx="100" cy="100" r="44"/></clipPath><g clip-path="url(#sunc)"><path d="${hatch}" stroke="${C}" stroke-width="7" stroke-linecap="round" fill="none"/></g>`, 4, 23);
    o += pastel(`<circle cx="100" cy="100" r="46" fill="none" stroke="${C}" stroke-width="9"/>`, 4, 25);
    return o;
  });
}

/** 크레용 파란 구름 (240×130, 정지원 님 시안): 봉우리 네 개, 위쪽 테두리는 옅게 빛난다 */
export function softCloud(night = false): string {
  return make(240, 130, () => {
    const d = "M30 104C10 100 8 70 30 62C34 44 52 40 66 46C70 20 104 12 120 36C132 18 166 22 172 48C190 46 200 60 196 70C218 70 230 92 214 106C200 118 176 112 166 108C150 122 120 120 110 108C92 118 54 116 30 104Z";
    // night = 밤하늘의 보랏빛 구름
    let o = night ? blob(d, "#8b78c8", "#7a68b8", 7, 31) : blob(d, "#8ec0ee", "#78b0e8", 7, 31);
    o += pastel(`<path d="M44 58C48 48 60 46 68 52M78 40C88 26 108 24 116 40M136 36C148 28 164 32 168 46M188 72C196 70 206 76 208 84" fill="none" stroke="${night ? "#a99ae0" : "#c4e0fa"}" stroke-width="7" stroke-linecap="round" opacity=".8"/>`, 3, 33);
    o += streaks([[60, 96, 14], [84, 80, 12], [120, 94, 14], [150, 78, 12], [182, 96, 12], [104, 60, 10]]);
    return o;
  });
}

/** 종 모양 초록 산 + 짙은 점 무늬 (360×200, 정지원 님 시안). light = 뒤쪽에 둘 옅은 산 */
export function softMountain(light = false): string {
  return make(360, 200, () => {
    const fill = light ? "#b7d98a" : "#9fcf5a", edge = light ? "#a2c977" : "#89bd47", spot = light ? "#9dc27a" : "#6f9f3c";
    let o = blob("M4 200C60 196 110 10 180 8C250 10 300 196 356 200Z", fill, edge, 7, light ? 41 : 43);
    o += pastel([[124, 80], [168, 104], [214, 60], [252, 120], [96, 140], [196, 150], [146, 168], [280, 162]]
      .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="10" fill="${spot}" opacity=".8"/>`).join(""), 2, 45);
    return o;
  });
}

/** 산 아래 짙은 덤불 줄 (400×80, 가로로 이어 붙인다) */
export function softHedge(): string {
  return make(400, 80, () => {
    let d = "M0 80V44";
    for (let x = 0; x < 400; x += 50) d += `C${x + 4} 22 ${x + 46} 22 ${x + 50} 44`;
    d += "V80Z";
    let o = blob(d, "#5c9a3c", "#4d8a32", 6, 47);
    o += pastel([[22, 52], [70, 60], [118, 50], [166, 58], [214, 52], [262, 60], [310, 50], [358, 58]]
      .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="7.5" fill="#3f7a2a" opacity=".75"/>`).join(""), 2, 49);
    return o;
  });
}

/** 크레용 종이 결 타일 (256×256, 가로·세로로 이어 붙여도 이음매가 없다). 물·하늘처럼 넓은 면에 겹쳐 결을 낸다 */
export function crayonGrain(color = "#ffffff"): string {
  return make(256, 256, () =>
    `<filter id="cg" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="5" stitchTiles="stitch" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.6 -1.35" result="m"/>` +
    `<feFlood flood-color="${color}"/><feComposite in2="m" operator="in"/></filter>` +
    `<rect width="256" height="256" fill="#fff" filter="url(#cg)"/>`);
}

/** 호숫가 띠 (480×90, 가로로 이어 붙인다): 위는 풀, 가운데 모래, 아래로 물가. 갈대 두 포기 */
export function softShore(): string {
  return make(480, 90, () => {
    let o = blob("M-10 40C40 30 80 50 120 42C170 32 210 50 250 42C300 32 340 50 380 42C420 34 450 44 490 40V96H-10Z", "#ead7a4", "#dcc38a", 6, 51);
    o += blob("M-10 62C40 54 80 70 120 64C170 56 210 70 250 64C300 56 340 70 380 64C420 58 450 66 490 62V96H-10Z", "#9fd3ec", "#86c2e4", 6, 53);
    o += streaks([[40, 78, 10], [150, 80, 12], [270, 78, 10], [390, 80, 12]], "#ffffff", 0.6);
    const reed = (x: number) =>
      pastel(`<path d="M${x - 8} 46q-4-20-10-34M${x} 46q0-24 2-40M${x + 8} 46q4-18 12-30" fill="none" stroke="#6f9c46" stroke-width="4" stroke-linecap="round"/>`, 2, 55) +
      blob(`M${x - 3} 6q3-6 6 0v14q-3 4-6 0Z`, "#a0683d", "#8a5a32", 3, 57);
    return o + reed(90) + reed(330);
  });
}

/** 나무 선착장 (100×170): 판자 여러 장 + 물에 잠긴 기둥 네 개 */
export function softDock(): string {
  return make(100, 170, () => {
    let o = "";
    for (const [x, y] of [[16, 110], [78, 110], [16, 150], [78, 150]]) o += blob(`M${x - 5} ${y}h10v18q-5 3-10 0Z`, "#8a5a3a", "#6f4630", 3, 61);
    for (let y = 0; y < 156; y += 17) {
      const w = (y / 17) % 2 ? 0 : 2;
      o += blob(`M${12 - w} ${y + 1}Q50 ${y - 1} ${88 + w} ${y + 1}L${88 + w} ${y + 15}Q50 ${y + 17} ${12 - w} ${y + 15}Z`, (y / 17) % 2 ? "#c9955f" : "#bf8a55", "#9a6a40", 4, 63 + y);
    }
    return o + pastel(`<path d="M30 20v126M70 20v126" stroke="#9a6a40" stroke-width="2.5" stroke-dasharray="2 15" fill="none"/>`, 1, 65);
  });
}

/** 연잎 (60×40), flower = 분홍 꽃이 핀 연잎 */
export function softLily(flower = false): string {
  return make(60, 40, () => {
    let o = blob("M30 20L52 16C56 28 44 36 30 36C14 36 4 28 8 18C12 8 26 6 34 8Z", "#8fd27a", "#5fc24f", 4, 71);
    if (flower) o += blob("M30 18C26 8 34 6 34 14C40 8 44 14 36 20C40 26 32 28 30 22C26 28 18 24 24 18C18 12 26 8 30 18Z", "#f7a9c0", "#f294b2", 3, 73);
    return o;
  });
}

/** 잔물결 (64×16): 흰 크레용 곡선 두 줄 */
export function softRipple(): string {
  return make(64, 16, () => pastel(`<path d="M4 10q12-8 24 0M36 12q10-6 22 0" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".75"/>`, 2, 77));
}

/** 불꽃놀이 색 묶음 (정지원 님 시안: 빨강·주황·노랑, 보라·하늘·노랑) */
export const FIREWORK_PALETTES = {
  warm: ["#e8352e", "#e8792e", "#f2cf3e"],
  cool: ["#6f62e0", "#6ab4f0", "#f2cf3e"],
  pink: ["#f06aa6", "#b98cf0", "#7fe0b8"],
} as const;
export type FireworkPalette = keyof typeof FIREWORK_PALETTES;

/** 크레용 불꽃 (240×240): 가운데서 뻗는 굽은 줄기, 몇 줄은 끝이 꼬불꼬불, 둘레에 작은 점 */
export function softFirework(kind: FireworkPalette): string {
  const cols = FIREWORK_PALETTES[kind];
  return make(240, 240, () => {
    let o = "";
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r0 = 24 + (i % 2) * 8, r1 = 74 + ((i * 5) % 3) * 12;
      const bend = (((i * 7) % 5) - 2) * 0.05;
      const p = (r: number, da = 0) => [120 + Math.cos(a + da) * r, 120 + Math.sin(a + da) * r].map((v) => v.toFixed(1)).join(" ");
      let d = `M${p(r0)}Q${p((r0 + r1) / 2, bend)} ${p(r1, bend * 1.6)}`;
      // 몇 줄은 끝을 꼬불꼬불하게 (시안의 번개 같은 꼬리)
      if (i % 5 === 2) d += `Q${p(r1 - 14, bend * 1.6 + 0.22)} ${p(r1 - 6, bend * 1.6 + 0.3)}Q${p(r1 + 2, bend * 1.6 + 0.4)} ${p(r1 - 12, bend * 1.6 + 0.48)}`;
      o += pastel(`<path d="${d}" fill="none" stroke="${cols[i % 3]}" stroke-width="${i % 3 === 2 ? 7 : 8}" stroke-linecap="round" stroke-linejoin="round"/>`, 3, 81 + i);
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, r = 104 + Math.sin(i * 2.3) * 8;
      o += pastel(`<circle cx="${(120 + Math.cos(a) * r).toFixed(1)}" cy="${(120 + Math.sin(a) * r).toFixed(1)}" r="5" fill="${cols[(i + 1) % 3]}"/>`, 2, 101 + i);
    }
    return o;
  });
}

/** 얼굴 모양 크레용 불꽃 (240×240): 토끼·고양이 얼굴을 짧은 크레용 선으로 */
export function softFireworkFace(face: "bunny" | "cat"): string {
  const c = face === "bunny" ? "#f06aa6" : "#8a7cf0";
  return make(240, 240, () => {
    const st = `fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-dasharray="10 9"`;
    let o = pastel(`<ellipse cx="120" cy="142" rx="74" ry="58" ${st}/>`, 3, 111);
    o += face === "bunny"
      ? pastel(`<path d="M86 92C74 52 78 18 92 18C106 18 106 56 102 88M154 92C166 52 162 18 148 18C134 18 134 56 138 88" ${st}/>`, 3, 113)
      : pastel(`<path d="M62 112L58 58L104 88M178 112L182 58L136 88" ${st} stroke-linejoin="round"/>`, 3, 113);
    o += pastel(`<circle cx="94" cy="136" r="7" fill="${c}"/><circle cx="146" cy="136" r="7" fill="${c}"/><path d="M110 158q10 10 20 0" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`, 2, 115);
    return o + pastel(`<circle cx="36" cy="60" r="4" fill="#f2cf3e"/><circle cx="206" cy="70" r="4" fill="#f2cf3e"/><circle cx="214" cy="190" r="4" fill="${c}"/>`, 2, 117);
  });
}
