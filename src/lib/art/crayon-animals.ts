// 크레용 그림체 농장 동물 (256×256 좌표, 정면, 발바닥 y=232). 아기·청소년·어른 모습이 다르다.
// 큰 머리 + 작은 몸 + 두 발. 발·꼬리·날개는 몸 뒤에 그려 몸에 붙어 보이게 한다.
// 펫 색(2026-10-12): 몸 색(main)만 바꾸고 무늬·코·귀 안쪽은 그대로. 검정색이면 눈·코·입을 흰색으로 그린다.

import { E, F, L, S, blush, dot, flowers, make, shadow } from "./crayon";

export type AnimalKind =
  | "pig" | "chick" | "cow" | "sheep" | "rabbit"
  | "tiger" | "dragon" | "raccoon" | "monkey" | "cat" | "bear" | "fox" | "hamster" | "unicorn" | "wolf" | "turtle" | "dino" | "mole";
export type Stage = "baby" | "teen" | "adult";
export type Acc = "none" | "ribbon" | "flower" | "scarf";
export type Coat = "default" | "brown" | "yellow" | "red" | "black" | "white" | "pink";

/** 고를 수 있는 몸 색 (파스텔) */
const COATS: Record<Exclude<Coat, "default">, string> = {
  brown: "#c49468",
  yellow: "#ffe06e",
  red: "#f0847a",
  black: "#3f3735",
  white: "#fbf8f1",
  pink: "#f7b8c8",
};

const recolor = (s: string, c: string) => s.replace(/#262220/g, c);
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** 색 섞기 (t = 0이면 a, 1이면 b) */
const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const isDark = (c: string) => {
  const [r, g, b] = hex(c);
  return r * 0.3 + g * 0.59 + b * 0.11 < 110;
};
/** 몸 색보다 조금 진한 색 (발·날개) */
const deeper = (c: string, t = 0.18) => (isDark(c) ? mix(c, "#ffffff", 0.14) : mix(c, "#5a3a22", t));
/** 몸 위 무늬 색 (줄무늬·가면): 어두운 몸이면 밝게 */
const mark = (c: string) => (isDark(c) ? "#8f8580" : mix(c, "#3a2418", 0.55));

/** 둥근 털 뭉치 (양) */
const cloud = (cx: number, cy: number, rx: number, ry: number, n: number) => {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 6.283, x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t), r = ((rx * 3.14) / n).toFixed(1);
    d += (i ? `A${r} ${r} 0 0 1 ` : "M") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  }
  return d + "Z";
};
/** 좌우 대칭 모양: 왼쪽 path를 x=128 기준으로 뒤집어 하나 더 */
const both = (left: string) => left + `<g transform="matrix(-1 0 0 1 256 0)">${left}</g>`;

/** 각 동물의 기본 몸 색 */
const BASE: Record<AnimalKind, string> = {
  pig: "#f6b6c4",
  chick: "#ffe066",
  cow: "#ffffff",
  sheep: "#fbf8f1",
  rabbit: "#ffffff",
  tiger: "#f6a24e",
  dragon: "#9fd88f",
  raccoon: "#b9b2aa",
  monkey: "#bf8a5e",
  cat: "#f4c48c",
  bear: "#b88658",
  fox: "#f39a52",
  hamster: "#f3c690",
  unicorn: "#fbf8f1",
  wolf: "#a6aeb8",
  turtle: "#6fae78",
  dino: "#8ccbe8",
  mole: "#8c7466",
};

