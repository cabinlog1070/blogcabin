// 동물 농장 화면 배경 (TOWN-09): 풀밭, 나무 울타리, 둥지, 헛간, 건초.
// 광장의 동물 농장 그림(town.ts farmSvg)과 같은 그림체: 둥근 통나무 기둥·가로대, 빨간 헛간, 건초 더미, 붓 느낌 명암.
// 타일(GRASS_TILE·FENCE_*)은 CSS 배경으로 반복하고, 헛간·건초·둥지는 <img>로 놓는다.
// 이 그림들은 서버에서도 그려지므로(하이드레이션) 그림 안 id 를 고정 문자열로 만든다 (그림마다 다른 접두사).
import { farmPaint as F } from "./town";
import { OUTLINE, rng, S } from "./style";

const uri = (svg: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

/** 그림 하나 안에서만 쓰는 고정 id (서버·브라우저가 같은 문자열을 만든다) */
const fixedIds = (prefix: string) => {
  let n = 0;
  return (p: string) => `${prefix}-${p}-${(n++).toString(36)}`;
};

/** 반복 타일: 화면 w×h px, 좌표는 2배 viewBox (광장 그림과 같은 선 굵기) */
const tile = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w * 2} ${h * 2}"><defs>${F.defs()}</defs>${body}</svg>`;

/** 풀밭 무늬 (짧은 풀 획 + 풀 포기 + 들꽃) 120×120 반복. 가장자리에 걸치는 것이 없어 이음매가 보이지 않는다 */
export const GRASS_TILE = uri(
  (() => {
    F.begin(240, 240, 41, fixedIds("fg"));
    const r = rng(41);
    let o = "";
    // 짧은 풀 획 (짙은 것·밝은 것)
    for (let i = 0; i < 26; i++) {
      const x = 16 + r() * 208, y = 16 + r() * 208;
      o += F.pl([[x - 3, y], [x - 1.5, y - 4], [x, y], [x + 1.5, y - 5], [x + 3, y]], i % 3 ? F.C.grassShade : "#c4df86", 1.3, i % 3 ? 0.55 : 0.8);
    }
    // 풀 포기
    for (const [x, y, s] of [[34, 64, 5], [160, 40, 4.5], [86, 176, 5], [200, 150, 4], [122, 104, 4]]) o += F.tuft(x, y, s);
    // 들꽃 (흰·노랑·분홍)
    o += F.flw(208, 208, 6, F.C.whiteFlower, "#f6c445", 10) + F.flw(60, 126, 5.5, F.C.pinkFlower, "#f6c445", 30) + F.flw(142, 214, 5, F.C.yellowFlower, "#e58a2e", 0);
    o += F.flw(178, 86, 4.5, F.C.whiteFlower, "#f6c445", 50);
    return tile(120, 120, o);
  })(),
);

/** 위·아래 울타리 한 칸 (둥근 통나무 기둥 + 가로대 두 줄) 56×44 가로 반복. 가로대는 타일 밖까지 그려 이어 보인다 */
export const FENCE_H_TILE = uri(
  (() => {
    F.begin(112, 88, 51, fixedIds("fh"));
    const o = F.rail([-14, 28], [126, 28], 10.5, 0.02) + F.rail([-14, 56], [126, 56], 10.5, -0.03) + F.post(56, 80, 19, 70, 0, 0);
    return tile(56, 44, o);
  })(),
);

/** 왼쪽·오른쪽 울타리 한 칸 (안쪽으로 뻗은 가로대 + 둥근 기둥) 22×52 세로 반복 */
export const FENCE_V_TILE = uri(
  (() => {
    F.begin(44, 104, 52, fixedIds("fv"));
    const o = F.rail([22, -14], [22, 118], 10.5, 0) + F.post(22, 78, 18, 44, 0, 0.03);
    return tile(22, 52, o);
  })(),
);

