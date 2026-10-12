// 광장 이웃 주민의 동작 소품 (TOWN-12): 기타, 마시멜로 꼬치, 물뿌리개, 물방울, 음표, 하트.
// 파스텔 크레용 그림체(pastel). 좌표는 다른 광장 그림처럼 화면 크기의 2배로 그린다.
import { E, F, L, S, make, pastel } from "./crayon";

/** 화면에 놓는 크기 (CSS px). 그림은 이 크기의 2배로 그린다 */
export const ACT_PROP_SIZE = {
  guitar: { width: 40, height: 47 },
  marshmallow: { width: 58, height: 20 },
  can: { width: 30, height: 22 },
  drop: { width: 7, height: 10 },
  note: { width: 19, height: 25 },
  heart: { width: 16, height: 14 },
} as const;
export type ActProp = keyof typeof ACT_PROP_SIZE;

/** 그린 좌표 크기 (viewBox). 내보내는 크기(ACT_PROP_SIZE의 2배)로 늘려 그린다 */
const BOX: Record<ActProp, readonly [number, number]> = { guitar: [68, 80], marshmallow: [104, 36], can: [60, 44], drop: [12, 18], note: [30, 40], heart: [32, 28] };
const draw = (k: ActProp, body: () => string) => {
  const [w, h] = BOX[k];
  return pastel(() => make(w, h, body, { dw: ACT_PROP_SIZE[k].width * 2, dh: ACT_PROP_SIZE[k].height * 2 }));
};

/** 통기타 (몸통이 왼쪽 아래, 목이 오른쪽 위로 비스듬히). 캐릭터 몸 앞에 겹쳐 든다 */
export function guitarSvg(): string {
  return draw("guitar", () => {
      let o = "";
      // 목·머리 (오른쪽 위)
      o += S("M34 46L58 10L64 14L42 50Z", "#a8703f", 3);
      o += S("M56 4L66 2L70 10L62 16Z", "#8a5a32", 3);
      // 몸통: 8자 모양
      o += S("M10 52C2 44 6 30 18 30C24 30 26 34 30 34C34 34 38 28 46 32C56 38 54 52 46 58C50 68 42 78 28 78C12 78 4 66 10 52Z", "#f2b26b", 4);
      o += F(E(30, 52, 7), "#7b5a44");
      // 줄
      o += L("M24 66L62 8M28 68L64 10", 1.5, "#fff6e0");
      // 줄받침
      o += F("M18 64L30 70L32 66L20 60Z", "#8a5a32");
    return o;
  });
}

/** 마시멜로 꼬치: 긴 나무 꼬치 끝에 노릇하게 구운 마시멜로 (꼬치 끝이 오른쪽) */
export function marshmallowSvg(): string {
  return draw("marshmallow", () => {
      let o = L("M4 30L80 14", 4, "#a8703f");
      o += S("M78 6Q78 2 84 2L96 2Q102 2 102 8L102 22Q102 28 96 28L84 28Q78 28 78 22Z", "#fff7ea", 3);
      // 구운 쪽 (아래·불 쪽)
      o += F("M80 18Q90 24 100 18L100 22Q100 26 96 26L84 26Q80 26 80 22Z", "#d99a52");
    return o;
  });
}

/** 물뿌리개 (주둥이가 오른쪽) */
export function wateringCanSvg(): string {
  return draw("can", () => {
      let o = L("M14 16Q22 2 32 16", 3.5, "#5b9bd5");
      o += S("M40 26L58 10L60 14L44 32Z", "#7fb6e6", 3);
      o += S("M8 18Q8 14 12 14L36 14Q40 14 40 18L42 40Q42 42 38 42L10 42Q6 42 6 40Z", "#9ccbf0", 3.5);
      o += F("M56 8L62 6L62 14L58 14Z", "#5b9bd5");
    return o;
  });
}

/** 물방울 하나 */
export function dropSvg(): string {
  return draw("drop", () => F("M6 1Q11 9 11 12Q11 17 6 17Q1 17 1 12Q1 9 6 1Z", "#6fb3ea"));
}

const NOTE_COLORS = { pink: "#f07fa6", blue: "#6f9fe0", yellow: "#e8b53a" } as const;
export type NoteColor = keyof typeof NOTE_COLORS;
export const NOTE_KINDS = Object.keys(NOTE_COLORS) as NoteColor[];

/** 음표 ♪ */
export function noteSvg(color: NoteColor): string {
  const c = NOTE_COLORS[color];
  return draw("note", () => {
      let o = F("M18 6L28 2Q28 12 20 12L20 30L16 30L16 6Z", c);
      o += S(E(11, 31, 8, 6), c, 3);
    return o;
  });
}

/** 작은 하트 (펫을 쓰다듬을 때) */
export function heartSvg(): string {
  return draw("heart", () => S("M16 26C6 18 2 12 4 7C6 2 13 2 16 8C19 2 26 2 28 7C30 12 26 18 16 26Z", "#f58aa8", 3));
}
