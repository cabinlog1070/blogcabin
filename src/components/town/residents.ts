// 광장을 돌아다니는 이웃 주민 (TOWN-12).
// 즐겨찾기한 이웃의 캐릭터가 데리고 다니는 펫과 함께 광장을 걷고, 가끔 아래 동작 중 하나를 고른다.
//   이리저리 걷기 · 캠프파이어 의자에 앉기 · 의자에서 기타 치기 · 기타 치는 이웃 옆에서 노래하기(음표)
//   펫 쓰다듬기(하트) · 광장 둘레 꽃에 물 주기 · 캠프파이어에서 마시멜로 구워 먹기
// 내 캐릭터가 가까이 가면 상태 메시지가 머리 위 말풍선으로 떠오른다.
// 주민은 부딪힘 계산(물리)을 하지 않고 길찾기 칸(WalkGrid)으로 나무·건물을 비켜 걷는다. 내 캐릭터와는 겹쳐 지나갈 수 있다.
import type * as PhaserNS from "phaser";
import { CHAR_FOOT_Y, characterViewKey, lookHasViews, WALK_FRAMES, type CharView, type WalkFrame } from "@/lib/art/character-views";
import { ACT_PROP_SIZE, NOTE_KINDS, type ActProp } from "@/lib/art/plaza-acts";
import { findPath, type Point, type WalkGrid } from "./pathfinding";
import type { TownResident } from "./types";

type PhaserLib = typeof PhaserNS;
type TextStyle = PhaserNS.Types.GameObjects.Text.TextStyle;

export type ResidentAct = "wander" | "sit" | "guitar" | "sing" | "pet" | "water" | "marshmallow";

/** 주민 걷는 그림 키: 내 캐릭터와 같은 이름 공간("walk")이라 같은 모습이면 그림을 같이 쓴다 */
export const residentWalkKey = (look: string, view: CharView, frame: WalkFrame) => characterViewKey(look, view, frame, "walk");
export const residentPetKey = (p: NonNullable<TownResident["pet"]>) => `rpet:${p.assetKey}:${p.stage}:${p.accessory}`;
export const actPropKey = (k: ActProp | `note:${string}`) => `act:${k}`;

const WALK_SPEED = 95; // 내 캐릭터(330)보다 느긋하게
const WALK_STEP_MS = 170;
const BUBBLE_DISTANCE = 120; // 이만큼 가까이 가면 상태 메시지 말풍선
const PET_BEHIND = 40;
const SEAT_DX = 20; // 의자 하나에 두 자리 (가운데에서 왼쪽·오른쪽)

export type ResidentWorld = {
  grid: WalkGrid;
  /** 캠프파이어 의자 (아랫변 가운데) */
  benches: Point[];
  /** 광장 둘레 꽃 (물 주기) */
  flowers: Point[];
  /** 캠프파이어 그림 아랫변 가운데와 부딪히는 폭·높이 */
  campfire: Point & { w: number; h: number };
  /** 걸어갈 만한 아무 곳 */
  roam: (rng: PhaserNS.Math.RandomDataGenerator) => Point;
  /** 처음 서 있을 곳 (모두 이곳에서 갈 수 있는 곳에 둔다) */
  start: Point;
  player: () => Point;
  font: (style?: TextStyle) => TextStyle;
  size: number;
  petSize: number;
};

type Seat = { x: number; y: number; bench: Point; side: -1 | 1; by: Walker | null };

type Walker = {
  r: TownResident;
  x: number;
  y: number;
  img: PhaserNS.GameObjects.Image;
  tag: PhaserNS.GameObjects.Text;
  pet: PhaserNS.GameObjects.Image | null;
  petPos: Point;
  bubble: PhaserNS.GameObjects.Container | null;
  views: boolean;
  act: ResidentAct | null;
  phase: "go" | "do" | "rest";
  path: Point[];
  until: number;
  seat: Seat | null;
  props: PhaserNS.GameObjects.Image[];
  facing: 1 | -1;
  view: CharView;
  walk: { step: number; clock: number };
  sitting: boolean;
  /** 이 동작 동안 바라볼 곳 (물 줄 꽃, 캠프파이어, 기타 치는 이웃) */
  lookAt: Point | null;
  /** 노래하는 주민이 따라가는 기타 치는 주민 */
  partner: Walker | null;
  /** 이 동작에서 다음 음표·하트·물방울을 띄울 시각 */
  nextFx: number;
  stuck: { x: number; y: number; since: number };
};

