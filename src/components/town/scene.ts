// 중앙 광장 (2D 탑다운). Phaser는 브라우저에서만 동작하므로 런타임에 받아서 씬을 만든다.
// 그림은 src/lib/art/ 의 SVG를 이미지로 바꿔 쓴다 (townTextures → TownGame이 미리 불러온다).
import type * as PhaserNS from "phaser";
import { animalSvg, toAnimalDataUri } from "@/lib/art/animals";
import { PHONE_MEDIA } from "@/lib/device";
import { characterDataUri, VISITOR_CHARACTER } from "@/lib/art/characters";
import {
  CHAR_FRAMES,
  CHAR_VIEWS,
  characterViewDataUri,
  characterViewKey,
  lookHasViews,
  WALK_FRAMES,
  type CharView,
  type WalkFrame,
} from "@/lib/art/character-views";
import {
  ATTENDANCE_SIZE,
  attendanceSvg,
  BENCH_SIZE,
  benchSvg,
  BOARD_SIZE,
  boardSvg,
  CAMPFIRE_SIZE,
  campfireFrontSvg,
  campfireSvg,
  FLAME_FRAMES,
  flameSvg,
  HOUSE_STAGES,
  houseSvg,
  roofHex,
  LAMP_LIGHT,
  LAMP_SIZE,
  lampSvg,
  SHOP_SIZE,
  shopSvg,
  FARM_SIZE,
  farmSvg,
  toDataUri,
  TREE_SIZE,
  treeSvg,
  type HouseStage,
} from "@/lib/art/town";
import {
  BARREL_SIZE,
  barrelSvg,
  CRATE_SIZE,
  crateSvg,
  FENCE_SIZE,
  fenceSvg,
  FLOWERS_SIZE,
  flowersSvg,
  GRASS_SIZE,
  grassSvg,
  LAUNDRY_SIZE,
  laundrySvg,
  MAILBOX_SIZE,
  mailboxSvg,
  PLANTER_SIZE,
  planterSvg,
  ROCK_SIZE,
  rockSvg,
  SIGNPOST_SIZE,
  signpostSvg,
  STUMP_SIZE,
  stumpSvg,
} from "@/lib/art/props";
import { findPath, type Point, type Rect, WalkGrid } from "./pathfinding";
import { lightAt, localHour, mixColor } from "./sky";
import type { TownData, TownHouse, TownTarget } from "./types";

type PhaserLib = typeof PhaserNS;

export const WORLD = { width: 1800, height: 1400 };
const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };
const PLAZA_RADIUS = 230;
// 걷기·조이스틱·탭 이동 모두 같은 속도 (달리기 정도, 일정하게)
const SPEED = 330;
const INTERACT_DISTANCE = 90;
const PLAYER_SIZE = 72; // 캐릭터 그림 크기
const PET_SIZE = 58; // 따라다니는 펫 그림 크기 (TOWN-09)
const PET_BEHIND = 48; // 캐릭터 뒤 얼마나 떨어져서 따라오는지
const WALK_STEP_MS = 140; // 걷는 그림을 넘기는 간격
// 가상 조이스틱 (터치 화면 전용, TOWN-02)
const JOYSTICK = { radius: 56, thumb: 26, margin: 28, deadZone: 8 };
// 휴대폰은 화면이 좁아서 멀리서 보듯 줄여 광장을 더 넓게 보여 준다
const PHONE_ZOOM = 0.7;

/** 광장에 놓는 그림 하나. (x, y) = 아랫변 가운데 (발 닿는 곳) */
type Structure = {
  texture: string;
  x: number;
  y: number;
  w: number;
  h: number;
  solid?: { w: number; h: number }; // 부딪히는 영역 (아랫변 기준)
  label?: string;
  sub?: string;
};

/** 들어갈 수 있는 곳: 문 앞 좌표에서 Space / 클릭 */
type Entrance = {
  label: string;
  emoji: string;
  x: number;
  y: number;
  target: TownTarget;
  /** 클릭으로 들어가기 판정할 그림 영역 */
  area: { x: number; y: number; w: number; h: number };
  promptY: number;
};

// 이웃 집 자리 (아랫변 가운데): 광장 바깥쪽 위 5채·아래 5채 (TOWN-04).
// 3단계 집(폭 214)끼리도 겹치지 않게 260 간격, 가운데 게시판·내 집 자리는 비운다 (TOWN-11)
const NEIGHBOR_SLOTS = [
  { x: 160, y: 300 }, { x: 420, y: 290 }, { x: 680, y: 300 }, { x: 1120, y: 300 }, { x: 1380, y: 290 },
  { x: 420, y: 1270 }, { x: 680, y: 1280 }, { x: 1120, y: 1280 }, { x: 1380, y: 1270 }, { x: 1640, y: 1270 },
];
// 마을 게시판(마을 소식)과 출석 도장 판은 가운데 길을 사이에 두고 살짝 떨어져 있다
const BOARD_POS = { x: CENTER.x - 115, y: CENTER.y - PLAZA_RADIUS - 70 };
const ATTENDANCE_POS = { x: CENTER.x + 120, y: CENTER.y - PLAZA_RADIUS - 70 };
const SHOP_POS = { x: CENTER.x + 480, y: CENTER.y + 80 };
// 동물 농장: 원래 우체통이 있던 왼쪽 길가 (TOWN-09)
const FARM_POS = { x: CENTER.x - 480, y: CENTER.y + 200 };
const MY_HOUSE_POS = { x: CENTER.x, y: CENTER.y + PLAZA_RADIUS + 210 };
// 캠프파이어 그림의 아랫변 가운데 (TOWN-02: 예전 분수와 같은 자리·크기)
const CAMPFIRE_POS = { x: CENTER.x, y: CENTER.y + CAMPFIRE_SIZE.height / 2 };

