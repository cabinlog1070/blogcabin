// BlogCabin 캐릭터 (SVG). 외부 그림 없이 코드로 그려서 라이선스 걱정이 없다.
//
// 1) 주민(남자·여자)·방문자·마네킹: 2026-10-11 크레용 그림체 (crayon-people.ts), 큰 머리에 작고 통통한 몸 (2026-10-12 시안).
//    viewBox 288×288. 발바닥은 y=268~270 → 아래 가운데 기준 0.93 (예전 그림과 같은 자리).
//    앞·뒤·옆(오른쪽을 본다) 모습과 걷기 2장을 그린다 (playerSvg). 광장 걷기 그림 목록은 character-views.ts.
// 2) 예전 캐릭터(고양이·강아지…): 상점에서 빠졌지만 가진 사람이 있을 수 있어 예전 그림 그대로 둔다.
//    viewBox 64×64(+여백), 발바닥 y=59 근처.
//
// 아바타 꾸미기(SHOP-06): "모습 키"는 캐릭터 키 뒤에 입은 꾸미기 키를 +로 붙인 문자열이다.
// 예) "char.boy+avatar.hat.straw+avatar.top.hoodie". 꾸미기 조각은 avatar.ts.
// 꾸미기는 남자·여자 주민(과 상점 미리보기용 마네킹)에만 입힌다. 상점에서 빠진 캐릭터를
// 장착한 동안에는 입은 상태가 저장돼 있어도 그리지 않는다 (spec 006 Edge Cases).

import { piecesInOrder } from "./avatar";
import { person, type Wear } from "./crayon-people";

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


// ═════════════════════════ 크레용 그림체 주민 ═════════════════════════

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
  const wear: Wear = {};
  if (WEARABLE.has(character))
    for (const p of piecesInOrder(avatars)) {
      if (p.slot === "top") wear.top = p.top;
      else if (p.slot === "bottom") wear.bottom = p.bottom;
      else if (p.slot === "shoes") wear.shoes = p.shoes;
      else wear.hat = p.hat;
    }
  return person(kind, view, frame, wear, size);
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
  if (hasViews(character)) return { span: 0.6, cx: 0.5, cy: 0.3 };
  return { span: 1, cx: 0.5, cy: 0.39 }; // 예전 그림: 예전 배지와 같은 자리
}
