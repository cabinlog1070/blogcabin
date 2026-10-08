// BlogCabin 캐릭터 (SVG). 외부 그림 없이 코드로 그려서 라이선스 걱정이 없다.
//
// 1) 주민(남자·여자)·방문자·마네킹: 2026-10-08 디자인 시안 그림체.
//    화면 72×72, viewBox 144×144 (2배 단위). 발바닥(그림자 가운데)은 y=134 → 아래 가운데 기준 0.93.
//    앞·뒤·옆(오른쪽을 본다) 모습과 걷기 2장을 그린다 (playerSvg). 광장 걷기 그림 목록은 character-views.ts.
// 2) 예전 캐릭터(고양이·강아지…): 상점에서 빠졌지만 가진 사람이 있을 수 있어 예전 그림 그대로 둔다.
//    viewBox 64×64(+여백), 발바닥 y=59 근처.
//
// 아바타 꾸미기(SHOP-06): "모습 키"는 캐릭터 키 뒤에 입은 꾸미기 키를 +로 붙인 문자열이다.
// 예) "char.boy+avatar.hat.straw+avatar.top.hoodie". 꾸미기 그림은 avatar.ts.
// 꾸미기는 남자·여자 주민(과 상점 미리보기용 마네킹)에만 입힌다. 상점에서 빠진 캐릭터를
// 장착한 동안에는 입은 상태가 저장돼 있어도 그리지 않는다 (spec 006 Edge Cases).

import { piecesInOrder, type AvatarPiece, type BottomArt, type HatArt, type ShoesArt, type TopArt } from "./avatar";
import { darken, lighten } from "./style";

// ═════════════════════════ 예전 캐릭터 (그대로) ═════════════════════════

const LEGACY_OUTLINE = "#3b2a20";
const LS = `stroke="${LEGACY_OUTLINE}" stroke-width="1.6" stroke-linejoin="round"`;

type Look = {
  body: string; // 몸 색
  head?: string; // 머리 색 (없으면 몸 색)
  belly?: string; // 배 색
  feet?: string; // 발 색
  arms?: string; // 팔 색
  behind?: string; // 몸 뒤에 그릴 것 (꼬리, 날개, 뒤쪽 귀)
  overHead?: string; // 머리 위에 그릴 것 (머리카락, 앞쪽 귀, 뿔)
  face?: string; // 눈 아래에 그릴 것 (무늬, 주둥이)
  extra?: string; // 맨 위에 그릴 것 (코, 수염, 소품)
  eyes?: string; // 눈 대신 그릴 것
  blush?: boolean;
};

const legacyEyes = (color = "#2b2118") =>
  `<ellipse cx="25.5" cy="27.5" rx="2.6" ry="3.2" fill="${color}"/><ellipse cx="38.5" cy="27.5" rx="2.6" ry="3.2" fill="${color}"/>` +
  `<circle cx="26.4" cy="26.3" r="1" fill="#fff"/><circle cx="39.4" cy="26.3" r="1" fill="#fff"/>`;
const blushes = `<ellipse cx="20.5" cy="32.8" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".55"/><ellipse cx="43.5" cy="32.8" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".55"/>`;
const smile = `<path d="M29.4 32.6q1.3 1.6 2.6 0q1.3 1.6 2.6 0" fill="none" stroke="${LEGACY_OUTLINE}" stroke-width="1.4" stroke-linecap="round"/>`;

function drawLegacy(l: Look) {
  const head = l.head ?? l.body;
  const feet = l.feet ?? l.body;
  const arms = l.arms ?? l.body;
  return [
    `<ellipse cx="32" cy="60.5" rx="14" ry="2.6" fill="#000" opacity=".14"/>`,
    l.behind ?? "",
    `<ellipse cx="25.5" cy="57" rx="4.6" ry="2.9" fill="${feet}" ${LS}/>`,
    `<ellipse cx="38.5" cy="57" rx="4.6" ry="2.9" fill="${feet}" ${LS}/>`,
    `<ellipse cx="32" cy="46.5" rx="12.5" ry="10.5" fill="${l.body}" ${LS}/>`,
    l.belly ? `<ellipse cx="32" cy="48.5" rx="7" ry="6.2" fill="${l.belly}"/>` : "",
    `<ellipse cx="20.2" cy="46" rx="3.2" ry="5" transform="rotate(25 20.2 46)" fill="${arms}" ${LS}/>`,
    `<ellipse cx="43.8" cy="46" rx="3.2" ry="5" transform="rotate(-25 43.8 46)" fill="${arms}" ${LS}/>`,
    `<circle cx="32" cy="27" r="16.5" fill="${head}" ${LS}/>`,
    l.face ?? "",
    l.eyes ?? legacyEyes(),
    l.blush === false ? "" : blushes,
    l.overHead ?? "",
    l.extra ?? smile,
  ].join("");
}

