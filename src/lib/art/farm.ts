// 동물 농장 화면 배경 (TOWN-09): 풀밭, 나무 울타리, 둥지, 헛간. 코드로 그린 작은 SVG 타일을 CSS 배경으로 반복한다
const O = "#5b3a22";

const uri = (svg: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

/** 풀밭 무늬 (풀 포기 + 들꽃) 120×120 반복 */
export const GRASS_TILE = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
    `<g fill="none" stroke="#6fbf5e" stroke-width="2" stroke-linecap="round">` +
    `<path d="M14 30l3 7l2-9l3 9l3-6"/><path d="M78 18l3 7l2-9l3 9"/><path d="M40 84l3 7l2-9l3 9l3-6"/><path d="M96 70l2 7l3-8l2 8"/><path d="M60 50l2 6l2-7"/><path d="M8 100l2 6l2-7l2 7"/>` +
    `</g>` +
    `<g><circle cx="104" cy="104" r="2.6" fill="#fff"/><circle cx="104" cy="104" r="1.1" fill="#ffc93d"/>` +
    `<circle cx="30" cy="62" r="2.4" fill="#ffd9e6"/><circle cx="30" cy="62" r="1" fill="#ff8fb0"/>` +
    `<circle cx="70" cy="104" r="2" fill="#fff59d"/></g></svg>`,
);

/** 위·아래 울타리 한 칸 (기둥 + 가로대 두 줄) 56×44 가로 반복 */
export const FENCE_H_TILE = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="44" viewBox="0 0 56 44">` +
    `<rect x="0" y="12" width="56" height="7" rx="2" fill="#d9a066" stroke="${O}" stroke-width="1.5"/>` +
    `<rect x="0" y="26" width="56" height="7" rx="2" fill="#d9a066" stroke="${O}" stroke-width="1.5"/>` +
    `<path d="M22 6l6-5l6 5v36h-12z" fill="#c08a52" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M25 12v26" stroke="#a87443" stroke-width="1.5"/></svg>`,
);

/** 왼쪽·오른쪽 울타리 한 칸 (위에서 본 기둥 + 세로 가로대) 22×52 세로 반복 */
export const FENCE_V_TILE = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="52" viewBox="0 0 22 52">` +
    `<rect x="7" y="0" width="8" height="52" fill="#d9a066" stroke="${O}" stroke-width="1.5"/>` +
    `<rect x="2" y="18" width="18" height="16" rx="3" fill="#c08a52" stroke="${O}" stroke-width="2"/>` +
    `<circle cx="11" cy="26" r="2.4" fill="#a87443"/></svg>`,
);

/** 알 둥지 (짚) */
export function nestSvg(): string {
  let straw = "";
  for (let i = 0; i < 14; i++) {
    const x = 14 + i * 13;
    straw += `<path d="M${x} ${46 + (i % 3) * 3}q8-${8 + (i % 4) * 2} 18 0" fill="none" stroke="#c99a2e" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80">` +
    `<ellipse cx="110" cy="62" rx="106" ry="16" fill="#000" opacity=".12"/>` +
    `<ellipse cx="110" cy="50" rx="104" ry="24" fill="#e8c46a" stroke="${O}" stroke-width="2.5"/>` +
    `<ellipse cx="110" cy="44" rx="86" ry="14" fill="#b9892f"/>` +
    straw +
    `</svg>`
  );
}

/** 작은 헛간 (오른쪽 위 장식) */
export function barnSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 110">` +
    `<ellipse cx="60" cy="104" rx="56" ry="6" fill="#000" opacity=".14"/>` +
    `<rect x="14" y="40" width="92" height="64" rx="3" fill="#d9534f" stroke="${O}" stroke-width="2.5"/>` +
    `<path d="M6 46L60 6L114 46Z" fill="#8f3b2d" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<rect x="48" y="22" width="24" height="12" fill="#fff4dc" stroke="${O}" stroke-width="2"/>` +
    `<rect x="40" y="62" width="40" height="42" fill="#fff4dc" stroke="${O}" stroke-width="2.5"/>` +
    `<path d="M40 62L80 104M80 62L40 104" stroke="${O}" stroke-width="2.5"/>` +
    `</svg>`
  );
}

/** 건초 더미 */
export function haySvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 46">` +
    `<ellipse cx="35" cy="42" rx="32" ry="4" fill="#000" opacity=".14"/>` +
    `<rect x="4" y="8" width="62" height="34" rx="8" fill="#f0c75e" stroke="${O}" stroke-width="2.5"/>` +
    `<path d="M10 18h50M10 26h50M10 34h50" stroke="#c99a2e" stroke-width="2"/></svg>`
  );
}

export const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