/** 알 둥지 (짚을 엮은 도넛 모양, 위에서 비스듬히). 220×80 */
export function nestSvg(): string {
  const W = 220, H = 80;
  F.begin(W * 2, H * 2, 61, fixedIds("nest"));
  const r = rng(61);
  const K = F.K;
  const cx = 220, cy = 92, RX = 206, RY = 58;
  let o = F.soft(F.fell(cx + 8, cy + 36, RX + 2, 22, "#2f4a1c", 0.32), "soft3");
  // 바깥 짚 테두리: 왼쪽 위 밝게 → 오른쪽 아래 그늘
  o += F.ell(cx, cy, RX, RY, F.face(K.hayHi, K.hay, K.hayShade), S(3.4));
  // 엮은 짚 결: 테두리를 따라 도는 짧은 호 (앞쪽은 그늘색, 위쪽은 밝게)
  const arc = (k: number, a0: number, a1: number, col: string, w: number, op: number) => {
    const p = (a: number) => `${(cx + Math.cos(a) * RX * k).toFixed(1)},${(cy + Math.sin(a) * RY * k).toFixed(1)}`;
    return `<path d="M${p(a0)} A${(RX * k).toFixed(1)} ${(RY * k).toFixed(1)} 0 0 1 ${p(a1)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
  };
  for (let i = 0; i < 46; i++) {
    const k = 0.74 + r() * 0.22, a0 = r() * Math.PI * 2, a1 = a0 + 0.25 + r() * 0.5;
    const front = Math.sin(a0 + 0.3) > 0.15;
    o += arc(k, a0, a1, front ? (r() < 0.6 ? K.hayLine : K.hayShade) : r() < 0.5 ? "#fff3c4" : K.hayShade, 2.4 + r() * 1.2, front ? 0.8 : 0.9);
  }
  // 안쪽 우묵한 곳 (알이 놓이는 자리): 위쪽으로 치우쳐 앞 테두리가 두껍게 보인다
  o += F.ell(cx, cy - 16, 156, 24, F.lg([[0, "#7d5718"], [0.55, "#9c7028"], [1, "#c09238"]], [0, 0, 0, 1]), `stroke="${K.hayLine}" stroke-width="2.2"`);
  o += F.soft(F.fell(cx - 6, cy - 27, 142, 9, "#5e3f12", 0.5));
  for (let i = 0; i < 16; i++) {
    const x = cx - 118 + r() * 236, y = cy - 18 + r() * 12;
    o += F.ln([x, y], [x + 8 + r() * 10, y + (r() - 0.5) * 3], "#d2a547", 1.3, 0.65);
  }
  // 앞 테두리 윗선의 밝은 빛, 아래쪽 그늘
  o += arc(0.6, 0.5, Math.PI - 0.5, "#fff0b8", 3.4, 0.6);
  o += F.soft(arc(0.9, 0.2, Math.PI - 0.2, K.hayShade, 9, 0.5), "soft3");
  // 테두리 밖으로 삐져나온 짚
  for (const [x, y, dx, dy] of [[20, 92, -12, -7], [24, 112, -14, 3], [418, 90, 12, -7], [414, 112, 14, 4], [116, 142, -6, 9], [318, 142, 8, 8], [210, 147, 2, 10]]) {
    o += F.ln([x, y], [x + dx, y + dy], OUTLINE, 4.4) + F.ln([x, y], [x + dx, y + dy], K.hay, 2.2);
  }
  return F.finish(W, H, o);
}

/** 작은 헛간 (오른쪽 위 장식) 120×110. 광장 농장 그림의 헛간과 같은 그림 */
export function barnSvg(): string {
  F.begin(240, 220, 71, fixedIds("barn"));
  // 광장 농장 그림 좌표의 헛간(가로 139~377, 세로 10~216)을 이 틀 가운데로 옮긴다
  const body = F.leaves(150, 116, 46, 32, 37, { r: 12 }) + F.barn() + F.leaves(244, 204, 30, 18, 41, { r: 9, flowers: 1, flowerCols: ["#f08a5d"], fr: 6.5 });
  return F.finish(120, 110, `<g transform="translate(-122.5 5.8) scale(.94)">${body}</g>`);
}

/** 건초 더미 70×46 */
export function haySvg(): string {
  F.begin(140, 92, 81, fixedIds("hay"));
  return F.finish(70, 46, `<g transform="translate(-90.5 -151)">${F.hay([128, 226])}</g>`);
}

export const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
