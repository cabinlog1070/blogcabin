// 광장 건물·소품 그림 (SVG). Phaser가 이 SVG를 이미지로 바꿔 광장에 놓는다.
// 크기는 화면에 보일 크기의 2배로 그려서(SCALE) 선명하게 만든다.
import { backgroundAccent } from "./backgrounds";

const O = "#4a3426"; // 외곽선
const S = `stroke="${O}" stroke-width="3" stroke-linejoin="round"`;
const FONT = `font-family="'Apple SD Gothic Neo','Noto Sans KR',sans-serif" font-weight="800"`;

function wrap(w: number, h: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}">${body}</svg>`;
}

function darken(hex: string, amount = 0.25) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ===== 집 = 통나무 오두막 (단계별 성장, TOWN-11) =====
// 1단계: 세모 지붕 + 문 하나 (창문·굴뚝 없음) / 2단계: + 창문 두 개(꽃 상자)·돌 굴뚝, 더 크게 / 3단계: + 지붕 다락방 창(도머), 더 크게
// 벽은 가로로 쌓은 통나무, 모서리에 둥근 통나무 끝(나이테)이 보인다. 지붕은 고른 색(TOWN-07)
// 단계는 집 주인의 레벨로 정한다 (houseStageForLevel, src/lib/game.ts)
export const HOUSE_STAGES = {
  1: { name: "작은 오두막", width: 150, height: 140, wall: { left: 26, right: 124, top: 70 }, roofTop: 20 },
  2: { name: "창문 있는 오두막", width: 182, height: 168, wall: { left: 24, right: 158, top: 84 }, roofTop: 20 },
  3: { name: "다락방 오두막", width: 214, height: 204, wall: { left: 24, right: 190, top: 104 }, roofTop: 14 },
} as const;
export type HouseStage = keyof typeof HOUSE_STAGES;

// ===== 지붕 색 (TOWN-07, 무료) =====
// 꾸미기 화면에서 고르는 기본 색 8가지. DB(blogs.roof_color)에는 키만 저장한다 (CHECK blogs_roof_color_check와 같은 목록)
export const ROOF_COLORS = {
  red: { name: "빨강", hex: "#dc2626" },
  orange: { name: "주황", hex: "#ea580c" },
  yellow: { name: "노랑", hex: "#eab308" },
  green: { name: "초록", hex: "#16a34a" },
  sky: { name: "하늘", hex: "#38bdf8" },
  blue: { name: "파랑", hex: "#2563eb" },
  purple: { name: "보라", hex: "#9333ea" },
  brown: { name: "갈색", hex: "#92400e" },
} as const;
export type RoofColor = keyof typeof ROOF_COLORS;
export const isRoofColor = (v: unknown): v is RoofColor => typeof v === "string" && Object.hasOwn(ROOF_COLORS, v);

/** 집 지붕에 칠할 색: 고른 색이 있으면 그 색, 없으면(또는 [배경 색 따라가기]) 장착한 배경의 강조색 */
export function roofHex(roofColor: string | null | undefined, backgroundAsset: string): string {
  return isRoofColor(roofColor) ? ROOF_COLORS[roofColor].hex : backgroundAccent(backgroundAsset);
}

const LOG = "#b9773f"; // 통나무 벽
const LOG_ALT = "#a96a36";
const LOG_HI = "#d39558";
const LOG_END = "#e6bd84"; // 통나무 끝 (나이테)
const LOG_RING = "#c08a52";

