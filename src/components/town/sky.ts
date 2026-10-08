// 광장 하늘(빛) 상태: 접속한 기기의 지역 시각에 맞춰 오전 6시에 낮, 오후 6시에 밤으로 바뀐다.
// 땅·건물·캐릭터 그림에 하늘색을 곱해(tint) 어둡게 하고, 밤에는 가로등·캠프파이어·집 창문 불빛을 켠다.

export type SkyPhase = "day" | "night";
export type SkyLight = {
  phase: SkyPhase;
  tint: number; // 물들이는 색
  alpha: number; // 물들이는 진하기 (0 = 낮)
  lamps: number; // 가로등 밝기 0~1
};

// [시각(시), 색, 진하기, 가로등]. 사이 시각은 앞뒤 값을 섞는다.
// 오전 6시·오후 6시를 기준으로 낮과 밤이 바뀐다 (그 앞뒤 30분 동안 노을빛으로 넘어간다)
const KEYS: [number, number, number, number][] = [
  [0, 0x0b1a3a, 0.58, 1],
  [5.5, 0x0b1a3a, 0.58, 1],
  [6, 0xff9e80, 0.2, 0.4],
  [6.5, 0xfff4d6, 0, 0],
  [17.5, 0xfff4d6, 0, 0],
  [18, 0xff8a3d, 0.25, 0.6],
  [18.5, 0x0b1a3a, 0.58, 1],
  [24, 0x0b1a3a, 0.58, 1],
];

/** 두 색(0xRRGGBB)을 t(0~1)만큼 섞는다 */
export function mixColor(a: number, b: number, t: number) {
  const ch = (v: number, s: number) => (v >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}

/** 오전 6시~오후 6시 = 낮, 그 밖 = 밤 */
export function phaseOf(hour: number): SkyPhase {
  return hour >= 6 && hour < 18 ? "day" : "night";
}

/** hour = 0~24 (분은 소수로). 기기의 지역 시각을 쓴다 */
export function lightAt(hour: number): SkyLight {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const [h0, c0, a0, l0] = KEYS[i];
  const [h1, c1, a1, l1] = KEYS[i + 1];
  const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
  return { phase: phaseOf(h), tint: mixColor(c0, c1, t), alpha: a0 + (a1 - a0) * t, lamps: l0 + (l1 - l0) * t };
}

/** 지금 지역 시각(시). 주소에 ?hour=21 을 붙이면 그 시각으로 볼 수 있다 (확인용) */
export function localHour(now = new Date()) {
  const forced = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("hour") : null;
  if (forced !== null && forced !== "" && Number.isFinite(Number(forced))) return Number(forced);
  return now.getHours() + now.getMinutes() / 60;
}
