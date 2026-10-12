// 동물 농장 화면 배경 (TOWN-09): 풀밭, 나무 울타리, 둥지, 헛간, 건초. 2026-10-11 크레용 그림체 (crayon.ts).
// 타일(GRASS_TILE·FENCE_*)은 CSS 배경으로 반복하고, 헛간·건초·둥지는 <img>로 놓는다.
import { barn, fenceHTile, fenceVTile, grassTile, hay, nestBack, nestFront, pastel } from "./crayon";

const uri = (svg: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

/** 풀밭 무늬 120×120 반복 */
export const GRASS_TILE = uri(pastel(grassTile));
/** 가로 울타리 56×44 반복 */
export const FENCE_H_TILE = uri(pastel(fenceHTile));
/** 세로 울타리 22×52 반복 */
export const FENCE_V_TILE = uri(pastel(fenceVTile));

/** 알 둥지 220×100: 뒤판(알 뒤)과 앞 테두리(알 앞) */
export const nestBackSvg = (): string => pastel(nestBack);
export const nestFrontSvg = (): string => pastel(nestFront);
/** 작은 헛간 (오른쪽 위 장식) 120×110 */
export const barnSvg = (): string => pastel(barn);
/** 건초 더미 70×46 */
export const haySvg = (): string => pastel(hay);

export const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
