// 크레용 그림체 농장 동물 (256×256 좌표, 정면, 발바닥 y=232). 아기·청소년·어른 모습이 다르다.
// 큰 머리 + 작은 몸 + 두 발. 발·꼬리는 몸 뒤에 그려 몸에 붙어 보이게 한다.

import { E, F, L, S, blush, dot, flowers, make, shadow } from "./crayon";

export type AnimalKind = "pig" | "chick" | "cow" | "sheep" | "rabbit";
export type Stage = "baby" | "teen" | "adult";
export type Acc = "none" | "ribbon" | "flower" | "scarf";

const recolor = (s: string, c: string) => s.replace(/#262220/g, c);
/** 둥근 털 뭉치 (양) */
const cloud = (cx: number, cy: number, rx: number, ry: number, n: number) => {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 6.283, x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t), r = ((rx * 3.14) / n).toFixed(1);
    d += (i ? `A${r} ${r} 0 0 1 ` : "M") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  }
  return d + "Z";
};

function parts(kind: AnimalKind, stage: Stage): { feet: string; body: string; head: string } {
  const baby = stage === "baby", teen = stage === "teen", adult = stage === "adult";
  const eye = baby ? 8 : teen ? 6.5 : 5.5;
  const eyes = (y = 124, dx = 24) => [128 - dx, 128 + dx].map((x) => dot(x, y, eye) + `<circle cx="${x + eye * 0.35}" cy="${y - eye * 0.35}" r="${eye * 0.35}" fill="#fff"/>`).join("");
  const cheeks = (y = 146, dx = 38) => blush(128 - dx, y) + blush(128 + dx, y);
  const feet = (c: string, y = 224) => S(E(104, y, 16, 10), c, 4.5) + S(E(152, y, 16, 10), c, 4.5);
  if (kind === "pig") {
    const c = "#f6b6c4";
    return {
      feet: feet("#ee98ab") + (adult ? L("M170 184q24-8 22 8q-8 4-6-4", 3.5) : ""),
      body: S(E(128, 190, 54, 38), c, 5.5) + (adult ? F(E(104, 196, 12, 8), "#e89aab") + F(E(152, 186, 9, 6), "#e89aab") : ""),
      head: S("M84 110L68 60L112 88Z", c, 4.5) + S("M172 110L188 60L144 88Z", c, 4.5) + S(E(128, 124, 62, 52), c, 5.5) + eyes(116) + cheeks(140, 42) + S(E(128, 144, 20, 14), "#ee98ab", 4.5) + dot(121, 144, 3.5) + dot(135, 144, 3.5),
    };
  }
  if (kind === "chick") {
    if (baby)
      return {
        feet: "",
        body: "",
        head: S(E(128, 170, 54, 52), "#ffe066", 5.5) + L("M120 120q2-14 8-8q4-12 10-2", 3.5) + eyes(160, 22) + cheeks(178, 36) + S("M120 172l8 10l8-10Z", "#f29a2e", 4) +
          S("M70 186l12 10l14-12l14 12l14-12l14 12l14-12l14 12l14-12l12 10v8q-8 38-62 38q-54 0-62-38Z", "#fff4dc", 5),
      };
    const c = adult ? "#fff8ec" : "#ffe066", w = adult ? "#f4e8d4" : "#ffd23f";
    return {
      feet: "",
      body: recolor(L("M112 214v14M144 214v14M104 230h16M136 230h16", 4), "#e8913a") + S(E(128, 186, 48, 36), c, 5.5) + S("M80 170q-18 16-4 34q14-6 16-24Z", w, 4.5) + S("M176 170q18 16 4 34q-14-6-16-24Z", w, 4.5),
      head: (adult ? S("M112 78q-6-22 10-20q4-16 16-6q12-8 14 8q6 14-14 22Z", "#e8433a", 4.5) : L("M120 74q2-14 8-8q4-12 10-2", 3.5)) + S(E(128, 120, 56, 50), c, 5.5) + eyes(114, 22) + cheeks(134, 38) + S("M118 128l10 12l10-12Z", "#f29a2e", 4) + (adult ? S("M122 140q6 18 12 0Z", "#e8433a", 3.5) : ""),
    };
  }
  if (kind === "cow") {
    const c = "#ffffff";
    const horns = teen
      ? S("M96 96L84 64L108 82Z", "#f2d27a", 3.5) + S("M160 96L172 64L148 82Z", "#f2d27a", 3.5)
      : adult
        ? S("M98 96L90 84Q70 76 68 50Q82 64 106 72L112 90Z", "#f2d27a", 4) + S("M158 96L166 84Q186 76 188 50Q174 64 150 72L144 90Z", "#f2d27a", 4)
        : S(E(128, 76, 13, 10), c, 4);
    return {
      feet: feet("#5a4636"),
      body: S(E(128, 192, 56, 38), c, 5.5) + F("M88 182q14-10 24 2q-4 16-24 10Z", "#3a2a22") + F("M146 196q14-8 22 4q-8 14-22 6Z", "#3a2a22") + L(E(128, 192, 56, 38), 5.5),
      head: horns + S(E(66, 112, 24, 11), c, 4.5) + S(E(190, 112, 24, 11), c, 4.5) + S(E(128, 120, 58, 50), c, 5.5) + F("M86 96q16-16 30 0q-6 18-30 10Z", "#3a2a22") + L(E(128, 120, 58, 50), 5.5) +
        eyes(112, 24) + S(E(128, 144, 32, 18), "#f6b6c4", 4.5) + dot(116, 144, 3.5) + dot(140, 144, 3.5) +
        (adult ? S("M96 168Q128 182 160 168L160 176Q128 190 96 176Z", "#e8433a", 3.5) + S(E(128, 188, 9, 10), "#f2c230", 4) + L("M124 192h8", 2) : ""),
    };
  }
  if (kind === "sheep") {
    const w = "#fbf8f1", f = "#f3d3bd";
    const rx = adult ? 40 : 34, cy = 100, n = 5;
    let tuft = `M${128 - rx} ${cy}`;
    for (let i = 1; i <= n; i++) tuft += ` A${rx / n} ${rx / n} 0 0 0 ${(128 - rx + (2 * rx * i) / n).toFixed(1)} ${cy}`;
    return {
      feet: feet("#8a6a5a"),
      body: S(cloud(128, 190, adult ? 60 : 52, adult ? 38 : 34, adult ? 12 : 10), w, 5),
      head: (adult ? S("M92 104Q66 96 62 118Q62 134 78 132Q70 126 72 118Q74 110 92 116Z", "#f2d8a8", 4) + S("M164 104Q190 96 194 118Q194 134 178 132Q186 126 184 118Q182 110 164 116Z", "#f2d8a8", 4) : "") +
        S(E(74, 130, 20, 10), f, 4.5) + S(E(182, 130, 20, 10), f, 4.5) + S(cloud(128, 116, adult ? 62 : 56, adult ? 54 : 50, adult ? 13 : 11), w, 5) + S(E(128, 132, 40, 36), f, 5) +
        F(cloud(128, cy - 8, rx, 18, 8), w) + F(`${tuft}V${cy - 30}H${128 - rx}Z`, w) + L(tuft, 4.5) +
        eyes(130, 18) + cheeks(148, 28) + S("M122 146h12l-6 6Z", "#e88fa0", 3) + L("M128 152v3M128 155q-5 4-8 1M128 155q5 4 8 1", 2.5),
    };
  }
  // rabbit
  const c = adult ? "#f4efe6" : "#ffffff", ear = baby ? 0.55 : teen ? 0.8 : 1;
  return {
    feet: feet(c, 224),
    body: S(E(128, 192, 48, 36), c, 5.5),
    head: `<g transform="translate(0 ${80 * (1 - ear)}) scale(1 ${ear})">` + S("M102 100q-16-76 0-92q16 8 16 92Z", c, 4.5) + S("M154 100q16-76 0-92q-16 8-16 92Z", c, 4.5) + F("M104 78q-6-44 2-60q6 30 4 60Z", "#f6b6c4") + F("M152 78q6-44-2-60q-6 30-4 60Z", "#f6b6c4") + "</g>" +
      S(E(128, 124, 54, 48), c, 5.5) + eyes(118, 22) + cheeks(138, 36) + S("M122 136h12l-6 7Z", "#f28fa8", 3) + L("M128 143v5M128 148q-6 5-10 1M128 148q6 5 10 1", 2.5) +
      (adult ? L("M96 140l-20-4M96 146l-20 4M160 140l20-4M160 146l20 4", 2.5) : ""),
  };
}