/** 가로로 쌓은 통나무 벽 + 양쪽 모서리의 둥근 통나무 끝 */
function logWall(left: number, right: number, top: number, bottom: number) {
  const n = Math.max(2, Math.round((bottom - top) / 12));
  const lh = (bottom - top) / n;
  let out = `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="${LOG_ALT}" ${S}/>`;
  for (let i = 0; i < n; i++) {
    const y = top + i * lh;
    out +=
      `<rect x="${left}" y="${y + 0.5}" width="${right - left}" height="${lh - 1}" rx="${lh / 2 - 1}" fill="${i % 2 ? LOG_ALT : LOG}" stroke="${O}" stroke-width="2"/>` +
      `<path d="M${left + lh / 2} ${y + 3}H${right - lh / 2}" stroke="${LOG_HI}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
  }
  for (let i = 0; i < n; i++) {
    const cy = top + i * lh + lh / 2;
    const r = lh / 2 + 0.5;
    // 모서리마다 통나무 끝이 번갈아 조금씩 튀어나온다
    for (const x of [left - (i % 2 ? 1 : 4), right + (i % 2 ? 1 : 4)]) {
      out +=
        `<circle cx="${x}" cy="${cy}" r="${r}" fill="${LOG_END}" stroke="${O}" stroke-width="2"/>` +
        `<circle cx="${x}" cy="${cy}" r="${r * 0.5}" fill="none" stroke="${LOG_RING}" stroke-width="1.3"/>` +
        `<circle cx="${x}" cy="${cy}" r="1" fill="${LOG_RING}"/>`;
    }
  }
  return out;
}

/** 나무 틀 창문 (따뜻한 불빛) + 꽃 상자 */
function cabinWindow(x: number, y: number, w: number, h: number, flowers: boolean) {
  let out =
    `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="2" fill="#7d5232" ${S}/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffe08a" stroke="${O}" stroke-width="2"/>` +
    `<path d="M${x} ${y + h}L${x + w} ${y}V${y + h}Z" fill="#ffc94d" opacity=".6"/>` +
    `<path d="M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}" stroke="#7d5232" stroke-width="3"/>`;
  if (flowers) {
    out +=
      `<rect x="${x - 4}" y="${y + h + 3}" width="${w + 8}" height="7" rx="2" fill="#8d6040" ${S}/>` +
      `<circle cx="${x + 3}" cy="${y + h + 2}" r="3" fill="#ff7aa2"/><circle cx="${x + w / 2}" cy="${y + h + 1}" r="3" fill="#ffd36e"/><circle cx="${x + w - 3}" cy="${y + h + 2}" r="3" fill="#ff7aa2"/>`;
  }
  return out;
}

export function houseSvg(stage: HouseStage, roof: string): string {
  const { width: w, height: h, wall, roofTop } = HOUSE_STAGES[stage];
  const roofDark = darken(roof, 0.28);
  const cx = w / 2;
  const ground = h - 10; // 벽 아랫변
  const eave = wall.top + 6; // 처마 높이
  const over = 14; // 처마가 벽 밖으로 나온 길이
  const halfSpan = wall.right + over - cx;
  const slopeAt = (x: number) => roofTop + ((eave - roofTop) * Math.abs(x - cx)) / halfSpan; // 지붕 경사 위 y
  let body = `<ellipse cx="${cx}" cy="${h - 7}" rx="${(wall.right - wall.left) / 2 + 14}" ry="6" fill="#000" opacity=".15"/>`;

  // 돌 굴뚝 (2단계부터): 지붕 오른쪽 경사 위로 솟는다. 아랫부분은 지붕에 가려진다
  if (stage >= 2) {
    const chw = 20;
    const chx = cx + (wall.right - cx) * 0.42;
    const top = slopeAt(chx) - 26;
    const bottom = slopeAt(chx + chw) + 6;
    body += `<rect x="${chx}" y="${top}" width="${chw}" height="${bottom - top}" fill="#9ea3a8" ${S}/>`;
    let stones = "";
    for (let y = top + 4, row = 0; y < bottom - 4; y += 8, row++) {
      for (let x = chx + 2 + (row % 2 ? 5 : 0); x < chx + chw - 4; x += 10)
        stones += `<rect x="${x}" y="${y}" width="${Math.min(8, chx + chw - 2 - x)}" height="6" rx="2" fill="${row % 2 ? "#b8bcc0" : "#8b9095"}"/>`;
    }
    body += stones + `<rect x="${chx - 3}" y="${top - 5}" width="${chw + 6}" height="7" rx="2" fill="#7c8186" ${S}/>`;
    // 굴뚝 연기
    body += `<g fill="#eef1f3" stroke="#c9cfd4" stroke-width="1.5" opacity=".9"><circle cx="${chx + 12}" cy="${top - 12}" r="5"/><circle cx="${chx + 20}" cy="${top - 20}" r="4"/></g>`;
  }

  // 통나무 벽
  body += logWall(wall.left, wall.right, wall.top, ground);

  // 세모 지붕 (고른 색) + 판자 줄 + 아래 처마 띠
  body += `<path d="M${wall.left - over} ${eave}L${cx} ${roofTop}L${wall.right + over} ${eave}Q${wall.right + over + 2} ${eave + 7} ${wall.right + over - 5} ${eave + 7}H${wall.left - over + 5}Q${wall.left - over - 2} ${eave + 7} ${wall.left - over} ${eave}Z" fill="${roof}" ${S}/>`;
  let shingles = "";
  for (let y = eave - 9; y > roofTop + 14; y -= 11) {
    const half = ((y - roofTop) / (eave - roofTop)) * halfSpan - 9;
    shingles += `M${cx - half} ${y}H${cx + half}`;
    // 엇갈린 판자 이음매
    for (let x = cx - half + ((y / 11) % 2 ? 10 : 20); x < cx + half - 6; x += 22) shingles += `M${x} ${y}v-7`;
  }
  body += `<path d="${shingles}" stroke="${roofDark}" stroke-width="2.5" stroke-linecap="round"/>`;
  body += `<path d="M${wall.left - over + 2} ${eave + 2}H${wall.right + over - 2}" stroke="${roofDark}" stroke-width="3" stroke-linecap="round"/>`;
  // 용마루 통나무
  body += `<circle cx="${cx}" cy="${roofTop + 1}" r="5" fill="${LOG_END}" stroke="${O}" stroke-width="2"/>`;

  // 다락방 창 (3단계): 지붕에서 튀어나온 작은 도머 (통나무 벽 + 창 + 작은 지붕)
  if (stage >= 3) {
    const dw = 46;
    const dBottom = eave - 16;
    const dTop = dBottom - 26;
    const dl = cx - dw / 2;
    body += logWall(dl, dl + dw, dTop, dBottom) + cabinWindow(cx - 10, dTop + 6, 20, 15, false);
    body += `<path d="M${dl - 9} ${dTop + 2}L${cx} ${dTop - 22}L${dl + dw + 9} ${dTop + 2}Z" fill="${roof}" ${S}/>` +
      `<path d="M${cx - 18} ${dTop - 4}H${cx + 18}" stroke="${roofDark}" stroke-width="2.5" stroke-linecap="round"/>`;
  }

  // 판자 문 (모든 단계): 문틀 + 세로 판자 + 가로 띠 + 쇠 손잡이 + 디딤돌
  const dw = stage === 1 ? 28 : 32;
  const dh = stage === 1 ? 42 : 48;
  const dl = cx - dw / 2;
  const dt = ground - dh;
  body += `<path d="M${dl - 5} ${ground}V${dt + 2}Q${dl - 5} ${dt - 5} ${dl + 2} ${dt - 5}H${dl + dw - 2}Q${dl + dw + 5} ${dt - 5} ${dl + dw + 5} ${dt + 2}V${ground}Z" fill="#7d5232" ${S}/>` +
    `<rect x="${dl}" y="${dt}" width="${dw}" height="${dh}" rx="2" fill="#a0693f" ${S}/>`;
  let planks = "";
  for (let x = dl + dw / 4; x < dl + dw - 2; x += dw / 4) planks += `M${x} ${dt + 2}V${ground - 1}`;
  body += `<path d="${planks}" stroke="#7d5232" stroke-width="1.8"/>` +
    `<path d="M${dl + 2} ${dt + dh * 0.25}H${dl + dw - 2}M${dl + 2} ${dt + dh * 0.72}H${dl + dw - 2}M${dl + 3} ${dt + dh * 0.72}L${dl + dw - 3} ${dt + dh * 0.25}" stroke="#6b4428" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="${dl + dw - 7}" cy="${dt + dh * 0.5}" r="2.6" fill="#3d3d3d" stroke="${O}" stroke-width="1"/>` +
    `<rect x="${dl - 8}" y="${ground - 2}" width="${dw + 16}" height="7" rx="3" fill="#b9b2a8" ${S}/>`;

  // 창문 두 개 + 꽃 상자 (2단계부터)
  if (stage >= 2) {
    const ww = stage === 3 ? 26 : 22;
    const wh = stage === 3 ? 22 : 19;
    const wy = dt + 4;
    for (const wx of [wall.left + (dl - 5 - wall.left) / 2 - ww / 2, dl + dw + 5 + (wall.right - dl - dw - 5) / 2 - ww / 2]) {
      body += cabinWindow(wx, wy, ww, wh, true);
    }
  }
  return wrap(w, h, body);
}

// ===== 마을 게시판 (마을 소식 + 출석 도장) =====
export const BOARD_SIZE = { width: 250, height: 170 };
export function boardSvg(): string {
  const { width: w, height: h } = BOARD_SIZE;
  let notes = "";
  const papers = [
    { x: 30, y: 52, r: -6, c: "#fffdf5" },
    { x: 64, y: 48, r: 4, c: "#fff3b0" },
    { x: 38, y: 92, r: 3, c: "#d6f5ff" },
    { x: 74, y: 90, r: -4, c: "#ffe1ec" },
  ];
  for (const p of papers) {
    notes +=
      `<g transform="rotate(${p.r} ${p.x + 15} ${p.y + 18})"><rect x="${p.x}" y="${p.y}" width="30" height="34" fill="${p.c}" stroke="#c9b79c" stroke-width="1.5"/>` +
      `<path d="M${p.x + 5} ${p.y + 12}H${p.x + 25}M${p.x + 5} ${p.y + 18}H${p.x + 22}M${p.x + 5} ${p.y + 24}H${p.x + 24}" stroke="#a89880" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="${p.x + 15}" cy="${p.y + 3}" r="3" fill="#e5484d" stroke="${O}" stroke-width="1"/></g>`;
  }
  // 출석 도장 판: 7칸 중 몇 칸에 도장
  let stamps = "";
  for (let i = 0; i < 7; i++) {
    const cx = 148 + (i % 4) * 19 + (i >= 4 ? 9 : 0);
    const cy = 82 + Math.floor(i / 4) * 22;
    stamps += `<circle cx="${cx}" cy="${cy}" r="8" fill="#fff" stroke="#c9b79c" stroke-width="1.5"/>`;
    if (i < 4) stamps += `<path d="M${cx} ${cy - 5}l1.5 3.4 3.7.3-2.8 2.4.9 3.6-3.3-2-3.3 2 .9-3.6-2.8-2.4 3.7-.3z" fill="#e5484d"/>`;
  }
  const body =
    `<ellipse cx="125" cy="163" rx="100" ry="6" fill="#000" opacity=".15"/>` +
    // 기둥
    `<rect x="22" y="40" width="12" height="124" rx="3" fill="#8d6040" ${S}/><rect x="216" y="40" width="12" height="124" rx="3" fill="#8d6040" ${S}/>` +
    // 작은 지붕
    `<path d="M6 34L125 6L244 34Q246 42 238 42H12Q4 42 6 34Z" fill="#a0522d" ${S}/><path d="M50 26H200" stroke="#7a3d20" stroke-width="3" stroke-linecap="round"/>` +
    // 판
    `<rect x="16" y="38" width="218" height="104" rx="6" fill="#b07a4f" ${S}/>` +
    `<rect x="24" y="44" width="98" height="92" rx="3" fill="#d9b382"/>` +
    `<rect x="128" y="44" width="98" height="92" rx="3" fill="#e9d5b0"/>` +
    notes +
    // 출석 도장 판 머리
    `<rect x="140" y="52" width="74" height="16" rx="4" fill="#4caf50" stroke="${O}" stroke-width="1.5"/>` +
    `<text x="177" y="64" text-anchor="middle" font-size="11" fill="#fff" ${FONT}>출석 도장</text>` +
    stamps +
    // 아래 명패
    `<rect x="70" y="146" width="110" height="18" rx="5" fill="#f5e6c8" ${S}/>` +
    `<text x="125" y="159" text-anchor="middle" font-size="11" fill="${O}" ${FONT}>마을 게시판</text>`;
  return wrap(w, h, body);
}

// ===== 상점 =====
export const SHOP_SIZE = { width: 210, height: 180 };
export function shopSvg(): string {
  const { width: w, height: h } = SHOP_SIZE;
  let awning = "";
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * 20;
    awning += `<path d="M${x} 60H${x + 20}V82Q${x + 10} 92 ${x} 82Z" fill="${i % 2 ? "#fff" : "#e5484d"}" stroke="${O}" stroke-width="2"/>`;
  }
  const body =
    `<ellipse cx="105" cy="173" rx="90" ry="6" fill="#000" opacity=".15"/>` +
    // 건물
    `<rect x="20" y="40" width="170" height="130" rx="5" fill="#fff4dc" ${S}/>` +
    `<path d="M14 44L105 14L196 44Z" fill="#c0392b" ${S}/>` +
    // 간판
    `<rect x="62" y="24" width="86" height="28" rx="8" fill="#ffd36e" ${S}/>` +
    `<circle cx="80" cy="38" r="8" fill="#ffb31a" stroke="${O}" stroke-width="2"/><text x="80" y="42" text-anchor="middle" font-size="10" fill="${O}" ${FONT}>₩</text>` +
    `<text x="116" y="43" text-anchor="middle" font-size="15" fill="${O}" ${FONT}>상점</text>` +
    // 줄무늬 차양
    `<rect x="12" y="56" width="186" height="8" rx="3" fill="#a5282b" ${S}/>` + awning +
    // 진열창 + 진열품
    `<rect x="30" y="98" width="72" height="50" rx="4" fill="#cdeefe" ${S}/>` +
    `<path d="M30 132H102" stroke="#9cc9de" stroke-width="2"/>` +
    `<circle cx="46" cy="124" r="7" fill="#f6a24e" stroke="${O}" stroke-width="1.5"/><circle cx="66" cy="122" r="9" fill="#b79cff" stroke="${O}" stroke-width="1.5"/>` +
    `<rect x="80" y="115" width="14" height="16" rx="3" fill="#6cc070" stroke="${O}" stroke-width="1.5"/>` +
    `<path d="M38 104l10 10M58 102l14 14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>` +
    // 문
    `<rect x="120" y="96" width="50" height="74" rx="4" fill="#8d5a3b" ${S}/>` +
    `<rect x="128" y="104" width="34" height="28" rx="3" fill="#cdeefe" stroke="${O}" stroke-width="2"/>` +
    `<circle cx="163" cy="140" r="2.5" fill="#ffd36e" stroke="${O}" stroke-width="1"/>` +
    `<rect x="127" y="110" width="36" height="10" rx="2" fill="#fff" stroke="${O}" stroke-width="1"/>` +
    `<text x="145" y="118" text-anchor="middle" font-size="7" fill="#2f855a" ${FONT}>OPEN</text>` +
    // 바깥 나무 상자·통·화분
    `<rect x="4" y="146" width="26" height="24" rx="2" fill="#c08a52" ${S}/><path d="M4 158H30M17 146V170" stroke="#9c6b3f" stroke-width="2"/>` +
    `<ellipse cx="190" cy="156" rx="11" ry="15" fill="#a9733f" ${S}/><path d="M179 150H201M179 162H201" stroke="#6d4c2f" stroke-width="2"/>` +
    `<rect x="104" y="156" width="12" height="12" rx="2" fill="#d9774f" ${S}/><circle cx="110" cy="150" r="7" fill="#57bb5a" stroke="${O}" stroke-width="2"/>`;
  return wrap(w, h, body);
}

