// 상점·꾸미기 규칙 테스트: 판매 여부·정렬(SHOP-01), 모습 키(SHOP-06), 위치 비율(SHOP-05)
// 실행: npm run test:shop
import { piecesInOrder } from "../src/lib/art/avatar";
import { characterSvg, composeLook, parseLook } from "../src/lib/art/characters";
import { fitRoomSpot, FURNITURE_COLOR_KEYS, furnitureInfo, furnitureSvg, paintedFurnitureKey, parseFurnitureKey } from "../src/lib/art/furniture";
import { FURNITURE_COLORS as DB_FURNITURE_COLORS } from "../src/db/schema";
import { clampPct, isForSale, sortItems } from "../src/lib/shop";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// 판매 여부
expect("기본 배경은 안 팖", isForSale({ type: "background", isStarter: true }), false);
expect("캐릭터는 안 팖 (판매 중단)", isForSale({ type: "character", isStarter: false }), false);
expect("꾸미기는 팖", isForSale({ type: "avatar", isStarter: false }), true);
expect("가구는 팖", isForSale({ type: "furniture", isStarter: false }), true);

// 정렬: 가구 5종 (화분 40 Lv1, 의자 50 Lv1, 램프 80 Lv2, 책상 120 Lv2, 침대 200 Lv3)
const f = [
  { id: 5, name: "침대", price: 200, requiredLevel: 3, ownerCount: 0, owned: false },
  { id: 3, name: "램프", price: 80, requiredLevel: 2, ownerCount: 5, owned: false },
  { id: 1, name: "화분", price: 40, requiredLevel: 1, ownerCount: 1, owned: true },
  { id: 4, name: "책상", price: 120, requiredLevel: 2, ownerCount: 5, owned: true },
  { id: 2, name: "의자", price: 50, requiredLevel: 1, ownerCount: 2, owned: false },
];
const names = (s: Parameters<typeof sortItems>[1]) => sortItems(f, s).map((i) => i.name);
expect("레벨순(기본)", names("level"), ["화분", "의자", "램프", "책상", "침대"]);
expect("인기순 (같으면 싼 순)", names("popular"), ["램프", "책상", "의자", "화분", "침대"]);
expect("비싼 순", names("price_desc"), ["침대", "책상", "램프", "의자", "화분"]);
expect("싼 순", names("price_asc"), ["화분", "의자", "램프", "책상", "침대"]);
expect("최신순", names("newest"), ["침대", "책상", "램프", "의자", "화분"]);
expect("보유순 (같으면 싼 순)", names("owned"), ["화분", "책상", "의자", "램프", "침대"]);
expect("원래 배열은 그대로", f[0].name, "침대");

// 가구 색 (SHOP-05, 2026-10-13)
expect("가구 색 목록이 DB CHECK와 같음", FURNITURE_COLOR_KEYS, [...DB_FURNITURE_COLORS]);
expect("색 붙인 가구 키", paintedFurnitureKey("furn.chair", "pink"), "furn.chair@pink");
expect("색이 없거나 모르는 색이면 가구 키 그대로", [paintedFurnitureKey("furn.chair", null), paintedFurnitureKey("furn.chair", "gold")], ["furn.chair", "furn.chair"]);
expect("색 붙인 가구 키 풀기", parseFurnitureKey("furn.tv@navy"), { assetKey: "furn.tv", color: "navy" });
expect("색을 붙여도 크기는 같음", furnitureInfo("furn.bed@mint"), furnitureInfo("furn.bed"));
expect("색을 고르면 그림이 바뀜", furnitureSvg("furn.chair@mint") !== furnitureSvg("furn.chair"), true);
expect("고른 색(민트, 파스텔로 조금 밝힌 #b2e0c8)이 그림에 들어감", furnitureSvg("furn.chair@mint").includes("#b2e0c8"), true);

// 모습 키
const look = composeLook("char.girl", ["avatar.hat.straw", "avatar.top.hoodie"]);
expect("모습 키 만들기", look, "char.girl+avatar.hat.straw+avatar.top.hoodie");
expect("모습 키 풀기", parseLook(look), { character: "char.girl", avatars: ["avatar.hat.straw", "avatar.top.hoodie"] });
expect("꾸미기 없으면 캐릭터 키 그대로", composeLook("char.boy", []), "char.boy");
expect(
  "그리는 순서: 하의 → 상의 → 신발 → 모자",
  piecesInOrder(["avatar.hat.straw", "avatar.shoes.boots", "avatar.top.hoodie", "avatar.bottom.jeans"]).map((p) => p.slot),
  ["bottom", "top", "shoes", "hat"],
);
expect("같은 부위가 둘이면 하나만", piecesInOrder(["avatar.hat.straw", "avatar.hat.crown"]).length, 1);
expect("남자 주민은 꾸미기를 그린다", characterSvg(look.replace("girl", "boy")).length > characterSvg("char.boy").length, true);
expect("상점에서 빠진 캐릭터(고양이)는 꾸미기를 그리지 않는다", characterSvg("char.cat+avatar.hat.straw") === characterSvg("char.cat"), true);

// 가구 위치
expect("위치는 0~100으로", [clampPct(-5), clampPct(42.345), clampPct(130)], [0, 42.3, 100]);

// 벽 장식 자리 (SHOP-05, 2026-10-13): 창문(x 3~29.5, y 9~50)·액자(x 78.5~91.5, y 12~37)를 가리지 않고 벽 안에만
{
  const box = (key: string, p: { x: number; y: number }) => {
    const { heightPct, aspect } = furnitureInfo(key);
    return { x0: p.x - (heightPct * aspect) / 4, x1: p.x + (heightPct * aspect) / 4, y0: p.y - heightPct / 2, y1: p.y + heightPct / 2 };
  };
  const clear = (b: ReturnType<typeof box>) =>
    b.x0 >= 0 && b.x1 <= 100 && b.y0 >= 0 && b.y1 <= 71 && (b.x1 <= 3 || b.x0 >= 29.5 || b.y1 <= 9 || b.y0 >= 50) && (b.x1 <= 78.5 || b.x0 >= 91.5 || b.y1 <= 12 || b.y0 >= 37);
  for (const key of ["furn.cloud", "furn.rainbow@pink", "furn.rocket"]) {
    for (const [x, y] of [[16, 30], [85, 25], [50, 85], [54, 25]]) {
      expect(`${key} (${x}, ${y})에 놓으면 창문·액자를 피해 벽 안에`, clear(box(key, fitRoomSpot(key, x, y))), true);
    }
  }
  expect("빈 벽에 놓은 구름은 그 자리 그대로", fitRoomSpot("furn.cloud", 54, 25), { x: 54, y: 25 });
  expect("바닥 가구는 그대로", fitRoomSpot("furn.chair", 16, 30), { x: 16, y: 30 });
}

if (failed) {
  console.error(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
