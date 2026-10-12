// 글 번역 (POST-10): 회원이 쓴 글이 지금 화면 언어와 다른 말로 쓰였는지 보고, 번역 버튼을 띄울지 정한다.
// 번역은 서버를 거치지 않는다: 브라우저에 들어 있는 번역 기능(Chrome Translator API)이 있으면 그 자리에서,
// 없으면 파파고 웹사이트를 새 탭으로 연다. 그래서 API 키·요금이 없다.
import type { Locale } from "@/lib/i18n";

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/g; // 히라가나·가타카나(반각 포함)
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/g;

/** 글이 주로 어떤 말로 쓰였는지. 가나·한글이 거의 없으면(영어, 숫자뿐 등) null */
export function detectPostLanguage(text: string): Locale | null {
  const kana = text.match(KANA)?.length ?? 0;
  const hangul = text.match(HANGUL)?.length ?? 0;
  if (kana + hangul < 5) return null;
  // 한국어 글에 일본어 한두 단어가 섞인 정도로는 바꾸지 않는다
  if (kana > hangul * 2) return "ja";
  if (hangul > kana * 2) return "ko";
  return null;
}

/** 파파고 웹 번역 주소. 너무 길면 주소가 잘리므로 앞부분만 넘긴다 */
export const PAPAGO_MAX_CHARS = 3000;
export function papagoUrl(from: Locale, to: Locale, text: string) {
  const st = text.length > PAPAGO_MAX_CHARS ? text.slice(0, PAPAGO_MAX_CHARS) : text;
  return `https://papago.naver.com/?sk=${from}&tk=${to}&st=${encodeURIComponent(st)}`;
}