// ===== 꾸밈 소품 (2026-10-08 디자인 시안 지도 느낌). 건물 자리·길·광장 입구는 그대로 두고 빈 풀밭에만 놓는다 =====
const PROP_ART = {
  mailbox: { draw: mailboxSvg, size: MAILBOX_SIZE },
  laundry: { draw: laundrySvg, size: LAUNDRY_SIZE },
  crate: { draw: crateSvg, size: CRATE_SIZE },
  barrel: { draw: barrelSvg, size: BARREL_SIZE },
  planter: { draw: planterSvg, size: PLANTER_SIZE },
  signpost: { draw: signpostSvg, size: SIGNPOST_SIZE },
  stump: { draw: stumpSvg, size: STUMP_SIZE },
  fence: { draw: fenceSvg, size: FENCE_SIZE },
  rock: { draw: rockSvg, size: ROCK_SIZE },
  flowers: { draw: flowersSvg, size: FLOWERS_SIZE },
  grass: { draw: grassSvg, size: GRASS_SIZE },
};
type PropKind = keyof typeof PROP_ART;
/** 자리를 정해 둔 소품: (x, y) = 아랫변 가운데, s = 크기 배율, solid = 부딪히는 영역(없으면 지나갈 수 있다) */
type PropSpot = { kind: PropKind; x: number; y: number; s?: number; solid?: { w: number; h: number } };
// 빨래대: 왼쪽 위 이웃 집 두 채 사이 뒤쪽
const LAUNDRY_POS = { x: 290, y: 178 };
const FIXED_PROPS: PropSpot[] = [
  { kind: "laundry", ...LAUNDRY_POS, s: 0.9, solid: { w: 58, h: 8 } },
  // 이정표: 위쪽 길에서 내려온 가운데 길이 광장으로 들어오는 갈림목 (오른쪽 가장자리, 출석 체크 이름표 아래)
  { kind: "signpost", x: CENTER.x + 84, y: CENTER.y - 188, s: 0.8, solid: { w: 12, h: 8 } },
  // 상점 옆: 오른쪽에 상자·통, 왼쪽 앞에 꽃 화분
  { kind: "crate", x: SHOP_POS.x + 128, y: SHOP_POS.y - 8, s: 0.8, solid: { w: 28, h: 10 } },
  { kind: "barrel", x: SHOP_POS.x + 156, y: SHOP_POS.y + 6, s: 0.8, solid: { w: 24, h: 10 } },
  { kind: "planter", x: SHOP_POS.x - 130, y: SHOP_POS.y + 10, s: 0.85, solid: { w: 40, h: 8 } },
  // 캠프파이어 광장 가장자리 (의자 바깥, 길이 들어오는 네 방향은 비운다)
  { kind: "stump", x: CENTER.x + 208, y: CENTER.y - 72, s: 0.8, solid: { w: 22, h: 8 } },
  { kind: "stump", x: CENTER.x + 238, y: CENTER.y - 98, s: 0.65, solid: { w: 18, h: 8 } },
  { kind: "crate", x: CENTER.x + 172, y: CENTER.y + 106, s: 0.85, solid: { w: 30, h: 10 } },
  { kind: "crate", x: CENTER.x + 200, y: CENTER.y + 120, s: 0.62, solid: { w: 22, h: 8 } },
  { kind: "stump", x: CENTER.x - 172, y: CENTER.y + 106, s: 0.8, solid: { w: 22, h: 8 } },
  { kind: "crate", x: CENTER.x - 210, y: CENTER.y - 88, s: 0.75, solid: { w: 26, h: 10 } },
  // 동물 농장 앞 양옆으로 이어지는 울타리
  { kind: "fence", x: FARM_POS.x - 176, y: FARM_POS.y - 20, s: 1, solid: { w: 80, h: 10 } },
  { kind: "fence", x: FARM_POS.x + 176, y: FARM_POS.y - 20, s: 1, solid: { w: 80, h: 10 } },
];

const charKey = (asset: string) => `char:${asset}`;
/** 내 캐릭터의 걷는 그림 (앞·뒤·옆 × 서 있기·걷기). 집 주인 그림(charKey)과 이름이 겹치지 않게 "walk" */
const walkKey = (look: string, view: CharView, frame: WalkFrame) => characterViewKey(look, view, frame, "walk");
const playerLook = (data: TownData) => data.player?.characterAsset ?? VISITOR_CHARACTER;
const propKey = (kind: PropKind) => `prop:${kind}`;
const houseKey = (stage: HouseStage, roof: string) => `house:${stage}:${roof}`;

/** 이 광장이 쓸 그림 목록. TownGame이 미리 이미지로 불러 둔다 */
export function townTextures(data: TownData) {
  const list = new Map<string, string>();
  const houses = [data.myHouse, ...data.neighbors].filter(Boolean) as TownHouse[];
  // 내 캐릭터(방문자는 방문자 캐릭터): 앞·뒤·옆 모습마다 서 있기(0)·걷기(1·2) 그림. 옆모습은 오른쪽을 본다
  const look = playerLook(data);
  for (const view of CHAR_VIEWS) {
    for (const frame of CHAR_FRAMES) list.set(walkKey(look, view, frame), characterViewDataUri(look, view, frame, PLAYER_SIZE * 2));
  }
  for (const h of houses) {
    list.set(charKey(h.characterAsset), characterDataUri(h.characterAsset, PLAYER_SIZE * 2));
    const roof = roofHex(h.roofColor, h.backgroundAsset); // 고른 지붕 색, 없으면 배경 색 (TOWN-07)
    list.set(houseKey(h.stage, roof), toDataUri(houseSvg(h.stage, roof)));
  }
  const pet = data.player?.pet;
  if (pet) list.set("pet", toAnimalDataUri(animalSvg(pet.assetKey, pet.stage, PET_SIZE * 2, pet.accessory)));
  list.set("board", toDataUri(boardSvg()));
  list.set("attendance", toDataUri(attendanceSvg()));
  list.set("shop", toDataUri(shopSvg()));
  list.set("campfire", toDataUri(campfireSvg()));
  list.set("campfire:front", toDataUri(campfireFrontSvg()));
  for (let i = 0; i < FLAME_FRAMES; i++) list.set(`flame:${i}`, toDataUri(flameSvg(i)));
  list.set("bench", toDataUri(benchSvg()));
  list.set("lamp", toDataUri(lampSvg()));
  list.set("farm", toDataUri(farmSvg()));
  for (const kind of ["round", "pine", "bush", "blossom"] as const) list.set(`tree:${kind}`, toDataUri(treeSvg(kind)));
  for (const [kind, art] of Object.entries(PROP_ART)) list.set(propKey(kind as PropKind), toDataUri(art.draw()));
  return [...list].map(([key, uri]) => ({ key, uri }));
}

