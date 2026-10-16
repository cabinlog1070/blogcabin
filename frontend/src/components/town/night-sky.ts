// 광장 위쪽 밤하늘 (2026-10-12 정지원 님 시안): 남색 하늘에 별·보라 구름, 산 아래 마을 불빛, 반짝이는 별과 별똥별,
// 그리고 밤마다 터지는 크레용 불꽃놀이 (알록달록 불꽃 + 가끔 토끼·고양이 얼굴). 불꽃 그림은 soft.ts. 낮에는 보이지 않는다.
// 밤하늘은 레이어 하나에 모아 낮·밤에 따라 한 번에 보이고 사라진다 (레이어 속 그림은 하늘색으로 물들이지 않는다).
import type * as PhaserNS from "phaser";

type Area = { x: number; y: number; w: number; h: number; horizon: number; depth: number; frontDepth: number };


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
  keep(scene.add.tileSprite(X, Y, W, H, "soft:grain").setOrigin(0).setTileScale(0.5).setAlpha(0.12) as unknown as PhaserNS.GameObjects.Image);
  // 지평선 위 보랏빛 크레용 구름
  for (let x = X + rng.between(0, 200); x < X + W; x += rng.between(260, 420)) {
    const w = rng.between(70, 100);
    keep(scene.add.image(x, horizon - rng.between(70, 110), "soft:cloud-night").setDisplaySize(w, (w * 130) / 240).setAlpha(0.85));
  }

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

  /** 불꽃 하나: 작은 크레용 점이 올라가서, 크레용으로 그은 불꽃 그림(정지원 님 시안)이 활짝 퍼졌다가 흘러내리며 사라진다 */
  const burst = (key: string) => {
    const sky = visibleSky();
    if (!sky || night < 0.5 || !scene.textures.exists(key)) return; // 불꽃 그림은 광장을 띄운 뒤에 들어온다
    scene.game.canvas.dataset.fireworks = String(Number(scene.game.canvas.dataset.fireworks ?? 0) + 1); // e2e 확인용
    const cx = rng.between(sky.left, sky.right), cy = rng.between(sky.top + 20, sky.bottom);
    const size = Math.min(130, (sky.bottom - sky.top + 60) * 0.9) * rng.realInRange(0.8, 1.1);
    const rocket = keep(scene.add.image(cx, horizon - 10, "spark").setDisplaySize(7, 7).setTint(0xfff1b8), front);
    scene.tweens.add({
      targets: rocket, y: cy, duration: 650, ease: "Quad.easeOut",
      onComplete: () => {
        rocket.destroy();
        const fw = keep(scene.add.image(cx, cy, key).setDisplaySize(size * 0.25, size * 0.25).setRotation(rng.realInRange(-0.4, 0.4)), front);
        scene.tweens.add({
          targets: fw, displayWidth: size, displayHeight: size, duration: 450, ease: "Cubic.easeOut",
          onComplete: () => scene.tweens.add({ targets: fw, alpha: 0, y: cy + 10, delay: 600, duration: 800, onComplete: () => fw.destroy() }),
        });
      },
    });
  };

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
        burst(rng.frac() < 0.12 ? rng.pick(["fw:bunny", "fw:cat"]) : rng.pick(["fw:warm", "fw:cool", "fw:pink"]));
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
    /** 지금 불꽃놀이가 터지는가 (밤이고 "동작 줄이기"가 꺼져 있을 때) */
    fireworks: () => !still && night >= 0.5,
    /** 0 = 낮(안 보임) ~ 1 = 밤 */
    setNight(n: number) {
      night = n;
      for (const l of [layer, front]) l.setAlpha(n).setVisible(n > 0.01);
    },
  };
}
