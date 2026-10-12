// 일본어 사전: 한국어 문장 → 일본어 문장. 화면 영역마다 파일을 나눠 둔다 (같은 문장이 여러 파일에 있어도 된다)
// {n} 같은 자리 표시는 번역문에도 그대로 둔다.
import { jaCommon } from "./common";

export const ja: Record<string, string> = {
  ...jaCommon,
};
