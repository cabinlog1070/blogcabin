// 광장 이웃 주민의 동작 소품 (TOWN-12): 기타, 마시멜로 꼬치, 물뿌리개, 물방울, 음표, 하트, 낚싯대·찌·물고기, 반짝 별.
// 파스텔 크레용 그림체(pastel). 좌표는 다른 광장 그림처럼 화면 크기의 2배로 그린다.
import { E, F, L, S, SKIN, make, pastel } from "./crayon";

/** 화면에 놓는 크기 (CSS px). 그림은 이 크기의 2배로 그린다 */
export const ACT_PROP_SIZE = {
  guitar: { width: 56, height: 28 },
  hand: { width: 9, height: 9 },
  marshmallow: { width: 58, height: 20 },
  can: { width: 30, height: 22 },
  drop: { width: 7, height: 10 },
  note: { width: 19, height: 25 },
  heart: { width: 16, height: 14 },
  rod: { width: 46, height: 52 },
  bobber: { width: 9, height: 12 },
  fish: { width: 26, height: 15 },
  star: { width: 14, height: 14 },
} as const;
export type ActProp = keyof typeof ACT_PROP_SIZE;

/** 그린 좌표 크기 (viewBox). 내보내는 크기(ACT_PROP_SIZE의 2배)로 늘려 그린다 */
const BOX: Record<ActProp, readonly [number, number]> = { guitar: [120, 60], hand: [20, 20], marshmallow: [104, 36], can: [60, 44], drop: [12, 18], note: [30, 40], heart: [32, 28], rod: [100, 112], bobber: [18, 24], fish: [52, 30], star: [28, 28] };
const draw = (k: ActProp, body: () => string) => {
  const [w, h] = BOX[k];
  return pastel(() => make(w, h, body, { dw: ACT_PROP_SIZE[k].width * 2, dh: ACT_PROP_SIZE[k].height * 2 }));
};

/** 통기타: 무릎에 가로로 안고 치는 모양 (몸통이 왼쪽, 목이 오른쪽 위로 몸 밖까지 나온다). 목을 잡은 왼손까지 그린다.
 *  몸통은 머리카락·옷과 섞이지 않게 밝은 꿀색, 목은 진한 갈색 */
export function guitarSvg(): string {
  return draw("guitar", () => {
    let o = "";
    // 목·머리
    o += S("M62 27L108 13L111 21L65 35Z", "#6b4226", 3);
    o += S("M106 9L117 6L119 17L110 20Z", "#4f301b", 3);
    o += F(E(111, 9, 1.6), "#e8d6b0") + F(E(114, 15, 1.6), "#e8d6b0");
    // 몸통: 가로로 누운 8자
    o += S("M8 36C8 22 20 14 32 18C38 20 42 18 48 16C60 12 70 22 68 32C66 42 58 48 48 46C42 45 38 48 32 52C18 58 8 50 8 36Z", "#f3bd6a", 4);
    o += F("M14 40C16 50 26 54 34 49C30 52 18 52 14 40Z", "#d9a24f");
    o += F(E(44, 32, 6.5), "#5a3a24");
    // 줄받침과 줄
    o += F("M17 33L23 32L24 41L18 42Z", "#6b4226");
    o += L("M20 35L112 12M21 39L113 16", 1.2, "#fff8e6");
    // 목을 잡은 왼손
    o += S(E(94, 19, 6, 5), SKIN, 2.5);
    return o;
  });
}

/** 줄을 튕기는 오른손 (기타 위에서 위아래로 움직인다) */
export function strumHandSvg(): string {
  return draw("hand", () => S(E(10, 10, 7, 6.5), SKIN, 2.5));
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

/** 낚싯대: 앞(호수 쪽)을 본 캐릭터가 오른손으로 손잡이(ROD_GRIP)를 잡고, 대는 오른쪽 아래 물 쪽으로 뻗는다 (끝 = ROD_TIP).
 *  손은 캐릭터 그림의 손을 그대로 쓴다 (소품에 손을 그리면 손이 넷이 된다). 낚싯줄은 장면에서 대 끝부터 찌까지 선으로 긋는다 */
export const ROD_TIP = { x: 97 / 100, y: 108 / 112 };
export const ROD_GRIP = { x: 16 / 100, y: 18 / 112 };
export function rodSvg(): string {
  return draw("rod", () => {
    let o = "";
    // 대: 손잡이 쪽은 굵고 끝으로 갈수록 가늘게
    o += L("M22 24L60 68", 7, "#7a4a28");
    o += L("M58 66L97 108", 4.2, "#9a6236");
    // 손잡이 코르크와 릴
    o += L("M8 8L26 28", 10, "#e2b77a");
    o += S(E(36, 30, 8, 8), "#9ccbf0", 3);
    o += F(E(36, 30, 2.6), "#4f7fb0");
    // 줄 고리
    o += L("M70 82L74 78M84 96L88 92", 2.4, "#5a3a24");
    return o;
  });
}

/** 찌: 위는 흰색, 아래는 빨간색 동그라미 + 꼭지 */
export function bobberSvg(): string {
  return draw("bobber", () => {
    let o = L("M9 2L9 8", 2.5, "#6b4226");
    o += S("M2 14A7 7 0 0 1 16 14Z", "#fff8ee", 2.5);
    o += S("M2 14A7 7 0 0 0 16 14Z", "#f07272", 2.5);
    return o;
  });
}

/** 낚은 물고기 (머리가 오른쪽) */
export function fishSvg(): string {
  return draw("fish", () => {
    let o = S("M4 6L14 15L4 24Q2 15 4 6Z", "#f3a65a", 3);
    o += S("M12 15C18 4 38 2 48 15C38 28 18 26 12 15Z", "#f6c06e", 3.5);
    o += F("M18 17C26 24 38 24 46 16C38 26 22 26 18 17Z", "#e89a4c");
    o += L("M26 8Q30 15 26 22", 2, "#e89a4c");
    o += F(E(39, 13, 2.4), "#3e2b20");
    return o;
  });
}

/** 반짝 별 (불꽃놀이 구경하며 "와!") */
export function starSvg(): string {
  return draw("star", () => S("M14 2L17 10L26 11L19 17L21 26L14 21L7 26L9 17L2 11L11 10Z", "#ffe08a", 2.5));
}