// ===== 캠프파이어 (광장 가운데) =====
// 돌 테두리 + 엇갈린 장작은 한 장(campfireSvg), 불꽃은 몇 장(flameSvg)을 번갈아 보여 줘서 일렁이게 한다
export const CAMPFIRE_SIZE = { width: 180, height: 150 };
export const FLAME_FRAMES = 3;

export function campfireSvg(): string {
  const cx = 90, cy = 116, rx = 64, ry = 22;
  let stones = "";
  const greys = ["#a3a8ad", "#8f959b", "#b5b9bd", "#9aa0a5"];
  // 뒤쪽 돌 먼저, 앞쪽 돌은 장작 뒤에 따로 그린다
  const ring = (front: boolean) => {
    let out = "";
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      const sw = 15 + (i % 3) * 2;
      out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${sw / 1.4}" ry="${(sw / 2.1).toFixed(1)}" fill="${greys[i % 4]}" ${S}/>` +
        `<ellipse cx="${(x - 3).toFixed(1)}" cy="${(y - 3).toFixed(1)}" rx="4" ry="2" fill="#fff" opacity=".35"/>`;
    }
    return out;
  };
  stones = ring(false);
  const log = (x1: number, y1: number, x2: number, y2: number, wdt = 14) => {
    const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const len = Math.hypot(x2 - x1, y2 - y1);
    return `<g transform="translate(${x1} ${y1}) rotate(${ang.toFixed(1)})">` +
      `<rect x="0" y="${-wdt / 2}" width="${len.toFixed(1)}" height="${wdt}" rx="${wdt / 2}" fill="#8a5a32" ${S}/>` +
      `<path d="M${wdt / 2} ${-wdt / 4}H${(len - wdt / 2).toFixed(1)}" stroke="#a8743f" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="${(len - 1).toFixed(1)}" cy="0" r="${wdt / 2}" fill="${LOG_END}" stroke="${O}" stroke-width="2"/>` +
      `<circle cx="${(len - 1).toFixed(1)}" cy="0" r="${wdt / 4}" fill="none" stroke="${LOG_RING}" stroke-width="1.3"/></g>`;
  };
  const body =
    `<ellipse cx="${cx}" cy="${cy + 6}" rx="${rx + 14}" ry="${ry + 9}" fill="#000" opacity=".14"/>` +
    stones +
    // 재와 숯불
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 8}" ry="${ry - 6}" fill="#4b3a33" stroke="${O}" stroke-width="2"/>` +
    `<ellipse cx="${cx}" cy="${cy + 1}" rx="${rx - 22}" ry="${ry - 11}" fill="#ff8a3d" opacity=".75"/>` +
    `<circle cx="${cx - 18}" cy="${cy + 2}" r="3" fill="#ffd36e"/><circle cx="${cx + 14}" cy="${cy + 4}" r="2.5" fill="#ffd36e"/><circle cx="${cx + 2}" cy="${cy - 2}" r="2" fill="#fff1b8"/>` +
    // 엇갈린 장작 (X자로 두 개, 세워 기댄 장작 두 개)
    log(cx - 46, cy + 10, cx + 40, cy - 8) +
    log(cx + 46, cy + 10, cx - 40, cy - 8) +
    log(cx - 30, cy + 2, cx - 4, cy - 40, 12) +
    log(cx + 30, cy + 2, cx + 4, cy - 40, 12) +
    ring(true);
  return wrap(CAMPFIRE_SIZE.width, CAMPFIRE_SIZE.height, body);
}