function layout(data: TownData) {
  const member = Boolean(data.player);
  const need = (href: string): TownTarget => (member ? { kind: "link", href } : { kind: "login" });
  const structures: Structure[] = [];
  const entrances: Entrance[] = [];
  const windows: { x: number; y: number; r: number }[] = []; // 밤에 불이 켜지는 집 (불빛 가운데·크기)

  // 마을 게시판 = 마을 소식
  const bw = BOARD_SIZE.width, bh = BOARD_SIZE.height;
  structures.push({ texture: "board", ...BOARD_POS, w: bw, h: bh, solid: { w: bw * 0.92, h: 22 }, label: "마을 게시판", sub: "마을 소식 · 이웃 새 글" });
  entrances.push({
    label: "마을 소식", emoji: "📋", x: BOARD_POS.x, y: BOARD_POS.y + 26, target: { kind: "link", href: "/feed" },
    area: { x: BOARD_POS.x - bw / 2, y: BOARD_POS.y - bh, w: bw, h: bh }, promptY: BOARD_POS.y - bh - 6,
  });
  // 출석 도장 판 (게시판에서 떨어뜨려 따로 세운다)
  const aw = ATTENDANCE_SIZE.width, ah = ATTENDANCE_SIZE.height;
  structures.push({
    texture: "attendance", ...ATTENDANCE_POS, w: aw, h: ah, solid: { w: 30, h: 14 },
    label: "출석 체크",
    sub: `${data.attendedToday ? "오늘 완료 ✅" : "보상 받기 🎁"}${data.quests ? ` · 퀘스트 ${data.quests.done}/${data.quests.total}` : ""}`,
  });
  entrances.push({
    label: data.attendedToday ? "출석 체크 (오늘 완료)" : "출석 체크", emoji: "📮", x: ATTENDANCE_POS.x, y: ATTENDANCE_POS.y + 26,
    target: need("/attendance"), area: { x: ATTENDANCE_POS.x - aw / 2, y: ATTENDANCE_POS.y - ah, w: aw, h: ah }, promptY: ATTENDANCE_POS.y - ah - 6,
  });

  // 상점
  structures.push({ texture: "shop", ...SHOP_POS, w: SHOP_SIZE.width, h: SHOP_SIZE.height, solid: { w: SHOP_SIZE.width * 0.86, h: 60 }, label: "상점", sub: "꾸미기·가구·배경" });
  entrances.push({
    label: "상점", emoji: "🏪", x: SHOP_POS.x + 40, y: SHOP_POS.y + 24, target: need("/shop"),
    area: { x: SHOP_POS.x - SHOP_SIZE.width / 2, y: SHOP_POS.y - SHOP_SIZE.height, w: SHOP_SIZE.width, h: SHOP_SIZE.height },
    promptY: SHOP_POS.y - SHOP_SIZE.height - 6,
  });

  // 동물 농장: 알을 받아 동물을 키운다
  structures.push({
    texture: "farm", ...FARM_POS, w: FARM_SIZE.width, h: FARM_SIZE.height, solid: { w: FARM_SIZE.width * 0.94, h: 100 },
    label: "동물 농장", sub: "펫 키우기 · 카드 도감",
  });
  entrances.push({
    label: "동물 농장", emoji: "🐮", x: FARM_POS.x, y: FARM_POS.y + 24, target: need("/farm"),
    area: { x: FARM_POS.x - FARM_SIZE.width / 2, y: FARM_POS.y - FARM_SIZE.height, w: FARM_SIZE.width, h: FARM_SIZE.height },
    promptY: FARM_POS.y - FARM_SIZE.height - 6,
  });

  // 집: 내 집 + 이웃집
  const addHouse = (h: TownHouse, pos: { x: number; y: number }, mine: boolean) => {
    // 크기·벽 위치는 주인 레벨로 정한 단계를 따른다 (TOWN-11)
    const { width: w, height: hh, wall } = HOUSE_STAGES[h.stage];
    const wallW = wall.right - wall.left;
    const roof = roofHex(h.roofColor, h.backgroundAsset); // 고른 지붕 색, 없으면 배경 색 (TOWN-07)
    structures.push({
      texture: houseKey(h.stage, roof), ...pos, w, h: hh, solid: { w: wallW * 0.92, h: 38 + h.stage * 8 },
      // 블로그 이름이 길면 옆집과 겹치지 않게 줄인다 (집 간격 260)
      label: mine ? "내 집" : `${h.nickname}의 집`, sub: h.title.length > 16 ? `${h.title.slice(0, 16)}…` : h.title,
    });
    // 집 주인 캐릭터가 문 옆(벽 오른쪽 끝)에 서 있다
    structures.push({ texture: charKey(h.characterAsset), x: pos.x + wallW / 2 + 4, y: pos.y + 2, w: 46, h: 46 });
    // 빨간 우체통: 집 앞 왼쪽 모서리 (문·계단은 비운다). 집이 클수록 조금 크게
    const mk = 0.58 + 0.07 * h.stage;
    structures.push({
      texture: propKey("mailbox"), x: pos.x - wallW / 2 + 2, y: pos.y + 3,
      w: MAILBOX_SIZE.width * mk, h: MAILBOX_SIZE.height * mk, solid: { w: 12, h: 8 },
    });
    windows.push({ x: pos.x, y: pos.y - hh * 0.35, r: w * 0.9 });
    entrances.push({
      label: mine ? "내 집" : `${h.nickname}의 집`, emoji: "🏠", x: pos.x, y: pos.y + 22, target: { kind: "link", href: `/@${h.slug}` },
      area: { x: pos.x - w / 2, y: pos.y - hh, w, h: hh }, promptY: pos.y - hh - 4,
    });
  };
  if (data.myHouse) addHouse(data.myHouse, MY_HOUSE_POS, true);
  // 이웃 집 자리는 순서대로 고정 (즐겨찾기 먼저·최근 글 순으로 NEIGHBOR_SLOTS 앞자리부터)
  const slots = NEIGHBOR_SLOTS;
  const neighborSlots = data.neighbors.slice(0, slots.length).map((h, i) => {
    addHouse(h, slots[i], false);
    return `${h.slug}:${slots[i].x},${slots[i].y}`;
  });

  // 캠프파이어 (예전 분수 자리, 부딪히는 영역도 같다). 불꽃은 createCampfireFlames()가 위에 겹친다
  structures.push({ texture: "campfire", ...CAMPFIRE_POS, w: CAMPFIRE_SIZE.width, h: CAMPFIRE_SIZE.height, solid: { w: 150, h: 70 } });
  // 불가의 통나무 의자: 왼쪽·오른쪽·위쪽 양옆 (아래쪽은 캐릭터가 처음 서는 자리라 비운다)
  for (const [dx, dy] of [[-150, 20], [150, 20], [-100, -95], [100, -95]]) {
    structures.push({ texture: "bench", x: CENTER.x + dx, y: CENTER.y + dy, w: BENCH_SIZE.width, h: BENCH_SIZE.height, solid: { w: BENCH_SIZE.width * 0.86, h: 14 } });
  }
  // 랜턴 기둥 (예전 가로등 자리)
  for (const p of LAMP_POSITIONS) {
    structures.push({ texture: "lamp", ...p, w: LAMP_SIZE.width, h: LAMP_SIZE.height, solid: { w: 14, h: 10 } });
  }
  // 자리를 정해 둔 꾸밈 소품 (빨래대, 이정표, 상점 옆 상자·통·화분, 광장 가장자리 그루터기·상자, 농장 울타리)
  for (const p of FIXED_PROPS) {
    const { width, height } = PROP_ART[p.kind].size;
    const s = p.s ?? 1;
    structures.push({ texture: propKey(p.kind), x: p.x, y: p.y, w: width * s, h: height * s, solid: p.solid });
  }
  return { structures, entrances, windows, neighborSlots };
}

/** 흙길 (x, y, 폭, 높이): 가운데 세로·가로 길, 위·아래 가로 길 */
const ROADS: [number, number, number, number][] = [
  [CENTER.x - 46, 0, 92, WORLD.height],
  [0, CENTER.y - 46, WORLD.width, 92],
  [0, 395, WORLD.width, 64],
  [0, WORLD.height - 470, WORLD.width, 64],
];

/** 가로등 기둥 아랫변 가운데 */
const LAMP_POSITIONS = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => ({ x: CENTER.x + dx * 175, y: CENTER.y + dy * 175 + 40 }));
/** 가로등 등불 가운데 (lampSvg의 랜턴 자리: 그림 왼쪽 위에서 LAMP_LIGHT) */
const lampLight = (p: { x: number; y: number }) => ({ x: p.x - LAMP_SIZE.width / 2 + LAMP_LIGHT.x, y: p.y - LAMP_SIZE.height + LAMP_LIGHT.y });


