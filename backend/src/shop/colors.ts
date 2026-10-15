// 고를 수 있는 색 (무료 꾸미기). DB CHECK(db/schema.ts)와 같은 목록이어야 한다 (frontend의 npm run test:shop이 확인한다).
// 화면 코드도 읽어서 DB 코드를 끌어오지 않게 따로 둔다.
// 색 이름·실제 색 값은 화면 그림 코드(frontend/src/lib/art)에 있고, 그 표는 이 목록과 키가 같아야 한다 (satisfies로 확인)

/** 머리 색 (2026-10-13): profiles_hair_color_check */
export const HAIR_COLOR_KEYS = ["black", "brown", "caramel", "blonde", "red", "pink", "blue", "purple", "mint"] as const;
export type HairColor = (typeof HAIR_COLOR_KEYS)[number];
export const isHairColor = (c: unknown): c is HairColor => typeof c === "string" && (HAIR_COLOR_KEYS as readonly string[]).includes(c);

/** 가구 색 (SHOP-05, 2026-10-13): user_items_color_check */
export const FURNITURE_COLOR_KEYS = ["wood", "pink", "sky", "mint", "lemon", "lilac", "white", "navy"] as const;
export type FurnitureColor = (typeof FURNITURE_COLOR_KEYS)[number];
export const isFurnitureColor = (v: unknown): v is FurnitureColor => typeof v === "string" && (FURNITURE_COLOR_KEYS as readonly string[]).includes(v);

/** 광장 내 집 지붕 색 (TOWN-07): blogs_roof_color_check */
export const ROOF_COLOR_KEYS = ["red", "orange", "yellow", "green", "sky", "blue", "purple", "brown"] as const;
export type RoofColor = (typeof ROOF_COLOR_KEYS)[number];
export const isRoofColor = (v: unknown): v is RoofColor => typeof v === "string" && (ROOF_COLOR_KEYS as readonly string[]).includes(v);
