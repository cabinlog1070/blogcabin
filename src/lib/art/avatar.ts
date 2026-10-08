// 아바타 꾸미기 그림 (SHOP-06). 캐릭터 SVG(characters.ts)와 같은 좌표계(viewBox 64×64)에 겹쳐 그린다.
// 남녀 공용: 남자·여자 주민 모두 같은 몸(2등신)이라 같은 그림을 입힌다.
// 부위 4가지와 그리는 순서: 몸 → 하의 → 상의 → 신발 → 모자 (SLOT_ORDER)
// DB의 asset_key("avatar.hat.straw" 등)로 고른다.

const OUTLINE = "#3b2a20";
const S = `stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"`;

export type AvatarSlot = "top" | "bottom" | "hat" | "shoes";

/** 그리는 순서 (앞쪽이 먼저 = 뒤에 깔린다) */
export const SLOT_ORDER: AvatarSlot[] = ["bottom", "top", "shoes", "hat"];

export const SLOT_LABEL: Record<AvatarSlot, string> = { top: "상의", bottom: "하의", hat: "모자", shoes: "신발" };

/**
 * body: 몸 위(팔보다 아래)에 그릴 것
 * sleeves: 팔 위에 그릴 것 (소매)
 * top: 머리까지 다 그린 뒤 맨 위에 그릴 것 (모자)
 */
export type AvatarPiece = { slot: AvatarSlot; body?: string; sleeves?: string; top?: string };

// 몸통 타원(cx 32, cy 46.5, rx 12.5, ry 10.5)의 y 아래쪽 부분
const lowerBody = (y: number, fill: string) =>
  `<path d="M${(32 - 12.45).toFixed(2)} ${y}H${(32 + 12.45).toFixed(2)}A12.5 10.5 0 0 1 ${(32 - 12.45).toFixed(2)} ${y}Z" fill="${fill}" ${S}/>`;
const wholeBody = (fill: string) => `<ellipse cx="32" cy="46.5" rx="12.5" ry="10.5" fill="${fill}" ${S}/>`;
const sleeve = (fill: string) =>
  `<ellipse cx="20.2" cy="45" rx="3.4" ry="4.2" transform="rotate(25 20.2 45)" fill="${fill}" ${S}/>` +
  `<ellipse cx="43.8" cy="45" rx="3.4" ry="4.2" transform="rotate(-25 43.8 45)" fill="${fill}" ${S}/>`;
const shoe = (fill: string, extra = "") =>
  `<path d="M20.4 57.6c0-2.6 2.2-4 5.1-4s5.1 1.4 5.1 4q0 1.4-1.6 1.4h-7q-1.6 0-1.6-1.4z" fill="${fill}" ${S}/>` +
  `<path d="M33.4 57.6c0-2.6 2.2-4 5.1-4s5.1 1.4 5.1 4q0 1.4-1.6 1.4h-7q-1.6 0-1.6-1.4z" fill="${fill}" ${S}/>` +
  extra;

