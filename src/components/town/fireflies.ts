// 반딧불이 (2026-10-13 정지원 님 요청): 저녁·밤 광장이 어두워 보여서, 노란 빛이 숲과 풀밭 위를 천천히 떠다니며 깜빡인다.
// 가로등처럼 빛(ADD)으로 더해 그려서 밤 어둠(tint)에 물들지 않고, 캐릭터·건물보다 위에 보인다. 낮에는 숨는다.
import type * as PhaserNS from "phaser";

type Area = { x: number; y: number; w: number; h: number; depth: number };

const COUNT = 130;
const COLORS = [0xf8ff9a, 0xfff2a0, 0xd8ff8a]; // 연노랑·연두 (반딧불이 빛)

export function createFireflies(scene: PhaserNS.Scene, Phaser: typeof PhaserNS, area: Area) {
  const rng = new Phaser.Math.RandomDataGenerator(["blogcabin-fireflies"]);
  // 가운데는 하얗게 밝고 둘레로 번지는 빛 한 점
  if (!scene.textures.exists("firefly")) {
    const tex = scene.textures.createCanvas("firefly", 48, 48)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.12, "rgba(255,255,240,0.95)");
    g.addColorStop(0.32, "rgba(255,255,200,0.5)");
    g.addColorStop(1, "rgba(255,255,200,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 48, 48);
    tex.refresh();
  }

  const layer = scene.add.layer().setDepth(area.depth);
  const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  for (let i = 0; i < COUNT; i++) {
    const x = area.x + rng.frac() * area.w, y = area.y + rng.frac() * area.h;
    const size = rng.between(24, 40);
    const f = scene.add.image(x, y, "firefly").setDisplaySize(size, size).setTint(rng.pick(COLORS)).setBlendMode(Phaser.BlendModes.ADD).setData("light", true);
    layer.add(f);
    if (still) continue;
    // 천천히 이리저리 떠다닌다: 가까운 곳으로 갔다가 다시 다른 곳으로
    const drift = () => {
      scene.tweens.add({
        targets: f,
        x: Phaser.Math.Clamp(f.x + rng.between(-70, 70), area.x, area.x + area.w),
        y: Phaser.Math.Clamp(f.y + rng.between(-45, 45), area.y, area.y + area.h),
        duration: rng.between(2600, 5200),
        ease: "Sine.easeInOut",
        onComplete: drift,
      });
    };
    drift();
    // 깜빡깜빡: 켜졌다 꺼졌다를 저마다 다른 박자로
    scene.tweens.add({ targets: f, alpha: { from: 1, to: 0.15 }, duration: rng.between(700, 1600), yoyo: true, repeat: -1, delay: rng.between(0, 2400), ease: "Sine.easeInOut" });
  }

  return {
    /** 0 = 낮(안 보임) ~ 1 = 밤 */
    setNight(n: number) {
      layer.setAlpha(n).setVisible(n > 0.01);
    },
  };
}