/** 불꽃 한 장 (frame 0~2). 캠프파이어와 같은 크기라 같은 자리에 겹쳐 놓는다 */
export function flameSvg(frame: number): string {
  const cx = 90, base = 112;
  // 프레임마다 혀 높이와 기울기를 조금씩 바꾼다
  const v = [
    { l: 54, m: 76, r: 50, lean: -4 },
    { l: 60, m: 70, r: 58, lean: 4 },
    { l: 50, m: 80, r: 54, lean: 0 },
  ][frame % 3];
  const tongue = (x: number, wdt: number, ht: number, lean: number, fill: string) =>
    `<path d="M${x - wdt} ${base}C${x - wdt - 4} ${base - ht * 0.45} ${x - wdt * 0.2 + lean} ${base - ht * 0.6} ${x + lean} ${base - ht}` +
    `C${x + wdt * 0.3 + lean} ${base - ht * 0.6} ${x + wdt + 4} ${base - ht * 0.45} ${x + wdt} ${base}Z" fill="${fill}"/>`;
  const body =
    `<g stroke="${O}" stroke-width="2.5" stroke-linejoin="round">` +
    tongue(cx - 18, 16, v.l, v.lean - 4, "#ff6a2b") +
    tongue(cx + 18, 16, v.r, v.lean + 4, "#ff6a2b") +
    tongue(cx, 24, v.m, v.lean, "#ff8a3d") +
    `</g>` +
    tongue(cx - 1, 15, v.m * 0.7, v.lean * 0.7, "#ffb547") +
    tongue(cx, 8, v.m * 0.42, v.lean * 0.4, "#fff1b8");
  return wrap(CAMPFIRE_SIZE.width, CAMPFIRE_SIZE.height, body);
}