// 귀·꼬리처럼 몸 색에 외곽선이 있는 굵은 선
const thickLine = (d: string, color: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${LEGACY_OUTLINE}" stroke-width="${width + 3.2}" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;

const LEGACY: Record<string, Look> = {
  // 모험가: 갈색 머리, 빨간 스카프, 초록 튜닉
  "char.human": {
    body: "#4caf7a",
    head: "#ffdcbf",
    arms: "#ffdcbf",
    feet: "#8a5a35",
    overHead:
      `<path d="M15.6 27.5C14.8 15.5 22.6 9.6 32 9.6S49.2 15.5 48.4 27.5C45.5 21.2 40.6 18.6 34.8 19.6C30.4 17 23 18.8 15.6 27.5Z" fill="#7a4b2a" ${LS}/>` +
      `<path d="M31 10.2c2-4 6-4.6 7.6-3.2c-2.6.4-4.4 1.8-5 3.6" fill="#7a4b2a" ${LS}/>`,
    extra:
      smile +
      `<path d="M21 40.5q11 5 22 0l1.5 3.2q-12.5 5.6-25 0z" fill="#e85d4a" ${LS}/>` +
      `<path d="M38.5 43.5l3.5 6.5l3-1.2l-2.6-6.4" fill="#e85d4a" ${LS}/>`,
  },
  // 고양이: 주황 줄무늬, 세모 귀, 수염, 말린 꼬리
  "char.cat": {
    body: "#f6a24e",
    belly: "#fde3c4",
    behind: thickLine("M43 52c11 3 14-7 9.5-12", "#f6a24e", 4.2),
    overHead:
      `<path d="M16.5 21L18.5 6.5L28.5 13.5Z" fill="#f6a24e" ${LS}/><path d="M19 17.5l.9-6.8l4.6 3.4z" fill="#ffb3c1"/>` +
      `<path d="M47.5 21L45.5 6.5L35.5 13.5Z" fill="#f6a24e" ${LS}/><path d="M45 17.5l-.9-6.8l-4.6 3.4z" fill="#ffb3c1"/>` +
      `<path d="M29 12.5l1.2 4M32 11.8v4.4M35 12.5l-1.2 4" stroke="#d9781f" stroke-width="1.8" stroke-linecap="round"/>`,
    extra:
      `<path d="M30.6 30.6h2.8l-1.4 1.6z" fill="#ff8fa3" stroke="${LEGACY_OUTLINE}" stroke-width=".8"/>` +
      `<path d="M30 33.2q1 1.2 2 0q1 1.2 2 0" fill="none" stroke="${LEGACY_OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M14 30.5l6 1M14.5 34l5.6-.6M50 30.5l-6 1M49.5 34l-5.6-.6" stroke="${LEGACY_OUTLINE}" stroke-width="1" stroke-linecap="round"/>`,
  },
  // 강아지: 크림색, 늘어진 갈색 귀, 눈가 얼룩, 내민 혀
  "char.dog": {
    body: "#f1d3a1",
    belly: "#fff3dd",
    behind: thickLine("M43.5 47c6-2 8.5-6.5 8-10", "#f1d3a1", 3.6),
    face: `<ellipse cx="38.8" cy="27.2" rx="5.2" ry="5.6" fill="#c98c55"/>`,
    overHead:
      `<ellipse cx="17" cy="26" rx="5" ry="10" transform="rotate(18 17 26)" fill="#a8683b" ${LS}/>` +
      `<ellipse cx="47" cy="26" rx="5" ry="10" transform="rotate(-18 47 26)" fill="#a8683b" ${LS}/>`,
    extra:
      `<ellipse cx="32" cy="30.8" rx="2.5" ry="1.8" fill="${LEGACY_OUTLINE}"/>` +
      `<path d="M29.4 33q1.3 1.3 2.6 0q1.3 1.3 2.6 0" fill="none" stroke="${LEGACY_OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M31 34.4h3v1.8a1.5 1.5 0 0 1-3 0z" fill="#ff7b8a" stroke="${LEGACY_OUTLINE}" stroke-width=".8"/>`,
  },
  // 토끼: 하얀 털, 긴 귀, 분홍 코, 앞니
  "char.rabbit": {
    body: "#fbf7f2",
    belly: "#ffffff",
    behind: `<circle cx="44" cy="52" r="3.6" fill="#ffffff" ${LS}/>`,
    overHead:
      `<ellipse cx="25" cy="7.5" rx="4.6" ry="11.5" transform="rotate(-8 25 7.5)" fill="#fbf7f2" ${LS}/>` +
      `<ellipse cx="25" cy="8.5" rx="2" ry="8" transform="rotate(-8 25 8.5)" fill="#ffc2cf"/>` +
      `<ellipse cx="39" cy="7.5" rx="4.6" ry="11.5" transform="rotate(8 39 7.5)" fill="#fbf7f2" ${LS}/>` +
      `<ellipse cx="39" cy="8.5" rx="2" ry="8" transform="rotate(8 39 8.5)" fill="#ffc2cf"/>`,
    extra:
      `<ellipse cx="32" cy="31" rx="1.8" ry="1.3" fill="#ff8fa3"/>` +
      `<path d="M29.6 32.6q1.2 1.4 2.4 0q1.2 1.4 2.4 0" fill="none" stroke="${LEGACY_OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<rect x="30.6" y="33.3" width="2.8" height="2.6" rx=".6" fill="#fff" stroke="${LEGACY_OUTLINE}" stroke-width=".8"/>`,
  },
  // 여우: 주황 털, 흰 주둥이, 검은 귀 끝, 풍성한 꼬리
  "char.fox": {
    body: "#ef7a35",
    belly: "#fff5ea",
    feet: "#4a3326",
    behind:
      `<path d="M42 51c10 4 18-1 17-11c-1-4-4-6-6-5c1 7-4 12-12 12z" fill="#ef7a35" ${LS}/>` +
      `<path d="M53 35c1.6 2.6 1.3 6-.6 8.6c3-.6 5.6-3.2 5.4-6.6c-.2-1.8-1.8-2.8-4.8-2z" fill="#fff5ea"/>`,
    face: `<path d="M17 30c4 8 26 8 30 0c-2 9-8 12-15 12s-13-3-15-12z" fill="#fff5ea"/>`,
    overHead:
      `<path d="M16 20L16.5 5L28 12.5Z" fill="#ef7a35" ${LS}/><path d="M16.3 11L16.5 5l4.6 3z" fill="${LEGACY_OUTLINE}"/>` +
      `<path d="M48 20L47.5 5L36 12.5Z" fill="#ef7a35" ${LS}/><path d="M47.7 11L47.5 5l-4.6 3z" fill="${LEGACY_OUTLINE}"/>`,
    extra:
      `<ellipse cx="32" cy="31" rx="2.2" ry="1.6" fill="${LEGACY_OUTLINE}"/>` +
      `<path d="M29.6 33.2q1.2 1.4 2.4 0q1.2 1.4 2.4 0" fill="none" stroke="${LEGACY_OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>`,
  },
  // 판다: 흰 몸, 검은 귀·눈 무늬·팔다리
  "char.panda": {
    body: "#fbfbf8",
    arms: "#2f2a2a",
    feet: "#2f2a2a",
    face:
      `<ellipse cx="25" cy="27.5" rx="5" ry="5.8" transform="rotate(20 25 27.5)" fill="#2f2a2a"/>` +
      `<ellipse cx="39" cy="27.5" rx="5" ry="5.8" transform="rotate(-20 39 27.5)" fill="#2f2a2a"/>`,
    eyes:
      `<ellipse cx="25.6" cy="27.6" rx="1.9" ry="2.3" fill="#fff"/><ellipse cx="38.4" cy="27.6" rx="1.9" ry="2.3" fill="#fff"/>` +
      `<circle cx="25.8" cy="27.8" r="1.1" fill="#2b2118"/><circle cx="38.6" cy="27.8" r="1.1" fill="#2b2118"/>`,
    overHead: `<circle cx="18.5" cy="13" r="5.5" fill="#2f2a2a" ${LS}/><circle cx="45.5" cy="13" r="5.5" fill="#2f2a2a" ${LS}/>`,
    extra: `<ellipse cx="32" cy="31.4" rx="2.2" ry="1.5" fill="#2f2a2a"/>` + smile.replace("32.6", "33.4"),
  },
  // 로봇: 둥근 네모 머리, 화면 얼굴, 안테나
  "char.robot": {
    body: "#9db4c8",
    belly: "#c7d6e3",
    head: "#b8c9d9",
    arms: "#8aa2b8",
    feet: "#6f879d",
    blush: false,
    eyes:
      `<rect x="20" y="18.5" width="24" height="16" rx="5" fill="#23324a"/>` +
      `<rect x="24" y="22.5" width="4" height="5.6" rx="2" fill="#6ff3ff"/><rect x="36" y="22.5" width="4" height="5.6" rx="2" fill="#6ff3ff"/>` +
      `<path d="M28.5 30.6q3.5 2.4 7 0" fill="none" stroke="#6ff3ff" stroke-width="1.5" stroke-linecap="round"/>`,
    overHead:
      `<path d="M32 10.5V4.5" stroke="${LEGACY_OUTLINE}" stroke-width="1.6"/><circle cx="32" cy="3.6" r="2.6" fill="#ff5d5d" ${LS}/>` +
      `<circle cx="16.6" cy="27" r="2.2" fill="#8aa2b8" ${LS}/><circle cx="47.4" cy="27" r="2.2" fill="#8aa2b8" ${LS}/>` +
      `<circle cx="27" cy="45" r="1" fill="#6f879d"/><circle cx="37" cy="45" r="1" fill="#6f879d"/>`,
    extra: `<ellipse cx="20" cy="36" rx="2.6" ry="1.4" fill="#ff8fa3" opacity=".45"/><ellipse cx="44" cy="36" rx="2.6" ry="1.4" fill="#ff8fa3" opacity=".45"/>`,
  },
  // 드래곤: 초록 몸, 크림색 배·뿔, 작은 날개, 등 가시
  "char.dragon": {
    body: "#6cc070",
    belly: "#f3e7b0",
    behind:
      `<path d="M22 40c-9-8-15-4-14 3c4-2 7 0 9 3c1-3 3-5 5-6z" fill="#4f9a55" ${LS}/>` +
      `<path d="M42 40c9-8 15-4 14 3c-4-2-7 0-9 3c-1-3-3-5-5-6z" fill="#4f9a55" ${LS}/>` +
      thickLine("M43 53c7 2 11-1 12-5", "#6cc070", 4) +
      `<path d="M54 46.5l4.5-2l-1 5z" fill="#f3e7b0" ${LS}/>`,
    overHead:
      `<path d="M21 14c-3-5-2-9 1-10c0 3 1.5 5 4.5 6.5" fill="#f3e7b0" ${LS}/>` +
      `<path d="M43 14c3-5 2-9-1-10c0 3-1.5 5-4.5 6.5" fill="#f3e7b0" ${LS}/>` +
      `<path d="M28.5 11.2l3.5-5l3.5 5z" fill="#4f9a55" ${LS}/>`,
    extra:
      `<circle cx="29.8" cy="31.2" r=".8" fill="${LEGACY_OUTLINE}"/><circle cx="34.2" cy="31.2" r=".8" fill="${LEGACY_OUTLINE}"/>` +
      `<path d="M29 33.4q3 2.2 6 0" fill="none" stroke="${LEGACY_OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>`,
  },
  // 유니콘: 하얀 몸, 무지개 갈기, 금색 뿔
  "char.unicorn": {
    body: "#fffaff",
    feet: "#d9c2ff",
    behind: thickLine("M43 52c6 3 10 0 10.5-5", "#ff9ecb", 4),
    overHead:
      `<circle cx="18" cy="17" r="5" fill="#ff9ecb" ${LS}/><circle cx="15.5" cy="25" r="4.6" fill="#b79cff" ${LS}/>` +
      `<circle cx="16.5" cy="32.5" r="4" fill="#8fd3ff" ${LS}/><circle cx="25" cy="12" r="4.6" fill="#ffd36e" ${LS}/>` +
      `<path d="M29 11.5L32 -1L35 11.5Z" fill="#ffd36e" ${LS}/>` +
      `<path d="M30.2 7.5l3.6-1.2M30.8 4.5l2.4-.8" stroke="#e0a72c" stroke-width="1.1" stroke-linecap="round"/>` +
      `<path d="M17 14l-3-6l5.5 3" fill="#fffaff" ${LS}/>`,
    extra: smile,
  },
};

const LEGACY_FALLBACK: Look = { body: "#cfc4b8" };

// ═════════════════════════ 새 그림체 주민 ═════════════════════════

/** 상점 미리보기용 마네킹 (꾸미기 아이템 카드) */
export const MANNEQUIN = "char.mannequin";
/** 로그인하지 않은 방문자용 (광장 구경) */
export const VISITOR_CHARACTER = "char.visitor";

export type CharView = "front" | "back" | "side";
export type WalkFrame = 0 | 1 | 2;
export type BodyKind = "girl" | "boy" | "mannequin" | "visitor";

const KIND_BY_ASSET: Record<string, BodyKind> = {
  "char.girl": "girl",
  "char.boy": "boy",
  [MANNEQUIN]: "mannequin",
  [VISITOR_CHARACTER]: "visitor",
};

/** 꾸미기를 입을 수 있는 캐릭터 */
const WEARABLE = new Set(["char.boy", "char.girl", MANNEQUIN]);

const GROUND = 134; // 신발 바닥
const SIL = 2; // 실루엣 선 굵기
const INL = 1.1; // 안쪽 선 굵기

export type Tone = { b: string; s: string; h: string };
export type Pt = [number, number, number?];

/** 그림 한 장의 색 (b = 바탕, s = 그늘, h = 밝은 쪽). 방문자·마네킹은 색만 바꿔 같은 몸을 쓴다 */
export type Palette = {
  ol: string; // 피부·밝은 옷 외곽선
  olh: string; // 머리카락·짙은 옷 외곽선
  skin: Tone; hair: Tone; pink: Tone; blouse: Tone; navy: Tone; red: Tone;
  green: Tone; shirt: Tone; pants: Tone; sock: Tone; shoe: Tone;
  shine: string; eye: string; cheek: string; mouth: string;
};

const BASE: Palette = {
  ol: "#9c5a4a",
  olh: "#74402f",
  skin: { b: "#fde6d3", s: "#f3c6aa", h: "#fff7ef" },
  hair: { b: "#9a5a45", s: "#774232", h: "#b8775c" },
  pink: { b: "#f7a8b8", s: "#e3869c", h: "#fdd2db" },
  blouse: { b: "#fffaf2", s: "#ead9cc", h: "#ffffff" },
  navy: { b: "#3f4a86", s: "#2d3564", h: "#6874b2" },
  red: { b: "#dc5a4f", s: "#b8433a", h: "#f2877b" },
  green: { b: "#6fa55f", s: "#4f8646", h: "#9acb85" },
  shirt: { b: "#f6f2dc", s: "#ded4b4", h: "#ffffff" },
  pants: { b: "#3b5594", s: "#2c4074", h: "#5f7cbb" },
  sock: { b: "#fffaf1", s: "#e6dccb", h: "#ffffff" },
  shoe: { b: "#8e5734", s: "#6b3e22", h: "#b67e50" },
  shine: "#d29478", // 머리 윤기 (장밋빛 황갈색)
  eye: "#4a2a20",
  cheek: "#f4958c",
  mouth: "#e0727c",
};

// 방문자: 회색 톤의 동네 주민 (남자 주민 몸)
const VISITOR_PAL: Palette = {
  ...BASE,
  ol: "#8f8279",
  olh: "#6b5f57",
  skin: { b: "#f1ebe4", s: "#ddd2c7", h: "#fbf8f4" },
  hair: { b: "#a39a90", s: "#82796f", h: "#c0b8ae" },
  green: { b: "#b3ada5", s: "#958f87", h: "#cfcac3" },
  shirt: { b: "#f4f1ec", s: "#dcd6cd", h: "#ffffff" },
  pants: { b: "#7d7872", s: "#625e59", h: "#9c9790" },
  sock: { b: "#faf8f5", s: "#e2ddd6", h: "#ffffff" },
  shoe: { b: "#857a70", s: "#685f57", h: "#a59b91" },
  shine: "#c4bbb1",
  eye: "#4a403a",
  cheek: "#e3b3a9",
  mouth: "#c4948e",
};

// 마네킹: 머리카락 없는 베이지색 몸 (꾸미기 아이템을 입혀 보여주는 용도)
const MANNEQUIN_PAL: Palette = {
  ...BASE,
  ol: "#a8896f",
  olh: "#8a6c55",
  skin: { b: "#f3e8da", s: "#e0cfba", h: "#fcf7f0" },
  eye: "#6b5442",
};

// ───────── 작은 도우미 ─────────
const f = (n: number) => +(+n).toFixed(2);
const rad = (d: number) => (d * Math.PI) / 180;

/** 점 목록을 부드러운 곡선(캐트멀-롬)으로. 점 [x, y, k] 의 k(0~1)는 뾰족함: 1 = 꼭짓점, 0.5 = 반쯤 둥근 끝 */
function sp(pts: Pt[], closed = true): string {
  const n = pts.length;
  const P = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const tan = (i: number) => {
    const p = P(i);
    const k = 1 - Math.min(1, p[2] || 0);
    const a = P(i - 1), b = P(i + 1);
    return [((b[0] - a[0]) / 6) * k, ((b[1] - a[1]) / 6) * k];
  };
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i), p1 = P(i + 1), t0 = tan(i), t1 = tan(i + 1);
    d += ` C ${f(p0[0] + t0[0])} ${f(p0[1] + t0[1])} ${f(p1[0] - t1[0])} ${f(p1[1] - t1[1])} ${f(p1[0])} ${f(p1[1])}`;
  }
  return d + (closed ? " Z" : "");
}
/** 좌우 뒤집기 (가운데 x = 72) */
const mir = (pts: Pt[], cx = 72): Pt[] => pts.map((p): Pt => [2 * cx - p[0], p[1], p[2]]);
/** 살짝 비틀기 — 좌우가 똑같지 않게 */
const wob = (pts: Pt[], amt = 0.6, seed = 3): Pt[] => {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 2 * amt;
  return pts.map((p): Pt => [p[0] + r(), p[1] + r(), p[2]]);
};
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${f(cx - rx)} ${f(cy)} A ${rx} ${ry} 0 1 0 ${f(cx + rx)} ${f(cy)} A ${rx} ${ry} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;

/** 두 점을 잇는 캡슐(팔·다리). r1 = 시작 반지름, r2 = 끝 반지름(손은 조금 더 크게) */
function capsule(x1: number, y1: number, x2: number, y2: number, r1: number, r2 = r1): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const nx = -Math.sin(a), ny = Math.cos(a);
  const p1 = [x1 + nx * r1, y1 + ny * r1], p2 = [x2 + nx * r2, y2 + ny * r2];
  const p3 = [x2 - nx * r2, y2 - ny * r2], p4 = [x1 - nx * r1, y1 - ny * r1];
  return `M ${f(p1[0])} ${f(p1[1])} L ${f(p2[0])} ${f(p2[1])} A ${r2} ${r2} 0 0 0 ${f(p3[0])} ${f(p3[1])} L ${f(p4[0])} ${f(p4[1])} A ${r1} ${r1} 0 0 0 ${f(p1[0])} ${f(p1[1])} Z`;
}

type ShagOpts = { cx: number; cy: number; rx: number; ry: number; a0: number; a1: number; n: number; out?: number; inn?: number; pw?: number; seed?: number; sweep?: number; tip?: number };
/**
 * 덥수룩한 머리 윤곽: 납작한 타원(위가 판판함) 둘레에 끝이 살짝 뾰족한 머리 뭉치를 크기 제각각으로 늘어놓는다.
 * 뭉치 끝은 정수리에서 멀어지는 쪽(옆은 아래, 위는 바깥)으로 기운다. a0→a1 은 화면 각도(270 = 위).
 */
function shag({ cx, cy, rx, ry, a0, a1, n, out = 2.4, inn = 1.3, pw = 2.6, seed = 1, sweep = 1.6, tip = 0.72 }: ShagOpts): Pt[] {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const e = 2 / pw, pts: Pt[] = [];
  for (let i = 0; i <= 2 * n; i++) {
    const isTip = i % 2 === 0;
    const jit = isTip ? (rnd() - 0.5) * 0.5 : 0;
    const tdeg = a0 + ((a1 - a0) * (i + jit)) / (2 * n);
    const t = rad(tdeg), c = Math.cos(t), si = Math.sin(t);
    const bx = cx + rx * Math.sign(c) * Math.abs(c) ** e, by = cy + ry * Math.sign(si) * Math.abs(si) ** e;
    let nx = (bx - cx) / rx, ny = (by - cy) / ry;
    const L = Math.hypot(nx, ny) || 1;
    nx /= L; ny /= L;
    if (!isTip) { pts.push([bx - nx * inn, by - ny * inn]); continue; }
    const k = out * (0.55 + rnd() * 0.9);
    const deg = ((tdeg % 360) + 360) % 360;
    const side = deg < 270 && deg > 90 ? -1 : 1;
    const lx = side * -si, ly = side * c; // 정수리에서 멀어지는 접선
    pts.push([bx + nx * k + lx * sweep, by + ny * k + ly * sweep, tip]);
  }
  return pts;
}

/**
 * 같은 문자열이면 같은 값 (filter·clipPath id 접두사).
 * 서버와 브라우저가 똑같은 SVG를 만들어야 클라이언트 컴포넌트(꾸미기·상점)의 하이드레이션이 어긋나지 않는다.
 * 그림마다 키(모습 키·모습·장면)가 달라 id도 달라진다.
 */
