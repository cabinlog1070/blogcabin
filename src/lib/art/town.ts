// 광장 건물·소품 그림 (SVG). Phaser가 이 SVG를 이미지로 바꿔 광장에 놓는다.
// 2026-10-11 크레용 그림체 (crayon.ts). 좌표는 화면 크기의 2배. 그림은 아랫변 가운데를 발 닿는 곳으로 놓는다.
import { backgroundAccent } from "./backgrounds";
import { attendance, bench, board, campfireBase, campfireFront, farm, flame, house, lamp, shop, tree } from "./crayon";

// ===== 집 = 둥근 지붕 오두막 (단계별 성장, TOWN-11) =====
// 1단계: 문 + 창 하나 / 2단계: + 창 두 개(꽃 상자)·굴뚝, 더 크게 / 3단계: + 지붕 다락방 창, 더 크게
// 단계는 집 주인의 레벨로 정한다 (houseStageForLevel, src/lib/game.ts). wall.left~right = 벽의 x 범위(충돌 영역, 화면 px)
export const HOUSE_STAGES = {
  1: { name: "작은 오두막", width: 150, height: 140, wall: { left: 26, right: 124, top: 70 }, roofTop: 20 },
  2: { name: "창문 있는 오두막", width: 182, height: 168, wall: { left: 33, right: 149, top: 84 }, roofTop: 20 },
  3: { name: "다락방 오두막", width: 214, height: 204, wall: { left: 39, right: 175, top: 99 }, roofTop: 14 },
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

// ----- 크기 (화면 px). 그림은 아랫변 가운데를 발 닿는 곳으로 놓는다 -----
export const BOARD_SIZE = { width: 170, height: 170 };
export const ATTENDANCE_SIZE = { width: 110, height: 150 };
export const SHOP_SIZE = { width: 210, height: 180 };
export const FARM_SIZE = { width: 260, height: 170 };
export const CAMPFIRE_SIZE = { width: 180, height: 150 };
export const FLAME_FRAMES = 3;
export const BENCH_SIZE = { width: 90, height: 40 };
export const LAMP_SIZE = { width: 40, height: 110 };
/** 랜턴 불빛 가운데: lampSvg 그림 왼쪽 위에서 (x, y) px */
export const LAMP_LIGHT = { x: 29.5, y: 49 };
export const TREE_SIZE = { width: 80, height: 100 };

/** 집 (HOUSE_STAGES 크기). roof = 지붕 색 (#rrggbb) */
export function houseSvg(stage: HouseStage, roof: string): string {
  return house(stage, roof);
}
export const farmSvg = (): string => farm();
export const shopSvg = (): string => shop();
export const boardSvg = (): string => board();
export const attendanceSvg = (): string => attendance();

/** 돌 고리 + 장작 + 숯불 (불꽃 없음). 화면 180×150, 불 중심 = (90, 99)px */
export const campfireSvg = (): string => campfireBase();
/** 불꽃 한 프레임 (0,1,2). 모닥불과 같은 기준점 — 그대로 겹쳐 쓴다 */
export const flameSvg = (frame: number): string => flame(frame);
/** 모닥불의 앞쪽 장작·돌만 (불꽃 위에 겹쳐서 불꽃 밑동이 장작 뒤로 들어가 보이게 한다) */
export const campfireFrontSvg = (): string => campfireFront();

/** 불가에 놓는 통나무 의자 (BENCH_SIZE) */
export const benchSvg = (): string => bench();
/** 랜턴 기둥 (LAMP_SIZE, 불빛 가운데 LAMP_LIGHT) */
export const lampSvg = (): string => lamp();
/** 광장 나무 (TREE_SIZE). bush 는 꽃 덤불을 같은 틀 아래 가운데에 놓는다 */
export const treeSvg = (kind: "round" | "pine" | "bush" | "blossom"): string => tree(kind);

export function toDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