/** 불가에 놓는 통나무 의자 */
export const BENCH_SIZE = { width: 90, height: 40 };
export function benchSvg(): string {
  return wrap(
    BENCH_SIZE.width,
    BENCH_SIZE.height,
    `<ellipse cx="45" cy="35" rx="40" ry="4" fill="#000" opacity=".15"/>` +
      `<rect x="16" y="22" width="10" height="13" rx="2" fill="#7d5232" ${S}/><rect x="64" y="22" width="10" height="13" rx="2" fill="#7d5232" ${S}/>` +
      `<rect x="6" y="8" width="78" height="17" rx="8.5" fill="#a96a36" ${S}/>` +
      `<path d="M14 13H74" stroke="${LOG_HI}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle cx="83" cy="16.5" r="8" fill="${LOG_END}" stroke="${O}" stroke-width="2"/><circle cx="83" cy="16.5" r="4" fill="none" stroke="${LOG_RING}" stroke-width="1.3"/>`,
  );
}

// ===== 나무·소품 =====
export const TREE_SIZE = { width: 80, height: 100 };
export function treeSvg(kind: "round" | "pine" | "bush" | "blossom"): string {
  const trunk = `<rect x="34" y="62" width="12" height="30" rx="3" fill="#8d6040" ${S}/>`;
  const shadow = `<ellipse cx="40" cy="94" rx="26" ry="5" fill="#000" opacity=".15"/>`;
  const body = {
    round:
      shadow + trunk +
      `<circle cx="40" cy="40" r="28" fill="#4caf50" ${S}/><circle cx="30" cy="34" r="10" fill="#66c26a"/><circle cx="50" cy="48" r="7" fill="#43a047"/>`,
    pine:
      shadow + trunk +
      `<path d="M40 2L60 30H52L68 52H58L74 76H6L22 52H12L28 30H20Z" fill="#2e7d4f" ${S}/>` +
      `<path d="M40 12L50 27M32 40L22 50M48 58L60 70" stroke="#3f9e66" stroke-width="3.5" stroke-linecap="round"/>`,
    bush:
      `<ellipse cx="40" cy="92" rx="30" ry="5" fill="#000" opacity=".15"/>` +
      `<path d="M10 90Q4 66 22 62Q26 46 42 50Q58 44 62 60Q78 64 70 90Z" fill="#5cb85c" ${S}/>` +
      `<circle cx="28" cy="70" r="3.5" fill="#e5484d"/><circle cx="48" cy="64" r="3.5" fill="#e5484d"/><circle cx="56" cy="78" r="3.5" fill="#e5484d"/>`,
    blossom:
      shadow + trunk +
      `<circle cx="40" cy="40" r="27" fill="#ffb7d0" ${S}/><circle cx="28" cy="32" r="9" fill="#ffd1e1"/><circle cx="52" cy="46" r="8" fill="#ff9ec3"/>`,
  }[kind];
  return wrap(TREE_SIZE.width, TREE_SIZE.height, body);
}

