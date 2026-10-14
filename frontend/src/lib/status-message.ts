/**
 * 상태 메시지 규칙 (TOWN-12). 광장 말풍선은 캔버스 글꼴로 그려서 이모티콘이 네모(□)로 깨진다.
 * 그래서 저장할 때 이모티콘을 막고, 이미 저장된 메시지는 말풍선에 보일 때 이모티콘을 뺀다.
 */
export const STATUS_MESSAGE_MAX = 30;

// 기본으로 그림처럼 보이는 글자(Emoji_Presentation)와 이모티콘 조합에 쓰는 글자만 막는다.
// ♥ ♪ ★ ☆ 같은 글자 기호는 글꼴에 있어서 깨지지 않으니 그대로 둔다 (뒤에 그림 표시 FE0F가 붙으면 막는다)
const EMOJI = /\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[‍️⃣\u{e0020}-\u{e007f}]/u;
const EMOJI_ALL = new RegExp(EMOJI.source, "gu");

export function hasEmoji(text: string): boolean {
  return EMOJI.test(text);
}

/** 이모티콘을 빼고 공백을 정리한다. 남는 글자가 없으면 null */
export function stripEmoji(text: string | null): string | null {
  if (!text) return null;
  const clean = text.replace(EMOJI_ALL, "").replace(/\s+/g, " ").trim();
  return clean || null;
}