const K: Record<Stage, number> = { baby: 0.62, teen: 0.82, adult: 1 };

/** 동물 그림 본체 (그림자 없이, 단계 크기로 줄인 것) */
function animalBody(kind: AnimalKind, stage: Stage, acc: Acc): string {
  const k = K[stage], hb = stage === "baby" ? 1.14 : 1;
  const p = parts(kind, stage);
  let o = p.feet + p.body + `<g transform="translate(${128 * (1 - hb)} ${176 * (1 - hb)}) scale(${hb})">${p.head}</g>`;
  const nx = 128, ny = kind === "chick" && stage === "baby" ? 190 : 176;
  if (acc === "ribbon") o += S(`M${nx} ${ny}l-22-14v28Z`, "#f37c9e", 4) + S(`M${nx} ${ny}l22-14v28Z`, "#f37c9e", 4) + S(E(nx, ny, 7), "#d95a80", 3.5);
  if (acc === "flower") o += flowers(166, 82, ["#fffaf0"], 11);
  if (acc === "scarf") o += S(`M${nx - 36} ${ny - 6}q36 14 72 0v14q-36 14 -72 0Z`, "#4a9fd8", 4.5) + S(`M${nx + 12} ${ny + 8}l-2 34l16 0l2-30Z`, "#4a9fd8", 4);
  return `<g transform="translate(${128 * (1 - k)} ${232 * (1 - k)}) scale(${k})">${o}</g>`;
}

export function animal(kind: AnimalKind, stage: Stage, acc: Acc, size: number): string {
  const k = K[stage];
  return make(256, 256, () => shadow(128, 232, 70 * k, 9 * k) + animalBody(kind, stage, acc), { dw: size, dh: size });
}
/** 아직 모으지 못한 동물 (한 색 실루엣) */
export function silhouette(kind: AnimalKind, size: number): string {
  return make(256, 256, () => `<filter id="flat" x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-color="#b9ad9d"/><feComposite in2="SourceAlpha" operator="in"/></filter><g filter="url(#flat)">${animalBody(kind, "adult", "none")}</g>`, { dw: size, dh: size });
}
export function egg(size: number): string {
  return make(256, 256, () =>
    shadow(128, 232, 50, 8) + S("M128 40q62 0 66 110q0 82-66 82q-66 0-66-82q4-110 66-110Z", "#fff4dc", 5.5, "M150 44q44 20 44 106q0 70-50 80Z") +
    [[104, 110, 9], [150, 140, 12], [118, 180, 8], [160, 92, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8c48e" filter="url(#fg)"/>`).join(""), { dw: size, dh: size });
}