// 랜턴 기둥: 나무 기둥 + 팔에 매단 랜턴 (캠프 분위기, 예전 가로등 자리)
export const LAMP_SIZE = { width: 40, height: 110 };
export function lampSvg(): string {
  return wrap(
    LAMP_SIZE.width,
    LAMP_SIZE.height,
    `<ellipse cx="14" cy="106" rx="12" ry="3" fill="#000" opacity=".15"/>` +
      `<rect x="9" y="12" width="10" height="94" rx="3" fill="#8a5a32" ${S}/>` +
      `<path d="M12 22V96" stroke="#a8743f" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="9" y="12" width="26" height="7" rx="3" fill="#7d5232" ${S}/>` +
      `<path d="M30 19V27" stroke="${O}" stroke-width="2"/>` +
      `<circle cx="30" cy="42" r="13" fill="#ffd36e" opacity=".35"/>` +
      `<path d="M23 31H37L35 52H25Z" fill="#ffe08a" ${S}/>` +
      `<path d="M30 33V50" stroke="#c9862e" stroke-width="1.5"/>` +
      `<path d="M21 31H39L35 26H25Z" fill="#4a4036" ${S}/><rect x="23" y="52" width="14" height="4" rx="1.5" fill="#4a4036" ${S}/>`,
  );
}

