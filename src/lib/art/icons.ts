// UI 아이콘. 이모지 대신 쓰는 코드로 그린 SVG. 2026-10-11 크레용 그림체 (crayon.ts ICON).
// 좌표는 128×128 viewBox. 작은 크기(20~24px)에서도 알아보도록 실루엣을 굵고 단순하게 그린다.
import { icon } from "./crayon";

export const ICON_NAMES = [
  "mail", "coin", "exp", "heart", "comment", "guestbook",
  "notice", "inquiry", "write", "search", "category", "invite",
  "pet", "shop", "background", "furniture", "clothes", "hat",
  "settings", "level", "alert", "news", "achievement", "home",
  "egg", "potion", "carrot", "hand", "calendar", "lock", "logout", "back", "campfire",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** 아이콘 SVG 문자열 (<img>·data URI로 쓴다. 그림마다 문서가 따로라 id가 겹쳐도 된다) */
export function iconSvg(name: IconName, size = 48): string {
  return icon(name, size);
}

const uriCache = new Map<string, string>();
/** <img src>용 data URI */
export function iconDataUri(name: IconName, size = 48): string {
  const key = `${name}:${size}`;
  let uri = uriCache.get(key);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon(name, size))}`;
    uriCache.set(key, uri);
  }
  return uri;
}
