// 아바타 꾸미기 그림 (SHOP-06). 캐릭터 그림(characters.ts, viewBox 144×144)과 같은 좌표·같은 붓(Kit)으로 그린다.
// 남녀 공용: 남자·여자 주민(과 상점 마네킹)이 같은 몸 비율이라 같은 옷을 입는다. 모자는 머리 자리(Pose.head)에 맞춰
// 머리카락 위에 얹는다 (여자는 머리가 좁고 길게, 남자는 덥수룩하게 넓다).
// 앞·뒤·옆(오른쪽) 모습과 걷기 장면마다 맞게 그린다. 뒷모습은 얼굴·앞 무늬 없이 등쪽 모양.
// 부위 4가지와 그리는 순서: 몸 → 하의 → 상의 → 신발 → 모자 (SLOT_ORDER)
// DB의 asset_key("avatar.hat.straw" 등)로 고른다.

import type { ArmGeom, Kit, Pose, Pt, SideLeg, Tone } from "./characters";

export type AvatarSlot = "top" | "bottom" | "hat" | "shoes";

/** 그리는 순서 (앞쪽이 먼저 = 뒤에 깔린다) */
export const SLOT_ORDER: AvatarSlot[] = ["bottom", "top", "shoes", "hat"];

export const SLOT_LABEL: Record<AvatarSlot, string> = { top: "상의", bottom: "하의", hat: "모자", shoes: "신발" };

/**
 * 상의. torso = 몸통(하의 위, 팔 아래), shoulder = 어깨 소매(팔 위, side -1 왼쪽/먼 쪽 · 1 오른쪽/가까운 쪽),
 * arm = 긴 소매(팔과 같이 흔들린다), collar = 목둘레(얼굴 바로 아래)
 */
export type TopArt = {
  slot: "top";
  torso(k: Kit, p: Pose): string;
  shoulder(k: Kit, p: Pose, side: -1 | 1): string;
  arm?(k: Kit, p: Pose, a: ArmGeom): string;
  collar?(k: Kit, p: Pose): string;
};
/** 하의. hips = 허리 아래 전체(옆모습은 엉덩이·치마), leg = 옆모습 바짓가랑이 하나, long = 발목까지 덮는다(맨다리를 그리지 않는다) */
export type BottomArt = { slot: "bottom"; long?: boolean; hips(k: Kit, p: Pose): string; leg?(k: Kit, p: Pose, lg: SideLeg): string };
/** 신발. foot = 앞·뒤 모습 한 짝(x = 가운데, by = 바닥), footSide = 옆모습 한 짝(오른쪽이 앞코) */
export type ShoesArt = {
  slot: "shoes";
  foot(k: Kit, p: Pose, x: number, by: number): string;
  footSide(k: Kit, p: Pose, x: number, by: number, far: boolean): string;
};
/** 모자. 머리카락까지 다 그린 뒤 맨 위에 */
export type HatArt = { slot: "hat"; hat(k: Kit, p: Pose): string };

export type AvatarPiece = TopArt | BottomArt | ShoesArt | HatArt;

// ───────── 상의 공통 ─────────

// 몸통 (앞·뒤): 남자 재킷과 같은 어깨, 아랫단은 하의 허리를 덮는다
const TORSO_F: Pt[] = [[57.4, 80.2, 1], [72, 78.8], [86.6, 80.2, 1], [89, 86], [90.4, 97], [91.2, 105.4, 1], [72, 107], [52.8, 105.4, 1], [53.6, 97], [55, 86]];
// 몸통 (옆, 앞이 오른쪽)
const TORSO_S: Pt[] = [[62.4, 80.4, 1], [80, 79.4], [86.6, 82, 1], [88.6, 92], [90.2, 101.6], [90.6, 106, 1], [72, 108], [54.6, 106, 1], [53.2, 99], [54.2, 90], [57.6, 83.4]];
// 어깨 소매
const SH_L: Pt[] = [[60, 80.6], [54, 81.4], [49.8, 85.8], [47.4, 92.6, 1], [53, 94.8], [59, 93.4, 1], [60, 87.4]];
const SH_NEAR: Pt[] = [[66.6, 81.4], [75.4, 80.8], [80.6, 85.2], [82.2, 93.6, 1], [74.4, 95.8], [66.2, 94.4, 1], [64.6, 87.4]];
const SH_FAR: Pt[] = [[64.8, 81.6], [72.6, 81], [76.6, 86], [77.6, 93.4, 1], [71.4, 95], [65.2, 93.8, 1], [63.8, 87.4]];

const torsoPts = (p: Pose) => (p.view === "side" ? TORSO_S : TORSO_F);
function shoulderPts(k: Kit, p: Pose, side: -1 | 1): Pt[] {
  if (p.view === "side") return side === 1 ? SH_NEAR : SH_FAR;
  return side === -1 ? SH_L : k.mir(SH_L).reverse();
}

