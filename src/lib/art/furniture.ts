// 미니룸 가구 그림 (SHOP-05). 외부 그림 없이 코드로 그린 SVG.
// 가구마다 viewBox 크기가 다르고, 미니룸 높이에 대한 비율(heightPct)로 크기를 정한다.
// 그래서 휴대폰처럼 좁은 화면에서도 미니룸 높이가 같으면 같은 크기로 보인다.
// DB의 asset_key("furn.chair" 등)로 고른다.

const OUTLINE = "#3b2a20";
const S = `stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"`;

type Furniture = { w: number; h: number; heightPct: number; svg: string };

const FURNITURE: Record<string, Furniture> = {
  // 화분: 테라코타 화분과 둥근 잎
  "furn.plant": {
    w: 40,
    h: 56,
    heightPct: 26,
    svg:
      `<path d="M20 34C20 22 12 14 6 12c2 9 6 16 14 22z" fill="#5fbf6a" ${S}/>` +
      `<path d="M20 34C20 20 28 10 35 8c-1 10-6 19-15 26z" fill="#4caf7a" ${S}/>` +
      `<path d="M20 34C19 24 20 12 20 4c3 8 4 20 0 30z" fill="#7fd08a" ${S}/>` +
      `<path d="M9 32h22l-3.4 21H12.4z" fill="#d9774a" ${S}/>` +
      `<rect x="7.5" y="30" width="25" height="5" rx="1.5" fill="#e88a5c" ${S}/>`,
  },
  // 의자: 나무 의자
  "furn.chair": {
    w: 44,
    h: 60,
    heightPct: 32,
    svg:
      `<rect x="9" y="3" width="26" height="30" rx="5" fill="#c4874f" ${S}/>` +
      `<rect x="14" y="8" width="16" height="18" rx="3" fill="#d9a06b"/>` +
      `<path d="M9 40v18M35 40v18" stroke="${OUTLINE}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M9 40v18M35 40v18" stroke="#a86d3a" stroke-width="2.4" stroke-linecap="round"/>` +
      `<rect x="4" y="31" width="36" height="9" rx="3" fill="#b7794a" ${S}/>`,
  },
  // 램프: 스탠드 조명, 따뜻한 불빛
  "furn.lamp": {
    w: 40,
    h: 84,
    heightPct: 44,
    svg:
      `<circle cx="20" cy="18" r="17" fill="#ffe9a8" opacity=".55"/>` +
      `<path d="M20 26v50" stroke="${OUTLINE}" stroke-width="4.6" stroke-linecap="round"/>` +
      `<path d="M20 26v50" stroke="#8a8f99" stroke-width="2"/>` +
      `<ellipse cx="20" cy="78" rx="11" ry="3.6" fill="#6b7280" ${S}/>` +
      `<path d="M10 6h20l6 20H4z" fill="#ffd36e" ${S}/>` +
      `<path d="M13 10h14" stroke="#f2b632" stroke-width="1.4"/>`,
  },
  // 책상: 서랍 있는 책상, 위에 책
  "furn.desk": {
    w: 90,
    h: 60,
    heightPct: 34,
    svg:
      `<rect x="8" y="22" width="6" height="36" rx="1.5" fill="#a86d3a" ${S}/>` +
      `<rect x="54" y="22" width="30" height="36" rx="2" fill="#c4874f" ${S}/>` +
      `<path d="M54 39h30" stroke="${OUTLINE}" stroke-width="1.4"/>` +
      `<rect x="65" y="28" width="8" height="3" rx="1.5" fill="${OUTLINE}"/><rect x="65" y="45" width="8" height="3" rx="1.5" fill="${OUTLINE}"/>` +
      `<rect x="3" y="16" width="84" height="7" rx="2" fill="#b7794a" ${S}/>` +
      `<rect x="16" y="8" width="18" height="5" rx="1" fill="#6cb4ee" ${S}/><rect x="18" y="3.5" width="15" height="5" rx="1" fill="#ff8fa3" ${S}/>` +
      `<path d="M44 16v-8h8v8" fill="#fff" ${S}/>`,
  },
  // 침대: 머리판, 이불, 베개
  "furn.bed": {
    w: 110,
    h: 64,
    heightPct: 34,
    svg:
      `<rect x="4" y="6" width="16" height="54" rx="4" fill="#a86d3a" ${S}/>` +
      `<rect x="98" y="30" width="9" height="30" rx="3" fill="#a86d3a" ${S}/>` +
      `<rect x="14" y="30" width="88" height="20" rx="4" fill="#fff8ee" ${S}/>` +
      `<ellipse cx="32" cy="29" rx="12" ry="6" fill="#fff" ${S}/>` +
      `<path d="M44 26h56q4 0 4 4v16q0 4-4 4H44z" fill="#6cb4ee" ${S}/>` +
      `<path d="M58 30v18M72 30v18M86 30v18" stroke="#4f9ad6" stroke-width="1.4"/>` +
      `<path d="M14 50v8M100 50v8" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>`,
  },
};

const FALLBACK: Furniture = {
  w: 40,
  h: 40,
  heightPct: 24,
  svg: `<rect x="4" y="4" width="32" height="32" rx="6" fill="#cfc4b8" ${S}/>`,
};

export function furnitureInfo(assetKey: string) {
  const f = FURNITURE[assetKey] ?? FALLBACK;
  return { heightPct: f.heightPct, aspect: (f.w + 4) / (f.h + 4) };
}

/** 가구 SVG 문자열. height는 픽셀 높이 (너비는 비율에 맞춘다) */
export function furnitureSvg(assetKey: string, height = 120): string {
  const f = FURNITURE[assetKey] ?? FALLBACK;
  const width = Math.round((height * (f.w + 4)) / (f.h + 4));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${f.w + 4} ${f.h + 4}" width="${width}" height="${height}">${f.svg}</svg>`;
}

export function furnitureDataUri(assetKey: string, height = 120): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(furnitureSvg(assetKey, height))}`;
}