// ===== 동물 농장: 울타리, 헛간, 간판, 울타리 안 동물 =====
export const FARM_SIZE = { width: 260, height: 170 };
export function farmSvg(): string {
  const { width: w, height: h } = FARM_SIZE;
  // 울타리 기둥 + 가로대 두 줄. 가운데 아래(문 자리)는 비운다
  const post = (x: number, y: number) => `<rect x="${x - 3.5}" y="${y - 20}" width="7" height="22" rx="2" fill="#c08a52" stroke="${O}" stroke-width="2"/>`;
  const rails = (x1: number, x2: number, y: number) =>
    `<rect x="${x1}" y="${y - 15}" width="${x2 - x1}" height="5" rx="2" fill="#d9a066" stroke="${O}" stroke-width="1.5"/>` +
    `<rect x="${x1}" y="${y - 7}" width="${x2 - x1}" height="5" rx="2" fill="#d9a066" stroke="${O}" stroke-width="1.5"/>`;
  let fence = rails(96, 248, 72);
  for (let x = 100; x <= 245; x += 24) fence += post(x, 72);
  let front = rails(12, 112, 160) + rails(148, 248, 160);
  for (const x of [16, 40, 64, 88, 112, 148, 172, 196, 220, 244]) front += post(x, 160);
  const side = (x: number) => rails(x - 2, x + 2, 120) + post(x, 96) + post(x, 120) + post(x, 144);
  const body =
    `<ellipse cx="130" cy="163" rx="124" ry="7" fill="#000" opacity=".15"/>` +
    // 울타리 안 땅 (풀 + 흙길)
    `<rect x="12" y="56" width="236" height="100" rx="10" fill="#b9dc86" ${S}/>` +
    `<path d="M120 156Q126 120 150 100T210 76" fill="none" stroke="#d9c08f" stroke-width="16" stroke-linecap="round"/>` +
    `<circle cx="60" cy="130" r="2" fill="#fff"/><circle cx="196" cy="128" r="2" fill="#ffd36e"/><circle cx="172" cy="140" r="2" fill="#ff9ecb"/>` +
    // 헛간 (왼쪽 뒤)
    `<rect x="18" y="38" width="76" height="66" rx="3" fill="#d9534f" ${S}/>` +
    `<path d="M12 42L56 8L100 42Z" fill="#8f3b2d" ${S}/>` +
    `<path d="M46 26h20v10h-20z" fill="#fff4dc" stroke="${O}" stroke-width="2"/>` +
    `<rect x="38" y="64" width="36" height="40" fill="#fff4dc" ${S}/><path d="M38 64L74 104M74 64L38 104" stroke="${O}" stroke-width="2.5"/>` +
    fence + side(12) + side(248) +
    // 건초 더미, 여물통
    `<rect x="104" y="80" width="30" height="20" rx="5" fill="#f0c75e" ${S}/><path d="M108 86h22M108 93h22" stroke="#c99a2e" stroke-width="2"/>` +
    `<path d="M196 112h36l-4 14h-28z" fill="#a9733f" ${S}/><path d="M199 116h30" stroke="#6cb4ee" stroke-width="3"/>` +
    front +
    // 울타리 안 동물 (병아리, 아기 돼지)
    `<circle cx="66" cy="128" r="7" fill="#ffd84d" stroke="${O}" stroke-width="1.5"/><path d="M71 128l4 1.5l-4 1.5z" fill="#f08a24"/><circle cx="68" cy="126" r="1" fill="${O}"/>` +
    `<ellipse cx="214" cy="136" rx="11" ry="8" fill="#ffc7d6" stroke="${O}" stroke-width="1.5"/><ellipse cx="223" cy="136" rx="3.5" ry="2.6" fill="#ff9fb8" stroke="${O}" stroke-width="1.2"/><circle cx="217" cy="132" r="1" fill="${O}"/>` +
    // 간판
    `<rect x="166" y="100" width="6" height="40" fill="#8d6040" ${S}/>` +
    `<rect x="128" y="74" width="82" height="34" rx="6" fill="#f5e6c8" ${S}/>` +
    `<text x="169" y="96" text-anchor="middle" font-size="14" fill="#2f7d32" ${FONT}>동물 농장</text>`;
  return wrap(w, h, body);
}

export function toDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