/** 어깨 소매 하나 (옆모습 먼 쪽은 어둡게). inner 는 소매 안쪽에 잘려 들어간다 */
function shoulderCap(k: Kit, p: Pose, side: -1 | 1, t: Tone, inner = "") {
  const pts = shoulderPts(k, p, side);
  const tone = p.view === "side" && side === -1 ? k.far(t) : t;
  const xs = pts.map((q) => q[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  return k.shape(k.sp(pts), tone, {
    dx: -1.8, dy: -2.4,
    inner: inner + k.line(`M ${k.f(x0 + 1)} 92.2 Q ${k.f((x0 + x1) / 2)} 95.2 ${k.f(x1 - 0.8)} 92.6`, tone.s, 1.6),
  });
}

/** 긴 소매: 팔 캡슐 위쪽 절반을 덮고, 손목에 소맷부리 띠 */
function longSleeve(k: Kit, a: ArmGeom, t: Tone, cuff: string, ol?: string) {
  const tone = a.far ? k.far(t) : t;
  const len = Math.hypot(a.hx - a.px, a.hy - a.py);
  const ux = (a.hx - a.px) / len, uy = (a.hy - a.py) / len;
  const ex = a.px + ux * len * 0.42, ey = a.py + uy * len * 0.42;
  const d = k.capsule(a.px - ux * 6, a.py - uy * 6, ex, ey, 5.2, 5.6);
  const cx = ex + ux * 2.4, cy = ey + uy * 2.4, nx = -uy * 7, ny = ux * 7;
  return k.shape(d, tone, {
    ol, dx: -1.4, dy: -1.8, rim: 1,
    inner: `<path d="M ${k.f(cx + nx)} ${k.f(cy + ny)} L ${k.f(cx - nx)} ${k.f(cy - ny)}" stroke="${a.far ? tone.s : cuff}" stroke-width="3.6"/>` +
      k.line(`M ${k.f(cx - ux * 1.8 + nx)} ${k.f(cy - uy * 1.8 + ny)} L ${k.f(cx - ux * 1.8 - nx)} ${k.f(cy - uy * 1.8 - ny)}`, tone.s, 0.9, 0.8),
  });
}

// ───────── 하의 공통 ─────────

/** 앞·뒤 바지 모양 (pantsFront 와 같은 틀). bottom = 가랑이 아랫단 높이(서 있을 때), lift = 든 발을 따라 올라가는 비율 */
function pantsShape(k: Kit, p: Pose, bottom: number, crotch: number, lift: number) {
  const tl = p.liftL ? 1.4 : 0, tr = p.liftR ? -1.4 : 0;
  const bl = bottom - p.liftL * lift, br = bottom - p.liftR * lift;
  const flare = bottom < 118 ? 1.2 : 0; // 반바지는 아랫단이 살짝 넓다
  return {
    d: k.sp([[58.4, 101.6, 1], [85.6, 101.6, 1], [84.6 + tr + flare, br, 1], [74.2 + tr - flare * 0.4, br, 1], [72.8, crotch, 1], [71.2, crotch, 1], [69.8 + tl + flare * 0.4, bl, 1], [59.4 + tl - flare, bl, 1]]),
    tl, tr, bl, br, flare,
  };
}
// 옆모습 엉덩이
const SEAT_S: Pt[] = [[59, 100, 1], [86, 100, 1], [86.6, 109.4], [72, 112.4], [58.4, 109.4]];
/** 옆모습 바짓가랑이 (엉덩이 → t 비율 지점) */
function sideLeg(k: Kit, lg: SideLeg, t: number, w = 5.6) {
  const ex = lg.hx + (lg.ax - lg.hx) * t, ey = lg.hy + (lg.ay - lg.hy) * t;
  const wide = t < 1 ? 0.8 : 0;
  return { d: k.sp([[lg.hx - w, lg.hy - 6, 1], [lg.hx + w, lg.hy - 6, 1], [ex + w + wide, ey + 0.6, 0.6], [ex - w - wide, ey + 0.6, 0.6]]), ex, ey, w: w + wide };
}

// ───────── 신발 공통 ─────────

/** 앞·뒤에서 본 운동화 모양 */
const sneakerPts = (x: number, by: number): Pt[] => [[x - 7.3, by, 1], [x + 7.3, by, 1], [x + 6.9, by - 3.8], [x + 3, by - 6.8], [x - 3, by - 6.8], [x - 6.9, by - 3.8]];
/** 옆에서 본 신발 모양 (오른쪽이 앞코) */
const sidePts = (x: number, by: number): Pt[] => [[x - 6.4, by, 1], [x + 8.8, by, 1], [x + 9.2, by - 3.4], [x + 5.4, by - 6.6], [x - 1.6, by - 7.6], [x - 6.6, by - 5.4]];
/** 네 갈래 반짝이 */
const sparkle = (x: number, y: number, r: number, color = "#ffd36e") =>
  `<path d="M ${x} ${y - r} Q ${x + r * 0.22} ${y - r * 0.22} ${x + r} ${y} Q ${x + r * 0.22} ${y + r * 0.22} ${x} ${y + r} Q ${x - r * 0.22} ${y + r * 0.22} ${x - r} ${y} Q ${x - r * 0.22} ${y - r * 0.22} ${x} ${y - r} Z" fill="${color}" stroke="#e0a72c" stroke-width=".6" stroke-linejoin="round"/>`;

// ───────── 모자 공통 ─────────

/** 털모자 방울 (둘레가 몽글몽글) */
function pompom(k: Kit, cx: number, cy: number, r: number) {
  const pts: Pt[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const rr = i % 2 ? r * 0.86 : r * 1.05;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, i % 2 ? 0 : 0.2]);
  }
  return k.shape(k.sp(pts), { b: "#ffffff", s: "#e6e2f0", h: "#ffffff" }, {
    sw: 1.6, dx: -1.2, dy: -1.4, rim: 0.8,
    inner: k.blob(cx + r * 0.4, cy + r * 0.4, r * 0.5, r * 0.4, "#d8d2e8", 0.6, "soft"),
  });
}

// ───────── 조각들 ─────────

const WHITE: Tone = { b: "#ffffff", s: "#e6e1da", h: "#ffffff" };
const STRIPE = "#4f8fe0";
const HOODIE: Tone = { b: "#9b7bd4", s: "#8466c2", h: "#bca6e9" };
const KNIT: Tone = { b: "#4caf7a", s: "#3d8f62", h: "#80cca0" };
const SHORTS: Tone = { b: "#7cc4e8", s: "#5aa5cd", h: "#aadcf3" };
const JEANS: Tone = { b: "#3f5f9e", s: "#2f4a80", h: "#6585c2" };
const SKIRT: Tone = { b: "#e85d4a", s: "#c4473a", h: "#f38b7b" };
const BOOTS: Tone = { b: "#ffd36e", s: "#e8b54c", h: "#ffeaa8" };
const SHINY: Tone = { b: "#d94b6a", s: "#b3344f", h: "#f38ea3" };
const STRAW: Tone = { b: "#f6d98a", s: "#e0bd66", h: "#fff1c6" };
const BRIM: Tone = { b: "#f2cf73", s: "#d9b45a", h: "#fbe6a6" };
const BEANIE: Tone = { b: "#5b8def", s: "#4877d4", h: "#8db0f6" };
const BEANIE_CUFF: Tone = { b: "#3f6fcc", s: "#3460b4", h: "#6e93de" };
const GOLD: Tone = { b: "#ffd36e", s: "#e9b443", h: "#fff0b8" };