export function createTownScene(
  Phaser: PhaserLib,
  data: TownData,
  images: Map<string, HTMLImageElement>,
  onEnter: (target: TownTarget) => void,
  fontFamily = "sans-serif",
) {
  const font = (style: PhaserNS.Types.GameObjects.Text.TextStyle = {}) => ({ fontFamily, ...style });

  return class TownScene extends Phaser.Scene {
    private feet!: PhaserNS.GameObjects.Zone; // 부딪힘을 계산하는 발밑 상자
    private playerBody!: PhaserNS.Physics.Arcade.Body;
    private player!: PhaserNS.GameObjects.Image; // 보이는 캐릭터 그림 (발 상자를 따라간다)
    private nameTag!: PhaserNS.GameObjects.Text;
    private pet: PhaserNS.GameObjects.Image | null = null; // 데리고 다니는 펫 (캐릭터 뒤를 따라온다)
    private facing: 1 | -1 = 1; // 캐릭터가 보는 좌우 방향 (1 = 오른쪽). 펫이 반대쪽(뒤)을 따라온다
    private look = playerLook(data); // 내 캐릭터 모습 키 (방문자는 방문자 캐릭터)
    private views = lookHasViews(this.look); // 앞·뒤·옆 그림이 따로 있는가 (예전 캐릭터는 한 장뿐)
    private view: CharView = "front"; // 지금 보여 주는 모습 (멈추면 마지막 모습으로 서 있는다)
    private flip = false; // 옆모습을 왼쪽으로 뒤집었는가
    private walk = { step: 0, clock: 0 }; // 걷는 그림 순서(WALK_FRAMES)와 넘길 때까지 지난 시간
    private holdView = false; // 탭한 곳에 거의 다 와서 몇 px만 맞추는 중 (그 사이 뒤돌아보지 않게 모습을 그대로 둔다)
    private cursors!: PhaserNS.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<"W" | "A" | "S" | "D", PhaserNS.Input.Keyboard.Key>;
    private actionKeys: PhaserNS.Input.Keyboard.Key[] = [];
    private path: Point[] = []; // 탭·클릭한 곳까지 남은 길 (꺾이는 점들)
    private grid!: WalkGrid;
    private solids: Rect[] = []; // 부딪히는 영역 (길찾기 칸을 만들 때 쓴다)
    private occupied: Rect[] = []; // 그림·이름표가 차지한 영역 (풀밭 소품을 흩어 놓을 때 피한다)
    private stuck: { x: number; y: number; since: number; retried?: boolean } = { x: 0, y: 0, since: 0 }; // 길을 가다 막혔는지 보는 용도
    private touch = false; // 손가락으로 쓰는 화면 (안내 문구를 "탭해서"로)
    private glows: { image: PhaserNS.GameObjects.Image; kind: "lamp" | "window" | "fire"; base: number }[] = [];
    private entrances: Entrance[] = [];
    private prompt!: PhaserNS.GameObjects.Text;
    private joystick: {
      base: PhaserNS.GameObjects.Arc;
      thumb: PhaserNS.GameObjects.Arc;
      pointerId: number | null;
      vector: PhaserNS.Math.Vector2;
    } | null = null;

    constructor() {
      super("town");
    }

    create() {
      for (const [key, img] of images) if (!this.textures.exists(key)) this.textures.addImage(key, img);

      this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
      this.drawGround();

      const walls = this.physics.add.staticGroup();
      const { structures, entrances, windows, neighborSlots } = layout(data);
      this.entrances = entrances;
      this.game.canvas.dataset.neighborSlots = neighborSlots.join(";"); // 이웃 집이 놓인 자리 (e2e)
      for (const s of structures) this.placeStructure(s, walls);
      this.createCampfireFlames();
      this.plantTrees(walls);
      this.scatterProps(walls);
      // 길찾기 칸: 발 상자(28×16) 반만큼 + 여유 3px 넓혀서 막는다
      this.grid = new WalkGrid(WORLD.width, WORLD.height, this.solids, { x: 17, y: 11 });
      this.createSky(windows);

      // 플레이어: 발 상자(물리) + 그림
      this.feet = this.add.zone(CENTER.x, CENTER.y + 160, 28, 16);
      this.physics.add.existing(this.feet);
      this.playerBody = this.feet.body as PhaserNS.Physics.Arcade.Body;
      this.playerBody.setCollideWorldBounds(true);
      this.physics.add.collider(this.feet, walls);
      this.player = this.add
        .image(0, 0, walkKey(this.look, "front", 0))
        .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
        .setOrigin(0.5, 0.94);
      this.game.canvas.dataset.playerView = "front"; // 지금 보는 모습 (e2e 확인용)

      // 데리고 다니는 펫: 캐릭터 뒤쪽에서 시작해 부드럽게 따라온다
      if (data.player?.pet && this.textures.exists("pet")) {
        this.pet = this.add.image(this.feet.x - PET_BEHIND, this.feet.y + 6, "pet").setDisplaySize(PET_SIZE, PET_SIZE).setOrigin(0.5, 0.92);
        this.game.canvas.dataset.followPet = data.player.pet.name;
      }

      this.nameTag = this.add
        .text(0, 0, data.player?.nickname ?? "구경하는 중", font({
          fontSize: "13px",
          fontStyle: "bold",
          color: "#2b2118",
          backgroundColor: "#ffffffe0",
          padding: { x: 7, y: 3 },
        }))
        .setOrigin(0.5);

      this.prompt = this.add
        .text(0, 0, "", font({
          fontSize: "15px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: "#2b2118e6",
          padding: { x: 10, y: 6 },
        }))
        .setOrigin(0.5, 1)
        .setDepth(100000)
        .setVisible(false);

      // 카메라
      this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
      this.cameras.main.startFollow(this.feet, true, 0.12, 0.12, 0, 20);
      this.cameras.main.setBackgroundColor("#8aba5c");

      // 입력: 방향키, WASD, Space/Enter, 클릭·터치
      const keyboard = this.input.keyboard!;
      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys("W,A,S,D") as typeof this.wasd;
      this.actionKeys = [keyboard.addKey("SPACE"), keyboard.addKey("ENTER")];
      // 페이지 스크롤과 겹치지 않게 게임 안에서만 키를 쓴다
      keyboard.addCapture("UP,DOWN,LEFT,RIGHT,SPACE");

      // 조이스틱은 태블릿처럼 화면이 넓은 터치 기기에서만. 휴대폰은 탭해서 움직이고, 시야를 넓게 본다
      const phone = window.matchMedia?.(PHONE_MEDIA).matches;
      if (!phone && window.matchMedia?.("(pointer: coarse)").matches) this.createJoystick();
      this.touch = Boolean(phone || this.joystick);
      if (phone) this.cameras.main.setZoom(PHONE_ZOOM);
      this.game.canvas.dataset.joystick = this.joystick ? "on" : "off"; // e2e 확인용

      this.input.on("pointerdown", (pointer: PhaserNS.Input.Pointer) => {
        // 조이스틱을 누른 경우: 걷기 목표를 정하지 않고 조이스틱으로 움직인다
        if (this.joystick && this.isOnJoystick(pointer)) {
          this.joystick.pointerId = pointer.id;
          this.moveJoystick(pointer);
          return;
        }
        const hit = this.entranceAt(pointer.worldX, pointer.worldY);
        if (hit) {
          // 가까우면 바로 들어가고, 멀면 그 입구 앞까지 걸어간다
          if (this.distanceTo(hit) <= INTERACT_DISTANCE) return onEnter(hit.target);
          return this.walkTo(hit.x, hit.y);
        }
        this.walkTo(pointer.worldX, pointer.worldY);
      });
      this.input.on("pointermove", (pointer: PhaserNS.Input.Pointer) => {
        if (this.joystick?.pointerId === pointer.id) this.moveJoystick(pointer);
      });
      const release = (pointer: PhaserNS.Input.Pointer) => {
        if (this.joystick?.pointerId === pointer.id) this.resetJoystick();
      };
      this.input.on("pointerup", release);
      this.input.on("pointerupoutside", release);
    }

    // ===== 가상 조이스틱 =====
    private createJoystick() {
      this.input.addPointer(1); // 조이스틱을 누른 채 다른 곳도 탭할 수 있게 두 손가락까지
      const base = this.add.circle(0, 0, JOYSTICK.radius, 0x2b2118, 0.18).setStrokeStyle(3, 0xffffff, 0.7);
      const thumb = this.add.circle(0, 0, JOYSTICK.thumb, 0xffffff, 0.85).setStrokeStyle(2, 0x2b2118, 0.4);
      for (const o of [base, thumb]) o.setScrollFactor(0).setDepth(200000);
      this.joystick = { base, thumb, pointerId: null, vector: new Phaser.Math.Vector2() };
      this.placeJoystick();
      this.scale.on("resize", () => this.placeJoystick());
    }

    /** 화면 왼쪽 아래 (화면 크기가 바뀌어도 따라간다) */
    private placeJoystick() {
      if (!this.joystick) return;
      const x = JOYSTICK.margin + JOYSTICK.radius;
      const y = this.scale.height - JOYSTICK.margin - JOYSTICK.radius;
      this.joystick.base.setPosition(x, y);
      if (this.joystick.pointerId === null) this.joystick.thumb.setPosition(x, y);
    }

    private isOnJoystick(pointer: PhaserNS.Input.Pointer) {
      const { base } = this.joystick!;
      return Phaser.Math.Distance.Between(pointer.x, pointer.y, base.x, base.y) <= JOYSTICK.radius + 20;
    }

    /** 손가락 위치 → 방향 벡터 (조이스틱 반지름 밖으로는 나가지 않는다) */
    private moveJoystick(pointer: PhaserNS.Input.Pointer) {
      const j = this.joystick!;
      const v = new Phaser.Math.Vector2(pointer.x - j.base.x, pointer.y - j.base.y);
      if (v.length() > JOYSTICK.radius) v.setLength(JOYSTICK.radius);
      j.thumb.setPosition(j.base.x + v.x, j.base.y + v.y);
      j.vector = v.length() < JOYSTICK.deadZone ? new Phaser.Math.Vector2() : v.clone().scale(1 / JOYSTICK.radius);
    }

    private resetJoystick() {
      const j = this.joystick!;
      j.pointerId = null;
      j.vector = new Phaser.Math.Vector2();
      j.thumb.setPosition(j.base.x, j.base.y);
    }

    update() {
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;
      this.holdView = false;

      if (left || right || up || down) {
        this.path = [];
        const v = new Phaser.Math.Vector2((right ? 1 : 0) - (left ? 1 : 0), (down ? 1 : 0) - (up ? 1 : 0))
          .normalize()
          .scale(SPEED);
        this.playerBody.setVelocity(v.x, v.y);
      } else if (this.joystick && this.joystick.vector.lengthSq() > 0) {
        // 조이스틱: 미는 방향으로 늘 같은 속도
        this.path = [];
        const v = this.joystick.vector.clone().normalize().scale(SPEED);
        this.playerBody.setVelocity(v.x, v.y);
      } else if (this.path.length) {
        this.followPath();
      } else {
        this.playerBody.setVelocity(0, 0);
      }

      // 가는 방향에 맞는 모습(앞·뒤·옆)으로, 걷는 동안 그림을 넘긴다
      const { x: vx, y: vy } = this.playerBody.velocity;
      const moving = vx * vx + vy * vy > 1;
      if (moving && !this.holdView) this.face(vx, vy);
      this.animateWalk(moving);
      // 그림은 발 상자를 따라간다. 걷는 그림이 따로 없는 예전 캐릭터만 통통 튀며 걷는다
      const bob = moving && !this.views ? Math.abs(Math.sin(this.time.now / 90)) * 4 : 0;
      this.player.setPosition(this.feet.x, this.feet.y + 8 - bob);
      this.nameTag.setPosition(this.feet.x, this.feet.y - PLAYER_SIZE - 4 - bob);
      // 아래쪽에 있을수록 앞에 그린다 (y-sorting)
      this.player.setDepth(this.feet.y + 8);
      this.nameTag.setDepth(this.feet.y + 9);
      this.updatePet(moving);

      this.updatePrompt();
    }

    /** 탭·클릭한 곳까지 나무·건물을 비켜 가는 길을 찾아 걷기 시작한다 */
    private walkTo(x: number, y: number) {
      const path = findPath(this.grid, { x: this.feet.x, y: this.feet.y }, { x, y });
      this.path = path ?? [];
      this.stuck = { x: this.feet.x, y: this.feet.y, since: this.time.now };
      this.game.canvas.dataset.walkPath = String(this.path.length);
    }

    /** 다음 꺾이는 점으로 일정한 속도로 간다. 다른 것에 막혀 제자리면 길을 다시 찾는다 */
    private followPath() {
      const dt = this.game.loop.delta / 1000;
      let next = this.path[0];
      let d = Phaser.Math.Distance.Between(this.feet.x, this.feet.y, next.x, next.y);
      // 이번 프레임에 지나칠 만큼 가까우면 다음 점으로
      while (d <= Math.max(4, SPEED * dt) && this.path.length) {
        this.path.shift();
        if (!this.path.length) {
          this.playerBody.setVelocity(0, 0);
          this.playerBody.reset(next.x, next.y);
          this.game.canvas.dataset.arrived = `${Math.round(next.x)},${Math.round(next.y)}`; // 도착 확인용 (e2e)
          return;
        }
        next = this.path[0];
        d = Phaser.Math.Distance.Between(this.feet.x, this.feet.y, next.x, next.y);
      }
      this.physics.moveTo(this.feet, next.x, next.y, SPEED);
      // 마지막 몇 px는 지나쳤다 되돌아오는 보정일 수 있어 모습을 바꾸지 않는다 (도착하자마자 뒤돌아 서지 않게)
      this.holdView = this.path.length === 1 && d < 20;
      // 0.4초 동안 거의 못 움직였으면 지금 자리에서 길을 다시 찾는다 (한 번 더 막히면 멈춘다)
      if (Phaser.Math.Distance.Between(this.feet.x, this.feet.y, this.stuck.x, this.stuck.y) > 6) {
        this.stuck = { x: this.feet.x, y: this.feet.y, since: this.time.now };
      } else if (this.time.now - this.stuck.since > 400) {
        const goal = this.path[this.path.length - 1];
        this.path = this.stuck.retried ? [] : (findPath(this.grid, { x: this.feet.x, y: this.feet.y }, goal) ?? []);
        this.stuck = { x: this.feet.x, y: this.feet.y, since: this.time.now, retried: true };
        if (!this.path.length) this.playerBody.setVelocity(0, 0);
      }
    }

    /** 가는 방향(dx, dy) → 모습. 위로는 뒷모습, 아래로는 앞모습, 옆으로는 옆모습(오른쪽을 보는 그림, 왼쪽이면 뒤집기).
     *  대각선 근처에서 모습이 깜빡이지 않게, 지금 모습이 조금 더 오래 버틴다 */
    private face(dx: number, dy: number) {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax > 1) this.facing = dx > 0 ? 1 : -1;
      const side = this.view === "side" ? ax > ay * 0.75 : ax > ay * 1.1;
      if (side) {
        this.view = "side";
        this.flip = dx < 0;
      } else {
        this.view = dy < 0 ? "back" : "front";
        this.flip = false;
      }
      // 예전 캐릭터는 그림 한 장(왼쪽을 본다)을 좌우로만 뒤집는다
      if (!this.views) this.flip = this.facing === 1;
    }

    /** 걷는 동안 WALK_STEP_MS마다 걷는 그림(1 → 0 → 2 → 0)을 넘기고, 멈추면 그 모습의 서 있는 그림(0) */
    private animateWalk(moving: boolean) {
      if (moving) {
        this.walk.clock += this.game.loop.delta;
        while (this.walk.clock >= WALK_STEP_MS) {
          this.walk.clock -= WALK_STEP_MS;
          this.walk.step = (this.walk.step + 1) % WALK_FRAMES.length;
        }
      } else {
        this.walk = { step: 0, clock: 0 }; // 다시 걸으면 첫걸음(1)부터
      }
      const frame: WalkFrame = moving ? WALK_FRAMES[this.walk.step] : 0;
      const key = walkKey(this.look, this.views ? this.view : "front", this.views ? frame : 0);
      if (this.player.texture.key !== key) this.player.setTexture(key);
      if (this.player.flipX !== this.flip) this.player.setFlipX(this.flip);
      const label = this.view === "side" ? (this.flip ? "side-left" : "side-right") : this.view;
      if (this.game.canvas.dataset.playerView !== label) this.game.canvas.dataset.playerView = label;
      const f = String(frame);
      if (this.game.canvas.dataset.walkFrame !== f) this.game.canvas.dataset.walkFrame = f;
    }

    /** 펫은 캐릭터가 보는 반대쪽(뒤) 자리를 목표로 천천히 다가간다. 걸을 때 통통 튄다 */
    private updatePet(playerMoving: boolean) {
      if (!this.pet) return;
      const dt = this.game.loop.delta / 1000;
      const tx = this.feet.x - this.facing * PET_BEHIND;
      const ty = this.feet.y + 6;
      const k = 1 - Math.exp(-dt * 5); // 프레임 속도와 상관없이 같은 느낌으로 따라오기
      const baseY = (this.pet.getData("baseY") as number | undefined) ?? this.pet.y;
      const nx = this.pet.x + (tx - this.pet.x) * k;
      const ny = baseY + (ty - baseY) * k;
      const moving = playerMoving || Math.hypot(tx - nx, ty - ny) > 3;
      if (Math.abs(tx - nx) > 1) this.pet.setFlipX(tx < nx); // 펫 그림은 기본으로 오른쪽을 본다
      const hop = moving ? Math.abs(Math.sin(this.time.now / 80)) * 5 : 0;
      this.pet.setData("baseY", ny);
      this.pet.setPosition(nx, ny - hop).setDepth(ny);
    }

    private updatePrompt() {
      let closest: Entrance | null = null;
      let best = INTERACT_DISTANCE;
      for (const e of this.entrances) {
        const d = this.distanceTo(e);
        if (d <= best) {
          best = d;
          closest = e;
        }
      }
      if (closest) {
        const verb = closest.target.kind === "login" ? "로그인하고 이용하기" : "들어가기";
        this.prompt.setText(`${closest.emoji} ${closest.label} · ${this.touch ? "탭해서" : "Space"} ${verb}`);
        this.prompt.setPosition(closest.x, closest.promptY).setVisible(true);
        if (this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) onEnter(closest.target);
      } else {
        this.prompt.setVisible(false);
      }
    }

    /** 입구(문 앞)까지의 거리 */
    private distanceTo(e: Entrance) {
      return Phaser.Math.Distance.Between(this.feet.x, this.feet.y, e.x, e.y);
    }

    private entranceAt(x: number, y: number) {
      return this.entrances.find((e) => x >= e.area.x && x <= e.area.x + e.area.w && y >= e.area.y && y <= e.area.y + e.area.h + 20);
    }

    /** 캠프파이어 불꽃: 불꽃 그림 몇 장을 번갈아 보여 주고, 바닥의 따뜻한 빛과 불티가 일렁인다.
     *  "동작 줄이기"(prefers-reduced-motion)를 켠 기기에서는 불꽃 한 장과 빛만 가만히 둔다 */
    private createCampfireFlames() {
      const { x, y } = CAMPFIRE_POS;
      const { width: w, height: h } = CAMPFIRE_SIZE;
      const glow = this.add.ellipse(x, y - 34, 300, 120, 0xffa53d, 0.22).setDepth(-5);
      const flame = this.add.image(x, y, "flame:0").setOrigin(0.5, 1).setDisplaySize(w, h).setDepth(y + 0.5).setData("light", true); // 밤에도 어둡게 하지 않는다
      // 앞쪽 장작·돌을 불꽃 위에 한 번 더 겹쳐, 불꽃 밑동이 돌 고리 안으로 들어가 보이게 한다
      this.add.image(x, y, "campfire:front").setOrigin(0.5, 1).setDisplaySize(w, h).setDepth(y + 0.6);
      this.game.canvas.dataset.campfire = "1";
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      this.game.canvas.dataset.campfire = "animated";

      let frame = 0;
      this.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          frame = (frame + 1 + Math.floor(Math.random() * (FLAME_FRAMES - 1))) % FLAME_FRAMES; // 같은 장이 연달아 나오지 않게
          flame.setTexture(`flame:${frame}`).setDisplaySize(w * (0.97 + Math.random() * 0.06), h);
        },
      });
      this.tweens.add({ targets: glow, alpha: { from: 0.16, to: 0.3 }, scaleX: { from: 0.96, to: 1.04 }, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      // 불티: 작은 점이 위로 날아오르며 사라진다
      this.time.addEvent({
        delay: 260,
        loop: true,
        callback: () => {
          const spark = this.add
            .circle(x + Phaser.Math.Between(-22, 22), y - 70, Phaser.Math.FloatBetween(1.5, 3), Phaser.Math.RND.pick([0xffd36e, 0xffa53d, 0xfff1b8]))
            .setDepth(y + 1);
          this.tweens.add({
            targets: spark,
            y: spark.y - Phaser.Math.Between(50, 90),
            x: spark.x + Phaser.Math.Between(-18, 18),
            alpha: 0,
            duration: Phaser.Math.Between(700, 1100),
            onComplete: () => spark.destroy(),
          });
        },
      });
    }

    /** 하늘 빛: 기기의 지역 시각에 맞춰 그림들을 하늘색으로 물들이고(tint), 저녁·밤에는 가로등·집 창문 불빛을 켠다.
     *  캠프파이어 둘레는 늘 조금 더 밝고, 어두워질수록 더 밝게 보인다 */
    private createSky(windows: { x: number; y: number; r: number }[]) {
      // 부드러운 빛 동그라미 (가운데가 밝고 가장자리로 갈수록 투명)
      if (!this.textures.exists("glow")) {
        const size = 256;
        const tex = this.textures.createCanvas("glow", size, size)!;
        const ctx = tex.getContext();
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        tex.refresh();
      }
      const SKY_DEPTH = 150000;
      const addLight = (x: number, y: number, diameter: number, tint: number, kind: "lamp" | "window" | "fire", base: number) => {
        const image = this.add.image(x, y, "glow").setDisplaySize(diameter, diameter).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(SKY_DEPTH + 1);
        this.glows.push({ image, kind, base });
        return image;
      };
      for (const p of LAMP_POSITIONS) {
        const l = lampLight(p);
        addLight(l.x, l.y, 150, 0xffc964, "lamp", 0.75);
        addLight(l.x, p.y - 6, 190, 0xffb347, "lamp", 0.35); // 가로등 아래 바닥에 비친 빛
      }
      for (const w of windows) addLight(w.x, w.y, w.r, 0xffb85c, "window", 0.35);
      const fire = addLight(CAMPFIRE_POS.x, CAMPFIRE_POS.y - 40, 420, 0xff9a3d, "fire", 1);
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        this.tweens.add({ targets: fire, scale: { from: fire.scale * 0.95, to: fire.scale * 1.05 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }

      const apply = () => {
        const sky = lightAt(localHour());
        // 땅·건물·나무·캐릭터 그림마다 흰색과 하늘색을 섞은 색을 곱해(tint) 어둡게 한다. 불꽃·불빛·글자는 그대로 둔다
        const shade = mixColor(0xffffff, sky.tint, sky.alpha);
        const glowImages = new Set<unknown>(this.glows.map((l) => l.image));
        for (const o of this.children.list) {
          if (o instanceof Phaser.GameObjects.Image && !glowImages.has(o) && !o.getData("light")) o.setTint(shade);
        }
        for (const l of this.glows) {
          // 캠프파이어: 낮에도 살짝(0.22), 밤에는 더 밝게. 가로등·창문: 저녁부터 켜진다
          const alpha = l.kind === "fire" ? 0.22 + 0.4 * sky.lamps : l.base * sky.lamps;
          l.image.setAlpha(alpha).setVisible(alpha > 0.01);
        }
        this.game.canvas.dataset.sky = sky.phase;
        this.game.canvas.dataset.lamps = sky.lamps > 0.5 ? "on" : "off";
      };
      apply();
      this.time.addEvent({ delay: 30_000, loop: true, callback: apply });
    }

    private placeStructure(s: Structure, walls: PhaserNS.Physics.Arcade.StaticGroup) {
      // 깊이 = 아랫변의 y. 캐릭터가 뒤(위쪽)에 있으면 가려지고, 앞(아래쪽)에 있으면 앞에 보인다
      this.add.image(s.x, s.y, s.texture).setOrigin(0.5, 1).setDisplaySize(s.w, s.h).setDepth(s.y);
      // 이름표가 있으면 그 아래(입구 앞)까지 차지한 것으로 친다
      this.occupied.push({ x: s.x - s.w / 2, y: s.y - s.h, w: s.w, h: s.h + (s.label ? 48 : 4) });
      if (s.solid) {
        walls.add(this.add.zone(s.x, s.y - s.solid.h / 2, s.solid.w, s.solid.h));
        this.solids.push({ x: s.x - s.solid.w / 2, y: s.y - s.solid.h, w: s.solid.w, h: s.solid.h });
      }
      if (s.label) {
        this.add
          .text(s.x, s.y + 6, s.label.length > 12 ? `${s.label.slice(0, 12)}…` : s.label, font({
            fontSize: "14px",
            fontStyle: "bold",
            color: "#2b2118",
            backgroundColor: "#fff8ece6",
            padding: { x: 7, y: 3 },
          }))
          .setOrigin(0.5, 0)
          .setDepth(s.y + 1);
      }
      if (s.sub) {
        this.add
          .text(s.x, s.y + 30, s.sub, font({ fontSize: "12px", color: "#3e2b20", stroke: "#fff8ec", strokeThickness: 3 }))
          .setOrigin(0.5, 0)
          .setDepth(s.y + 1);
      }
    }

    private drawGround() {
      const rng = new Phaser.Math.RandomDataGenerator(["blogcabin"]);
      const g = this.add.graphics().setDepth(-10);

      // 잔디: 은은한 체크 무늬 타일
      const TILE = 80;
      for (let x = 0; x < WORLD.width; x += TILE)
        for (let y = 0; y < WORLD.height; y += TILE) {
          g.fillStyle((x / TILE + y / TILE) % 2 ? 0x8aba5c : 0x8fbe61).fillRect(x, y, TILE, TILE); // 시안처럼 차분한 잔디
        }
      // 풀 포기
      g.lineStyle(2, 0x6f9c46, 0.9);
      for (let i = 0; i < 420; i++) {
        const x = rng.between(0, WORLD.width);
        const y = rng.between(0, WORLD.height);
        g.beginPath();
        g.moveTo(x - 4, y - 5).lineTo(x - 1, y).lineTo(x + 1, y - 7).lineTo(x + 3, y).lineTo(x + 6, y - 4);
        g.strokePath();
      }

      // 길: 흙길 (가장자리는 풀과 자연스럽게 섞이게 조금 진한 띠, 군데군데 작은 돌)
      const roads = ROADS;
      for (const [x, y, w, h] of roads) g.fillStyle(0xc9a874).fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 18);
      for (const [x, y, w, h] of roads) g.fillStyle(0xdcc191).fillRoundedRect(x, y, w, h, 14);
      for (const [x, y, w, h] of roads) {
        for (let i = 0; i < (w * h) / 900; i++) {
          g.fillStyle(rng.pick([0xcfb07d, 0xe6d0a4, 0xbfa070]), 0.9)
            .fillEllipse(rng.between(x + 6, x + w - 6), rng.between(y + 6, y + h - 6), rng.between(3, 7), rng.between(2, 5));
        }
      }

      // 캠프파이어 광장: 다져진 흙바닥 (시안 ①: 돌 깔지 않은 자연스러운 흙)
      g.fillStyle(0xc9a874).fillCircle(CENTER.x, CENTER.y, PLAZA_RADIUS + 18);
      g.fillStyle(0xd8bb88).fillCircle(CENTER.x, CENTER.y, PLAZA_RADIUS + 6);
      g.fillStyle(0xe2c99a).fillCircle(CENTER.x, CENTER.y, PLAZA_RADIUS - 40);
      for (let i = 0; i < 140; i++) {
        const a = rng.realInRange(0, Math.PI * 2);
        const r = Math.sqrt(rng.frac()) * PLAZA_RADIUS;
        g.fillStyle(rng.pick([0xcdb07e, 0xeedab0, 0xbd9e6c]), 0.85)
          .fillEllipse(CENTER.x + Math.cos(a) * r, CENTER.y + Math.sin(a) * r, rng.between(3, 8), rng.between(2, 5));
      }
      // 광장 둘레 풀포기·꽃 (길이 지나가는 곳은 비운다)
      for (let a = 0; a < 360; a += 7) {
        if (a % 90 < 16 || a % 90 > 74) continue;
        const rad = Phaser.Math.DegToRad(a + rng.between(-2, 2));
        const x = CENTER.x + Math.cos(rad) * (PLAZA_RADIUS + 30);
        const y = CENTER.y + Math.sin(rad) * (PLAZA_RADIUS + 30);
        g.fillStyle(0x6f9c46).fillCircle(x, y, 8);
        if (rng.frac() < 0.45) g.fillStyle(rng.pick([0xf3a6b8, 0xf6d77a, 0xfffaf0])).fillCircle(x + rng.between(-3, 3), y - 3, 3.5);
      }

      // 들꽃
      for (let i = 0; i < 160; i++) {
        const x = rng.between(0, WORLD.width);
        const y = rng.between(0, WORLD.height);
        if (Phaser.Math.Distance.Between(x, y, CENTER.x, CENTER.y) < PLAZA_RADIUS + 50) continue;
        const c = rng.pick([0xfffaf0, 0xf6d77a, 0xf3a6b8, 0xd9b8e8]);
        for (const [dx, dy] of [[-2.5, 0], [2.5, 0], [0, -2.5], [0, 2.5]]) g.fillStyle(c).fillCircle(x + dx, y + dy, 2.3);
        g.fillStyle(0xffb300).fillCircle(x, y, 1.6);
      }

      // 밤에 어둡게 칠할 수 있게(tint) 그림 한 장으로 굽는다
      g.generateTexture("ground", WORLD.width, WORLD.height);
      g.destroy();
      this.add.image(0, 0, "ground").setOrigin(0).setDepth(-10);
    }

    /** 나무: 길, 광장, 건물 자리를 피해서 심는다 */
    private plantTrees(walls: PhaserNS.Physics.Arcade.StaticGroup) {
      const rng = new Phaser.Math.RandomDataGenerator(["blogcabin-trees"]);
      const blocked = [
        { ...BOARD_POS, r: 190 }, { ...SHOP_POS, r: 170 }, { ...FARM_POS, r: 190 }, { ...MY_HOUSE_POS, r: 150 },
        ...NEIGHBOR_SLOTS.map((p) => ({ ...p, r: 160 })),
        // 자리를 정해 둔 소품(빨래대 등)과 겹치지 않게
        ...FIXED_PROPS.map((p) => ({ x: p.x, y: p.y, r: (PROP_ART[p.kind].size.width * (p.s ?? 1)) / 2 + 40 })),
      ];
      let planted = 0;
      for (let i = 0; i < 400 && planted < 46; i++) {
        const x = rng.between(40, WORLD.width - 40);
        const y = rng.between(90, WORLD.height - 20);
        if (Phaser.Math.Distance.Between(x, y, CENTER.x, CENTER.y) < PLAZA_RADIUS + 110) continue;
        if (Math.abs(x - CENTER.x) < 95 || Math.abs(y - CENTER.y) < 95) continue;
        if (y > 380 && y < 490) continue;
        if (y > WORLD.height - 490 && y < WORLD.height - 380) continue;
        if (blocked.some((b) => Phaser.Math.Distance.Between(x, y - 60, b.x, b.y - 60) < b.r)) continue;
        // 오두막 마을이라 소나무를 많이 심는다
        const kind = rng.pick(["pine", "pine", "pine", "round", "bush", "blossom"]);
        const scale = kind === "bush" ? 0.75 : rng.realInRange(0.9, 1.15);
        this.placeStructure(
          { texture: `tree:${kind}`, x, y, w: TREE_SIZE.width * scale, h: TREE_SIZE.height * scale, solid: { w: 26 * scale, h: 12 } },
          walls,
        );
        planted++;
      }
    }

    /** 풀밭 소품: 바위(작게 부딪힘)·꽃 포기·풀 포기(지나갈 수 있음)를 길·광장·건물·나무를 피해 흩어 놓는다 */
    private scatterProps(walls: PhaserNS.Physics.Arcade.StaticGroup) {
      const rng = new Phaser.Math.RandomDataGenerator(["blogcabin-props"]);
      const plan: [PropKind, number, number, number][] = [["rock", 10, 0.7, 0.95], ["flowers", 22, 0.8, 1.05], ["grass", 30, 0.75, 1]];
      const hits = (x: number, y: number, w: number, h: number, r: Rect, pad: number) =>
        x + w / 2 > r.x - pad && x - w / 2 < r.x + r.w + pad && y > r.y - pad && y - h < r.y + r.h + pad;
      for (const [kind, count, s0, s1] of plan) {
        const { width, height } = PROP_ART[kind].size;
        for (let i = 0, placed = 0; i < count * 40 && placed < count; i++) {
          const s = rng.realInRange(s0, s1);
          const w = width * s, h = height * s;
          const x = rng.between(30, WORLD.width - 30);
          const y = rng.between(110, WORLD.height - 10);
          if (Phaser.Math.Distance.Between(x, y, CENTER.x, CENTER.y) < PLAZA_RADIUS + 60) continue;
          // 길(가장자리 여유 12px), 건물·나무·이름표·다른 소품 자리는 피한다
          if (ROADS.some(([rx, ry, rw, rh]) => hits(x, y, w, h, { x: rx, y: ry, w: rw, h: rh }, 12))) continue;
          if (this.occupied.some((o) => hits(x, y, w, h, o, 6))) continue;
          this.placeStructure({ texture: propKey(kind), x, y, w, h, solid: kind === "rock" ? { w: w * 0.6, h: 8 } : undefined }, walls);
          placed++;
        }
      }
    }
  };
}