function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

type FilterName = "blur" | "soft" | "tiny" | "cheek";
export type ShapeOpts = { ol?: string; sw?: number; inner?: string; dx?: number; dy?: number; rim?: number; rimOp?: number };

/**
 * 그림 도구 상자. 꾸미기 그림(avatar.ts)도 이걸 받아서 같은 붓으로 그린다.
 */
export type Kit = {
  P: Palette;
  /** 채운 모양: 그늘색 바탕 + 왼쪽 위로 민 바탕색(흐림) + 밝은 테. inner 는 모양 안쪽에 잘려 들어간다 */
  shape(d: string, t: Tone, o?: ShapeOpts): string;
  /** 안쪽 선 (깃·밑단·주름) */
  line(d: string, color?: string, w?: number, op?: number): string;
  /** 흐린 덩어리 (명암 보조) */
  blob(cx: number, cy: number, rx: number, ry: number, color: string, op?: number, filter?: FilterName): string;
  /** filter="…" 에 넣을 값 */
  filter(name: FilterName): string;
  sp: typeof sp;
  mir: typeof mir;
  ell: typeof ell;
  capsule: typeof capsule;
  f: typeof f;
  /** 바탕색 하나로 b·s·h 만들기 */
  tone(b: string, s?: string, h?: string): Tone;
  /** 몸 뒤쪽(먼 쪽) 팔다리에 쓰는 어두운 톤 */
  far(t: Tone, amt?: number): Tone;
};

function mkKit(key: string, P: Palette): { k: Kit; defs: string[] } {
  const defs: string[] = [];
  const pre = `c${hashKey(key)}`;
  let n = 0;
  const next = (p: string) => `${pre}${p}${(n++).toString(36)}`;
  const id: Record<FilterName, string> = { blur: next("B"), soft: next("S"), tiny: next("T"), cheek: next("K") };
  const filt = (i: string, sd: number) =>
    `<filter id="${i}" filterUnits="userSpaceOnUse" x="-20" y="-20" width="184" height="184"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
  defs.push(filt(id.blur, 1.8), filt(id.soft, 0.9), filt(id.tiny, 0.45), filt(id.cheek, 1.3));
  const clip = (d: string) => {
    const c = next("c");
    defs.push(`<clipPath id="${c}"><path d="${d}"/></clipPath>`);
    return c;
  };
  const k: Kit = {
    P, sp, mir, ell, capsule, f,
    filter: (name) => `url(#${id[name]})`,
    shape(d, t, o = {}) {
      const { ol = P.ol, sw = SIL, inner = "", dx = -2.8, dy = -3.2, rim = 1.5, rimOp = 0.8 } = o;
      let s = `<path d="${d}" fill="${t.s}"/><g clip-path="url(#${clip(d)})">`;
      s += `<path d="${d}" fill="${t.b}" transform="translate(${dx} ${dy})" filter="url(#${id.blur})"/>`;
      if (rim) s += `<path d="${d}" fill="none" stroke="${t.h}" stroke-width="${f(rim * 1.9)}" transform="translate(${rim} ${rim})" filter="url(#${id.soft})" opacity="${rimOp}"/>`;
      s += inner + "</g>";
      if (sw) s += `<path d="${d}" fill="none" stroke="${ol}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
      return s;
    },
    line(d, color = P.ol, w = INL, op = 1) {
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
    },
    blob(cx, cy, rx, ry, color, op = 0.5, filter = "blur") {
      return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${color}" opacity="${op}" filter="url(#${id[filter]})"/>`;
    },
    tone: (b, s, h) => ({ b, s: s ?? darken(b, 0.16), h: h ?? lighten(b, 0.4) }),
    far: (t, amt = 0.15) => ({ b: t.s, s: darken(t.s, amt), h: t.b }),
  };
  return { k, defs };
}

/** 모자를 씌울 머리 자리: cx = 가운데, top = 머리 꼭대기, rimY = 이마 위 모자 테 높이, hw = 테 높이의 머리 반폭 */
export type HeadBox = { cx: number; top: number; rimY: number; hw: number };

/** 꾸미기 그림이 받는 자세 정보 */
export type Pose = {
  kind: BodyKind;
  view: CharView;
  frame: WalkFrame;
  back: boolean; // 뒷모습
  liftL: number; // 앞·뒤 모습에서 든 발 높이 (걷기)
  liftR: number;
  head: HeadBox;
};

/** 팔(아래팔+손) 캡슐 좌표. 회전은 바깥 <g>가 한다 — 긴 소매는 이 좌표로 그린다 */
export type ArmGeom = { px: number; py: number; hx: number; hy: number; side: -1 | 1; far?: boolean };

/** 옆모습 다리 하나: 엉덩이(hx, hy) → 발목(ax, ay), 신발 바닥 by */
export type SideLeg = { hx: number; hy: number; ax: number; ay: number; by: number; far: boolean };

type Outfit = { top?: TopArt; bottom?: BottomArt; shoes?: ShoesArt; hat?: HatArt };

function outfitOf(pieces: AvatarPiece[]): Outfit {
  const o: Outfit = {};
  for (const p of pieces) {
    if (p.slot === "top") o.top = p;
    else if (p.slot === "bottom") o.bottom = p;
    else if (p.slot === "shoes") o.shoes = p;
    else o.hat = p;
  }
  return o;
}

const BOY_HEADS: Record<CharView, HeadBox> = {
  front: { cx: 72, top: 10, rimY: 38, hw: 37 },
  back: { cx: 72, top: 10, rimY: 38, hw: 37 },
  side: { cx: 69.4, top: 10.5, rimY: 38, hw: 36 },
};
const HEADS: Record<BodyKind, Record<CharView, HeadBox>> = {
  girl: {
    front: { cx: 72, top: 13, rimY: 37, hw: 31.5 },
    back: { cx: 72, top: 12, rimY: 38, hw: 33.5 },
    side: { cx: 68.6, top: 12.6, rimY: 37, hw: 31 },
  },
  boy: BOY_HEADS,
  visitor: BOY_HEADS,
  mannequin: {
    front: { cx: 72, top: 29, rimY: 45, hw: 27.5 },
    back: { cx: 72, top: 29, rimY: 45, hw: 27.5 },
    side: { cx: 72, top: 29, rimY: 45, hw: 27 },
  },
};

/** 바닥 그림자: 머리보다 조금 넓은 따뜻한 베이지 타원 */
const shadow = (k: Kit, cx = 72, rx = 32) =>
  `<ellipse cx="${cx}" cy="${GROUND}" rx="${rx}" ry="7" fill="#d8bf9a" opacity=".6" filter="${k.filter("tiny")}"/>`;

// ───────── 머리카락 질감 ─────────

/** 왕관처럼 둥글게 늘어선 윤기 붓자국 + 흩어진 몇 개 */
function shine(k: Kit, x0: number, y0: number, qx: number, qy: number, x1: number, y1: number, seed = 5, extra: [number, number, number][] = []) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const at = (t: number) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * qx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * qy + t * t * y1];
  let out = "";
  const ts = [0.04, 0.19, 0.33, 0.5, 0.63, 0.79, 0.95];
  for (const t0 of ts) {
    const t = t0 + (rnd() - 0.5) * 0.06;
    const [x, y] = at(t), [x2, y2] = at(t + 0.01);
    const ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
    const rx = 1.3 + rnd() * 1.6, ry = 0.95 + rnd() * 0.7;
    out += `<ellipse cx="${f(x)}" cy="${f(y + (rnd() - 0.5) * 1.6)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(ang)} ${f(x)} ${f(y)})" fill="${k.P.shine}" opacity="${f(0.55 + rnd() * 0.15)}"/>`;
  }
  for (const [x, y, r] of extra) out += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.7)}" fill="${k.P.shine}" opacity=".5"/>`;
  return `<g filter="${k.filter("tiny")}">${out}</g>`;
}

/** 머리 뭉치를 나누는 짧은 곡선들 (짙은 색) */
const clumps = (k: Kit, list: string[], op = 0.75, w = 1.25) => list.map((d) => k.line(d, k.P.hair.s, w, op)).join("");
/** 머리 뭉치의 밝은 결 */
const glints = (k: Kit, list: string[], op = 0.55) => list.map((d) => k.line(d, k.P.hair.h, 1.4, op)).join("");

/** 경로 문자열의 x 를 좌우 뒤집기 (M/Q 숫자 쌍만 쓰는 짧은 선용) */
function mirD(d: string, cx = 72): string {
  let i = 0;
  return d.replace(/-?[\d.]+/g, (num) => String(i++ % 2 === 0 ? f(2 * cx - +num) : num));
}

// ───────── 얼굴 ─────────

const FACE = { cx: 72, cy: 59.5, rx: 24.5, ry: 21 };

function faceFront(k: Kit) {
  const { cx, cy, rx, ry } = FACE;
  const T = k.P;
  return k.shape(ell(cx, cy, rx, ry), T.skin, {
    dx: -2.2, dy: -2.6,
    inner: k.blob(cx, cy - 7.5, 27, 5.5, T.skin.s, 0.85) + k.blob(cx + 23, cy + 8, 5, 14, T.skin.s, 0.3),
  });
}

function eyes(k: Kit, xs: number[], y: number) {
  return xs.map((x) =>
    `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="5.2" fill="${k.P.eye}"/><circle cx="${f(x - 1.1)}" cy="${f(y - 2.3)}" r=".9" fill="#fff"/>`).join("");
}
const cheeks = (k: Kit, pts: [number, number][]) =>
  pts.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.5" fill="${k.P.cheek}" opacity=".55" filter="${k.filter("cheek")}"/>`).join("");
const mouth = (k: Kit, x: number, y: number, w = 1.6) =>
  `<path d="M ${f(x - w)} ${y} Q ${x} ${f(y + 1.9)} ${f(x + w)} ${y}" fill="none" stroke="${k.P.mouth}" stroke-width="1.3" stroke-linecap="round"/>`;

function ear(k: Kit, x: number, y: number, flip = 1, r = 5) {
  return k.shape(ell(x, y, r * 0.92, r), k.P.skin, {
    sw: 1.7, dx: -1.2, dy: -1.2, rim: 0,
    inner: k.line(`M ${f(x + 0.6 * flip)} ${f(y - 2.2)} Q ${f(x - 1.6 * flip)} ${f(y + 0.2)} ${f(x + 0.4 * flip)} ${f(y + 2.4)}`, k.P.skin.s, 1.3, 0.85),
  });
}

/** 옆(오른쪽) 얼굴 — 3/4 로 살짝 돌아 볼이 둥글게 보인다 */
const FACE_S: Pt[] = [[59.6, 47], [74, 39.8], [91, 40.6], [98.4, 49.4], [100.8, 60.4], [100, 69.6], [95.8, 76.6], [87, 80.4], [76, 80.2], [66.6, 76.4], [60.6, 68.4], [58.4, 57.6]];
function faceSide(k: Kit) {
  const T = k.P;
  return k.shape(sp(FACE_S), T.skin, {
    dx: 2.2, dy: -2.6,
    inner: k.blob(80, 52, 24, 5, T.skin.s, 0.85) + k.blob(63, 66, 7, 13, T.skin.s, 0.5),
  }) + eyes(k, [89.6], 62.6) + cheeks(k, [[88.4, 70.8]]) + mouth(k, 95.4, 72.4, 1.2);
}

// ───────── 다리·신발 ─────────

