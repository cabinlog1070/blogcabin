// 광장에서 걷는 캐릭터 그림 (앞·뒤·옆 모습 × 서 있기·걷기 2장).
// 남자·여자 주민(과 방문자·마네킹)은 모습마다 따로 그리고, 입은 꾸미기도 그 모습에 맞게 그린다
// (뒷모습: 모자 뒤쪽·옷 등판, 얼굴 없음 / 옆모습: 옆얼굴). 옆모습은 오른쪽을 본다 — 왼쪽으로 걸을 때는 좌우로 뒤집어 쓴다.
// 예전 캐릭터(고양이·강아지…)는 모습이 하나뿐이라 어느 모습이든 characterSvg 그림을 쓴다.
// 그림은 모두 정사각형이고 발(그림자 가운데)은 아래 가운데 y = 0.93 — characterSvg와 같은 자리라 같은 크기·기준점으로 놓으면 된다.

import { characterSvg, hasViews, parseLook, playerSvg, type CharView, type WalkFrame } from "./characters";

export type { CharView, WalkFrame } from "./characters";

/** 모든 모습 */
export const CHAR_VIEWS: readonly CharView[] = ["front", "back", "side"];
/** 장면 번호: 0 = 서 있기, 1·2 = 걷기 (다리·팔이 엇갈린다) */
export const CHAR_FRAMES: readonly WalkFrame[] = [0, 1, 2];
/** 걷는 동안 되풀이할 장면 순서 (1 → 0 → 2 → 0 …) */
export const WALK_FRAMES: readonly WalkFrame[] = [1, 0, 2, 0];
/** 그림 발 위치 (그림 높이에 대한 비율). setOrigin(0.5, CHAR_FOOT_Y) */
export const CHAR_FOOT_Y = 134 / 144;

/**
 * 한 모습·한 장면의 캐릭터 SVG (정사각형, size px).
 * look = 캐릭터 키 또는 모습 키("char.girl+avatar.hat.straw"), side 는 오른쪽을 본다.
 */
export function characterViewSvg(look: string, view: CharView, frame: WalkFrame, size: number): string {
  return playerSvg(look, view, frame, size) ?? characterSvg(look, size);
}

export function characterViewDataUri(look: string, view: CharView, frame: WalkFrame, size: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(characterViewSvg(look, view, frame, size))}`;
}

/** 이 모습 키가 앞·뒤·옆 그림을 따로 갖는가 (아니면 모든 모습이 같은 그림) */
export function lookHasViews(look: string): boolean {
  return hasViews(parseLook(look).character);
}

/** 텍스처 키 (Phaser 등). prefix 로 이름 공간을 나눈다 */
export function characterViewKey(look: string, view: CharView, frame: WalkFrame, prefix = "char"): string {
  return `${prefix}:${look}:${view}:${frame}`;
}

export type CharViewTexture = { key: string; view: CharView; frame: WalkFrame; svg: string };

/**
 * 이 모습 키로 미리 만들어 둘 그림 목록 (3모습 × 3장면 = 9장).
 * 예전 캐릭터도 9개 키를 모두 돌려준다 (그림은 같다) — 쓰는 쪽이 모습을 가리지 않고 같은 키 규칙을 쓸 수 있다.
 */
export function characterViewTextures(look: string, size: number, prefix = "char"): CharViewTexture[] {
  const list: CharViewTexture[] = [];
  const legacy = lookHasViews(look) ? null : characterSvg(look, size);
  for (const view of CHAR_VIEWS) {
    for (const frame of CHAR_FRAMES) {
      list.push({ key: characterViewKey(look, view, frame, prefix), view, frame, svg: legacy ?? characterViewSvg(look, view, frame, size) });
    }
  }
  return list;
}

/** 이동 방향(dx, dy) → 보여 줄 모습과 좌우 뒤집기 (옆모습 그림은 오른쪽을 보므로 왼쪽이면 flipX) */
export function viewForDirection(dx: number, dy: number): { view: CharView; flipX: boolean } {
  if (Math.abs(dx) > Math.abs(dy) * 0.9) return { view: "side", flipX: dx < 0 };
  return { view: dy < 0 ? "back" : "front", flipX: false };
}