export const AVATAR_PIECES: Record<string, AvatarPiece> = {
  // ===== 상의 =====
  // 줄무늬 티셔츠
  "avatar.top.stripe": {
    slot: "top",
    body:
      wholeBody("#ffffff") +
      `<path d="M20.5 41.5h23M19.6 45.5h24.8M19.8 49.5h24.4" stroke="#4f8fe0" stroke-width="2.2"/>` +
      `<ellipse cx="32" cy="46.5" rx="12.5" ry="10.5" fill="none" ${S}/>`,
    sleeves: sleeve("#ffffff"),
  },
  // 후드티: 보라색, 주머니, 끈
  "avatar.top.hoodie": {
    slot: "top",
    body:
      wholeBody("#9b7bd4") +
      `<path d="M26 50.5h12l-1.4 4.2h-9.2z" fill="#8466c2" ${S}/>` +
      `<path d="M29 42.5v5M35 42.5v5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
      `<circle cx="29" cy="48" r=".9" fill="#fff"/><circle cx="35" cy="48" r=".9" fill="#fff"/>`,
    sleeves: sleeve("#9b7bd4"),
  },
  // 니트 스웨터: 초록, 가운데 하트 무늬
  "avatar.top.knit": {
    slot: "top",
    body:
      wholeBody("#4caf7a") +
      `<path d="M21 52.5q11 3 22 0" fill="none" stroke="#3d8f62" stroke-width="2"/>` +
      `<path d="M32 50.2c-3.2-2.2-4.2-4.4-2.6-5.6c1.1-.8 2.2-.3 2.6.6c.4-.9 1.5-1.4 2.6-.6c1.6 1.2.6 3.4-2.6 5.6z" fill="#ff8fa3"/>`,
    sleeves: sleeve("#4caf7a") + `<path d="M17.6 48.4l3.8 1.6M46.4 48.4l-3.8 1.6" stroke="#3d8f62" stroke-width="1.6"/>`,
  },

  // ===== 하의 =====
  // 반바지: 하늘색
  "avatar.bottom.shorts": {
    slot: "bottom",
    body: lowerBody(48, "#7cc4e8") + `<path d="M32 50v6.8" stroke="${OUTLINE}" stroke-width="1.2"/>`,
  },
  // 청바지: 남색, 바느질 선
  "avatar.bottom.jeans": {
    slot: "bottom",
    body:
      lowerBody(47, "#3f5f9e") +
      `<path d="M32 49v7.8" stroke="${OUTLINE}" stroke-width="1.2"/>` +
      `<path d="M22 49.5q4 1.6 7 0M35 49.5q3 1.6 7 0" fill="none" stroke="#f2c14e" stroke-width=".9" stroke-dasharray="1.2 1"/>`,
  },
  // 주름치마: 빨간 체크, 아래로 퍼짐
  "avatar.bottom.skirt": {
    slot: "bottom",
    body:
      `<path d="M20 47h24l3.2 9.4q-15.2 3.4-30.4 0z" fill="#e85d4a" ${S}/>` +
      `<path d="M24.5 47.4l-1.6 9.6M29 47.4l-.6 10.2M35 47.4l.6 10.2M39.5 47.4l1.6 9.6" stroke="#b8402f" stroke-width="1"/>` +
      `<path d="M18.4 51.5h27.2" stroke="#ffd36e" stroke-width=".9" opacity=".8"/>`,
  },

  // ===== 신발 =====
  // 운동화: 흰색, 빨간 줄
  "avatar.shoes.sneakers": {
    slot: "shoes",
    body: shoe("#ffffff", `<path d="M23 56.4h5M36 56.4h5" stroke="#e85d4a" stroke-width="1.3" stroke-linecap="round"/>`),
  },
  // 장화: 노란 장화, 발목까지
  "avatar.shoes.boots": {
    slot: "shoes",
    body:
      `<path d="M21 52h8.6v5.2q0 2-1.8 2H22.8q-1.8 0-1.8-2z" fill="#ffd36e" ${S}/>` +
      `<path d="M34.4 52H43v5.2q0 2-1.8 2h-5q-1.8 0-1.8-2z" fill="#ffd36e" ${S}/>` +
      `<path d="M21 54h8.6M34.4 54H43" stroke="#e0a72c" stroke-width="1.2"/>`,
  },
  // 반짝 구두: 빨간 에나멜 구두, 반짝이
  "avatar.shoes.shiny": {
    slot: "shoes",
    body: shoe(
      "#d94b6a",
      `<path d="M23.4 55.6l1.6-.8M36.4 55.6l1.6-.8" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
        `<path d="M47 52.5l.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8z" fill="#ffd36e"/>`,
    ),
  },

  // ===== 모자 =====
  // 밀짚모자: 넓은 챙, 빨간 띠
  "avatar.hat.straw": {
    slot: "hat",
    top:
      `<path d="M20.5 15.5Q20.5 3.5 32 3.5T43.5 15.5Z" fill="#f6d98a" ${S}/>` +
      `<path d="M20.8 12.2q11.2 2.6 22.4 0l.3 3h-23z" fill="#e85d4a"/>` +
      `<ellipse cx="32" cy="16" rx="22" ry="4.4" fill="#f2cf73" ${S}/>` +
      `<path d="M14 16.4q18 3.2 36 0" fill="none" stroke="#d9b45a" stroke-width=".9"/>`,
  },
  // 털모자: 파란 비니, 방울
  "avatar.hat.beanie": {
    slot: "hat",
    top:
      `<path d="M15.6 21C15.6 6.5 48.4 6.5 48.4 21Z" fill="#5b8def" ${S}/>` +
      `<path d="M24 9.5v10M32 7.6v11.6M40 9.5v10" stroke="#4877d4" stroke-width="1.4"/>` +
      `<rect x="14.4" y="17.6" width="35.2" height="6" rx="3" fill="#3f6fcc" ${S}/>` +
      `<circle cx="32" cy="5.4" r="3.8" fill="#fff" ${S}/>`,
  },
  // 왕관: 금색, 보석
  "avatar.hat.crown": {
    slot: "hat",
    top:
      `<path d="M21 17.5L19.5 5.5l6.5 5.5L32 2.5l6 8.5l6.5-5.5L43 17.5z" fill="#ffd36e" ${S}/>` +
      `<rect x="20.6" y="15" width="22.8" height="4" rx="1.2" fill="#f2b632" ${S}/>` +
      `<circle cx="32" cy="12" r="1.8" fill="#e85d4a"/><circle cx="25.5" cy="13" r="1.3" fill="#6cb4ee"/><circle cx="38.5" cy="13" r="1.3" fill="#6cb4ee"/>`,
  },
};

/** 부위 순서대로 정리한 꾸미기 조각들 (없는 키는 건너뛴다) */
export function piecesInOrder(assetKeys: string[]): AvatarPiece[] {
  const pieces = assetKeys.map((k) => AVATAR_PIECES[k]).filter((p): p is AvatarPiece => Boolean(p));
  return SLOT_ORDER.flatMap((slot) => pieces.filter((p) => p.slot === slot).slice(0, 1));
}