/** 앞/뒤에서 본 메리제인 구두 (빨간 끈) */
function maryJane(k: Kit, x: number, by: number, back = false) {
  const T = k.P;
  const d = sp([[x - 7.2, by, 1], [x + 7.2, by, 1], [x + 6.8, by - 4.6], [x + 2.8, by - 7.8], [x - 2.8, by - 7.8], [x - 6.8, by - 4.6]]);
  const strap = back
    ? `M ${f(x - 5.8)} ${f(by - 6.2)} Q ${x} ${f(by - 8.4)} ${f(x + 5.8)} ${f(by - 6.2)}`
    : `M ${f(x - 6.4)} ${f(by - 4.4)} Q ${x} ${f(by - 7.6)} ${f(x + 6.4)} ${f(by - 4.4)}`;
  return k.shape(d, T.navy, {
    ol: T.olh, dx: -2, dy: -2.4,
    inner: k.line(strap, T.red.b, 2.2) + (back ? "" : `<circle cx="${f(x + 3.4)}" cy="${f(by - 5.4)}" r=".9" fill="${T.red.h}"/>`) +
      k.line(`M ${f(x - 6.6)} ${f(by - 1.1)} L ${f(x + 6.6)} ${f(by - 1.1)}`, T.navy.s, 1.6, 0.9),
  });
}
/** 앞/뒤에서 본 갈색 운동화 */
function sneaker(k: Kit, x: number, by: number) {
  const T = k.P;
  const d = sp([[x - 7.3, by, 1], [x + 7.3, by, 1], [x + 6.9, by - 3.8], [x + 3, by - 6.8], [x - 3, by - 6.8], [x - 6.9, by - 3.8]]);
  return k.shape(d, T.shoe, {
    ol: T.olh, dx: -2, dy: -2.2,
    inner: k.line(`M ${f(x - 6.6)} ${f(by - 1.2)} L ${f(x + 6.6)} ${f(by - 1.2)}`, T.shoe.s, 1.8, 0.9) +
      k.line(`M ${f(x - 2.4)} ${f(by - 5.2)} Q ${x} ${f(by - 6)} ${f(x + 2.4)} ${f(by - 5.2)}`, T.shoe.h, 1.1, 0.8),
  });
}
/** 마네킹 발 (앞/뒤) */
function bareFoot(k: Kit, x: number, by: number) {
  const d = sp([[x - 6.8, by, 1], [x + 6.8, by, 1], [x + 6.4, by - 3.6], [x + 2.8, by - 6.2], [x - 2.8, by - 6.2], [x - 6.4, by - 3.6]]);
  return k.shape(d, k.P.skin, { dx: -1.6, dy: -1.8, rim: 1 });
}
/** 옆에서 본 신발 (오른쪽이 앞코) */
function shoeSide(k: Kit, x: number, by: number, t: Tone, strap = false, far = false) {
  const T = k.P;
  const tone = far ? { b: t.s, s: darken(t.s, 0.15), h: t.b } : t;
  const d = sp([[x - 6.4, by, 1], [x + 8.8, by, 1], [x + 9.2, by - 3.4], [x + 5.4, by - 6.6], [x - 1.6, by - 7.6], [x - 6.6, by - 5.4]]);
  return k.shape(d, tone, {
    ol: T.olh, dx: -1.6, dy: -2,
    inner: k.line(`M ${f(x - 6.4)} ${f(by - 1.2)} L ${f(x + 9)} ${f(by - 1.2)}`, tone.s, 1.6, 0.9) +
      (strap ? k.line(`M ${f(x - 0.4)} ${f(by - 7.4)} L ${f(x + 3.4)} ${f(by - 4.4)}`, far ? T.red.s : T.red.b, 2.1) : ""),
  });
}
/** 마네킹 발 (옆) */
function bareFootSide(k: Kit, x: number, by: number, far: boolean) {
  const tone = far ? k.far(k.P.skin, 0.08) : k.P.skin;
  const d = sp([[x - 6, by, 1], [x + 8.4, by, 1], [x + 8.6, by - 3.2], [x + 5, by - 6], [x - 1.4, by - 6.8], [x - 6.2, by - 5]]);
  return k.shape(d, tone, { dx: -1.4, dy: -1.8, rim: 0.8 });
}

/** 걷기 동작 값 */
function gait(frame: WalkFrame) {
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  return { step, liftL: step === 1 ? 6.6 : 0, liftR: step === -1 ? 6.6 : 0, bob: step ? -1.5 : 0, tilt: step * 1.6 };
}
type Gait = ReturnType<typeof gait>;

type ArmState = "rest" | "fwd" | "back";
/** 팔 상태 (오른다리가 나가면 왼팔이 앞으로) */
const armStates = (g: Gait): [ArmState, ArmState] => [
  g.step === -1 ? "fwd" : g.step === 1 ? "back" : "rest",
  g.step === 1 ? "fwd" : g.step === -1 ? "back" : "rest",
];

type SleeveFn = ((a: ArmGeom) => string) | undefined;

/**
 * 앞모습 팔 하나. side = -1(왼쪽) | 1(오른쪽), state = "rest" | "fwd" | "back"
 * 앞으로 흔드는 손은 몸 가운데 쪽으로 오며 살짝 내려가고, 뒤로 가는 팔은 몸 뒤로 숨는다.
 * sleeve: 긴 소매 (팔과 같은 회전 안에 그린다)
 */
function armFront(k: Kit, side: -1 | 1, state: ArmState, sleeve: SleeveFn) {
  const px = 72 + side * 16.4, py = 92.4;
  const hx = 72 + side * 20.4, hy = 104.6;
  let body = k.shape(capsule(px, py, hx, hy, 4.5, 5), k.P.skin, {
    dx: -1.6, dy: -1.8, rim: 1.1,
    inner: k.line(`M ${f(hx - side * 3.2)} ${f(hy - 2.6)} Q ${f(hx - side * 4.4)} ${f(hy + 0.2)} ${f(hx - side * 3)} ${f(hy + 2.6)}`, k.P.skin.s, 1.2, 0.9),
  });
  body += sleeve?.({ px, py, hx, hy, side }) ?? "";
  if (state === "rest") return body;
  // 회전 각 (양수 = 시계 방향 → 늘어뜨린 손이 왼쪽으로). 앞으로: 손이 가운데로 오며 내려감, 뒤로: 위로 올라가 몸 뒤에 숨음
  const a = state === "fwd" ? 9 * side : 4 * side;
  const ty = state === "fwd" ? 1.4 : -2.6;
  return `<g transform="translate(0 ${ty}) rotate(${a} ${px} ${py - 8})">${body}</g>`;
}

/** 남자 팔: 짧은 소매는 어깨에 붙고, 맨살 아래팔과 둥근 손만 흔든다 */
function boyArm(k: Kit, side: -1 | 1, state: ArmState, sleeve: SleeveFn) {
  const px = 72 + side * 18.4, py = 92.6;
  const hx = 72 + side * 20.8, hy = 104.4;
  let body = k.shape(capsule(px, py, hx, hy, 4.2, 5.6), k.P.skin, {
    dx: -1.6, dy: -1.8, rim: 1.1,
    inner: k.line(`M ${f(hx - side * 3.6)} ${f(hy - 2.4)} Q ${f(hx - side * 4.8)} ${f(hy + 0.4)} ${f(hx - side * 3.4)} ${f(hy + 3)}`, k.P.skin.s, 1.2, 0.9),
  });
  body += sleeve?.({ px, py, hx, hy, side }) ?? "";
  if (state === "rest") return body;
  const a = state === "fwd" ? 10 * side : 4 * side;
  const ty = state === "fwd" ? 1.4 : -2.6;
  return `<g transform="translate(0 ${ty}) rotate(${a} ${px} ${py - 6})">${body}</g>`;
}

/** 앞·뒤 모습 공통: 다리 + 신발 (그림자 위, 몸 기울기 밖) */
function feetFront(k: Kit, p: Pose, o: Outfit, xs: [number, number], shoe: (x: number, by: number) => string, leg: (xx: number, l: number) => string) {
  let out = "";
  const legs: [number, number, number][] = [[xs[0], p.liftL, 1.4], [xs[1], p.liftR, -1.4]];
  for (const [x, l, tuck] of legs) {
    const xx = x + (l ? tuck : 0);
    out += leg(xx, l);
    const sx = xx + (x < 72 ? -0.6 : 0.6), by = GROUND - l;
    out += o.shoes ? o.shoes.foot(k, p, sx, by) : shoe(sx, by);
  }
  return out;
}

const sleeveOf = (k: Kit, p: Pose, o: Outfit): SleeveFn => {
  const arm = o.top?.arm;
  return arm ? (a) => arm(k, p, a) : undefined;
};

// ───────── 여자 ─────────

// 앞모습: 정수리·일자 앞머리·얼굴 옆선을 덮는 옆머리
const GIRL_CAP_F: Pt[] = [
  [47.6, 74.6, 0.9],
  [44.8, 68], [44.2, 60], [42.2, 49], [44.6, 35.4], [51.6, 23.2], [61.6, 15.6], [72.6, 13], [83.6, 15], [93.2, 22.2], [99.8, 34.4], [101.8, 48], [100, 60], [99.2, 68],
  [96.4, 74.6, 0.9],
  [94.6, 66], [94.6, 58.6],
  // 일자 앞머리: 끝이 뭉툭한 뭉치 7개, 길이가 2~3 단위씩 다르고 사이가 V 로 갈라진다
  [93.8, 55.4, 0.5], [92.2, 55.8, 0.5], [91, 51.8, 1],
  [89.6, 56.2, 0.5], [85.4, 55, 0.5], [84, 51.4, 1],
  [82.6, 54.4, 0.5], [78.2, 54.8, 0.5], [76.8, 50.6, 1],
  [75, 55.6, 0.5], [70.2, 54.2, 0.5], [68.4, 48.6, 1], // 가르마 (살짝 왼쪽)
  [66.8, 54, 0.5], [61.6, 55.4, 0.5], [60, 51.4, 1],
  [58.6, 56.6, 0.5], [54, 55.6, 0.5], [52.6, 51.8, 1],
  [51.2, 55, 0.5],
  [50.2, 60], [49.8, 67.4],
];
// 앞모습 등 뒤 긴 웨이브 머리 (왼쪽 절반, 위 가운데 → 아래 안쪽)
const GIRL_BACK_F_L: Pt[] = [
  [72, 18], [57, 19.6], [48, 27], [44.6, 38], [41.6, 46],
  [36.6, 53.6], [38.2, 61.6], [33, 70.6], [35.8, 79], [30.8, 88], [30.2, 95.6],
  [27.4, 99.2], [26.8, 97.4, 1], // 바깥으로 말린 끝
  [27, 102.4], [31.6, 104.8], [36, 103], [38, 99.8, 0.7],
  [39.8, 104.2], [44.4, 105.2], [48.6, 102], [50.4, 98.6, 0.7],
  [53.6, 100.4], [57, 99.4], [61, 96],
];
const girlBackHairF = () => {
  const R = wob(mir(GIRL_BACK_F_L), 0.7, 11).reverse().slice(1);
  return sp([...GIRL_BACK_F_L, ...R]);
};
const GIRL_BACK_F_CURLS = [
  "M 40.4 49 Q 36.4 54 39.6 59.4", "M 37 64.6 Q 32.8 70.4 36.6 76", "M 34 82 Q 29.6 88 33.2 93.6",
  "M 30.4 99.4 Q 30.8 103 34.4 102.6", "M 41 99 Q 42 103.4 46 102.6",
];

const GIRL_BLOUSE_F: Pt[] = [[60.5, 80.6], [72, 79], [83.5, 80.6], [86.2, 85], [87, 93, 1], [57, 93, 1], [57.8, 85]];
// 하의만 입었을 때 보이는 블라우스 전체 (아랫단이 하의 허리를 덮는다)
const GIRL_BLOUSE_FULL: Pt[] = [[60.5, 80.6], [72, 79], [83.5, 80.6], [86.2, 85], [88, 94], [89.6, 103.6, 1], [72, 105.2], [54.4, 103.6, 1], [56, 94], [57.8, 85]];
const GIRL_PINK = (back: boolean): Pt[] => back
  ? [[58.8, 82.6, 1], [65.4, 82.2, 1], [72, 91.4, 1], [78.6, 82.2, 1], [85.2, 82.6, 1], [87.6, 92], [92.2, 102], [96.4, 109.2, 1], [84, 111.6], [72, 112.2], [60, 111.6], [47.6, 109.2, 1], [51.8, 102], [56.4, 92]]
  : [[58.8, 83.8, 1], [72, 83], [85.2, 83.8, 1], [87.6, 92], [92.2, 102], [96.4, 109.2, 1], [84, 111.6], [72, 112.2], [60, 111.6], [47.6, 109.2, 1], [51.8, 102], [56.4, 92]];
// 상의만 입었을 때: 원피스 아랫부분만 분홍 치마로
const GIRL_PINK_SKIRT: Pt[] = [[53.6, 99.6, 1], [90.4, 99.6, 1], [92.2, 102], [96.4, 109.2, 1], [84, 111.6], [72, 112.2], [60, 111.6], [47.6, 109.2, 1], [51.8, 102]];
const GIRL_NAVY: Pt[] = [[48.6, 104, 1], [95.4, 104, 1], [97.8, 112.6], [94.8, 116.6], [72, 118.6], [49.2, 116.6], [46.2, 112.6]];
const PUFF_L: Pt[] = [[62.2, 81.6], [56, 81.6], [51.2, 85.4], [49.2, 91], [50.6, 94.2, 1], [56, 95.4], [61.4, 94.2, 1], [62.4, 88]];
const DOTS: [number, number, number][] = [[61, 95.6, 1.3], [67.4, 100.4, 1.2], [77.6, 95, 1.3], [84.2, 100.2, 1.2], [56.4, 104.4, 1.3], [63.6, 107.4, 1.2], [73, 105.4, 1.4], [81.4, 107.6, 1.2], [88.6, 104.6, 1.3], [89.6, 96.6, 1.1], [53.8, 99, 1.1], [60.6, 88.6, 1.1], [83.4, 88.4, 1.1]];