function parts(kind: AnimalKind, stage: Stage, coat: Coat): { feet: string; body: string; head: string } {
  const baby = stage === "baby", teen = stage === "teen", adult = stage === "adult";
  const picked = coat !== "default";
  // 병아리는 다 자라면 흰 닭, 토끼는 다 자라면 크림색 (색을 고르면 그 색)
  const c = picked ? COATS[coat] : kind === "chick" && adult ? "#fff8ec" : kind === "rabbit" && adult ? "#f4efe6" : BASE[kind];
  const eye = baby ? 8 : teen ? 6.5 : 5.5;
  const eyes = (y = 124, dx = 24, r = eye) => [128 - dx, 128 + dx].map((x) => dot(x, y, r) + `<circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff"/>`).join("");
  const cheeks = (y = 146, dx = 38) => blush(128 - dx, y) + blush(128 + dx, y);
  const feet = (fc: string, y = 224) => S(E(104, y, 16, 10), fc, 4.5) + S(E(152, y, 16, 10), fc, 4.5);
  /** 고양이·곰 같은 입 (코 아래 ㅅ자) */
  const mouth = (y: number) => L(`M128 ${y}v4M128 ${y + 4}q-6 5-10 1M128 ${y + 4}q6 5 10 1`, 2.5);
  const whiskers = (y: number, dx = 34) => L(`M${128 - dx} ${y - 4}l-22-4M${128 - dx} ${y + 2}l-22 4M${128 + dx} ${y - 4}l22-4M${128 + dx} ${y + 2}l22 4`, 2.5);
  const pale = "#fff6ea";

  if (kind === "pig") {
    return {
      feet: feet(deeper(c, 0.1)) + (adult ? L("M170 184q24-8 22 8q-8 4-6-4", 3.5) : ""),
      body: S(E(128, 190, 54, 38), c, 5.5) + (adult ? F(E(104, 196, 12, 8), deeper(c, 0.12)) + F(E(152, 186, 9, 6), deeper(c, 0.12)) : ""),
      head: S("M84 110L68 60L112 88Z", c, 4.5) + S("M172 110L188 60L144 88Z", c, 4.5) + S(E(128, 124, 62, 52), c, 5.5) + eyes(116) + cheeks(140, 42) + S(E(128, 144, 20, 14), "#ee98ab", 4.5) + dot(121, 144, 3.5) + dot(135, 144, 3.5),
    };
  }
  if (kind === "chick") {
    if (baby)
      return {
        feet: "",
        body: "",
        head: S(E(128, 170, 54, 52), c, 5.5) + L("M120 120q2-14 8-8q4-12 10-2", 3.5) + eyes(160, 22) + cheeks(178, 36) + S("M120 172l8 10l8-10Z", "#f29a2e", 4) +
          S("M70 186l12 10l14-12l14 12l14-12l14 12l14-12l14 12l14-12l12 10v8q-8 38-62 38q-54 0-62-38Z", "#fff4dc", 5),
      };
    const w = picked ? deeper(c, 0.1) : adult ? "#f4e8d4" : "#ffd23f";
    return {
      feet: "",
      body: recolor(L("M112 214v14M144 214v14M104 230h16M136 230h16", 4), "#e8913a") + S(E(128, 186, 48, 36), c, 5.5) + S("M80 170q-18 16-4 34q14-6 16-24Z", w, 4.5) + S("M176 170q18 16 4 34q-14-6-16-24Z", w, 4.5),
      head: (adult ? S("M112 78q-6-22 10-20q4-16 16-6q12-8 14 8q6 14-14 22Z", "#e8433a", 4.5) : L("M120 74q2-14 8-8q4-12 10-2", 3.5)) + S(E(128, 120, 56, 50), c, 5.5) + eyes(114, 22) + cheeks(134, 38) + S("M118 128l10 12l10-12Z", "#f29a2e", 4) + (adult ? S("M122 140q6 18 12 0Z", "#e8433a", 3.5) : ""),
    };
  }
  if (kind === "cow") {
    const spot = isDark(c) ? "#fbf8f1" : picked && coat !== "white" ? mark(c) : "#3a2a22";
    const horns = teen
      ? S("M96 96L84 64L108 82Z", "#f2d27a", 3.5) + S("M160 96L172 64L148 82Z", "#f2d27a", 3.5)
      : adult
        ? S("M98 96L90 84Q70 76 68 50Q82 64 106 72L112 90Z", "#f2d27a", 4) + S("M158 96L166 84Q186 76 188 50Q174 64 150 72L144 90Z", "#f2d27a", 4)
        : S(E(128, 76, 13, 10), c, 4);
    return {
      feet: feet("#5a4636"),
      body: S(E(128, 192, 56, 38), c, 5.5) + F("M88 182q14-10 24 2q-4 16-24 10Z", spot) + F("M146 196q14-8 22 4q-8 14-22 6Z", spot) + L(E(128, 192, 56, 38), 5.5),
      head: horns + S(E(66, 112, 24, 11), c, 4.5) + S(E(190, 112, 24, 11), c, 4.5) + S(E(128, 120, 58, 50), c, 5.5) + F("M86 96q16-16 30 0q-6 18-30 10Z", spot) + L(E(128, 120, 58, 50), 5.5) +
        eyes(112, 24) + S(E(128, 144, 32, 18), "#f6b6c4", 4.5) + dot(116, 144, 3.5) + dot(140, 144, 3.5) +
        (adult ? S("M96 168Q128 182 160 168L160 176Q128 190 96 176Z", "#e8433a", 3.5) + S(E(128, 188, 9, 10), "#f2c230", 4) + L("M124 192h8", 2) : ""),
    };
  }
  if (kind === "sheep") {
    const f = "#f3d3bd";
    const rx = adult ? 40 : 34, cy = 100, n = 5;
    let tuft = `M${128 - rx} ${cy}`;
    for (let i = 1; i <= n; i++) tuft += ` A${rx / n} ${rx / n} 0 0 0 ${(128 - rx + (2 * rx * i) / n).toFixed(1)} ${cy}`;
    return {
      feet: feet("#8a6a5a"),
      body: S(cloud(128, 190, adult ? 60 : 52, adult ? 38 : 34, adult ? 12 : 10), c, 5),
      head: (adult ? S("M92 104Q66 96 62 118Q62 134 78 132Q70 126 72 118Q74 110 92 116Z", "#f2d8a8", 4) + S("M164 104Q190 96 194 118Q194 134 178 132Q186 126 184 118Q182 110 164 116Z", "#f2d8a8", 4) : "") +
        S(E(74, 130, 20, 10), f, 4.5) + S(E(182, 130, 20, 10), f, 4.5) + S(cloud(128, 116, adult ? 62 : 56, adult ? 54 : 50, adult ? 13 : 11), c, 5) + S(E(128, 132, 40, 36), f, 5) +
        F(cloud(128, cy - 8, rx, 18, 8), c) + F(`${tuft}V${cy - 30}H${128 - rx}Z`, c) + L(tuft, 4.5) +
        eyes(130, 18) + cheeks(148, 28) + S("M122 146h12l-6 6Z", "#e88fa0", 3) + L("M128 152v3M128 155q-5 4-8 1M128 155q5 4 8 1", 2.5),
    };
  }
  if (kind === "rabbit") {
    const ear = baby ? 0.55 : teen ? 0.8 : 1;
    return {
      feet: feet(c, 224),
      body: S(E(128, 192, 48, 36), c, 5.5),
      head: `<g transform="translate(0 ${80 * (1 - ear)}) scale(1 ${ear})">` + S("M102 100q-16-76 0-92q16 8 16 92Z", c, 4.5) + S("M154 100q16-76 0-92q-16 8-16 92Z", c, 4.5) + F("M104 78q-6-44 2-60q6 30 4 60Z", "#f6b6c4") + F("M152 78q6-44-2-60q-6 30-4 60Z", "#f6b6c4") + "</g>" +
        S(E(128, 124, 54, 48), c, 5.5) + eyes(118, 22) + cheeks(138, 36) + S("M122 136h12l-6 7Z", "#f28fa8", 3) + L("M128 143v5M128 148q-6 5-10 1M128 148q6 5 10 1", 2.5) +
        (adult ? L("M96 140l-20-4M96 146l-20 4M160 140l20-4M160 146l20 4", 2.5) : ""),
    };
  }
  if (kind === "tiger") {
    const st = mark(c), muz = pale;
    const tail = S("M168 204q34 0 34-36q0-8 8-6q8 34-40 52Z", c, 4.5) + L("M196 184l10 2M200 172l10-2", 4, st);
    return {
      feet: feet(c) + (baby ? "" : tail),
      body: S(E(128, 192, 52, 36), c, 5.5) + F(E(128, 202, 28, 22), muz) +
        (baby ? "" : L("M80 186q10 0 14 8M176 186q-10 0-14 8", 4.5, st)) + (adult ? L("M84 204q8-2 12 4M172 204q-8-2-12 4", 4.5, st) : ""),
      head: both(S(E(82, 80, 17), c, 4.5) + F(E(82, 82, 8), "#f8d2b0")) + S(E(128, 124, 60, 50), c, 5.5) +
        L(adult ? "M128 80v14M112 82l4 12M144 82l-4 12" : "M128 80v12M116 84l3 9M140 84l-3 9", 4.5, st) +
        (baby ? "" : L("M70 118h14M70 132l14-3M186 118h-14M186 132l-14-3", 4.5, st)) +
        F(E(128, 146, 28, 17), muz) + eyes(116, 24) + cheeks(140, 42) + S("M120 136h16l-8 8Z", "#e8806a", 3) + mouth(144),
    };
  }
  if (kind === "dragon") {
    const belly = "#fff0b8", horn = "#f6d36a", wing = deeper(c, 0.22);
    const w = adult ? 1 : teen ? 0.7 : 0.45;
    const wingL = `<g transform="translate(${90 * (1 - w)} ${170 * (1 - w)}) scale(${w})">` + S("M92 174Q48 128 30 150Q46 156 44 172Q58 164 64 182Q74 172 92 190Z", wing, 4.5) + L("M44 172Q64 168 86 182M64 182Q76 180 90 188", 2.5) + "</g>";
    return {
      feet: feet(deeper(c, 0.08)) + both(wingL) + S("M170 206q30 4 40-20l10 14l-12 2q-12 20-38 16Z", c, 4.5) + F("M210 186l10 14l-12 2Z", horn),
      body: S(E(128, 192, 50, 36), c, 5.5) + S(E(128, 200, 28, 24), belly, 4) + L("M108 192h40M106 204h44", 2.5),
      head: both(S(adult ? "M102 82L86 40L118 72Z" : teen ? "M102 82L92 54L116 74Z" : "M104 80L98 64L114 74Z", horn, 4)) +
        both(S(E(70, 114, 18, 10), c, 4.5)) + S(E(128, 124, 58, 50), c, 5.5) +
        F("M120 74l8-14l8 14Z", deeper(c, 0.22)) + (baby ? "" : F("M104 78l6-12l8 12ZM138 78l8-12l6 12Z", deeper(c, 0.22))) +
        eyes(116, 24) + cheeks(140, 40) + dot(120, 138, 2.5) + dot(136, 138, 2.5) + L("M112 148q16 12 32 0", 3),
    };
  }
  if (kind === "raccoon") {
    const st = mark(c), muz = isDark(c) ? "#bdb5b0" : "#fbf8f1";
    return {
      feet: feet(st) + S("M168 206q40-4 40-44q0-12 10-10q10 50-46 66Z", c, 4.5) + L("M190 200l14-8M200 186l14-4M206 170l12 0", 5, st),
      body: S(E(128, 192, 50, 36), c, 5.5) + F(E(128, 202, 26, 20), muz),
      head: both(S("M82 98L76 56L112 82Z", c, 4.5) + F("M86 90L82 66L104 82Z", st)) + S(E(128, 124, 60, 50), c, 5.5) +
        F("M70 112q14-12 34-6q14 4 24 14q10-10 24-14q20-6 34 6q-2 18-22 22q-18 2-36-6q-18 8-36 6q-20-4-22-22Z", st) +
        F("M92 96q12-6 24 0M140 96q12-6 24 0", muz) + L("M92 98q12-6 22 0M142 98q12-6 22 0", 4, muz) +
        F(E(128, 148, 24, 15), muz) + eyes(118, 24) + dot(128, 142, 6) + mouth(147),
    };
  }
  if (kind === "monkey") {
    const face = "#f6d2b0";
    return {
      feet: feet(deeper(c, 0.12)) + (baby ? "" : L("M168 206q38 4 34-28q-4-18-18-10q-8 6 0 12", 7, deeper(c, 0.12))),
      body: S(E(128, 192, 48, 36), c, 5.5) + F(E(128, 200, 26, 22), face),
      head: both(S(E(66, 124, 20, 22), c, 4.5) + F(E(66, 124, 11, 13), face)) + S(E(128, 120, 56, 52), c, 5.5) +
        L(adult ? "M118 72q4-16 10-6q6-14 12 0" : "M122 72q4-12 8-2", 4, deeper(c, 0.2)) +
        S("M128 104q-14-18-34-8q-14 10-6 30q-6 18 12 30q14 10 28 10q14 0 28-10q18-12 12-30q8-20-6-30q-20-10-34 8Z", face, 4) +
        eyes(118, 18) + cheeks(142, 30) + dot(122, 136, 2.5) + dot(134, 136, 2.5) + L("M114 146q14 10 28 0", 3),
    };
  }
  if (kind === "cat") {
    const st = mark(c);
    return {
      feet: feet(c) + S("M168 210q34-2 30-44q-2-14 10-14q12 58-38 66Z", c, 4.5),
      body: S(E(128, 194, 46, 34), c, 5.5) + F(E(128, 204, 22, 18), pale),
      head: both(S("M80 104L74 52L118 82Z", c, 4.5) + F("M86 94L82 66L106 82Z", "#f6b6c4")) + S(E(128, 126, 60, 48), c, 5.5) +
        (coat === "default" && !baby ? L("M128 84v12M114 86l3 9M142 86l-3 9", 4, st) : "") +
        eyes(120, 26) + cheeks(142, 42) + S("M122 134h12l-6 6Z", "#f28fa8", 3) + mouth(140) + whiskers(140),
    };
  }
  if (kind === "bear") {
    const muz = isDark(c) ? "#8c827c" : mix(c, "#ffffff", 0.55);
    return {
      feet: feet(deeper(c, 0.12)),
      body: S(E(128, 192, 54, 38), c, 5.5) + F(E(128, 200, 30, 24), muz),
      head: both(S(E(80, 80, 20), c, 4.5) + F(E(80, 82, 10), muz)) + S(E(128, 124, 62, 52), c, 5.5) +
        S(E(128, 146, 26, 18), muz, 4) + F(E(128, 138, 9, 6), "#4a3628") + eyes(116, 26) + cheeks(140, 44) + mouth(144),
    };
  }
  if (kind === "fox") {
    const tip = isDark(c) ? "#8f8580" : "#3f3330";
    return {
      feet: feet(tip) + S("M164 210q40 6 50-30q4-20-6-30q-18 6-22 26q-6 20-22 18Z", c, 4.5) + F("M208 150q10 10 6 30q-10 2-18-8q4-16 12-22Z", "#fbf8f1"),
      body: S(E(128, 194, 46, 34), c, 5.5) + F("M108 168q20 22 40 0q6 22-20 40q-26-18-20-40Z", "#fbf8f1"),
      head: both(S(adult ? "M80 102L68 38L120 80Z" : "M82 102L74 50L118 82Z", c, 4.5) + F(adult ? "M76 66L70 40L92 58Z" : "M80 70L76 52L94 64Z", tip)) +
        S("M128 74q-60 0-64 52q0 10 6 18q24 20 58 22q34-2 58-22q6-8 6-18q-4-52-64-52Z", c, 5.5) +
        F("M68 136q24 30 60 30q36 0 60-30q-10-12-30-8q-14 2-30 22q-16-20-30-22q-20-4-30 8Z", "#fbf8f1") +
        eyes(118, 26) + cheeks(140, 44) + F(E(128, 146, 7, 5), "#3f3330") + L("M128 151v3M128 154q-5 4-8 1M128 154q5 4 8 1", 2.5),
    };
  }
  if (kind === "hamster") {
    const belly = isDark(c) ? "#bdb5b0" : "#fffaf2";
    return {
      feet: feet("#f6b6c4", 226),
      body: S(E(128, 192, 56, 38), c, 5.5) + F(E(128, 200, 34, 26), belly) +
        (adult ? S(E(128, 180, 10, 14), "#a87850", 3.5) + L("M128 168v24", 2) + both(S(E(114, 184, 8, 6), "#f6b6c4", 3)) : ""),
      head: both(S(E(84, 82, 14), c, 4.5) + F(E(84, 84, 7), "#f6b6c4")) + S(E(128, 126, 64, 52), c, 5.5) +
        both(F(E(84, 146, 22, 18), belly)) + F(E(128, 146, 16, 12), belly) +
        eyes(118, 24) + cheeks(144, 44) + S("M123 134h10l-5 5Z", "#f28fa8", 3) + mouth(139),
    };
  }
  if (kind === "unicorn") {
    const mane = ["#f7a8c8", "#b8a4ec", "#9ad0f0"];
    const hornH = adult ? 56 : teen ? 40 : 24;
    return {
      feet: feet(deeper(c, 0.08)) + S("M168 196q30-8 34 14q-14-4-18 6q-4-12-16-20Z", mane[0], 4) + S("M170 206q26 4 22 24q-10-10-20-6q2-10-2-18Z", mane[1], 4),
      body: S(E(128, 192, 48, 36), c, 5.5),
      head: both(S("M88 98L82 60L112 84Z", c, 4.5) + F("M92 90L88 70L106 84Z", "#f6dce4")) +
        S(`M118 80L128 ${80 - hornH}L138 80Z`, "#f6d36a", 4) + L(`M121 ${80 - hornH * 0.3}h14M124 ${80 - hornH * 0.6}h8`, 2.5) +
        S(E(128, 124, 56, 50), c, 5.5) +
        S("M96 90q10-22 34-14q-12 8-10 22q-14-14-24-8Z", mane[0], 4) + S("M132 78q24-8 34 14q-12-6-20 2q0-10-14-16Z", mane[2], 4) +
        S("M74 108q-12 20 0 38q4-14 10-22Z", mane[1], 4) +
        eyes(120, 22) + cheeks(140, 38) + F(E(128, 148, 18, 10), "#f6dce4") + L("M120 146v2M136 146v2", 2.5) + mouth(150),
    };
  }
  if (kind === "wolf") {
    const muz = isDark(c) ? "#8c827c" : "#eef0f2";
    return {
      feet: feet(deeper(c, 0.12)) + S("M166 206q40 8 46-34q2-14-8-16q-10 24-38 30Z", c, 4.5) + F("M204 156q10 2 8 16q-8 0-12-8Z", muz),
      body: S(E(128, 194, 48, 34), c, 5.5) + (adult ? S("M92 174q8 14 18 4q8 14 18 2q10 12 18-2q10 10 18-4q-10 26-36 28q-26-2-36-28Z", muz, 4) : F(E(128, 202, 24, 20), muz)),
      head: both(S(adult ? "M80 104L70 44L118 80Z" : "M82 104L76 56L116 82Z", c, 4.5) + F("M86 94L80 64L102 82Z", mix(c, "#3a2418", 0.3))) +
        S(E(128, 124, 60, 50), c, 5.5) + F("M128 102q-16 0-22 18q-24 2-30 16q20 26 52 28q32-2 52-28q-6-14-30-16q-6-18-22-18Z", muz) +
        L("M96 106l14 4M160 106l-14 4", 3) + eyes(118, 22) + F(E(128, 140, 9, 6), "#3f3330") + mouth(145),
    };
  }
  if (kind === "turtle") {
    // 몸 색 = 등딱지. 머리·발은 늘 연두색. 정면: 둥근 등딱지가 몸 뒤로 크게 솟고, 앞에 크림색 배딱지, 그 위에 머리
    const skin = "#c5e39a", rim = mix(c, "#fff6d8", 0.45), line = isDark(c) ? "#8f8580" : mix(c, "#3a2418", 0.4), belly = "#f7e9b8";
    const shell = "M44 214Q40 118 128 108Q216 118 212 214Z";
    // 등딱지 무늬: 가운데 육각형 줄 + 양옆 조각 (머리·배딱지 뒤로 숨는 곳까지 그려 둔다)
    const plates = "M128 108v28M86 128l18 22M170 128l-18 22M56 168l34 4M200 168l-34 4M60 196l28-6M196 196l-28-6";
    return {
      feet: S(shell, c, 5.5) + both(F("M64 158l12-12h16l8 14l-10 14h-18Z", mix(c, "#ffffff", 0.3)) + F("M60 196l10-12h16l6 12l-8 12h-16Z", mix(c, "#ffffff", 0.3))) + L(plates, 6, line) + S("M44 206Q128 230 212 206L212 216Q128 240 44 216Z", rim, 4) +
        both(S(E(70, 218, 17, 11), skin, 4.5) + L("M62 222v3M70 224v3", 2.5)) + feet(skin, 226),
      body: S(E(128, 196, 40, 32), belly, 5) + L("M98 190h60M100 206h56M128 168v58", 3, mix(belly, "#8a6a3a", 0.35)) +
        both(S("M90 176q-22 2-26 18q10 8 24-2Z", skin, 4)),
      head: S("M128 76q-44 0-46 44q0 34 46 36q46-2 46-36q-2-44-46-44Z", skin, 5.5) +
        eyes(112, 20) + cheeks(130, 32) + dot(122, 124, 2) + dot(134, 124, 2) + L("M114 136q14 10 28 0", 3) +
        (adult ? L("M104 92q8-6 16-2M136 90q8-4 16 2", 2.5, deeper(skin, 0.3)) : ""),
    };
  }
  if (kind === "dino") {
    const spike = "#f6a96a", belly = mix(c, "#ffffff", 0.55);
    const n = adult ? 3 : teen ? 2 : 1;
    let back = "";
    // 머리 위 등 가시: 가운데 하나, 자라면 양옆에 더
    const spots = [[128, 76, 22], [104, 86, 20], [152, 86, 20]].slice(0, n === 1 ? 1 : 3) as [number, number, number][];
    for (const [x, y, h] of spots) back += S(`M${x - 10} ${y}l10-${h + (adult ? 6 : 0)}l10 ${h + (adult ? 6 : 0)}Z`, spike, 3.5);
    return {
      feet: feet(deeper(c, 0.12)) + S("M168 214q36 6 52-22q-20 8-28-2q-10 14-30 6Z", c, 4.5) + F("M196 196l8-12l6 12ZM208 192l8-10l4 12Z", spike),
      body: S(E(128, 192, 50, 36), c, 5.5) + S(E(128, 200, 28, 24), belly, 4) + both(S("M86 180q-14 4-10 14q8 0 14-6Z", c, 3.5)),
      head: (adult ? both(S("M100 80l-6-22l18 16Z", spike, 3.5)) : "") + back + both(S(E(76, 104, 10, 8), c, 4)) +
        S("M128 70q-58 0-60 52q0 46 60 46q60 0 60-46q-2-52-60-52Z", c, 5.5) +
        eyes(112, 24) + cheeks(136, 42) + dot(118, 136, 2.5) + dot(138, 136, 2.5) + L("M106 148q22 12 44 0", 3),
    };
  }
  // mole
  const paw = "#f6b6c4";
  return {
    feet: feet(paw),
    body: S(E(128, 192, 54, 38), c, 5.5) + F(E(128, 200, 30, 24), isDark(c) ? "#6e6460" : mix(c, "#ffffff", 0.3)) +
      both(S("M74 172q-18 6-14 22q4 10 18 4q10-6 6-20Z", paw, 4) + L("M62 186l-6 4M64 194l-6 4", 2.5)),
    head: S(E(128, 124, 58, 50), c, 5.5) + eyes(110, 26, baby ? 6 : 4.5) + cheeks(130, 40) +
      S(E(128, 136, adult ? 20 : 16, adult ? 15 : 12), "#f28fa8", 4) + both(L("M98 140l-24-6M98 146l-24 2", 2.5)) + L("M120 156q8 6 16 0", 2.5),
  };
}

