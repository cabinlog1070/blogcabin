// 일본어 사전: 한국어 문장 → 일본어 문장. 화면 영역마다 파일을 나눠 둔다 (같은 문장이 여러 파일에 있어도 된다)
// {n} 같은 자리 표시는 번역문에도 그대로 둔다.
import { jaAccount } from "./account";
import { jaBlog } from "./blog";
import { jaCommon } from "./common";
import { jaGame } from "./game";
import { jaReleaseNotes } from "./release-notes";
import { jaTown } from "./town";

export const ja: Record<string, string> = {
  ...jaReleaseNotes,
  ...jaTown,
  ...jaGame,
  ...jaBlog,
  ...jaAccount,
  ...jaCommon,
};