function puffSleeve(k: Kit, pts: Pt[]) {
  const T = k.P;
  const xs = pts.map((p) => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  return k.shape(sp(pts), T.blouse, {
    dx: -1.8, dy: -2.4,
    inner: k.line(`M ${f(x0 + 1.4)} 91.4 Q ${f((x0 + x1) / 2)} 93.6 ${f(x1 - 1)} 91.8`, T.blouse.s, 1.6) +
      k.line(`M ${f(x0 + 4)} 84.6 Q ${f(x0 + 5.6)} 88 ${f(x0 + 5)} 90.4`, T.blouse.s, 1, 0.7),
  });
}

const dotsSvg = (list: [number, number, number][]) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff6f8" opacity=".9"/>`).join("");

function pinafore(k: Kit, back: boolean) {
  const T = k.P;
  const d = sp(GIRL_PINK(back));
  const dots = dotsSvg(DOTS.filter(([x, y]) => back || Math.hypot(x - 72, y - 90) > 6));
  const motif = back ? "" :
    `<g fill="#fffaf6"><ellipse cx="69.8" cy="87.2" rx="1.2" ry="2.4" transform="rotate(-12 69.8 87.2)"/><ellipse cx="74.2" cy="87.2" rx="1.2" ry="2.4" transform="rotate(12 74.2 87.2)"/><ellipse cx="72" cy="91" rx="3.6" ry="2.8"/></g>` +
    `<circle cx="70.8" cy="90.6" r=".45" fill="${T.pink.s}"/><circle cx="73.2" cy="90.6" r=".45" fill="${T.pink.s}"/>`;
  return k.shape(d, T.pink, {
    dx: -3.2, dy: -2.6,
    inner: k.blob(72, back ? 84 : 85, 17, 3.2, T.pink.s, 0.55) +
      `<g filter="${k.filter("tiny")}">${dots}</g>` + motif +
      k.line("M 56.4 95 Q 53.6 102 51.6 108", T.pink.h, 2.6, 0.7),
  });
}
/** 원피스 아랫부분만 (상의를 입었을 때 분홍 물방울 치마로 보인다) */
function pinkSkirt(k: Kit) {
  const T = k.P;
  return k.shape(sp(GIRL_PINK_SKIRT), T.pink, {
    dx: -3.2, dy: -2.6,
    inner: k.blob(72, 100, 17, 2.6, T.pink.s, 0.5) +
      `<g filter="${k.filter("tiny")}">${dotsSvg(DOTS.filter(([, y]) => y > 101))}</g>` +
      k.line("M 53.8 101.6 Q 52.6 105 51.6 108", T.pink.h, 2.6, 0.7),
  });
}
const navySkirt = (k: Kit) =>
  k.shape(sp(GIRL_NAVY), k.P.navy, { ol: k.P.olh, dx: -3, dy: -2.4, inner: k.line("M 50 113 Q 58 116.4 66 116.8", k.P.navy.h, 1.6, 0.7) });

/** 둥근 흰 칼라 + 빨간 리본 (앞) */
function girlCollar(k: Kit) {
  const T = k.P;
  const flapL: Pt[] = [[72, 80.6, 1], [67.4, 79.4], [62.6, 80.4], [61.8, 83.4], [65.2, 85.6], [69.6, 84.4]];
  return k.shape(sp(flapL), T.blouse, { sw: 1.3, dx: -1, dy: -1.4, rim: 0 }) +
    k.shape(sp(mir(flapL).reverse()), T.blouse, { sw: 1.3, dx: -1, dy: -1.4, rim: 0 }) +
    `<path d="M 72 82 L 68.4 79.8 L 68.8 84.2 Z M 72 82 L 75.6 79.8 L 75.2 84.2 Z" fill="${T.red.b}" stroke="${T.red.s}" stroke-width=".9" stroke-linejoin="round"/><circle cx="72" cy="82" r="1.4" fill="${T.red.h}" stroke="${T.red.s}" stroke-width=".8"/>`;
}

function girl(k: Kit, p: Pose, o: Outfit) {
  const g = gait(p.frame);
  let out = shadow(k);
  if (p.view === "side") return out + girlSide(k, p, o, g);
  const T = k.P;
  const back = p.back;
  // 다리 + 구두
  const feet = feetFront(k, p, o, [65.4, 78.6], (x, by) => maryJane(k, x, by, back),
    (xx, l) => {
      const top = o.bottom?.long ? 121 : 112; // 긴 바지 안쪽은 발목만
      return k.shape(`M ${f(xx - 4.6)} ${top} L ${f(xx + 4.6)} ${top} L ${f(xx + 4.6)} ${f(130 - l)} L ${f(xx - 4.6)} ${f(130 - l)} Z`, T.skin, { dx: -1.4, dy: 0, rim: 1 });
    });
  out += feet;
  const [stL, stR] = armStates(g);
  const sleeve = sleeveOf(k, p, o);
  let up = "";
  if (!back) {
    up += k.shape(girlBackHairF(), T.hair, {
      ol: T.olh, dx: -2.6, dy: -3,
      inner: k.blob(98, 80, 12, 26, T.hair.s, 0.5) + clumps(k, [...GIRL_BACK_F_CURLS, ...GIRL_BACK_F_CURLS.map((d) => mirD(d))], 0.85) +
        glints(k, ["M 36.6 56 Q 34.6 61 36.4 64", "M 33.4 76 Q 31.6 81 33.4 84"]),
    });
  }
  // 몸 뒤로 숨는 팔
  if (stL === "back") up += armFront(k, -1, "back", sleeve);
  if (stR === "back") up += armFront(k, 1, "back", sleeve);
  // 아래(하의) → 위(상의)
  if (o.bottom) up += o.bottom.hips(k, p);
  else {
    up += navySkirt(k);
    if (o.top) up += pinkSkirt(k);
  }
  if (o.top) up += o.top.torso(k, p);
  else if (o.bottom) {
    up += k.shape(sp(GIRL_BLOUSE_FULL), T.blouse, {
      dx: -2, dy: -2,
      inner: k.line("M 72 86 L 72 104.4", T.blouse.s, 1, 0.8) + (back ? "" : `<circle cx="74" cy="92" r=".9" fill="${T.blouse.s}"/><circle cx="74" cy="99" r=".9" fill="${T.blouse.s}"/>`),
    });
  } else {
    up += k.shape(sp(GIRL_BLOUSE_F), T.blouse, { dx: -2, dy: -2 });
    up += pinafore(k, back);
  }
  if (stL !== "back") up += armFront(k, -1, stL, sleeve);
  if (stR !== "back") up += armFront(k, 1, stR, sleeve);
  if (o.top) up += o.top.shoulder(k, p, -1) + o.top.shoulder(k, p, 1);
  else up += puffSleeve(k, PUFF_L) + puffSleeve(k, mir(PUFF_L).reverse());
  up += o.top?.collar?.(k, p) ?? "";
  if (!back) {
    if (!o.top) up += girlCollar(k);
    up += ear(k, 45.8, 65, -1) + ear(k, 98.2, 65, 1);
    up += faceFront(k);
    up += eyes(k, [60, 84], 63.6) + cheeks(k, [[53.8, 70.6], [90.2, 70.6]]) + mouth(k, 72, 72.4);
    up += k.shape(sp(GIRL_CAP_F), T.hair, {
      ol: T.olh, dx: -2.6, dy: -3,
      inner: k.blob(96, 46, 9, 20, T.hair.s, 0.4) +
        clumps(k, ["M 90.2 50.6 Q 89.4 45 90.8 39", "M 82.8 50.6 Q 82.2 45 83.4 40.6", "M 75.6 50 Q 75 45.6 76 42", "M 59.4 50.4 Q 58.6 45 59.8 40.2", "M 52.6 51 Q 51.6 46.6 52.6 42.6",
          "M 68.4 48.6 Q 66.6 38 68.8 27.6", "M 46.6 54 Q 45.6 63 47.6 72", "M 97.4 54 Q 98.4 63 96.4 72"]) + k.line("M 63 21.6 Q 72 17 81 20.8", T.hair.s, 1.2, 0.45) +
        glints(k, ["M 56 41 Q 54.6 46 55.4 50", "M 86 41.6 Q 87 46 86.4 50"]) +
        shine(k, 49.4, 35, 72, 19.6, 94.6, 35, 7, [[58.6, 41.2, 1.1], [87.8, 40.4, 1.2]]),
    });
  } else {
    up += girlBackHead(k, !o.top);
  }
  up += o.hat?.hat(k, p) ?? "";
  out += `<g transform="translate(0 ${g.bob}) rotate(${g.tilt} 72 112)">${up}</g>`;
  return out;
}

// 뒷모습: 어깨까지 덮는 굵은 웨이브 머리, 아래 끝은 곱슬 끝 6개
const GIRL_BACK_B: Pt[] = [
  [72, 12],
  [83.6, 13.2], [94, 19.6], [101.6, 30], [105, 42],
  [110, 53.4], [106.4, 62.4], [111.6, 70.6], [108.4, 78.6], [110.4, 86],
  // 아래 끝: 둥글게 말린 곱슬 끝 6개, 가운데는 짧아 칼라가 보인다
  [107.6, 93], [103.6, 89, 1], [98.6, 94.4], [94, 89.4, 1], [88.4, 91.6], [83.4, 85.6, 1],
  [77, 86.2], [72, 83.4, 0.5], [67, 86.2],
  [60.6, 85.6, 1], [55.6, 91.6], [50, 89.4, 1], [45.4, 94.4], [40.4, 89, 1], [36.4, 93],
  [33.6, 86], [35.6, 78.6], [32.2, 70.6], [35.6, 62.4], [33.8, 53.4],
  [38.6, 42], [42.4, 30], [50, 19.6], [60.4, 13.2],
];

function girlBackHead(k: Kit, collar: boolean) {
  const T = k.P;
  let s = "";
  // 귀 (머리 옆에 살짝)
  s += ear(k, 38.4, 63.6, -1, 4.6) + ear(k, 105.6, 63.6, 1, 4.6);
  // 정수리 잔머리 (본 머리 뒤에 그려 끝만 삐져나오게) — 옆으로 휘는 작은 잔머리 두 가닥
  const tuftL = sp([[57, 15.2], [52.8, 13.2], [49.6, 13.8, 1], [52.6, 10.6], [58.8, 12.6]]);
  const tuftR = sp([[86.4, 14], [90.2, 13], [93.6, 14.6, 1], [90.8, 16.4], [92.4, 19]]);
  const tuft3 = sp([[101, 25.4], [104, 25.2, 1], [103.2, 29.4]]);
  for (const d of [tuftL, tuftR, tuft3]) s += k.shape(d, T.hair, { ol: T.olh, sw: 1.6, dx: -1, dy: -1, rim: 0.6 });
  // C·S 자로 말린 웨이브 결 (길이·방향 제각각)
  const C = [
    "M 52 34 Q 47 41 50.6 49", "M 66 28 Q 62 35 65.6 41", "M 84 30 Q 88.6 37.6 85 45", "M 96 40 Q 99.6 46 96.6 52",
    "M 44 54 Q 40 61 43.6 67 Q 46 71 43 76", "M 58 48 Q 54.6 54 58 60", "M 73 44 Q 69.6 52 73.4 59 Q 75.6 64 72.6 69", "M 88 50 Q 91.8 57 88.2 64",
    "M 52 66 Q 48.6 72 52.4 79", "M 64 62 Q 61 67 63.8 72", "M 81 64 Q 84.4 70 80.8 77", "M 99 64 Q 102.6 70 99.6 76 Q 97.6 80 100.6 84",
    "M 38 80 Q 35.6 86 38.4 91", "M 47 85 Q 44.6 90 47.4 93", "M 57.4 84.4 Q 55.4 88 57.6 90.4", "M 87 84.4 Q 89.2 88 86.8 90.4", "M 97.6 86 Q 100 90.4 97 93", "M 106.4 82 Q 109 87 106 91",
  ];
  s += k.shape(sp(GIRL_BACK_B), T.hair, {
    ol: T.olh, dx: -2.8, dy: -3.4,
    inner: k.blob(80, 70, 22, 13, T.hair.s, 0.45) + k.blob(100, 55, 8, 24, T.hair.s, 0.4) + clumps(k, C, 0.62, 1.15) +
      glints(k, ["M 45 44 Q 42 52 43.6 60", "M 56 64 Q 54 70 55.6 76", "M 76.4 30 Q 78.4 36 77.4 42"]) +
      shine(k, 47, 34, 72, 20, 97, 34, 9, [[60.4, 42, 1.2], [84.6, 41.2, 1.1], [52.6, 50.4, 0.9]]),
  });
  // 등 쪽 흰 칼라 (머리 아래로 살짝)
  if (collar) s += k.line("M 64.6 84.6 Q 72 87.4 79.4 84.6", T.blouse.s, 1.2, 0.9);
  return s;
}

// 옆모습 (오른쪽을 본다)
const GIRL_SIDE_BACKHAIR: Pt[] = [
  [62, 18], [48, 24], [40.6, 36], [38, 48],
  [35, 57], [37.6, 64], [33.4, 72], [36.4, 79], [32, 87], [34.4, 94],
  [30.8, 100.4, 1], [37.4, 99.6], [41.4, 105, 1], [46, 100.2], [51.6, 104, 1], [55.6, 98], [60.6, 101.4, 1],
  [63.6, 94], [66, 84], [68, 72], [74, 50], [72, 26],
];
const GIRL_CAP_S: Pt[] = [
  [96.2, 53.6, 0.8],
  [98, 47], [98.6, 38], [95.4, 27], [87, 17.6], [75, 12.6], [62, 13.6], [50.4, 19.6], [42, 30], [38.6, 42], [39.4, 54],
  [43, 63], [48.6, 69.4], [55.8, 73.4, 0.9],
  [58.4, 66], [60.4, 58.6], [63.6, 54.6],
  [66.4, 55.6, 0.5], [70.6, 56.4, 0.5], [72.2, 51.6, 1], [74, 55.8, 0.5], [78.6, 55.4, 0.5], [80.2, 51.2, 1],
  [82, 55.2, 0.5], [86.4, 56, 0.5], [88, 51.4, 1], [89.8, 55, 0.5], [93.6, 55.2, 0.5],
];
const GIRL_SIDE_LOCK: Pt[] = [[54.4, 66], [59, 70], [60.8, 78], [58.8, 85], [61, 91.4], [58.4, 98.6, 0.9], [55, 92], [55.8, 85], [53, 77.6], [51.8, 70]];
const GIRL_SIDE_PINK: Pt[] = [[59.4, 84, 1], [84.8, 84, 1], [88.4, 92.6], [93, 102.4], [96.6, 109.4, 1], [84, 112.2], [70, 112.4], [57.6, 111.6], [49.4, 109, 1], [52.2, 100.6], [55.6, 91.6]];
const GIRL_SIDE_PINK_SKIRT: Pt[] = [[53, 99.6, 1], [91.4, 99.6, 1], [93, 102.4], [96.6, 109.4, 1], [84, 112.2], [70, 112.4], [57.6, 111.6], [49.4, 109, 1], [52.2, 100.6]];
const GIRL_SIDE_DOTS: [number, number, number][] = [[63, 95, 1.2], [70.6, 100, 1.2], [80.4, 95.4, 1.3], [87, 101.6, 1.2], [58.4, 104, 1.2], [66.6, 107.4, 1.3], [77, 105, 1.3], [88.8, 107.6, 1.1], [56.6, 96, 1.1]];

/** 옆모습 다리 좌표 (여자: 엉덩이 y 111, 길이 17.4) */
function girlSideLeg(hx: number, deg: number, far: boolean): SideLeg {
  const L = 17.4, hipY = 111;
  const lift = deg < 0 ? 1.6 : 0; // 뒤로 간 발은 살짝 든다
  const fx = hx + Math.sin(rad(deg)) * L, fy = hipY + Math.cos(rad(deg)) * L;
  return { hx, hy: hipY, ax: fx, ay: fy - lift, by: GROUND - lift - (hipY + L - fy), far };
}
/** 옆모습 다리 좌표 (남자: 엉덩이 y 106, 길이 18.4) */
function boySideLeg(hx: number, deg: number, far: boolean): SideLeg {
  const L = 18.4, hipY = 106;
  const lift = deg < 0 ? 1.6 : 0;
  const ax = hx + Math.sin(rad(deg)) * L, ay = hipY + Math.cos(rad(deg)) * L - lift;
  return { hx, hy: hipY, ax, ay, by: ay + 9.6, far };
}

function girlSide(k: Kit, p: Pose, o: Outfit, g: Gait) {
  const T = k.P;
  const sw = g.step * 20; // 다리 흔드는 각
  const bob = g.step ? -1.4 : 0;
  let out = "";
  const leg = (hx: number, deg: number, far: boolean) => {
    const lg = girlSideLeg(hx, deg, far);
    const tone = far ? { b: T.skin.s, s: darken(T.skin.s, 0.08), h: T.skin.b } : T.skin;
    let s = k.shape(capsule(hx, lg.hy, lg.ax, lg.ay, 4.6), tone, { dx: -1.4, dy: 0, rim: 1 });
    s += o.bottom?.leg?.(k, p, lg) ?? "";
    s += o.shoes ? o.shoes.footSide(k, p, lg.ax - 1, lg.by, far) : shoeSide(k, lg.ax - 1, lg.by, T.navy, true, far);
    return s;
  };
  out += leg(70, -sw, true) + leg(74.4, sw, false);
  let up = "";
  up += k.shape(sp(GIRL_SIDE_BACKHAIR), T.hair, {
    ol: T.olh, dx: 2.4, dy: -3,
    inner: k.blob(52, 84, 14, 20, T.hair.s, 0.5) +
      clumps(k, ["M 40.6 50 Q 36.6 55 39.6 61.6", "M 38.6 66 Q 34.6 71.4 38.4 77.4", "M 37 82 Q 33 87.6 36.4 92.6", "M 35 96.6 Q 33.4 100 36.4 101.4", "M 45 95 Q 43 100 46 102.4", "M 54.6 94.4 Q 53 99 56 101.6", "M 49 60 Q 45 76 49.6 92"], 0.85) +
      glints(k, ["M 39.4 56 Q 37.6 62 39 66", "M 36.4 74 Q 34.4 80 36 84"]),
  });
  // 먼 쪽 팔 (몸 뒤, 그늘색)
  const farA = sw * 0.9;
  const farArm: ArmGeom = { px: 70, py: 92, hx: 71, hy: 105, side: -1, far: true };
  up += `<g transform="rotate(${f(-farA)} 70 92)">` + k.shape(capsule(70, 92, 71, 105, 4.4, 4.8), { b: T.skin.s, s: darken(T.skin.s, 0.1), h: T.skin.b }, { dx: -1.2, dy: -1.4, rim: 0.8 }) +
    (o.top ? (o.top.arm?.(k, p, farArm) ?? "") + o.top.shoulder(k, p, -1) : "") + "</g>";
  // 아래: 하의
  if (o.bottom) up += o.bottom.hips(k, p);
  else {
    up += k.shape(sp([[50, 104, 1], [95, 104, 1], [97.6, 112.6], [94.2, 116.4], [72, 118.6], [51.6, 116.6], [48.4, 112.6]]), T.navy, { ol: T.olh, dx: -3, dy: -2.4 });
    if (o.top) {
      up += k.shape(sp(GIRL_SIDE_PINK_SKIRT), T.pink, {
        dx: -3.2, dy: -2.6,
        inner: `<g filter="${k.filter("tiny")}">${dotsSvg(GIRL_SIDE_DOTS.filter(([, y]) => y > 101))}</g>` + k.line("M 52.6 101.6 Q 51.8 105 51.4 108", T.pink.h, 2.4, 0.7),
      });
    }
  }
  // 위: 상의
  if (o.top) up += o.top.torso(k, p);
  else if (o.bottom) {
    up += k.shape(sp([[63.4, 80.6], [76, 79.4], [84.6, 81.6], [86.4, 88], [88, 96], [89.4, 104.4, 1], [72, 106], [55.4, 104.4, 1], [56.6, 95], [59.4, 86]]), T.blouse, { dx: -2, dy: -2 });
  } else {
    up += k.shape(sp([[63.4, 80.6], [76, 79.4], [84.6, 81.6], [86.4, 88], [86.6, 93, 1], [58, 93, 1], [59.4, 86]]), T.blouse, { dx: -2, dy: -2 });
    // 원피스 (앞이 오른쪽)
    up += k.shape(sp(GIRL_SIDE_PINK), T.pink, {
      dx: -3.2, dy: -2.6,
      inner: k.blob(72, 85, 16, 3, T.pink.s, 0.55) +
        `<g filter="${k.filter("tiny")}">${dotsSvg(GIRL_SIDE_DOTS)}</g>` +
        `<ellipse cx="85.6" cy="89.6" rx="2.2" ry="2.6" fill="#fffaf6"/>` +
        k.line("M 55.6 95 Q 53.2 102 51.4 108", T.pink.h, 2.4, 0.7),
    });
  }
  // 가까운 팔 + 퍼프 소매 (팔은 다리와 반대로 흔든다)
  const nearA = -sw * 0.9;
  const nearArm: ArmGeom = { px: 73.4, py: 92, hx: 75, hy: 104.8, side: 1 };
  up += `<g transform="rotate(${f(-nearA)} 73.4 92)">` + k.shape(capsule(73.4, 92, 75, 104.8, 4.5, 5), T.skin, {
    dx: -1.6, dy: -1.8, rim: 1.1,
    inner: k.line("M 78.2 102.4 Q 79.6 105 78 107.4", T.skin.s, 1.2, 0.9),
  }) + (o.top?.arm?.(k, p, nearArm) ?? "") + "</g>";
  if (o.top) up += o.top.shoulder(k, p, 1) + (o.top.collar?.(k, p) ?? "");
  else {
    up += puffSleeve(k, [[67.6, 81.2], [76, 81], [81.2, 85.4], [82, 91.4], [80, 94.6, 1], [73.2, 95.8], [66.6, 94.6, 1], [65, 88.4]]);
    // 칼라·리본
    up += k.shape(sp([[76.4, 79.8], [83.6, 80.4], [85.6, 83.4], [81, 85.2], [77.4, 83]]), T.blouse, { sw: 1.3, dx: -1, dy: -1.4, rim: 0 });
    up += `<path d="M 84.4 81.6 L 81.4 79.6 L 81.6 83.6 Z M 84.4 81.6 L 87.2 80.2 L 86.8 83.4 Z" fill="${T.red.b}" stroke="${T.red.s}" stroke-width=".9" stroke-linejoin="round"/><circle cx="84.4" cy="81.6" r="1.2" fill="${T.red.h}" stroke="${T.red.s}" stroke-width=".8"/>`;
  }
  // 어깨 위로 흘러내리는 머리 한 가닥
  up += k.shape(sp(GIRL_SIDE_LOCK), T.hair, {
    ol: T.olh, dx: -1.6, dy: -2, rim: 1,
    inner: clumps(k, ["M 56.4 72 Q 57.8 80 55.8 86", "M 57.8 88 Q 58.6 92 57.2 95"], 0.85),
  });
  // 머리: 얼굴 → 머리카락 → 귀
  up += faceSide(k);
  up += k.shape(sp(GIRL_CAP_S), T.hair, {
    ol: T.olh, dx: -2.6, dy: -3,
    inner: k.blob(52, 56, 12, 16, T.hair.s, 0.4) +
      clumps(k, ["M 72.2 51.8 Q 71.6 46 73 41", "M 80.2 51.4 Q 79.8 45.6 81.2 41", "M 88 51.6 Q 88 46 89.2 41.6", "M 61 21.4 Q 70 16.4 79.6 19.6",
        "M 46 42 Q 44 52 47.4 62", "M 52.4 40 Q 51 50 54.4 60"]) +
      glints(k, ["M 91 40 Q 92.4 45 91.6 49", "M 43 45 Q 42 50 43.4 55"]) +
      shine(k, 46, 33, 68, 18.6, 92, 31, 4, [[83.4, 38.4, 1.1], [56, 40.6, 1]]),
  });
  up += ear(k, 65.4, 64, 1, 4.5);
  up += o.hat?.hat(k, p) ?? "";
  out += `<g transform="translate(0 ${bob})">${up}</g>`;
  return out;
}

// ───────── 남자 (방문자·마네킹도 이 몸을 쓴다) ─────────

// 앞모습: 위가 판판하고 옆으로 넓은 버섯 모양, 끝이 뾰족한 머리 뭉치들
const BOY_CAP_F: Pt[] = [
  // 정수리 둘레: 위가 판판하고 옆으로 넓은 덥수룩한 뭉치 (양 끝 뭉치는 귀 위로 바깥으로 삐친다)
  ...shag({ cx: 72, cy: 43.6, rx: 33.6, ry: 31.6, a0: 166, a1: 374, n: 8, out: 2.2, inn: 1.2, pw: 2.35, seed: 7, sweep: 1.5, tip: 0.4 }),
  [101.2, 59.4], [98.6, 54],
  // 앞머리: 길고 들쭉날쭉한 뾰족 뭉치, 가르마는 오른쪽
  [96.4, 57.8, 0.8], [92.8, 50.6, 0.5], [88.6, 58.8, 0.8], [85.2, 51.2, 0.5], [81, 56.6, 0.8], [77.6, 48.4, 0.7],
  [70.4, 59.4, 0.8], [66.4, 51.2, 0.5], [60.4, 58, 0.8], [56.4, 51, 0.5], [51.2, 56.8, 0.8], [47.6, 53.4], [43, 57.2],
];
const BOY_LOCK_F: Pt[] = [[84.2, 41.6], [79.8, 49.6], [73.6, 58.4, 0.9], [76.2, 49.2], [80.2, 41.8]]; // 비스듬히 가로지르는 앞머리 한 가닥

/** 정수리 삐침: 옆으로 휘는 작은 머리 뭉치 두 개 (본 머리 뒤에 그려 끝만 보인다). 모자를 쓰면 그리지 않는다 */
function cowlick(k: Kit, dx = 0) {
  const T = k.P;
  const a = sp([[69 + dx, 14.4], [71.4 + dx, 9.2], [76.4 + dx, 6.2, 1], [74.6 + dx, 9.8], [75.4 + dx, 14]]);
  const b = sp([[76.4 + dx, 13.4], [79.6 + dx, 9.6], [83.6 + dx, 8.6, 1], [81.4 + dx, 11.4], [82.4 + dx, 15]]);
  return k.shape(a, T.hair, { ol: T.olh, dx: -1, dy: -1, rim: 0.8 }) + k.shape(b, T.hair, { ol: T.olh, dx: -1, dy: -1, rim: 0.8 });
}

const BOY_JACKET: Pt[] = [[57, 80.2, 1], [72, 78.8], [87, 80.2, 1], [89.4, 86], [91.4, 98], [92.4, 107.6, 1], [72, 109.2], [51.6, 107.6, 1], [52.6, 98], [54.6, 86]];
const BOY_SLEEVE_L: Pt[] = [[60, 80.6], [54, 81.4], [49.8, 85.8], [47.4, 92.6, 1], [53, 94.8], [59, 93.4, 1], [60, 87.4]];

function boySleeve(k: Kit, pts: Pt[], tone: Tone) {
  const xs = pts.map((p) => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  return k.shape(sp(pts), tone, {
    dx: -1.8, dy: -2.4,
    inner: k.line(`M ${f(x0 + 1)} 92.2 Q ${f((x0 + x1) / 2)} 95.2 ${f(x1 - 0.8)} 92.6`, tone.s, 1.6),
  });
}

function pantsFront(k: Kit, liftL: number, liftR: number) {
  const T = k.P;
  const tl = liftL ? 1.4 : 0, tr = liftR ? -1.4 : 0;
  const bl = 124.6 - liftL, br = 124.6 - liftR;
  const d = sp([[58.4, 101.6, 1], [85.6, 101.6, 1], [84.6 + tr, br, 1], [74.2 + tr, br, 1], [72.8, 113.4, 1], [71.2, 113.4, 1], [69.8 + tl, bl, 1], [59.4 + tl, bl, 1]]);
  const cuff = (x0: number, x1: number, b: number) => `<rect x="${f(x0)}" y="${f(b - 2.8)}" width="${f(x1 - x0)}" height="2.8" fill="${T.pants.h}" opacity=".8"/>` +
    k.line(`M ${f(x0)} ${f(b - 2.8)} L ${f(x1)} ${f(b - 2.8)}`, T.pants.s, 1.1, 0.9);
  return k.shape(d, T.pants, {
    ol: T.olh, dx: -3, dy: -2.6,
    inner: cuff(59 + tl, 70.4 + tl, bl) + cuff(73.6 + tr, 85 + tr, br) + k.line("M 62.4 104 L 62.4 112", T.pants.h, 1.6, 0.6),
  });
}

// 마네킹: 머리카락 없는 둥근 머리, 매끈한 몸통
const MQ_HEAD = { cx: 72, cy: 55.5, rx: 26.5, ry: 26.5 };
const MQ_TORSO: Pt[] = [[58.4, 80.4, 1], [72, 79], [85.6, 80.4, 1], [88, 86], [89, 97], [88.6, 104, 1], [72, 106.4], [55.4, 104, 1], [55, 97], [56, 86]];
const MQ_HIPS: Pt[] = [[57.6, 100.6, 1], [86.4, 100.6, 1], [85.6, 110.4], [72, 113.6], [58.4, 110.4]];

function mannequinHead(k: Kit, view: CharView) {
  const T = k.P;
  const { cx, cy, rx, ry } = MQ_HEAD;
  if (view === "side") {
    return k.shape(ell(cx, cy, rx - 1, ry), T.skin, { dx: 2, dy: -2.6, inner: k.blob(cx - 16, cy + 6, 8, 16, T.skin.s, 0.45) }) +
      ear(k, 65, 61, 1, 4.6) + eyes(k, [89.4], 62.6);
  }
  let s = ear(k, 45.8, 61, -1) + ear(k, 98.2, 61, 1);
  s += k.shape(ell(cx, cy, rx, ry), T.skin, {
    dx: -2.4, dy: -2.8,
    inner: k.blob(cx + 22, cy + 6, 6, 16, T.skin.s, 0.35) + (view === "back" ? k.blob(cx, cy + 16, 18, 6, T.skin.s, 0.35) : ""),
  });
  if (view === "front") s += eyes(k, [60, 84], 63.6);
  return s;
}

function boy(k: Kit, p: Pose, o: Outfit) {
  const g = gait(p.frame);
  let out = shadow(k);
  if (p.view === "side") return out + boySide(k, p, o, g);
  const T = k.P;
  const back = p.back;
  const mq = p.kind === "mannequin";
  // 다리(맨살, 짧은 하의일 때 보인다) + 양말 + 신발
  const feet = feetFront(k, p, o, [64.6, 79.4], (x, by) => (mq ? bareFoot(k, x, by) : sneaker(k, x, by)), (xx, l) => {
    const top = mq ? 106 : 110;
    // 기본 바지·청바지 안쪽 맨다리는 그리지 않는다 (가랑이 사이로 윤곽이 비친다)
    let s = !mq && (!o.bottom || o.bottom.long) ? "" : k.shape(`M ${f(xx - 4.6)} ${top} L ${f(xx + 4.6)} ${top} L ${f(xx + 4.6)} ${f(129 - l)} L ${f(xx - 4.6)} ${f(129 - l)} Z`, T.skin, { dx: -1.4, dy: 0, rim: 1 });
    if (!mq) s += k.shape(`M ${f(xx - 4.8)} ${f(121 - l)} L ${f(xx + 4.8)} ${f(121 - l)} L ${f(xx + 4.8)} ${f(129 - l)} L ${f(xx - 4.8)} ${f(129 - l)} Z`, T.sock, { dx: -1.2, dy: 0, rim: 0.8 });
    return s;
  });
  out += feet;
  const [stL, stR] = armStates(g);
  const sleeve = sleeveOf(k, p, o);
  let up = "";
  // 하의
  if (o.bottom) up += o.bottom.hips(k, p);
  else if (mq) up += k.shape(sp(MQ_HIPS), T.skin, { dx: -2.6, dy: -2.4 });
  else up += pantsFront(k, p.liftL, p.liftR);
  if (stL === "back") up += boyArm(k, -1, "back", sleeve);
  if (stR === "back") up += boyArm(k, 1, "back", sleeve);
  // 상의
  if (o.top) up += o.top.torso(k, p);
  else if (mq) up += k.shape(sp(MQ_TORSO), T.skin, { dx: -3, dy: -2.6, inner: k.line("M 58 101.4 Q 72 104.4 86 101.4", T.skin.s, 1.1, 0.8) });
  else {
    // 재킷 몸통
    up += k.shape(sp(BOY_JACKET), T.green, {
      dx: -3.2, dy: -2.6,
      inner: k.blob(72, 80.6, 16, 3, T.green.s, 0.55) + k.line("M 56.6 92 Q 55 100 54.6 106", T.green.h, 2.4, 0.6) +
        k.line("M 53.4 103.4 Q 72 106.4 90.6 103.4", T.green.s, 1.1, 0.7) +
        (back ? k.line("M 72 86 L 72 107", T.green.s, 1.2, 0.7) : ""),
    });
    if (!back) {
      // 안쪽 셔츠 (단추 여밈) + 옷깃 + 셔츠 깃
      up += k.shape(sp([[65.4, 79.6, 1], [78.6, 79.6, 1], [77.6, 108.6, 1], [66.4, 108.6, 1]]), T.shirt, {
        sw: 1.3, dx: -1.6, dy: -1.6, rim: 0,
        inner: k.line("M 72.8 84 L 72.8 108", T.shirt.s, 1.1) + `<circle cx="71" cy="91.6" r=".95" fill="${T.shirt.s}"/><circle cx="71" cy="99.4" r=".95" fill="${T.shirt.s}"/>`,
      });
      const lapel: Pt[] = [[65.6, 79.6, 1], [60.6, 82.8], [63.2, 88.6], [67, 98.6, 1], [67.4, 86.6]];
      up += k.shape(sp(lapel), T.green, { sw: 1.3, dx: -1.2, dy: -1.6, rim: 1, inner: k.line("M 62.4 84 Q 64.6 90 66.6 96", T.green.h, 1.2, 0.6) });
      up += k.shape(sp(mir(lapel).reverse()), T.green, { sw: 1.3, dx: -1.2, dy: -1.6, rim: 1 });
      const tab: Pt[] = [[72, 81.8, 1], [66.4, 79.2, 1], [67.8, 86, 1]];
      up += k.shape(sp(tab), T.shirt, { sw: 1.2, dx: -0.8, dy: -1, rim: 0 }) + k.shape(sp(mir(tab).reverse()), T.shirt, { sw: 1.2, dx: -0.8, dy: -1, rim: 0 });
    } else {
      up += k.shape(sp([[61.6, 79.8], [72, 78.2], [82.4, 79.8], [81.6, 83.8], [72, 82.6], [62.4, 83.8]]), T.green, { sw: 1.3, dx: -1, dy: -1.4, rim: 0 });
    }
  }
  if (stL !== "back") up += boyArm(k, -1, stL, sleeve);
  if (stR !== "back") up += boyArm(k, 1, stR, sleeve);
  // 소매 (마네킹은 맨 위팔)
  if (o.top) up += o.top.shoulder(k, p, -1) + o.top.shoulder(k, p, 1);
  else up += boySleeve(k, BOY_SLEEVE_L, mq ? T.skin : T.green) + boySleeve(k, mir(BOY_SLEEVE_L).reverse(), mq ? T.skin : T.green);
  up += o.top?.collar?.(k, p) ?? "";
  if (mq) up += mannequinHead(k, p.view);
  else if (!back) {
    up += ear(k, 46.2, 65, -1) + ear(k, 97.8, 65, 1);
    up += faceFront(k);
    up += eyes(k, [60, 84], 63.8) + cheeks(k, [[53.8, 70.8], [90.2, 70.8]]) + mouth(k, 72, 72.6, 1.4);
    if (!o.hat) up += cowlick(k, 0);
    up += k.shape(sp(BOY_CAP_F), T.hair, {
      ol: T.olh, dx: -2.6, dy: -3,
      inner: k.blob(100, 44, 9, 18, T.hair.s, 0.4) +
        clumps(k, ["M 92.8 50.8 Q 93.4 44 91.4 38", "M 85.2 51.4 Q 85.4 45 84 40", "M 66.4 51.4 Q 65.4 45 66.8 39", "M 56.4 51.2 Q 54.8 45 56.2 39.4",
          "M 77.6 48.6 Q 77.6 37 74.6 28", "M 45 27 Q 50.4 30.4 52.4 36", "M 101 29 Q 96.4 32 95 37.6", "M 40.6 50.4 Q 45.4 48 47.4 43.6", "M 104 50.6 Q 99.6 48 98.4 43.4",
          "M 58 15 Q 61.6 20 61 25", "M 88.4 14.6 Q 85.6 19.6 86.4 24.6"]) +
        glints(k, ["M 57 41.6 Q 56 46 57.2 50", "M 88 41 Q 88.8 45 87.8 49"]) +
        shine(k, 47.4, 34, 72, 19, 96.6, 34, 3, [[59, 41.6, 1.1], [88.6, 41.6, 1]]),
    });
    up += k.shape(sp(BOY_LOCK_F), T.hair, { ol: T.olh, sw: 1.3, dx: -1, dy: -1.4, rim: 0.8 });
  } else {
    up += boyBackHead(k, !o.hat);
  }
  up += o.hat?.hat(k, p) ?? "";
  out += `<g transform="translate(0 ${g.bob}) rotate(${g.tilt} 72 112)">${up}</g>`;
  return out;
}

// 뒷모습: 위는 넓고 목덜미로 갈수록 좁아지며, 뾰족한 뭉치 4개가 목을 덮는다
const BOY_BACK: Pt[] = [
  ...shag({ cx: 72, cy: 43.2, rx: 33.6, ry: 31.6, a0: 152, a1: 388, n: 9, out: 2.2, inn: 1.2, pw: 2.35, seed: 3, sweep: 1.5, tip: 0.4 }),
  // 목덜미 쪽으로 좁아지며 뾰족한 뭉치 4개가 목을 덮는다
  [98.8, 64.6], [95.6, 71, 0.8], [91.2, 68.6], [87.4, 76.2, 0.8], [82.6, 71.8], [77.8, 78.4, 0.8], [72.6, 73.2],
  [66.2, 77.8, 0.8], [61.4, 71.4], [56.4, 75, 0.8], [52.6, 68.2], [48.2, 69.4, 0.8], [45.4, 64.4],
];

function boyBackHead(k: Kit, withCowlick: boolean) {
  const T = k.P;
  let s = ear(k, 39.8, 63, -1, 4.8) + ear(k, 104.2, 63, 1, 4.8) + (withCowlick ? cowlick(k, 0) : "");
  // 정수리 가마에서 퍼지는 짧은 뭉치 선
  const C = [
    "M 72 26 Q 66 30 64.6 37", "M 72 26 Q 79 28 81.4 35", "M 70.6 27 Q 70 34 72.6 40",
    "M 58 15.4 Q 61.6 21 61 27", "M 88 15 Q 85.6 20 86.6 26", "M 45.4 24.6 Q 50.6 28 52 34", "M 102 26.4 Q 97 29.6 95.6 35",
    "M 55 40 Q 51 49 54.6 57", "M 89 40 Q 93 49 89.4 57", "M 66 46 Q 63.6 54 66.6 62", "M 79 46 Q 81.6 54 78.6 62",
    "M 40.6 47.6 Q 45 47 47.4 51.4", "M 104 47.6 Q 99.6 47 97.4 51.4", "M 58 62 Q 57 67 58.6 71", "M 86 62 Q 87.4 67 85.6 71", "M 72.4 63 Q 71.6 68 73 72",
  ];
  s += k.shape(sp(BOY_BACK), T.hair, {
    ol: T.olh, dx: -2.8, dy: -3.4,
    inner: k.blob(82, 62, 20, 12, T.hair.s, 0.45) + k.blob(102, 46, 7, 18, T.hair.s, 0.4) + clumps(k, C, 0.7) +
      glints(k, ["M 44 40 Q 42 46 43.4 52", "M 76 30 Q 78 35 77 40"]) +
      shine(k, 46.4, 33, 72, 19, 97.6, 33, 13, [[59.6, 41, 1.2], [85.6, 41.6, 1.1]]),
  });
  return s;
}

// 옆모습 (오른쪽을 본다)
const BOY_CAP_S: Pt[] = [
  ...shag({ cx: 68.6, cy: 43, rx: 33, ry: 31.6, a0: 128, a1: 338, n: 8, out: 2.2, inn: 1.2, pw: 2.35, seed: 11, sweep: 1.5, tip: 0.4 }),
  [101.6, 33.6], [104.6, 40.4, 0.7], [101.4, 45], [103.2, 50.8, 0.7], [99, 51.4],
  [97.8, 57, 0.8], [93.8, 50.6, 0.5], [89.4, 57.4, 0.8], [85.6, 50.4, 0.5], [80.6, 56.4, 0.8], [76.8, 50.4, 0.5], [71.8, 56.4, 0.8], [68.4, 51.8],
  [64.8, 54.4], [62.2, 59.2], [60.4, 65], [57.6, 70], [54.6, 76.4, 0.8], [50.4, 70.6],
];

function boySide(k: Kit, p: Pose, o: Outfit, g: Gait) {
  const T = k.P;
  const mq = p.kind === "mannequin";
  const sw = g.step * 20;
  const bob = g.step ? -1.4 : 0;
  let out = "";
  const leg = (hx: number, deg: number, far: boolean) => {
    const lg = boySideLeg(hx, deg, far);
    const { ax, ay } = lg;
    const sock = far ? { b: T.sock.s, s: darken(T.sock.s, 0.08), h: T.sock.b } : T.sock;
    const pant = far ? { b: T.pants.s, s: darken(T.pants.s, 0.15), h: T.pants.b } : T.pants;
    const skin = far ? { b: T.skin.s, s: darken(T.skin.s, 0.08), h: T.skin.b } : T.skin;
    const w = 5.6;
    let s = "";
    // 맨다리 (하의가 짧거나 마네킹이면 보인다)
    if ((o.bottom && !o.bottom.long) || mq) s += k.shape(capsule(hx, lg.hy - 2, ax, ay + 2, 4.6), skin, { dx: -1.4, dy: 0, rim: 1 });
    // 양말(2~3 단위 띠) → 바짓가랑이(굵게, 아래 접단) → 신발
    if (!mq) s += k.shape(`M ${f(ax - 4.4)} ${f(ay - 2)} L ${f(ax + 4.4)} ${f(ay - 2)} L ${f(ax + 4.4)} ${f(ay + 4)} L ${f(ax - 4.4)} ${f(ay + 4)} Z`, sock, { dx: -1, dy: 0, rim: 0.6 });
    if (o.bottom) s += o.bottom.leg?.(k, p, lg) ?? "";
    else if (!mq) {
      const pd = sp([[hx - w, lg.hy - 6, 1], [hx + w, lg.hy - 6, 1], [ax + w, ay + 0.6, 0.6], [ax - w, ay + 0.6, 0.6]]);
      s += k.shape(pd, pant, {
        ol: T.olh, dx: -2, dy: -1.6, rim: 1,
        inner: `<rect x="${f(ax - w - 1)}" y="${f(ay - 2.2)}" width="${f(2 * w + 2)}" height="3" fill="${pant.h}" opacity=".75"/>` +
          k.line(`M ${f(ax - w)} ${f(ay - 2.2)} L ${f(ax + w)} ${f(ay - 2.2)}`, pant.s, 1.1, 0.9),
      });
    }
    s += o.shoes ? o.shoes.footSide(k, p, ax - 0.6, lg.by, far) : mq ? bareFootSide(k, ax - 0.6, lg.by, far) : shoeSide(k, ax - 0.6, lg.by, T.shoe, false, far);
    return s;
  };
  out += leg(69.6, -sw, true) + leg(74.6, sw, false);
  let up = "";
  // 먼 쪽 팔 (몸 뒤)
  const farA = sw * 0.9;
  const farTone = { b: T.skin.s, s: darken(T.skin.s, 0.1), h: T.skin.b };
  const farArm: ArmGeom = { px: 70, py: 92, hx: 71, hy: 104, side: -1, far: true };
  const farSleeve: Pt[] = [[64.8, 81.6], [72.6, 81], [76.6, 86], [77.6, 93.4, 1], [71.4, 95], [65.2, 93.8, 1], [63.8, 87.4]];
  up += `<g transform="rotate(${f(-farA)} 70 90)">` + k.shape(capsule(70, 92, 71, 104, 4, 5.2), farTone, { dx: -1.2, dy: -1.4, rim: 0.8 }) +
    (o.top ? (o.top.arm?.(k, p, farArm) ?? "") + o.top.shoulder(k, p, -1) : boySleeve(k, farSleeve, mq ? farTone : { b: T.green.s, s: darken(T.green.s, 0.15), h: T.green.b })) + "</g>";
  // 엉덩이
  if (o.bottom) up += o.bottom.hips(k, p);
  else up += k.shape(sp([[59, 100, 1], [86, 100, 1], [86.6, 109.4], [72, 112.4], [58.4, 109.4]]), mq ? T.skin : T.pants, { ol: mq ? T.ol : T.olh, dx: -3, dy: -2.6 });
  // 재킷: 등이 둥글게 부푼 상자 모양, 앞섶 사이로 셔츠
  if (o.top) up += o.top.torso(k, p);
  else if (mq) up += k.shape(sp([[62.4, 80.4, 1], [80, 79.4], [86.6, 82, 1], [88.2, 92], [89, 101.6], [88.4, 105, 1], [72, 107.4], [56, 105, 1], [54, 99], [54.6, 90], [57.6, 83.4]]), T.skin, { dx: -3, dy: -2.6 });
  else {
    up += k.shape(sp([[62.4, 80.4, 1], [80, 79.4], [86.6, 82, 1], [88.6, 92], [90.6, 101.6], [90.8, 107.4, 1], [72, 109.6], [54.4, 107.4, 1], [52.8, 99], [54, 90], [57.6, 83.4]]), T.green, {
      dx: -3.2, dy: -2.6,
      inner: `<path d="${sp([[80.4, 79.6], [86.6, 82, 1], [88.8, 94], [91, 108, 1], [86.4, 108.4, 1], [84.6, 94], [81, 84]])}" fill="${T.shirt.b}"/>` +
        k.line("M 84.6 84 L 86.4 108.2", T.green.s, 1.2, 0.9) + k.line("M 56.6 92 Q 55.4 100 55.6 106", T.green.h, 2.4, 0.6) +
        k.line("M 54.8 103.4 Q 72 106.6 90.4 103.4", T.green.s, 1.1, 0.7) + k.blob(70, 80.6, 14, 3, T.green.s, 0.55),
    });
    up += k.shape(sp([[79.4, 79.4, 1], [85.6, 80.6, 1], [83.6, 86.2, 1]]), T.shirt, { sw: 1.2, dx: -0.8, dy: -1, rim: 0 });
  }
  // 가까운 팔 (소매 고정, 아래팔만 흔든다)
  const nearA = -sw * 0.9;
  const nearArm: ArmGeom = { px: 74, py: 93, hx: 75.4, hy: 104.4, side: 1 };
  up += `<g transform="rotate(${f(-nearA)} 74 90)">` + k.shape(capsule(74, 93, 75.4, 104.4, 4.2, 5.6), T.skin, {
    dx: -1.6, dy: -1.8, rim: 1.1,
    inner: k.line("M 79.2 102 Q 80.6 104.8 79 107.6", T.skin.s, 1.2, 0.9),
  }) + (o.top?.arm?.(k, p, nearArm) ?? "") + "</g>";
  if (o.top) up += o.top.shoulder(k, p, 1) + (o.top.collar?.(k, p) ?? "");
  else up += boySleeve(k, [[66.6, 81.4], [75.4, 80.8], [80.6, 85.2], [82.2, 93.6, 1], [74.4, 95.8], [66.2, 94.4, 1], [64.6, 87.4]], mq ? T.skin : T.green);
  // 머리
  if (mq) up += mannequinHead(k, "side");
  else {
    up += faceSide(k);
    if (!o.hat) up += cowlick(k, -3);
    up += k.shape(sp(BOY_CAP_S), T.hair, {
      ol: T.olh, dx: -2.6, dy: -3,
      inner: k.blob(50, 54, 13, 16, T.hair.s, 0.4) +
        clumps(k, ["M 76.8 50.6 Q 76.6 45 78 40", "M 85.6 50.6 Q 86.4 45 85.2 40", "M 93.8 50.8 Q 94.6 45 93 41", "M 101.4 45.2 Q 97 44 95 40",
          "M 58 15 Q 61.4 20 60.6 25", "M 43.6 25 Q 49 28 50.4 34", "M 37.4 41 Q 43 42 45 47", "M 40.6 60 Q 45.6 57.6 47.4 52.6", "M 50.4 70.6 Q 52 64 50.6 58"]) +
        glints(k, ["M 92 38 Q 93 43 92 47", "M 44 46 Q 43 51 44.4 56"]) +
        shine(k, 45, 32, 68, 18, 93, 30, 6, [[84.4, 37.6, 1.1], [55, 40, 1]]),
    });
    up += ear(k, 65.4, 64, 1, 4.5);
  }
  up += o.hat?.hat(k, p) ?? "";
  out += `<g transform="translate(0 ${bob})">${up}</g>`;
  return out;
}

// ───────── 공개 함수 ─────────

/** 새 그림체(앞·뒤·옆, 걷기)로 그리는 캐릭터인가 (남자·여자 주민, 방문자, 마네킹) */
export function hasViews(characterAsset: string): boolean {
  return characterAsset in KIND_BY_ASSET;
}

/** 꾸미기를 입을 수 있는 캐릭터인가 (남자·여자 주민) */
export function canWear(characterAsset: string): boolean {
  return WEARABLE.has(characterAsset);
}

/** 캐릭터 키 + 입은 꾸미기 키들 → 모습 키 */
export function composeLook(characterAsset: string, avatarAssets: string[] = []): string {
  return [characterAsset, ...avatarAssets.filter(Boolean)].join("+");
}

/** 모습 키 → 캐릭터 키 + 꾸미기 키들 */
export function parseLook(look: string): { character: string; avatars: string[] } {
  const [character, ...avatars] = look.split("+");
  return { character: character ?? "", avatars };
}

/**
 * 새 그림체 캐릭터 한 장 (정사각형 SVG, 발은 아래 가운데 y=0.93).
 * look = 캐릭터 키 또는 모습 키, view = 앞·뒤·옆(오른쪽), frame = 0 서 있기 · 1·2 걷기.
 * 새 그림체가 아닌(예전) 캐릭터는 null.
 */
export function playerSvg(look: string, view: CharView, frame: WalkFrame, size: number): string | null {
  const { character, avatars } = parseLook(look);
  const kind = KIND_BY_ASSET[character];
  if (!kind) return null;
  const pal = kind === "visitor" ? VISITOR_PAL : kind === "mannequin" ? MANNEQUIN_PAL : BASE;
  const pieces = WEARABLE.has(character) ? piecesInOrder(avatars) : [];
  // id는 꾸미기 순서와 상관없이 같은 모습이면 같게 (옷장·블로그 홈이 같은 src를 쓰도록)
  const idKey = [character, ...avatars.filter(Boolean).sort()].join("+");
  const { k, defs } = mkKit(`${idKey}|${view}|${frame}`, pal);
  const g = gait(frame);
  const pose: Pose = { kind, view, frame, back: view === "back", liftL: g.liftL, liftR: g.liftR, head: HEADS[kind][view] };
  const o = outfitOf(pieces);
  const body = kind === "girl" ? girl(k, pose, o) : boy(k, pose, o);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="${size}" height="${size}"><defs>${defs.join("")}</defs>${body}</svg>`;
}

/** 캐릭터 SVG 문자열 (앞모습, 서 있기). size는 픽셀 크기 (Phaser가 그림을 만들 때 해상도로 쓴다).
 *  assetKey는 캐릭터 키 또는 모습 키(꾸미기를 +로 붙인 것) */
export function characterSvg(assetKey: string, size = 64): string {
  const player = playerSvg(assetKey, "front", 0, size);
  if (player) return player;
  const { character } = parseLook(assetKey);
  const look = LEGACY[character] ?? LEGACY_FALLBACK;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -8 72 72" width="${size}" height="${size}">${drawLegacy(look)}</svg>`;
}

export function characterDataUri(assetKey: string, size = 64): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(characterSvg(assetKey, size))}`;
}

/**
 * 동그란 얼굴 배지(CharacterBadge)에 담을 부분 — 그림 한 변에 대한 비율.
 * span = 배지에 담을 정사각형 한 변, cx·cy = 그 가운데
 */
export function faceFrame(assetKey: string): { span: number; cx: number; cy: number } {
  const { character } = parseLook(assetKey);
  if (character === MANNEQUIN) return { span: 0.48, cx: 0.5, cy: 0.4 };
  if (hasViews(character)) return { span: 0.56, cx: 0.5, cy: 0.35 };
  return { span: 1, cx: 0.5, cy: 0.39 }; // 예전 그림: 예전 배지와 같은 자리
}