const K: Record<Stage, number> = { baby: 0.62, teen: 0.82, adult: 1 };

/** 검정 몸이면 눈·코·입을 흰색으로 */
const lightFace = (head: string) => head.replace(/fill="#4a3628"/g, 'fill="#fffaf2"').replace(/stroke="#7b5a44"/g, 'stroke="#f4efe6"');

/** 동물 그림 본체 (그림자 없이, 단계 크기로 줄인 것) */
function animalBody(kind: AnimalKind, stage: Stage, acc: Acc, coat: Coat = "default"): string {
  const k = K[stage], hb = stage === "baby" ? 1.14 : 1;
  const p = parts(kind, stage, coat);
  const head = coat === "black" && kind !== "turtle" ? lightFace(p.head) : p.head; // 거북이는 등딱지만 색이 바뀌고 얼굴은 연두색 그대로
  let o = p.feet + p.body + `<g transform="translate(${128 * (1 - hb)} ${176 * (1 - hb)}) scale(${hb})">${head}</g>`;
  const nx = 128, ny = kind === "chick" && stage === "baby" ? 190 : 176;
  if (acc === "ribbon") o += S(`M${nx} ${ny}l-22-14v28Z`, "#f37c9e", 4) + S(`M${nx} ${ny}l22-14v28Z`, "#f37c9e", 4) + S(E(nx, ny, 7), "#d95a80", 3.5);
  if (acc === "flower") o += flowers(166, 82, ["#fffaf0"], 11);
  if (acc === "scarf") o += S(`M${nx - 36} ${ny - 6}q36 14 72 0v14q-36 14 -72 0Z`, "#4a9fd8", 4.5) + S(`M${nx + 12} ${ny + 8}l-2 34l16 0l2-30Z`, "#4a9fd8", 4);
  return `<g transform="translate(${128 * (1 - k)} ${232 * (1 - k)}) scale(${k})">${o}</g>`;
}

export function animal(kind: AnimalKind, stage: Stage, acc: Acc, size: number, coat: Coat = "default"): string {
  const k = K[stage];
  return make(256, 256, () => shadow(128, 232, 70 * k, 9 * k) + animalBody(kind, stage, acc, coat), { dw: size, dh: size });
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
