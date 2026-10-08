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

  // 가구 (SHOP-05): 미니룸에 끌어다 놓는다 (최대 5개)
  { code: "furn_plant", type: "furniture", name: "화분", description: "방에 생기를 더하는 초록 화분", price: 40, requiredLevel: 1, isStarter: false, assetKey: "furn.plant" },
  { code: "furn_chair", type: "furniture", name: "의자", description: "잠깐 앉아 쉬어 가는 나무 의자", price: 50, requiredLevel: 1, isStarter: false, assetKey: "furn.chair" },
  { code: "furn_lamp", type: "furniture", name: "램프", description: "밤에도 글을 쓸 수 있는 스탠드", price: 80, requiredLevel: 2, isStarter: false, assetKey: "furn.lamp" },
  { code: "furn_desk", type: "furniture", name: "책상", description: "글쓰기에 딱 좋은 책상", price: 120, requiredLevel: 2, isStarter: false, assetKey: "furn.desk" },
  { code: "furn_bed", type: "furniture", name: "침대", description: "푹 쉬고 내일 또 쓰기", price: 200, requiredLevel: 3, isStarter: false, assetKey: "furn.bed" },

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