/** 줄무늬 띠 (모양 안쪽에 잘려 들어간다) */
const stripes = (ys: number[], color: string, h = 3) => ys.map((y) => `<rect x="30" y="${y}" width="84" height="${h}" fill="${color}"/>`).join("");

/** 하트 (가운데 아래 꼭짓점이 y + 4.6 근처) */
const heart = (x: number, y: number, s = 1, fill = "#ff8fa3") =>
  `<path d="M ${x} ${y + 4.6 * s} C ${x - 5.6 * s} ${y + 0.8 * s} ${x - 6.4 * s} ${y - 3.2 * s} ${x - 3.6 * s} ${y - 4.4 * s} C ${x - 2 * s} ${y - 5 * s} ${x - 0.6 * s} ${y - 4.2 * s} ${x} ${y - 3 * s} C ${x + 0.6 * s} ${y - 4.2 * s} ${x + 2 * s} ${y - 5 * s} ${x + 3.6 * s} ${y - 4.4 * s} C ${x + 6.4 * s} ${y - 3.2 * s} ${x + 5.6 * s} ${y + 0.8 * s} ${x} ${y + 4.6 * s} Z" fill="${fill}" stroke="#d9667f" stroke-width=".8" stroke-linejoin="round"/>` +
  `<ellipse cx="${x - 2.4 * s}" cy="${y - 2.2 * s}" rx="${1.1 * s}" ry="${0.7 * s}" fill="#ffd0da" transform="rotate(-30 ${x - 2.4 * s} ${y - 2.2 * s})"/>`;

/** 니트 무늬 (작은 V 자) */
function knitTexture(k: Kit, xs: number[], ys: number[], skip?: (x: number, y: number) => boolean) {
  let d = "";
  for (const y of ys) for (const x of xs) if (!skip?.(x, y)) d += `M ${x - 1.5} ${y} L ${x} ${y + 1.6} L ${x + 1.5} ${y} `;
  return k.line(d, KNIT.s, 0.9, 0.55);
}

