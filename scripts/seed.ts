// 아이템 카탈로그 기본 데이터. 여러 번 실행해도 안전하다 (code 기준으로 덮어쓰기).
// 실행: npm run db:seed
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { animalSpecies, items } from "../src/db/schema";

config({ path: ".env.local" });

type NewItem = typeof items.$inferInsert;

const ITEMS: NewItem[] = [
  // 가입할 때 고르는 기본 캐릭터 (is_starter): 남자·여자 중 하나를 골라 받는다
  { code: "char_boy", type: "character", name: "남자 주민", description: "마을에 막 이사 온 남자 주민", price: 0, requiredLevel: 1, isStarter: true, assetKey: "char.boy" },
  { code: "char_girl", type: "character", name: "여자 주민", description: "마을에 막 이사 온 여자 주민", price: 0, requiredLevel: 1, isStarter: true, assetKey: "char.girl" },

  // 예전 상점 캐릭터: 2026-10-06 결정으로 상점에서 팔지 않는다 (SHOP-01). 행은 남겨서 이미 산 회원은 계속 갖고 장착한다.
  // 상점은 type = 'character'인 아이템을 보여주지도, 팔지도 않는다 (src/lib/shop.ts의 isForSale)
  { code: "char_human", type: "character", name: "모험가", description: "어디든 떠나는 씩씩한 모험가", price: 60, requiredLevel: 1, isStarter: false, assetKey: "char.human" },
  { code: "char_cat", type: "character", name: "고양이", description: "호기심 많은 고양이", price: 80, requiredLevel: 1, isStarter: false, assetKey: "char.cat" },
  { code: "char_dog", type: "character", name: "강아지", description: "사람을 좋아하는 강아지", price: 80, requiredLevel: 1, isStarter: false, assetKey: "char.dog" },
  { code: "char_rabbit", type: "character", name: "토끼", description: "글 쓰는 속도가 빠른 토끼", price: 100, requiredLevel: 2, isStarter: false, assetKey: "char.rabbit" },
  { code: "char_fox", type: "character", name: "여우", description: "꾀가 많은 여우", price: 150, requiredLevel: 2, isStarter: false, assetKey: "char.fox" },
  { code: "char_panda", type: "character", name: "판다", description: "느긋하게 꾸준히 쓰는 판다", price: 250, requiredLevel: 3, isStarter: false, assetKey: "char.panda" },
  { code: "char_robot", type: "character", name: "로봇", description: "AI를 공부하는 로봇", price: 400, requiredLevel: 4, isStarter: false, assetKey: "char.robot" },
  { code: "char_dragon", type: "character", name: "드래곤", description: "마을의 전설", price: 800, requiredLevel: 6, isStarter: false, assetKey: "char.dragon" },
  { code: "char_unicorn", type: "character", name: "유니콘", description: "꾸준함의 상징", price: 1200, requiredLevel: 8, isStarter: false, assetKey: "char.unicorn" },

  // 아바타 꾸미기 (SHOP-06): 상의·하의·모자·신발 각 3개. 레벨이 오르면 하나씩 풀린다 (Lv.1·2·3·5)
  { code: "av_top_stripe", type: "avatar", slot: "top", name: "줄무늬 티셔츠", description: "어디에나 잘 어울리는 기본 티셔츠", price: 40, requiredLevel: 1, isStarter: false, assetKey: "avatar.top.stripe" },
  { code: "av_top_hoodie", type: "avatar", slot: "top", name: "후드티", description: "글 쓸 때 입기 좋은 포근한 후드티", price: 100, requiredLevel: 2, isStarter: false, assetKey: "avatar.top.hoodie" },
  { code: "av_top_knit", type: "avatar", slot: "top", name: "니트 스웨터", description: "하트 무늬가 들어간 따뜻한 스웨터", price: 160, requiredLevel: 5, isStarter: false, assetKey: "avatar.top.knit" },
  { code: "av_bottom_shorts", type: "avatar", slot: "bottom", name: "반바지", description: "가볍게 산책할 때 입는 반바지", price: 40, requiredLevel: 1, isStarter: false, assetKey: "avatar.bottom.shorts" },
  { code: "av_bottom_jeans", type: "avatar", slot: "bottom", name: "청바지", description: "튼튼하고 편한 청바지", price: 80, requiredLevel: 2, isStarter: false, assetKey: "avatar.bottom.jeans" },
  { code: "av_bottom_skirt", type: "avatar", slot: "bottom", name: "주름치마", description: "빨간 체크 무늬 주름치마", price: 120, requiredLevel: 3, isStarter: false, assetKey: "avatar.bottom.skirt" },
  { code: "av_shoes_sneakers", type: "avatar", slot: "shoes", name: "운동화", description: "마을을 돌아다니기 좋은 운동화", price: 50, requiredLevel: 1, isStarter: false, assetKey: "avatar.shoes.sneakers" },
  { code: "av_shoes_boots", type: "avatar", slot: "shoes", name: "장화", description: "비 오는 날에도 끄떡없는 노란 장화", price: 90, requiredLevel: 3, isStarter: false, assetKey: "avatar.shoes.boots" },
  { code: "av_shoes_shiny", type: "avatar", slot: "shoes", name: "반짝 구두", description: "특별한 날 신는 반짝이는 구두", price: 180, requiredLevel: 5, isStarter: false, assetKey: "avatar.shoes.shiny" },
  { code: "av_hat_straw", type: "avatar", slot: "hat", name: "밀짚모자", description: "햇살 좋은 날의 밀짚모자", price: 40, requiredLevel: 1, isStarter: false, assetKey: "avatar.hat.straw" },
  { code: "av_hat_beanie", type: "avatar", slot: "hat", name: "털모자", description: "방울 달린 포근한 털모자", price: 80, requiredLevel: 2, isStarter: false, assetKey: "avatar.hat.beanie" },
  { code: "av_hat_crown", type: "avatar", slot: "hat", name: "왕관", description: "꾸준히 쓴 사람에게 어울리는 왕관", price: 200, requiredLevel: 5, isStarter: false, assetKey: "avatar.hat.crown" },
  // 해적 옷 (2026-10-12)
  { code: "av_top_vest", type: "avatar", slot: "top", name: "모험 조끼", description: "바닷바람을 맞으며 입는 빨간 조끼", price: 90, requiredLevel: 2, isStarter: false, assetKey: "avatar.top.vest" },
  { code: "av_top_coat", type: "avatar", slot: "top", name: "선장 코트", description: "금색 단추가 달린 선장님의 코트", price: 220, requiredLevel: 6, isStarter: false, assetKey: "avatar.top.coat" },
  { code: "av_bottom_sailor", type: "avatar", slot: "bottom", name: "선원 바지", description: "갑판 위에서 일하기 좋은 넉넉한 바지", price: 90, requiredLevel: 3, isStarter: false, assetKey: "avatar.bottom.sailor" },
  { code: "av_shoes_sandals", type: "avatar", slot: "shoes", name: "샌들", description: "모래사장을 걷기 좋은 가벼운 샌들", price: 50, requiredLevel: 1, isStarter: false, assetKey: "avatar.shoes.sandals" },
  { code: "av_hat_pirate", type: "avatar", slot: "hat", name: "해적 모자", description: "해골 무늬가 달린 검은 해적 모자", price: 240, requiredLevel: 6, isStarter: false, assetKey: "avatar.hat.pirate" },
  // 공룡 옷 (2026-10-12): 네 가지를 다 입으면 공룡 점프수트
  { code: "av_hat_dino", type: "avatar", slot: "hat", name: "공룡 모자", description: "이빨과 눈이 달린 초록 공룡 모자", price: 120, requiredLevel: 3, isStarter: false, assetKey: "avatar.hat.dino" },
  { code: "av_top_dino", type: "avatar", slot: "top", name: "공룡 옷", description: "등에 가시가 난 초록 공룡 옷", price: 120, requiredLevel: 3, isStarter: false, assetKey: "avatar.top.dino" },
  { code: "av_bottom_dino", type: "avatar", slot: "bottom", name: "공룡 바지", description: "꼬리가 달랑달랑 달린 공룡 바지", price: 100, requiredLevel: 3, isStarter: false, assetKey: "avatar.bottom.dino" },
  { code: "av_shoes_dino", type: "avatar", slot: "shoes", name: "공룡 발", description: "하얀 발톱이 달린 공룡 발 신발", price: 80, requiredLevel: 3, isStarter: false, assetKey: "avatar.shoes.dino" },
  // 한복·기모노 (2026-10-13)
  { code: "av_top_jeogori", type: "avatar", slot: "top", name: "한복 저고리", description: "빨간 고름을 맨 노란 저고리", price: 120, requiredLevel: 2, isStarter: false, assetKey: "avatar.top.jeogori" },
  { code: "av_bottom_hanbok_skirt", type: "avatar", slot: "bottom", name: "한복 치마", description: "발목까지 내려오는 분홍 한복 치마", price: 120, requiredLevel: 2, isStarter: false, assetKey: "avatar.bottom.hanbok-skirt" },
  { code: "av_bottom_hanbok_pants", type: "avatar", slot: "bottom", name: "한복 바지", description: "넉넉한 하늘색 한복 바지", price: 90, requiredLevel: 2, isStarter: false, assetKey: "avatar.bottom.hanbok-pants" },
  { code: "av_shoes_kkotsin", type: "avatar", slot: "shoes", name: "꽃신", description: "하얀 꽃이 수놓인 빨간 꽃신", price: 70, requiredLevel: 1, isStarter: false, assetKey: "avatar.shoes.kkotsin" },
  { code: "av_top_kimono", type: "avatar", slot: "top", name: "기모노", description: "꽃무늬 하늘색 기모노와 빨간 허리띠", price: 220, requiredLevel: 3, isStarter: false, assetKey: "avatar.top.kimono" },
  { code: "av_shoes_geta", type: "avatar", slot: "shoes", name: "게타", description: "또각또각 소리 나는 나무 게타", price: 70, requiredLevel: 1, isStarter: false, assetKey: "avatar.shoes.geta" },
  { code: "av_hat_bandana", type: "avatar", slot: "hat", name: "반다나", description: "머리에 질끈 묶는 초록 반다나", price: 70, requiredLevel: 2, isStarter: false, assetKey: "avatar.hat.bandana" },

  // 가구 (SHOP-05): 미니룸에 끌어다 놓는다 (한 방에 최대 5개)
  { code: "furn_plant", type: "furniture", name: "화분", description: "방에 생기를 더하는 초록 화분", price: 40, requiredLevel: 1, isStarter: false, assetKey: "furn.plant" },
  { code: "furn_chair", type: "furniture", name: "의자", description: "잠깐 앉아 쉬어 가는 나무 의자", price: 50, requiredLevel: 1, isStarter: false, assetKey: "furn.chair" },
  { code: "furn_lamp", type: "furniture", name: "램프", description: "밤에도 글을 쓸 수 있는 스탠드", price: 80, requiredLevel: 2, isStarter: false, assetKey: "furn.lamp" },
  { code: "furn_desk", type: "furniture", name: "책상", description: "글쓰기에 딱 좋은 책상", price: 120, requiredLevel: 2, isStarter: false, assetKey: "furn.desk" },
  { code: "furn_bed", type: "furniture", name: "침대", description: "푹 쉬고 내일 또 쓰기", price: 200, requiredLevel: 3, isStarter: false, assetKey: "furn.bed" },
  // 2026-10-13 새 가구 9종 (요청 순서가 아니라 값이 싼 것부터)
  { code: "furn_basket", type: "furniture", name: "꽃바구니", description: "알록달록한 꽃을 가득 담은 바구니", price: 30, requiredLevel: 1, isStarter: false, assetKey: "furn.basket" },
  { code: "furn_teddy", type: "furniture", name: "곰인형", description: "리본을 맨 폭신한 곰인형", price: 60, requiredLevel: 1, isStarter: false, assetKey: "furn.teddy" },
  { code: "furn_rug", type: "furniture", name: "러그", description: "바닥에 깔면 포근해지는 동그란 러그", price: 70, requiredLevel: 1, isStarter: false, assetKey: "furn.rug" },
  { code: "furn_bookshelf", type: "furniture", name: "책장", description: "좋아하는 책을 꽂아 두는 책장", price: 100, requiredLevel: 2, isStarter: false, assetKey: "furn.bookshelf" },
  { code: "furn_tv", type: "furniture", name: "티비", description: "더듬이 안테나가 달린 옛날 텔레비전", price: 150, requiredLevel: 3, isStarter: false, assetKey: "furn.tv" },
  { code: "furn_console", type: "furniture", name: "게임기", description: "친구와 함께 즐기는 게임기", price: 180, requiredLevel: 3, isStarter: false, assetKey: "furn.console" },
  { code: "furn_cloud", type: "furniture", name: "구름", description: "방 안에 둥실 떠 있는 웃는 구름", price: 260, requiredLevel: 4, isStarter: false, assetKey: "furn.cloud" },
  { code: "furn_rainbow", type: "furniture", name: "무지개", description: "보기만 해도 기분 좋아지는 무지개", price: 380, requiredLevel: 5, isStarter: false, assetKey: "furn.rainbow" },
  { code: "furn_rocket", type: "furniture", name: "우주선", description: "언젠가 우주로 날아갈 꼬마 로켓", price: 600, requiredLevel: 6, isStarter: false, assetKey: "furn.rocket" },

  // 배경 (초원은 모두에게 기본 지급)
  { code: "bg_meadow", type: "background", name: "초원", description: "모든 이야기가 시작되는 곳", price: 0, requiredLevel: 1, isStarter: true, assetKey: "bg.meadow" },
  { code: "bg_beach", type: "background", name: "바닷가", description: "파도 소리가 들리는 해변", price: 120, requiredLevel: 1, isStarter: false, assetKey: "bg.beach" },
  { code: "bg_snow", type: "background", name: "눈 마을", description: "조용히 눈이 쌓이는 마을", price: 200, requiredLevel: 2, isStarter: false, assetKey: "bg.snow" },
  { code: "bg_sakura", type: "background", name: "벚꽃길", description: "봄바람이 부는 벚꽃길", price: 300, requiredLevel: 3, isStarter: false, assetKey: "bg.sakura" },
  { code: "bg_night", type: "background", name: "밤의 도시", description: "불빛이 반짝이는 밤", price: 450, requiredLevel: 4, isStarter: false, assetKey: "bg.night" },
  { code: "bg_space", type: "background", name: "우주", description: "끝없이 펼쳐진 우주", price: 900, requiredLevel: 6, isStarter: false, assetKey: "bg.space" },
];

