// 광장 자연·생활 소품 (SVG). 2026-10-11 크레용 그림체 (crayon.ts PROPS).
// *_SIZE 는 화면 크기(px), 그림 좌표는 그 2배. 그림은 아랫변 가운데를 발 닿는 곳으로 놓는다.
import { PROPS, pastel } from "./crayon";

export const FLOWERS_SIZE = { width: 40, height: 30 };
export const flowersSvg = (): string => pastel(PROPS.flowers);
export const GRASS_SIZE = { width: 34, height: 22 };
export const grassSvg = (): string => pastel(PROPS.grass);
export const ROCK_SIZE = { width: 46, height: 34 };
export const rockSvg = (): string => pastel(PROPS.rock);
export const FENCE_SIZE = { width: 90, height: 46 };
export const fenceSvg = (): string => pastel(PROPS.fence);
export const STUMP_SIZE = { width: 44, height: 40 };
export const stumpSvg = (): string => pastel(PROPS.stump);
export const SIGNPOST_SIZE = { width: 50, height: 80 };
export const signpostSvg = (): string => pastel(PROPS.signpost);
export const CRATE_SIZE = { width: 44, height: 44 };
export const crateSvg = (): string => pastel(PROPS.crate);
export const MAILBOX_SIZE = { width: 36, height: 64 };
export const mailboxSvg = (): string => pastel(PROPS.mailbox);
export const BARREL_SIZE = { width: 40, height: 46 };
export const barrelSvg = (): string => pastel(PROPS.barrel);
export const LAUNDRY_SIZE = { width: 90, height: 70 };
export const laundrySvg = (): string => pastel(PROPS.laundry);
export const PLANTER_SIZE = { width: 60, height: 40 };
export const planterSvg = (): string => pastel(PROPS.planter);