export const AVATAR_PIECES: Record<string, AvatarPiece> = {
  // ===== 상의 =====
  // 줄무늬 티셔츠: 흰 바탕에 파란 줄, 반소매
  "avatar.top.stripe": {
    slot: "top",
    torso(k, p) {
      const side = p.view === "side";
      const neck = p.back ? k.line("M 63.4 80.4 Q 72 83.6 80.6 80.4", STRIPE, 2.2)
        : side ? k.line("M 78.6 79.8 Q 82.6 84.4 86.4 81.6", STRIPE, 2.2)
        : k.line("M 63.4 80.2 Q 72 86.4 80.6 80.2", STRIPE, 2.4);
      return k.shape(k.sp(torsoPts(p)), WHITE, {
        dx: -3.2, dy: -2.6,
        inner: stripes([86.4, 92.4, 98.4], STRIPE) + stripes([103.6], STRIPE, 4) +
          k.blob(side ? 86 : 90, 96, 6, 14, "#1d3f7a", 0.16) + k.blob(72, 81, 16, 3, WHITE.s, 0.6) + neck,
      });
    },
    shoulder(k, p, side) {
      return shoulderCap(k, p, side, WHITE, stripes([86.6], STRIPE, 2.6));
    },
  },
  // 후드티: 보라색, 캥거루 주머니, 흰 끈, 긴소매
  "avatar.top.hoodie": {
    slot: "top",
    torso(k, p) {
      const side = p.view === "side";
      let inner = k.blob(72, 81, 16, 3, HOODIE.s, 0.6) + k.line(side ? "M 56.6 92 Q 55.4 100 55.6 105" : "M 56.6 92 Q 55 100 54.6 105", HOODIE.h, 2.4, 0.6);
      // 아랫단 고무단
      inner += `<path d="${side ? "M 50 103 Q 72 106.8 94 103 L 94 112 L 50 112 Z" : "M 48 102.6 Q 72 106 96 102.6 L 96 112 L 48 112 Z"}" fill="${HOODIE.s}" opacity=".85"/>`;
      if (p.back) {
        // 등에 늘어진 모자
        inner += k.shape(k.sp([[58.6, 79.6], [72, 77.6], [85.4, 79.6], [87.4, 87.4], [82, 95.6], [72, 97.8], [62, 95.6], [56.6, 87.4]]), HOODIE, {
          ol: "#6a4fa8", sw: 1.5, dx: -1.6, dy: -1.8, rim: 1,
          inner: k.blob(72, 84, 10, 5, "#6a4fa8", 0.5) + k.line("M 62.4 92 Q 72 96 81.6 92", HOODIE.s, 1.1, 0.8),
        });
      } else if (side) {
        inner += k.shape(k.sp([[73, 96, 1], [90.6, 96, 1], [91, 105.4, 1], [70.6, 105.4, 1]]), { b: HOODIE.s, s: "#7258b0", h: HOODIE.b }, { ol: "#6a4fa8", sw: 1.2, dx: -1, dy: -1, rim: 0.6 });
      } else {
        // 캥거루 주머니
        inner += k.shape(k.sp([[61.4, 95.4, 0.6], [82.6, 95.4, 0.6], [86, 105.6, 1], [58, 105.6, 1]]), { b: HOODIE.s, s: "#7258b0", h: HOODIE.b }, {
          ol: "#6a4fa8", sw: 1.2, dx: -1, dy: -1, rim: 0.6,
          inner: k.line("M 61.6 96.6 Q 59.6 101 59.4 105", "#6a4fa8", 1, 0.7) + k.line("M 82.4 96.6 Q 84.4 101 84.6 105", "#6a4fa8", 1, 0.7),
        });
      }
      return k.shape(k.sp(torsoPts(p)), HOODIE, { ol: "#6a4fa8", dx: -3.2, dy: -2.6, inner });
    },
    shoulder(k, p, side) {
      return shoulderCap(k, p, side, HOODIE);
    },
    arm(k, _p, a) {
      return longSleeve(k, a, HOODIE, "#7a5fbd", "#6a4fa8");
    },
    collar(k, p) {
      if (p.back) return "";
      if (p.view === "side") {
        // 목 뒤에 접힌 모자 + 앞쪽 끈 하나
        return k.shape(k.sp([[53.6, 78.6], [61.6, 74.4], [68.6, 77.2], [67.4, 86.4], [60.4, 90.6], [53, 87.4]]), HOODIE, {
          ol: "#6a4fa8", sw: 1.6, dx: -1.4, dy: -1.6, rim: 1, inner: k.blob(62, 82, 4, 5, "#6a4fa8", 0.45),
        }) + k.line("M 84.6 83 L 85.6 92.4", "#ffffff", 1.4) + `<circle cx="85.7" cy="93" r="1.2" fill="#ffffff" stroke="#6a4fa8" stroke-width=".6"/>`;
      }
      // 목둘레를 감싼 모자 + 흰 끈
      return k.shape(k.sp([[56.4, 80.6], [63.4, 76.8], [72, 75.8], [80.6, 76.8], [87.6, 80.6], [86.4, 85], [79.2, 86.8], [72, 85.4], [64.8, 86.8], [57.6, 85]]), HOODIE, {
        ol: "#6a4fa8", sw: 1.6, dx: -1.4, dy: -1.6, rim: 1, inner: k.blob(72, 80, 14, 3, "#6a4fa8", 0.4),
      }) +
        k.line("M 67.8 85.6 L 67 93.4", "#ffffff", 1.4) + k.line("M 76.2 85.6 L 77 93.4", "#ffffff", 1.4) +
        `<circle cx="66.9" cy="94" r="1.25" fill="#ffffff" stroke="#6a4fa8" stroke-width=".6"/><circle cx="77.1" cy="94" r="1.25" fill="#ffffff" stroke="#6a4fa8" stroke-width=".6"/>`;
    },
  },
  // 니트 스웨터: 초록, 가운데 하트 무늬, 고무단, 긴소매
  "avatar.top.knit": {
    slot: "top",
    torso(k, p) {
      const side = p.view === "side";
      const hx = side ? 83 : 72;
      let inner = k.blob(72, 81, 16, 3, KNIT.s, 0.55) + k.line(side ? "M 56.6 92 Q 55.4 100 55.6 104" : "M 56.6 92 Q 55 100 54.6 104", KNIT.h, 2.4, 0.6);
      inner += knitTexture(k, side ? [60, 66, 72, 78] : [59, 65.5, 72, 78.5, 85], [87, 93, 99], (x, y) => !p.back && Math.abs(x - hx) < 7 && y > 85 && y < 100);
      // 고무단 (아랫단·세로 골)
      const band = side ? "M 50 103 Q 72 106.8 94 103 L 94 112 L 50 112 Z" : "M 48 102.4 Q 72 105.8 96 102.4 L 96 112 L 48 112 Z";
      let ribs = "";
      for (let x = 54; x <= 90; x += 3) ribs += `M ${x} ${side ? 104.6 : 104.2} L ${x} 108.6 `;
      inner += `<path d="${band}" fill="${KNIT.s}"/>` + k.line(ribs, KNIT.b, 0.9, 0.7);
      if (!p.back) inner += heart(hx, 93, side ? 0.8 : 1);
      // 목 고무단
      inner += p.back ? k.line("M 62.4 80.2 Q 72 83.8 81.6 80.2", KNIT.s, 3.6)
        : side ? k.line("M 78.4 79.8 Q 82.4 84.6 86.6 81.6", KNIT.s, 3.4)
        : k.line("M 62.8 80 Q 72 86.6 81.2 80", KNIT.s, 3.6);
      return k.shape(k.sp(torsoPts(p)), KNIT, { ol: "#2f6d4b", dx: -3.2, dy: -2.6, inner });
    },
    shoulder(k, p, side) {
      return shoulderCap(k, p, side, KNIT, knitTexture(k, [52, 56, 60, 68, 72, 76, 80, 84, 88, 92], [87.4]));
    },
    arm(k, _p, a) {
      return longSleeve(k, a, KNIT, KNIT.s, "#2f6d4b");
    },
  },

  // ===== 하의 =====
  // 반바지: 하늘색, 무릎 위
  "avatar.bottom.shorts": {
    slot: "bottom",
    hips(k, p) {
      if (p.view === "side") return k.shape(k.sp(SEAT_S), SHORTS, { ol: k.P.olh, dx: -3, dy: -2.6, inner: k.line("M 59 103.4 Q 72 105.6 86 103.4", SHORTS.s, 1.1, 0.8) });
      const s = pantsShape(k, p, 114.6, 109.4, 0.35);
      const hem = (x0: number, x1: number, b: number) => `<rect x="${k.f(x0)}" y="${k.f(b - 2.6)}" width="${k.f(x1 - x0)}" height="2.6" fill="${SHORTS.h}" opacity=".85"/>` + k.line(`M ${k.f(x0)} ${k.f(b - 2.6)} L ${k.f(x1)} ${k.f(b - 2.6)}`, SHORTS.s, 1, 0.9);
      return k.shape(s.d, SHORTS, {
        ol: k.P.olh, dx: -3, dy: -2.6,
        inner: k.line("M 58.6 104.2 Q 72 106 85.4 104.2", SHORTS.s, 1.1, 0.9) +
          (p.back ? k.line("M 60.6 106.4 L 66.4 106.4 M 77.6 106.4 L 83.4 106.4", SHORTS.s, 1, 0.8) : k.line("M 72 104.6 L 72 109", SHORTS.s, 1, 0.8) + k.line("M 60.4 104.6 Q 63.4 107.6 64.6 104.6 M 83.6 104.6 Q 80.6 107.6 79.4 104.6", SHORTS.s, 1, 0.8)) +
          hem(58.6 + s.tl - s.flare, 70.2 + s.tl + s.flare * 0.4, s.bl) + hem(73.8 + s.tr - s.flare * 0.4, 85.4 + s.tr + s.flare, s.br) +
          k.line("M 62.4 106 L 62.4 111", SHORTS.h, 1.6, 0.6),
      });
    },
    leg(k, p, lg) {
      const tone = lg.far ? k.far(SHORTS) : SHORTS;
      const s = sideLeg(k, lg, 0.42);
      return k.shape(s.d, tone, {
        ol: k.P.olh, dx: -2, dy: -1.6, rim: 1,
        inner: `<rect x="${k.f(s.ex - s.w - 1)}" y="${k.f(s.ey - 2.2)}" width="${k.f(2 * s.w + 2)}" height="3" fill="${tone.h}" opacity=".8"/>` +
          k.line(`M ${k.f(s.ex - s.w)} ${k.f(s.ey - 2.2)} L ${k.f(s.ex + s.w)} ${k.f(s.ey - 2.2)}`, tone.s, 1.1, 0.9),
      });
    },
  },
  // 청바지: 남색, 노란 바느질 선, 접어 올린 밑단
  "avatar.bottom.jeans": {
    slot: "bottom",
    long: true,
    hips(k, p) {
      const stitch = (d: string) => `<path d="${d}" fill="none" stroke="#f2c14e" stroke-width=".9" stroke-dasharray="1.4 1.1" stroke-linecap="round" opacity=".9"/>`;
      if (p.view === "side") {
        return k.shape(k.sp(SEAT_S), JEANS, {
          ol: k.P.olh, dx: -3, dy: -2.6,
          inner: k.line("M 59 103.4 Q 72 105.6 86 103.4", JEANS.s, 1.1, 0.8) + stitch("M 60.6 104.8 Q 62 108.8 66.6 109.4") + stitch("M 80.6 104.6 Q 83.6 106.6 85.4 104.2"),
        });
      }
      const s = pantsShape(k, p, 124.6, 113.4, 1);
      const cuff = (x0: number, x1: number, b: number) => `<rect x="${k.f(x0)}" y="${k.f(b - 3)}" width="${k.f(x1 - x0)}" height="3" fill="${JEANS.h}" opacity=".85"/>` + k.line(`M ${k.f(x0)} ${k.f(b - 3)} L ${k.f(x1)} ${k.f(b - 3)}`, JEANS.s, 1.1, 0.9);
      const front = p.back
        ? stitch("M 60.4 106 L 67 106 L 67 111 L 63.7 112.6 L 60.4 111 Z") + stitch("M 77 106 L 83.6 106 L 83.6 111 L 80.3 112.6 L 77 111 Z")
        : stitch("M 60.4 104.6 Q 63.6 108.4 66.6 104.6") + stitch("M 77.4 104.6 Q 80.4 108.4 83.6 104.6") + stitch("M 72 104.6 L 72 111.6");
      return k.shape(s.d, JEANS, {
        ol: k.P.olh, dx: -3, dy: -2.6,
        inner: k.line("M 58.6 104 Q 72 105.8 85.4 104", JEANS.s, 1.1, 0.9) + front +
          stitch(`M ${k.f(60.6 + s.tl)} 113 L ${k.f(60.6 + s.tl)} ${k.f(s.bl - 3.6)}`) + stitch(`M ${k.f(83.4 + s.tr)} 113 L ${k.f(83.4 + s.tr)} ${k.f(s.br - 3.6)}`) +
          cuff(59 + s.tl, 70.4 + s.tl, s.bl) + cuff(73.6 + s.tr, 85 + s.tr, s.br) + k.line("M 62.4 106 L 62.4 112", JEANS.h, 1.6, 0.6),
      });
    },
    leg(k, p, lg) {
      const tone = lg.far ? k.far(JEANS) : JEANS;
      const s = sideLeg(k, lg, 1);
      return k.shape(s.d, tone, {
        ol: k.P.olh, dx: -2, dy: -1.6, rim: 1,
        inner: `<rect x="${k.f(s.ex - s.w - 1)}" y="${k.f(s.ey - 2.6)}" width="${k.f(2 * s.w + 2)}" height="3.2" fill="${tone.h}" opacity=".8"/>` +
          k.line(`M ${k.f(s.ex - s.w)} ${k.f(s.ey - 2.6)} L ${k.f(s.ex + s.w)} ${k.f(s.ey - 2.6)}`, tone.s, 1.1, 0.9) +
          `<path d="M ${k.f(lg.hx + 1)} ${k.f(lg.hy - 2)} L ${k.f(s.ex + 1)} ${k.f(s.ey - 3.6)}" fill="none" stroke="#f2c14e" stroke-width=".9" stroke-dasharray="1.4 1.1" opacity="${lg.far ? 0.5 : 0.9}"/>`,
      });
    },
  },
  // 주름치마: 빨간 체크, 아래로 퍼짐
  "avatar.bottom.skirt": {
    slot: "bottom",
    hips(k, p) {
      const side = p.view === "side";
      const pts: Pt[] = side
        ? [[55, 100, 1], [89, 100, 1], [92.6, 108], [97, 115, 1], [84, 117.6], [70, 117.8], [56, 117.2], [47.6, 114.8, 1], [51.6, 107]]
        : [[57.4, 100.4, 1], [86.6, 100.4, 1], [90.6, 108], [95, 115.4, 1], [83.6, 117.4], [72, 117.8], [60.4, 117.4], [49, 115.4, 1], [53.4, 108]];
      const tops = side ? [62, 68, 74, 80, 86] : [62, 67, 72, 77, 82];
      const hems = side ? [54, 63.4, 72.8, 82.2, 91.6] : [54, 63, 72, 81, 90];
      const pleats = tops.map((x, i) => `M ${x} 103.6 L ${hems[i]} 117`).join(" ");
      const checks = tops.slice(0, -1).map((x, i) => `M ${(x + tops[i + 1]) / 2} 103.6 L ${(hems[i] + hems[i + 1]) / 2} 117`).join(" ");
      return k.shape(k.sp(pts), SKIRT, {
        ol: k.P.olh, dx: -3.2, dy: -2.6,
        inner: k.line(checks, "#ffd36e", 0.8, 0.55) + k.line("M 46 110.4 Q 72 112.8 98 110.4", "#ffd36e", 0.9, 0.75) +
          k.line(pleats, "#b8402f", 1, 0.9) + k.line("M 56 103.4 Q 72 105 88 103.4", SKIRT.s, 1.2, 0.9) +
          k.line("M 54.6 106 Q 52.6 111 51 115", SKIRT.h, 2.4, 0.6) + k.blob(side ? 92 : 90, 110, 6, 8, "#8e2a20", 0.2),
      });
    },
  },

  // ===== 신발 =====
  // 운동화: 흰색, 빨간 줄
  "avatar.shoes.sneakers": {
    slot: "shoes",
    foot(k, p, x, by) {
      return k.shape(k.sp(sneakerPts(x, by)), WHITE, {
        ol: k.P.olh, dx: -2, dy: -2.2,
        inner: k.line(`M ${k.f(x - 6.8)} ${k.f(by - 1.3)} L ${k.f(x + 6.8)} ${k.f(by - 1.3)}`, "#cfc6bb", 2.2) +
          (p.back
            ? `<rect x="${k.f(x - 1.5)}" y="${k.f(by - 7.4)}" width="3" height="4" rx="1" fill="#e85d4a"/>`
            : k.line(`M ${k.f(x - 5.8)} ${k.f(by - 3.4)} Q ${x} ${k.f(by - 5.6)} ${k.f(x + 5.8)} ${k.f(by - 3.4)}`, "#e85d4a", 1.6) +
              k.line(`M ${k.f(x - 1.8)} ${k.f(by - 5.9)} L ${k.f(x + 1.8)} ${k.f(by - 5.9)}`, "#b9b0a6", 0.9)),
      });
    },
    footSide(k, p, x, by, far) {
      const tone = far ? k.far(WHITE, 0.08) : WHITE;
      return k.shape(k.sp(sidePts(x, by)), tone, {
        ol: k.P.olh, dx: -1.6, dy: -2,
        inner: k.line(`M ${k.f(x - 6.4)} ${k.f(by - 1.3)} L ${k.f(x + 9)} ${k.f(by - 1.3)}`, "#cfc6bb", 2) +
          k.line(`M ${k.f(x - 4.2)} ${k.f(by - 3.2)} Q ${k.f(x + 1.6)} ${k.f(by - 6)} ${k.f(x + 6.6)} ${k.f(by - 3.8)}`, far ? "#c4473a" : "#e85d4a", 1.6),
      });
    },
  },
  // 장화: 노란 장화, 정강이까지
  "avatar.shoes.boots": {
    slot: "shoes",
    foot(k, _p, x, by) {
      const d = k.sp([[x - 7.4, by, 1], [x + 7.4, by, 1], [x + 7, by - 4], [x + 5.6, by - 6.6], [x + 5.8, by - 15.6, 1], [x - 5.8, by - 15.6, 1], [x - 5.6, by - 6.6], [x - 7, by - 4]]);
      return k.shape(d, BOOTS, {
        ol: k.P.olh, dx: -2, dy: -2.4,
        inner: `<rect x="${k.f(x - 7)}" y="${k.f(by - 16)}" width="14" height="3.6" fill="#e0a72c"/>` +
          k.line(`M ${k.f(x - 7)} ${k.f(by - 1.4)} L ${k.f(x + 7)} ${k.f(by - 1.4)}`, "#c98f2a", 2) +
          k.line(`M ${k.f(x - 3.4)} ${k.f(by - 11)} L ${k.f(x - 3.4)} ${k.f(by - 6)}`, BOOTS.h, 1.6, 0.8),
      });
    },
    footSide(k, _p, x, by, far) {
      const tone = far ? k.far(BOOTS, 0.1) : BOOTS;
      const d = k.sp([[x - 6.4, by, 1], [x + 9, by, 1], [x + 9.2, by - 3.4], [x + 5.8, by - 6.2], [x + 4.6, by - 15, 1], [x - 5.8, by - 15, 1], [x - 6.6, by - 5.4]]);
      return k.shape(d, tone, {
        ol: k.P.olh, dx: -1.6, dy: -2,
        inner: `<rect x="${k.f(x - 7)}" y="${k.f(by - 15.4)}" width="13" height="3.4" fill="${far ? "#c48f25" : "#e0a72c"}"/>` +
          k.line(`M ${k.f(x - 6.4)} ${k.f(by - 1.3)} L ${k.f(x + 9)} ${k.f(by - 1.3)}`, "#c98f2a", 1.8),
      });
    },
  },
  // 반짝 구두: 빨간 에나멜 구두, 반짝이
  "avatar.shoes.shiny": {
    slot: "shoes",
    foot(k, p, x, by) {
      const d = k.sp([[x - 7.2, by, 1], [x + 7.2, by, 1], [x + 6.8, by - 4.6], [x + 2.8, by - 7.8], [x - 2.8, by - 7.8], [x - 6.8, by - 4.6]]);
      const strap = p.back
        ? `M ${k.f(x - 5.8)} ${k.f(by - 6.2)} Q ${x} ${k.f(by - 8.4)} ${k.f(x + 5.8)} ${k.f(by - 6.2)}`
        : `M ${k.f(x - 6.4)} ${k.f(by - 4.4)} Q ${x} ${k.f(by - 7.6)} ${k.f(x + 6.4)} ${k.f(by - 4.4)}`;
      const outer = x < 72 ? -1 : 1;
      return k.shape(d, SHINY, {
        ol: "#7c2234", dx: -2, dy: -2.4,
        inner: k.line(strap, "#9e2a43", 2) + (p.back ? "" : `<circle cx="${k.f(x + 3.4)}" cy="${k.f(by - 5.4)}" r="1" fill="#ffd36e"/>`) +
          `<ellipse cx="${k.f(x - 3)}" cy="${k.f(by - 3)}" rx="1.8" ry=".9" fill="#ffffff" opacity=".9" transform="rotate(-20 ${k.f(x - 3)} ${k.f(by - 3)})"/>` +
          k.line(`M ${k.f(x - 6.6)} ${k.f(by - 1.1)} L ${k.f(x + 6.6)} ${k.f(by - 1.1)}`, "#8e2238", 1.6, 0.9),
      }) + (outer === 1 && !p.back ? sparkle(x + 9.6, by - 9.4, 2.8) : "");
    },
    footSide(k, _p, x, by, far) {
      const tone = far ? k.far(SHINY, 0.12) : SHINY;
      return k.shape(k.sp(sidePts(x, by)), tone, {
        ol: "#7c2234", dx: -1.6, dy: -2,
        inner: k.line(`M ${k.f(x - 6.4)} ${k.f(by - 1.2)} L ${k.f(x + 9)} ${k.f(by - 1.2)}`, "#8e2238", 1.6, 0.9) +
          k.line(`M ${k.f(x - 0.4)} ${k.f(by - 7.4)} L ${k.f(x + 3.4)} ${k.f(by - 4.4)}`, "#9e2a43", 2) +
          (far ? "" : `<ellipse cx="${k.f(x + 4.6)}" cy="${k.f(by - 3.4)}" rx="1.8" ry=".9" fill="#ffffff" opacity=".9" transform="rotate(-18 ${k.f(x + 4.6)} ${k.f(by - 3.4)})"/>`),
      }) + (far ? "" : sparkle(x + 12, by - 8.6, 2.6));
    },
  },

  // ===== 모자 =====
  // 밀짚모자: 넓은 챙, 빨간 띠
  "avatar.hat.straw": {
    slot: "hat",
    hat(k, p) {
      const { cx, top, rimY, hw } = p.head;
      const side = p.view === "side";
      const bx = cx + (side ? 3 : 0);
      const rx = hw * 1.42, ry = side ? 8.4 : 9.6, by = rimY + 2;
      const cw = hw * 0.86;
      // 챙: 밀짚 결 (가운데에서 퍼지는 짧은 선)
      let weave = "";
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        weave += `M ${k.f(bx + c * rx * 0.7)} ${k.f(by + s * ry * 0.7)} L ${k.f(bx + c * rx * 0.93)} ${k.f(by + s * ry * 0.93)} `;
      }
      const brim = k.shape(k.ell(bx, by, rx, ry), BRIM, {
        ol: "#a9802f", dx: -2.4, dy: -2.4, rim: 1.2,
        inner: k.line(weave, BRIM.s, 0.9, 0.8) + k.line(`M ${k.f(bx - rx * 0.82)} ${k.f(by + ry * 0.2)} Q ${bx} ${k.f(by + ry * 1.12)} ${k.f(bx + rx * 0.82)} ${k.f(by + ry * 0.2)}`, BRIM.s, 1, 0.8),
      });
      const crownD = k.sp([[bx - cw, by + 1, 1], [bx - cw * 0.96, rimY - 7], [bx - cw * 0.7, top - 1], [bx, top - 5], [bx + cw * 0.7, top - 1], [bx + cw * 0.96, rimY - 7], [bx + cw, by + 1, 1], [bx, by + 4.6]]);
      const crown = k.shape(crownD, STRAW, {
        ol: "#a9802f", dx: -2.6, dy: -3, rim: 1.3,
        inner: `<path d="M ${k.f(bx - cw - 3)} ${k.f(rimY - 5.4)} Q ${bx} ${k.f(rimY + 0.6)} ${k.f(bx + cw + 3)} ${k.f(rimY - 5.4)} L ${k.f(bx + cw + 3)} ${k.f(rimY + 1.4)} Q ${bx} ${k.f(rimY + 7.4)} ${k.f(bx - cw - 3)} ${k.f(rimY + 1.4)} Z" fill="#e85d4a"/>` +
          k.line(`M ${k.f(bx - cw - 3)} ${k.f(rimY - 5.4)} Q ${bx} ${k.f(rimY + 0.6)} ${k.f(bx + cw + 3)} ${k.f(rimY - 5.4)}`, "#b8402f", 0.9, 0.8) +
          k.line(`M ${k.f(bx - cw * 0.6)} ${k.f(rimY - 10)} Q ${bx} ${k.f(rimY - 6)} ${k.f(bx + cw * 0.6)} ${k.f(rimY - 10)}`, STRAW.s, 0.9, 0.7) +
          k.line(`M ${k.f(bx - cw * 0.5)} ${k.f(top + 6)} Q ${k.f(bx - cw * 0.2)} ${k.f(top + 1)} ${k.f(bx + cw * 0.1)} ${k.f(top)}`, STRAW.h, 1.6, 0.8),
      });
      return brim + crown;
    },
  },
  // 털모자: 파란 비니, 접은 단, 흰 방울
  "avatar.hat.beanie": {
    slot: "hat",
    hat(k, p) {
      const { top, rimY, hw } = p.head;
      const side = p.view === "side";
      const cx = p.head.cx + (side ? 1 : 0);
      const dome = k.sp([[cx - hw - 1, rimY + 2, 1], [cx - hw + 0.6, rimY - 10], [cx - hw * 0.66, top + 2], [cx, top - 3], [cx + hw * 0.66, top + 2], [cx + hw - 0.6, rimY - 10], [cx + hw + 1, rimY + 2, 1]]);
      const ribs = [-0.56, -0.2, 0.2, 0.56].map((t) => `M ${k.f(cx + hw * t * 1.08)} ${k.f(rimY)} Q ${k.f(cx + hw * t * 1.02)} ${k.f((rimY + top) / 2)} ${k.f(cx + hw * t * 0.5)} ${k.f(top + 2)}`).join(" ");
      const body = k.shape(dome, BEANIE, {
        ol: "#2f4f99", dx: -2.6, dy: -3, rim: 1.3,
        inner: k.line(ribs, BEANIE.s, 1.3, 0.9) + k.blob(cx + hw * 0.7, rimY - 8, 7, 12, "#2f4f99", 0.3),
      });
      const cuffD = k.sp([[cx - hw - 3, rimY - 3.4, 0.5], [cx, rimY - 5.4], [cx + hw + 3, rimY - 3.4, 0.5], [cx + hw + 3.4, rimY + 5, 0.6], [cx, rimY + 7.4], [cx - hw - 3.4, rimY + 5, 0.6]]);
      let ticks = "";
      for (let t = -0.92; t <= 0.93; t += 0.155) ticks += `M ${k.f(cx + (hw + 2) * t)} ${k.f(rimY - 2.6 - 2 * (1 - t * t))} L ${k.f(cx + (hw + 2) * t)} ${k.f(rimY + 4.6 + 2 * (1 - t * t))} `;
      const cuff = k.shape(cuffD, BEANIE_CUFF, { ol: "#2f4f99", dx: -2, dy: -2, rim: 1, inner: k.line(ticks, BEANIE_CUFF.s, 1, 0.9) });
      return body + cuff + pompom(k, cx - (side ? 5 : 0), top - 3, 6.6);
    },
  },
  // 왕관: 금색, 보석
  "avatar.hat.crown": {
    slot: "hat",
    hat(k, p) {
      const { top, hw } = p.head;
      const side = p.view === "side";
      const cx = p.head.cx + (side ? 2 : 0);
      const w = hw * 0.5 * (side ? 0.84 : 1), by = top + 13, h = 17;
      const tips: [number, number][] = [[cx - w - 2.6, by - h + 3], [cx, by - h], [cx + w + 2.6, by - h + 3]];
      const d = k.sp([[cx - w, by, 1], [tips[0][0], tips[0][1], 1], [cx - w * 0.45, by - 8.4, 1], [tips[1][0], tips[1][1], 1], [cx + w * 0.45, by - 8.4, 1], [tips[2][0], tips[2][1], 1], [cx + w, by, 1]]);
      const body = k.shape(d, GOLD, { ol: "#b07a1e", dx: -2, dy: -2.4, rim: 1.2, inner: k.blob(cx + w * 0.6, by - 6, 5, 8, "#c98f2a", 0.35) });
      const band = k.shape(k.sp([[cx - w - 0.8, by - 5.6, 0.6], [cx + w + 0.8, by - 5.6, 0.6], [cx + w + 0.6, by + 1.4, 0.6], [cx - w - 0.6, by + 1.4, 0.6]]), { b: "#f2b632", s: "#d99a1e", h: "#ffe08a" }, { ol: "#b07a1e", sw: 1.6, dx: -1.2, dy: -1.2, rim: 0.8 });
      const balls = tips.map(([x, y]) => `<circle cx="${k.f(x)}" cy="${k.f(y)}" r="2" fill="#fff0b8" stroke="#b07a1e" stroke-width="1"/>`).join("");
      const gems = p.back
        ? `<circle cx="${k.f(cx)}" cy="${k.f(by - 2.1)}" r="1.5" fill="#6cb4ee" stroke="#3b7fb8" stroke-width=".6"/>`
        : `<ellipse cx="${k.f(cx)}" cy="${k.f(by - 2.1)}" rx="2.2" ry="2.4" fill="#e85d4a" stroke="#a83a2c" stroke-width=".7"/><circle cx="${k.f(cx - 0.7)}" cy="${k.f(by - 2.9)}" r=".6" fill="#ffd0c8"/>` +
          `<circle cx="${k.f(cx - w * 0.62)}" cy="${k.f(by - 2.1)}" r="1.5" fill="#6cb4ee" stroke="#3b7fb8" stroke-width=".6"/><circle cx="${k.f(cx + w * 0.62)}" cy="${k.f(by - 2.1)}" r="1.5" fill="#6cb4ee" stroke="#3b7fb8" stroke-width=".6"/>`;
      return `<g transform="rotate(${side ? 4 : -6} ${k.f(cx)} ${k.f(by)})">${body}${band}${balls}${gems}</g>`;
    },
  },
};

/** 부위 순서대로 정리한 꾸미기 조각들 (없는 키는 건너뛴다) */
export function piecesInOrder(assetKeys: string[]): AvatarPiece[] {
  const pieces = assetKeys.map((k) => AVATAR_PIECES[k]).filter((p): p is AvatarPiece => Boolean(p));
  return SLOT_ORDER.flatMap((slot) => pieces.filter((p) => p.slot === slot).slice(0, 1));
}
