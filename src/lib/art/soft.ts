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
