// 광장 위쪽 밤하늘 (2026-10-12 정지원 님 시안): 남색 하늘에 별·보라 구름, 산 아래 마을 불빛, 반짝이는 별과 별똥별,
// 그리고 밤마다 터지는 불꽃놀이 (동그란 불꽃 + 토끼·고양이 얼굴 불꽃). 낮에는 보이지 않는다.
// 밤하늘은 레이어 하나에 모아 낮·밤에 따라 한 번에 보이고 사라진다 (레이어 속 그림은 하늘색으로 물들이지 않는다).
import type * as PhaserNS from "phaser";

type Area = { x: number; y: number; w: number; h: number; horizon: number; depth: number; frontDepth: number };

const FIREWORK_COLORS = [0xff8fd0, 0xffd27a, 0x8ff5c8, 0xc9a2ff, 0x9fd8ff, 0xffb38a];

export function createNightSky(scene: PhaserNS.Scene, Phaser: typeof PhaserNS, area: Area) {
  const { x: X, y: Y, w: W, h: H, horizon, depth } = area;
  const rng = new Phaser.Math.RandomDataGenerator(["blogcabin-night"]);

  // 작은 빛 점 (불꽃·별)
  if (!scene.textures.exists("spark")) {
    const tex = scene.textures.createCanvas("spark", 32, 32)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    tex.refresh();
  }
  // 네 갈래 반짝이 별
  if (!scene.textures.exists("star4")) {
    const tex = scene.textures.createCanvas("star4", 32, 32)!;
    const ctx = tex.getContext();
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(18, 14, 32, 16);
    ctx.quadraticCurveTo(18, 18, 16, 32);
    ctx.quadraticCurveTo(14, 18, 0, 16);
    ctx.quadraticCurveTo(14, 14, 16, 0);
    ctx.fill();
    tex.refresh();
  }
  // 하늘 바탕: 위는 짙은 남색, 지평선 쪽은 보랏빛. 작은 별과 보라 구름을 구워 둔다
  if (!scene.textures.exists("night-sky")) {
    const tex = scene.textures.createCanvas("night-sky", W, H)!;
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#141a44");
    grad.addColorStop(0.6, "#28306a");
    grad.addColorStop(1, "#4b4790");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 2200; i++) {
      ctx.fillStyle = `rgba(255,248,220,${(0.35 + rng.frac() * 0.6).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(rng.between(0, W), rng.between(0, H - 60), 0.6 + rng.frac() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 지평선 위 보랏빛 구름: 동그라미 몇 개를 한 모양으로 합쳐 한 번에 칠한다 (겹친 곳이 진해지지 않게)
    for (let x = rng.between(0, 200); x < W; x += rng.between(260, 420)) {
      const y = H - rng.between(60, 110), k = rng.realInRange(0.5, 0.8);
      ctx.fillStyle = `rgba(${rng.between(130, 165)},${rng.between(100, 120)},${rng.between(180, 210)},0.45)`;
      ctx.beginPath();
      for (const [dx, dy, r] of [[-40, 8, 22], [-12, -4, 30], [20, 0, 26], [46, 10, 18], [0, 12, 22]]) {
        ctx.moveTo(x + (dx + r) * k, y + dy * k);
        ctx.arc(x + dx * k, y + dy * k, r * k, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    tex.refresh();
  }

  // 뒤 레이어(하늘·별)는 산 뒤에, 앞 레이어(불꽃·별똥별)는 산 앞에 그린다
  const layer = scene.add.layer().setDepth(depth);
  const front = scene.add.layer().setDepth(area.frontDepth);
  const keep = <O extends PhaserNS.GameObjects.Image>(o: O, to = layer) => {
    to.add(o);
    return o;
  };
  keep(scene.add.image(X, Y, "night-sky").setOrigin(0).setDepth(depth));

  const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // 반짝이는 큰 별
  for (let i = 0; i < 26; i++) {
    const s = keep(
      scene.add.image(rng.between(X, X + W), rng.between(Y + 20, horizon - 70), "star4")
        .setDisplaySize(10 + rng.frac() * 10, 10 + rng.frac() * 10).setDepth(depth + 0.1),
    );
    if (!still) scene.tweens.add({ targets: s, alpha: { from: 1, to: 0.25 }, duration: rng.between(900, 2200), yoyo: true, repeat: -1, delay: rng.between(0, 2000) });
  }

  let night = 0;
  const visibleSky = () => {
    const v = scene.cameras.main.worldView;
    const top = Math.max(v.y + 16, Y + 20), bottom = horizon - 50;
    return bottom - top > 30 ? { left: v.x + 60, right: v.right - 60, top, bottom } : null;
  };

  /** 불꽃 하나: 꼬리를 끌며 올라가서 터진다. shape가 있으면 그 모양 점들로 퍼진다 */
  const burst = (shape?: [number, number][]) => {
    const sky = visibleSky();
    if (!sky || night < 0.5) return;
    scene.game.canvas.dataset.fireworks = String(Number(scene.game.canvas.dataset.fireworks ?? 0) + 1); // e2e 확인용
    const cx = rng.between(sky.left, sky.right), cy = rng.between(sky.top + 20, sky.bottom);
    const color = rng.pick(FIREWORK_COLORS);
    const scale = Math.min(1, (sky.bottom - sky.top + 40) / 120);
    const spark = (x: number, y: number, size: number) =>
      keep(scene.add.image(x, y, "spark").setDisplaySize(size, size).setTint(color).setBlendMode(Phaser.BlendModes.ADD), front);
    const rocket = spark(cx, horizon - 10, 7);
    scene.tweens.add({
      targets: rocket, y: cy, duration: 650, ease: "Quad.easeOut",
      onComplete: () => {
        rocket.destroy();
        const flash = spark(cx, cy, 70 * scale).setAlpha(0.5);
        scene.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
        // 동그란 불꽃: 바깥·가운데·안쪽 세 겹으로 퍼지는 빛줄기 (시안처럼 꽉 찬 꽃 모양)
        const points: [number, number][] = shape ?? [[1, 32], [0.68, 22], [0.38, 12]].flatMap(([k, n]) =>
          Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2 + k;
            return [Math.cos(a) * k, Math.sin(a) * k] as [number, number];
          }));
        const r = (shape ? 34 : 50 + rng.between(0, 16)) * scale;
        for (const [px, py] of points) {
          const p = spark(cx, cy, shape ? 6 : 6.5);
          if (!shape) p.setDisplaySize(13, 4).setRotation(Math.atan2(py, px)); // 퍼지는 방향으로 길쭉한 빛줄기
          scene.tweens.add({
            targets: p, x: cx + px * r, y: cy + py * r + (shape ? 0 : 6 * scale), duration: shape ? 700 : 900, ease: "Cubic.easeOut",
            onComplete: () => scene.tweens.add({ targets: p, alpha: 0, y: p.y + 8, duration: shape ? 1100 : 700, delay: shape ? 500 : 0, onComplete: () => p.destroy() }),
          });
        }
      },
    });
  };

  // 토끼·고양이 얼굴 불꽃: 얼굴 둘레 + 귀 + 눈을 점으로
  const ring = (cx: number, cy: number, rx: number, ry: number, n: number, a0 = 0, a1 = Math.PI * 2): [number, number][] =>
    Array.from({ length: n }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    });
  const BUNNY: [number, number][] = [
    ...ring(0, 0.25, 1, 0.75, 22),
    ...ring(-0.42, -0.95, 0.2, 0.55, 10, Math.PI * 0.85, Math.PI * 2.15),
    ...ring(0.42, -0.95, 0.2, 0.55, 10, Math.PI * 0.85, Math.PI * 2.15),
    [-0.35, 0.15], [0.35, 0.15], [-0.08, 0.45], [0, 0.5], [0.08, 0.45],
  ];
  const CAT: [number, number][] = [
    ...ring(0, 0.2, 1, 0.78, 22),
    [-0.85, -0.35], [-0.78, -0.75], [-0.62, -1.05], [-0.4, -0.7], [-0.2, -0.6],
    [0.85, -0.35], [0.78, -0.75], [0.62, -1.05], [0.4, -0.7], [0.2, -0.6],
    [-0.35, 0.1], [0.35, 0.1], [-0.1, 0.42], [0, 0.36], [0.1, 0.42],
  ];

  /** 별똥별 */
  const meteor = () => {
    const sky = visibleSky();
    if (!sky || night < 0.5) return;
    const x = rng.between(sky.left, sky.right), y = sky.top + rng.between(0, 30);
    const m = keep(scene.add.image(x, y, "spark").setDisplaySize(28, 4).setRotation(0.5).setBlendMode(Phaser.BlendModes.ADD), front);
    scene.tweens.add({ targets: m, x: x + 160, y: y + 90, alpha: 0, duration: 900, ease: "Quad.easeIn", onComplete: () => m.destroy() });
  };

  if (!still) {
    // 장면의 update마다 시간을 재서 불꽃(0.9초마다)·별똥별(6초마다)을 띄운다
    let nextBurst = 0, nextMeteor = 3000;
    const tick = (now: number) => {
      if (now >= nextBurst) {
        nextBurst = now + 900;
        if (rng.frac() < 0.12) burst(rng.pick([BUNNY, CAT]));
        else burst();
      }
      if (now >= nextMeteor) {
        nextMeteor = now + 6000;
        meteor();
      }
    };
    scene.events.on("update", tick);
    scene.events.once("shutdown", () => scene.events.off("update", tick));
  }

  return {
    /** 0 = 낮(안 보임) ~ 1 = 밤 */
    setNight(n: number) {
      night = n;
      for (const l of [layer, front]) l.setAlpha(n).setVisible(n > 0.01);
    },
  };
}