// 동물 농장 동물 종류 (TOWN-09). 흔한 동물일수록 빨리 자라고 보상이 작다.
// maxLevel = 다 자란 레벨. 성장치(growExp)를 이 레벨까지 나눠서, 동물마다 한 레벨에 필요한 경험치가 다르다 (src/lib/farm.ts petLevelExp)
const SPECIES: (typeof animalSpecies.$inferInsert)[] = [
  { code: "chick", name: "병아리", assetKey: "animal.chick", growExp: 60, maxLevel: 5, rewardExp: 50, rewardCoins: 20, hatchWeight: 35 },
  { code: "bunny", name: "토끼", assetKey: "animal.bunny", growExp: 90, maxLevel: 6, rewardExp: 80, rewardCoins: 30, hatchWeight: 28 },
  { code: "piglet", name: "아기 돼지", assetKey: "animal.piglet", growExp: 120, maxLevel: 7, rewardExp: 110, rewardCoins: 50, hatchWeight: 20 },
  { code: "calf", name: "송아지", assetKey: "animal.calf", growExp: 160, maxLevel: 8, rewardExp: 160, rewardCoins: 80, hatchWeight: 12 },
  { code: "lamb", name: "아기 양", assetKey: "animal.lamb", growExp: 220, maxLevel: 10, rewardExp: 220, rewardCoins: 110, hatchWeight: 5 },
  // 2026-10-12 새 동물 14종 (흔한 순서). 드래곤·유니콘은 아주 드물게
  { code: "hamster", name: "햄스터", assetKey: "animal.hamster", growExp: 70, maxLevel: 5, rewardExp: 60, rewardCoins: 25, hatchWeight: 26 },
  { code: "puppy", name: "강아지", assetKey: "animal.puppy", growExp: 90, maxLevel: 6, rewardExp: 80, rewardCoins: 30, hatchWeight: 24 },
  { code: "cat", name: "고양이", assetKey: "animal.cat", growExp: 90, maxLevel: 6, rewardExp: 80, rewardCoins: 30, hatchWeight: 24 },
  { code: "mole", name: "두더지", assetKey: "animal.mole", growExp: 100, maxLevel: 6, rewardExp: 90, rewardCoins: 40, hatchWeight: 20 },
  { code: "raccoon", name: "너구리", assetKey: "animal.raccoon", growExp: 120, maxLevel: 7, rewardExp: 110, rewardCoins: 50, hatchWeight: 16 },
  { code: "turtle", name: "거북이", assetKey: "animal.turtle", growExp: 130, maxLevel: 7, rewardExp: 120, rewardCoins: 55, hatchWeight: 15 },
  { code: "monkey", name: "원숭이", assetKey: "animal.monkey", growExp: 140, maxLevel: 7, rewardExp: 130, rewardCoins: 60, hatchWeight: 14 },
  { code: "fox", name: "여우", assetKey: "animal.fox", growExp: 160, maxLevel: 8, rewardExp: 160, rewardCoins: 80, hatchWeight: 11 },
  { code: "bear", name: "곰", assetKey: "animal.bear", growExp: 180, maxLevel: 8, rewardExp: 180, rewardCoins: 90, hatchWeight: 10 },
  { code: "wolf", name: "늑대", assetKey: "animal.wolf", growExp: 200, maxLevel: 9, rewardExp: 200, rewardCoins: 100, hatchWeight: 8 },
  { code: "tiger", name: "호랑이", assetKey: "animal.tiger", growExp: 240, maxLevel: 10, rewardExp: 240, rewardCoins: 120, hatchWeight: 6 },
  { code: "dino", name: "공룡", assetKey: "animal.dino", growExp: 260, maxLevel: 11, rewardExp: 260, rewardCoins: 130, hatchWeight: 4 },
  { code: "unicorn", name: "유니콘", assetKey: "animal.unicorn", growExp: 300, maxLevel: 12, rewardExp: 300, rewardCoins: 150, hatchWeight: 3 },
  { code: "dragon", name: "드래곤", assetKey: "animal.dragon", growExp: 320, maxLevel: 12, rewardExp: 320, rewardCoins: 160, hatchWeight: 2 },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    for (const item of ITEMS) {
      await db
        .insert(items)
        .values(item)
        .onConflictDoUpdate({
          target: items.code,
          set: {
            type: item.type,
            name: item.name,
            description: item.description,
            price: item.price,
            requiredLevel: item.requiredLevel,
            isStarter: item.isStarter,
            assetKey: item.assetKey,
            slot: item.slot ?? null,
          },
        });
    }
    for (const sp of SPECIES) {
      await db
        .insert(animalSpecies)
        .values(sp)
        .onConflictDoUpdate({
          target: animalSpecies.code,
          set: {
            name: sp.name,
            assetKey: sp.assetKey,
            growExp: sp.growExp,
            rewardExp: sp.rewardExp,
            rewardCoins: sp.rewardCoins,
            hatchWeight: sp.hatchWeight,
            maxLevel: sp.maxLevel,
          },
        });
    }
    const rows = await db.execute(sql`SELECT type, COUNT(*)::int AS n FROM items GROUP BY type ORDER BY type`);
    console.log("✔ 아이템 시드 완료", rows.rows, `동물 ${SPECIES.length}종`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