export function createResidents(scene: PhaserNS.Scene, Phaser: PhaserLib, residents: TownResident[], world: ResidentWorld) {
  const rng = new Phaser.Math.RandomDataGenerator([`residents-${Date.now()}`]);
  const canvas = scene.game.canvas;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const seats: Seat[] = world.benches.flatMap((b) => ([-1, 1] as const).map((side) => ({ x: b.x + side * SEAT_DX, y: b.y - 8, bench: b, side, by: null })));
  const walkers: Walker[] = [];

  for (const r of residents) {
    const views = lookHasViews(r.look);
    if (!scene.textures.exists(residentWalkKey(r.look, "front", 0))) continue;
    // 처음 자리: 광장 여기저기 (내가 처음 서는 곳에서 갈 수 있는 곳)
    let p = world.roam(rng);
    for (let i = 0; i < 8 && !findPath(world.grid, world.start, p); i++) p = world.roam(rng);
    const end = findPath(world.grid, world.start, p)?.at(-1) ?? world.start;
    const img = scene.add.image(end.x, end.y, residentWalkKey(r.look, "front", 0)).setDisplaySize(world.size, world.size).setOrigin(0.5, CHAR_FOOT_Y);
    const tag = scene.add
      .text(end.x, end.y, r.nickname, world.font({ fontSize: "12px", fontStyle: "bold", color: "#3e2b20", backgroundColor: "#fff8ecd9", padding: { x: 6, y: 2 } }))
      .setOrigin(0.5);
    const petKey = r.pet ? residentPetKey(r.pet) : "";
    const pet = r.pet && scene.textures.exists(petKey)
      ? scene.add.image(end.x - PET_BEHIND, end.y + 4, petKey).setDisplaySize(world.petSize, world.petSize).setOrigin(0.5, 0.92)
      : null;
    walkers.push({
      r, x: end.x, y: end.y, img, tag, pet, petPos: { x: end.x - PET_BEHIND, y: end.y + 4 }, bubble: null, views,
      act: null, phase: "rest", path: [], until: scene.time.now + rng.between(300, 2500), seat: null, props: [],
      facing: 1, view: "front", walk: { step: 0, clock: 0 }, sitting: false, lookAt: null, partner: null, nextFx: 0,
      stuck: { x: end.x, y: end.y, since: 0 },
    });
  }
  canvas.dataset.residents = walkers.map((w) => w.r.slug).join(",");

  // ===== 동작 고르기 =====
  const freeSeat = (near?: Point) => {
    const free = seats.filter((s) => !s.by);
    if (!free.length) return null;
    if (near) free.sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, near.x, near.y) - Phaser.Math.Distance.Between(b.x, b.y, near.x, near.y));
    return near ? free[0] : rng.pick(free);
  };

  /** 다음 동작을 무작위로 (기타 치는 이웃이 있으면 노래하러 가기도 한다) */
  function chooseAct(w: Walker): ResidentAct {
    const guitarist = walkers.find((o) => o !== w && o.act === "guitar" && o.phase === "do" && !walkers.some((s) => s.partner === o));
    const bag: [ResidentAct, number][] = [
      ["wander", 4],
      ["sit", 2],
      ["guitar", walkers.some((o) => o !== w && o.act === "guitar") ? 0 : 2],
      ["sing", guitarist ? 5 : 0],
      ["pet", w.pet ? 2 : 0],
      ["water", world.flowers.length ? 2 : 0],
      ["marshmallow", 2],
    ];
    let n = rng.frac() * bag.reduce((s, [, k]) => s + k, 0);
    for (const [act, k] of bag) if ((n -= k) < 0) return act;
    return "wander";
  }

  function goTo(w: Walker, to: Point) {
    const path = findPath(world.grid, { x: w.x, y: w.y }, to);
    if (!path) return false;
    w.path = path;
    w.phase = "go";
    w.stuck = { x: w.x, y: w.y, since: scene.time.now };
    return true;
  }

  function start(w: Walker) {
    const act = chooseAct(w);
    w.act = act;
    w.lookAt = null;
    w.partner = null;
    let ok = false;
    if (act === "wander") ok = goTo(w, world.roam(rng));
    else if (act === "sit" || act === "guitar") {
      const seat = freeSeat();
      if (seat) {
        seat.by = w;
        w.seat = seat;
        ok = goTo(w, { x: seat.x, y: seat.bench.y + 20 });
      }
    } else if (act === "sing") {
      const g = walkers.find((o) => o !== w && o.act === "guitar" && o.phase === "do" && o.seat);
      if (g?.seat) {
        w.partner = g;
        // 기타 치는 이웃이 앉은 쪽 의자 끝 옆에 선다
        ok = goTo(w, { x: g.seat.bench.x + g.seat.side * 66, y: g.seat.bench.y + 2 });
        w.lookAt = { x: g.seat.x, y: g.seat.y };
      }
    } else if (act === "pet") {
      ok = Boolean(w.pet);
      if (ok) beginDo(w);
      return;
    } else if (act === "water") {
      const f = rng.pick(world.flowers);
      const side = rng.pick([-1, 1] as const);
      ok = goTo(w, { x: f.x + side * 30, y: f.y });
      w.lookAt = f;
    } else if (act === "marshmallow") {
      // 캠프파이어 왼쪽·오른쪽 앞에 서서 불 쪽으로 꼬치를 내민다
      const side = rng.pick([-1, 1] as const);
      const c = world.campfire;
      ok = goTo(w, { x: c.x + side * (c.w / 2 + 34), y: c.y - 12 });
      w.lookAt = { x: c.x, y: c.y - 12 };
    }
    if (!ok) {
      releaseSeat(w);
      w.act = null;
      w.phase = "rest";
      w.until = scene.time.now + rng.between(800, 2000);
    }
  }

  function releaseSeat(w: Walker) {
    if (w.seat) w.seat.by = null;
    w.seat = null;
  }

  /** 목적지에 닿으면: 앉거나 소품을 들고 동작을 시작한다 */
  function beginDo(w: Walker) {
    const now = scene.time.now;
    w.phase = "do";
    w.nextFx = now + 300;
    switch (w.act) {
      case "wander":
        w.phase = "rest";
        w.act = null;
        w.until = now + rng.between(1200, 4000);
        return;
      case "sit":
      case "guitar":
        if (w.seat) {
          w.sitting = true;
          w.x = w.seat.x;
          w.y = w.seat.y;
        }
        w.until = now + (w.act === "guitar" ? rng.between(14000, 22000) : rng.between(7000, 13000));
        if (w.act === "guitar") w.props.push(addProp("guitar"), addProp("hand"));
        break;
      case "sing":
        w.until = now + rng.between(9000, 15000);
        break;
      case "pet":
        w.until = now + rng.between(3500, 5500);
        break;
      case "water":
        w.until = now + rng.between(4000, 6500);
        w.props.push(addProp("can"));
        break;
      case "marshmallow":
        w.until = now + rng.between(6000, 9000);
        w.props.push(addProp("marshmallow"));
        break;
    }
  }

  function endDo(w: Walker) {
    const now = scene.time.now;
    for (const p of w.props) p.destroy();
    w.props = [];
    if (w.act === "marshmallow") floatUp(w.x, w.y - world.size * 0.8, "heart", 1); // 다 구워서 냠
    if (w.sitting && w.seat) {
      // 의자 앞으로 내려선다
      w.y = w.seat.bench.y + 20;
    }
    w.sitting = false;
    releaseSeat(w);
    w.act = null;
    w.partner = null;
    w.lookAt = null;
    w.phase = "rest";
    w.until = now + rng.between(1500, 5000);
  }

  const addProp = (k: ActProp) => {
    const { width, height } = ACT_PROP_SIZE[k];
    return scene.add.image(0, 0, actPropKey(k)).setDisplaySize(width, height);
  };

  /** 음표·하트·물방울이 위로(물방울은 아래로) 떠올랐다 사라진다 */
  function floatUp(x: number, y: number, k: ActProp | "note", dir: 1 | -1 = 1) {
    const key = k === "note" ? actPropKey(`note:${rng.pick(NOTE_KINDS)}`) : actPropKey(k);
    const size = ACT_PROP_SIZE[k === "note" ? "note" : k];
    const fx = scene.add.image(x, y, key).setDisplaySize(size.width, size.height).setDepth(y + 400).setData("light", true);
    if (reduced) {
      scene.time.delayedCall(700, () => fx.destroy());
      return;
    }
    scene.tweens.add({
      targets: fx,
      y: y - dir * (k === "drop" ? 14 : rng.between(26, 40)),
      x: x + (k === "drop" ? 0 : rng.between(-14, 14)),
      alpha: { from: 1, to: 0 },
      duration: k === "drop" ? 420 : rng.between(1100, 1500),
      ease: k === "drop" ? "Quad.easeIn" : "Sine.easeOut",
      onComplete: () => fx.destroy(),
    });
  }

  // ===== 매 프레임 =====
  function step(w: Walker, dt: number) {
    const now = scene.time.now;
    let moving = false;
    if (w.phase === "rest" && now >= w.until) start(w);
    if (w.phase === "go") {
      const next = w.path[0];
      if (!next) beginDo(w);
      else {
        const d = Phaser.Math.Distance.Between(w.x, w.y, next.x, next.y);
        const stepLen = WALK_SPEED * dt;
        if (d <= stepLen) {
          w.x = next.x;
          w.y = next.y;
          w.path.shift();
          if (!w.path.length) beginDo(w);
        } else {
          w.x += ((next.x - w.x) / d) * stepLen;
          w.y += ((next.y - w.y) / d) * stepLen;
          face(w, next.x - w.x, next.y - w.y);
          moving = true;
        }
        // 오래 제자리면(길이 막힘) 포기하고 쉰다
        if (Phaser.Math.Distance.Between(w.x, w.y, w.stuck.x, w.stuck.y) > 4) w.stuck = { x: w.x, y: w.y, since: now };
        else if (now - w.stuck.since > 1500) {
          releaseSeat(w);
          w.act = null;
          w.phase = "rest";
          w.until = now + 1000;
        }
      }
    }
    if (w.phase === "do") {
      // 노래: 기타 치는 이웃이 일어나면 같이 그만둔다
      if (w.act === "sing" && w.partner?.act !== "guitar") w.until = Math.min(w.until, now);
      if (now >= w.until) endDo(w);
      else doAct(w, now);
    }
    animate(w, moving, dt);
    updatePet(w, moving, dt);
  }

  /** 동작마다 바라보는 쪽, 소품 자리, 음표·하트·물방울 */
  function doAct(w: Walker, now: number) {
    const head = w.y - world.size * 0.92;
    if (w.lookAt) face(w, w.lookAt.x - w.x, w.act === "sing" || w.act === "marshmallow" || w.act === "water" ? 0 : w.lookAt.y - w.y);
    if (w.sitting) {
      w.view = "front";
    }
    const fx = now >= w.nextFx;
    switch (w.act) {
      case "guitar": {
        // 기타는 무릎(의자 통나무 바로 위)에 가로로 안고, 오른손이 울림구멍 옆에서 줄을 튕긴다
        const [g, hand] = w.props;
        const gx = w.x + 8, gy = w.y - world.size * 0.24;
        g?.setPosition(gx, gy).setRotation(-0.12).setDepth(w.y + 9);
        const strum = reduced ? 0 : Math.abs(Math.sin(now / 110)) * 4;
        hand?.setPosition(gx - 9, gy - 2 + strum).setDepth(w.y + 9.5);
        if (fx) {
          floatUp(w.x + rng.between(-6, 14), head + 4, "note");
          w.nextFx = now + rng.between(700, 1100);
        }
        break;
      }
      case "sing":
        if (fx) {
          floatUp(w.x + w.facing * 8, head + 2, "note");
          w.nextFx = now + rng.between(450, 750);
        }
        break;
      case "pet": {
        if (!w.pet) break;
        // 펫이 앞으로 와서 쓰다듬는 손 아래서 폴짝
        const px = w.x + w.facing * 30;
        w.view = "side";
        w.petPos = { x: px, y: w.y + 2 };
        if (fx) {
          floatUp(px, w.y - world.petSize * 0.9, "heart");
          w.nextFx = now + rng.between(600, 900);
        }
        break;
      }
      case "water": {
        const can = w.props[0];
        const tilt = reduced ? 0.35 : 0.3 + Math.sin(now / 300) * 0.08;
        can?.setPosition(w.x + w.facing * 22, w.y - world.size * 0.42).setFlipX(w.facing < 0).setRotation(w.facing * tilt).setDepth(w.y + 9);
        if (fx) {
          floatUp(w.x + w.facing * 38 + rng.between(-4, 4), w.y - world.size * 0.32, "drop", -1);
          w.nextFx = now + rng.between(140, 240);
        }
        break;
      }
      case "marshmallow": {
        const m = w.props[0];
        m?.setPosition(w.x + w.facing * 30, w.y - world.size * 0.4).setFlipX(w.facing < 0).setDepth(w.y + 9);
        break;
      }
    }
  }

  function face(w: Walker, dx: number, dy: number) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > 0.5) w.facing = dx > 0 ? 1 : -1;
    if (ax > ay * 0.9) w.view = "side";
    else if (ay > 0.5) w.view = dy < 0 ? "back" : "front";
  }

  function animate(w: Walker, moving: boolean, dt: number) {
    if (moving) {
      w.walk.clock += dt * 1000;
      while (w.walk.clock >= WALK_STEP_MS) {
        w.walk.clock -= WALK_STEP_MS;
        w.walk.step = (w.walk.step + 1) % WALK_FRAMES.length;
      }
    } else w.walk = { step: 0, clock: 0 };
    const view = w.views ? w.view : "front";
    const frame: WalkFrame = moving && w.views ? WALK_FRAMES[w.walk.step] : 0;
    const key = residentWalkKey(w.r.look, view, frame);
    if (w.img.texture.key !== key) w.img.setTexture(key);
    // 옆모습 그림은 오른쪽을 본다. 예전 캐릭터(한 장)는 왼쪽을 보는 그림이라 반대로
    const flip = w.views ? view === "side" && w.facing < 0 : w.facing > 0;
    if (w.img.flipX !== flip) w.img.setFlipX(flip);
    // 노래할 때는 몸을 살짝 들썩, 예전 캐릭터는 걸을 때 통통
    const bob = (moving && !w.views ? Math.abs(Math.sin(scene.time.now / 90)) * 4 : 0) + (w.act === "sing" && w.phase === "do" && !reduced ? Math.abs(Math.sin(scene.time.now / 260)) * 2 : 0);
    // 앉으면 의자 통나무 뒤에 서서 다리가 통나무에 가려진다 (의자보다 조금 뒤에 그린다)
    w.img.setPosition(w.x, w.y - bob).setDepth(w.sitting && w.seat ? w.seat.bench.y - 1 : w.y + 8);
    if (w.sitting) w.img.setCrop(0, 0, w.img.frame.realWidth, w.img.frame.realHeight * 0.8);
    else if (w.img.isCropped) w.img.setCrop();
    w.tag.setPosition(w.x, w.y - world.size - 2 - bob).setDepth(w.y + 9);
  }

  function updatePet(w: Walker, moving: boolean, dt: number) {
    if (!w.pet) return;
    if (!(w.act === "pet" && w.phase === "do")) {
      // 걷거나 쉴 때는 주인 뒤를 따라온다. 주인이 앉아 있으면 의자 앞 바닥에 앉는다
      w.petPos = w.sitting && w.seat ? { x: w.seat.x + w.seat.side * 16, y: w.seat.bench.y + 22 } : { x: w.x - w.facing * PET_BEHIND, y: w.y + 4 };
    }
    const k = 1 - Math.exp(-dt * 4);
    const baseY = (w.pet.getData("baseY") as number | undefined) ?? w.pet.y;
    const nx = w.pet.x + (w.petPos.x - w.pet.x) * k;
    const ny = baseY + (w.petPos.y - baseY) * k;
    const petMoving = moving || Math.hypot(w.petPos.x - nx, w.petPos.y - ny) > 3;
    const happy = w.act === "pet" && w.phase === "do" && !reduced;
    if (Math.abs(w.petPos.x - nx) > 1) w.pet.setFlipX(w.petPos.x < nx);
    else if (happy) w.pet.setFlipX(w.x < nx); // 쓰다듬는 주인을 본다
    const hop = petMoving || happy ? Math.abs(Math.sin(scene.time.now / (happy ? 140 : 80))) * (happy ? 4 : 5) : 0;
    w.pet.setData("baseY", ny);
    w.pet.setPosition(nx, ny - hop).setDepth(ny);
  }

  // ===== 상태 메시지 말풍선 =====
  function showBubble(w: Walker, show: boolean) {
    const text = w.r.statusMessage;
    if (!text) return;
    if (show && !w.bubble) {
      const label = scene.add.text(0, 0, text, world.font({ fontSize: "13px", color: "#2b2118", align: "center", wordWrap: { width: 170, useAdvancedWrap: true } })).setOrigin(0.5, 1);
      const bw = label.width + 20, bh = label.height + 12;
      const g = scene.add.graphics();
      g.fillStyle(0xfffdf6, 0.97).fillRoundedRect(-bw / 2, -bh - 8, bw, bh, 12);
      g.lineStyle(2, 0xb58a63, 1).strokeRoundedRect(-bw / 2, -bh - 8, bw, bh, 12);
      g.fillStyle(0xfffdf6, 1).fillTriangle(-7, -9.5, 7, -9.5, 0, 0);
      g.lineStyle(2, 0xb58a63, 1).beginPath().moveTo(-7, -8).lineTo(0, 0).lineTo(7, -8).strokePath();
      label.setPosition(0, -14);
      w.bubble = scene.add.container(0, 0, [g, label]).setAlpha(0).setScale(0.85);
      scene.tweens.add({ targets: w.bubble, alpha: 1, scale: 1, duration: reduced ? 0 : 180, ease: "Back.easeOut" });
    } else if (!show && w.bubble) {
      const b = w.bubble;
      w.bubble = null;
      scene.tweens.add({ targets: b, alpha: 0, duration: reduced ? 0 : 160, onComplete: () => b.destroy() });
    }
    if (w.bubble) {
      // 말풍선 꼬리 끝이 닉네임 이름표 윗변 가운데에 닿게 하고, 이름표도 말풍선과 함께 맨 앞으로 (내 이름표에 가려지지 않게)
      w.bubble.setPosition(Math.round(w.tag.x), Math.round(w.tag.y - w.tag.height * w.tag.originY) - 1).setDepth(150000 + w.y);
      w.tag.setDepth(150000 + w.y - 0.5);
    }
  }

  let lastReport = 0;
  return {
    update(dt: number) {
      const me = world.player();
      let near: Walker | null = null;
      let best = BUBBLE_DISTANCE;
      for (const w of walkers) {
        step(w, dt);
        const d = Phaser.Math.Distance.Between(me.x, me.y, w.x, w.y);
        if (d < best && w.r.statusMessage) {
          best = d;
          near = w;
        }
      }
      // 말풍선은 가장 가까운 한 명만 (여럿이 겹쳐 보이지 않게)
      for (const w of walkers) showBubble(w, w === near);
      const bubble = near?.r.slug ?? "";
      if (canvas.dataset.bubble !== bubble) canvas.dataset.bubble = bubble;
      // 지금 동작과 자리 (e2e 확인용): 0.5초마다
      if (scene.time.now - lastReport > 500) {
        lastReport = scene.time.now;
        canvas.dataset.residentActs = walkers.map((w) => `${w.r.slug}:${w.phase === "do" ? w.act : w.phase === "go" ? `go-${w.act}` : "rest"}`).join(",");
        canvas.dataset.playerPos = `${Math.round(me.x)},${Math.round(me.y)}`;
        canvas.dataset.residentPos = walkers.map((w) => `${w.r.slug}:${Math.round(w.x)},${Math.round(w.y)}`).join(";");
      }
    },
  };
}
