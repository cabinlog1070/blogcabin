// 게임 규칙 계산 테스트: 레벨(GAME-02), 연속 출석(GAME-04), 동물 농장(TOWN-09)
// 실행: npm run test:game
import { animalStage, cleanPetName, josa, levelEggLevels, petLevel, petLevelExp, petLevelProgress, pickWeighted, subject } from "../src/lib/farm";
import { currentStreak, houseStageForLevel, levelFromExp, levelProgress, MAX_LEVEL, timeAgo } from "../src/lib/game";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// GAME-02 레벨
expect("경험치 99 → Lv.1", levelFromExp(99), 1);
expect("경험치 100 → Lv.2", levelFromExp(100), 2);
expect("경험치 150 진행 막대", [levelProgress(150).current, levelProgress(150).needed], [50, 200]);
expect("경험치 485,099 → Lv.98", levelFromExp(485_099), 98);
expect("경험치 485,100 → Lv.99", levelFromExp(485_100), MAX_LEVEL);
expect("경험치 1,000만 → Lv.99에서 멈춤", levelFromExp(10_000_000), 99);
expect("최고 레벨 진행 막대 가득(MAX)", [levelProgress(600_000).isMax, levelProgress(600_000).ratio], [true, 1]);

// GAME-04 연속 출석
expect("기록 없음 → 0", currentStreak(null, "2026-10-01"), 0);
expect("오늘 출석 → 그 연속 일수", currentStreak({ date: "2026-10-01", streak: 5 }, "2026-10-01"), 5);
expect("어제 출석(달 바뀜) → 이어짐", currentStreak({ date: "2026-09-30", streak: 6 }, "2026-10-01"), 6);
expect("그저께가 마지막 → 끊김", currentStreak({ date: "2026-09-29", streak: 6 }, "2026-10-01"), 0);
expect("해 바뀜 12/31 → 1/1 이어짐", currentStreak({ date: "2025-12-31", streak: 3 }, "2026-01-01"), 3);

// TOWN-11 집 단계 (경계값 Lv.4, 5, 14, 15, 99 → 1·2·2·3·3)
expect("집 단계 Lv.1/4/5/14/15/99", [1, 4, 5, 14, 15, 99].map(houseStageForLevel), [1, 1, 2, 2, 3, 3]);

// GAME-08 알림 시간
const now = new Date("2026-10-08T12:00:00Z");
expect("30초 전 → 방금", timeAgo(new Date("2026-10-08T11:59:30Z"), now), "방금");
expect("5분 전", timeAgo(new Date("2026-10-08T11:55:00Z"), now), "5분 전");
expect("23시간 전", timeAgo(new Date("2026-10-07T13:00:00Z"), now), "23시간 전");
expect("하루 넘으면 날짜", timeAgo(new Date("2026-10-02T03:00:00Z"), now), "2026. 10. 02.");

// TOWN-09 동물 농장
expect("성장 0/90 → 아기", animalStage(0, 90), "baby");
expect("성장 29/90 → 아기", animalStage(29, 90), "baby");
expect("성장 30/90 → 청소년", animalStage(30, 90), "teen");
expect("성장 89/90 → 청소년", animalStage(89, 90), "teen");
expect("성장 90/90 → 어른", animalStage(90, 90), "adult");
expect("Lv.4 → 레벨 보상 알 없음", levelEggLevels(4), []);
expect("Lv.12 → 5, 10레벨 알", levelEggLevels(12), [5, 10]);
const sp = [{ code: "a", hatchWeight: 40 }, { code: "b", hatchWeight: 10 }];
expect("비중 고르기: 0 → 첫째", pickWeighted(sp, 0).code, "a");
expect("비중 고르기: 0.79 → 첫째 (40/50 경계 전)", pickWeighted(sp, 0.79).code, "a");
expect("비중 고르기: 0.8 → 둘째", pickWeighted(sp, 0.8).code, "b");
expect("비중 고르기: 0.999 → 둘째", pickWeighted(sp, 0.999).code, "b");
expect("조사: 토끼가", subject("토끼"), "토끼가");
expect("조사: 아기 돼지가", subject("아기 돼지"), "아기 돼지가");
expect("조사: 곰이", subject("곰"), "곰이");

expect("조사: 콩이와 / 곰과", [josa("콩이", "과", "와"), josa("곰", "과", "와")], ["콩이와", "곰과"]);
expect("조사: 토끼로 / 곰으로 / 별로(ㄹ)", [josa("토끼", "으로", "로"), josa("곰", "으로", "로"), josa("별", "으로", "로")], ["토끼로", "곰으로", "별로"]);

// TOWN-09 펫 레벨 (동물마다 경험치 크기가 다르다)
const chick = { growExp: 60, maxLevel: 5 };
const lamb = { growExp: 220, maxLevel: 10 };
expect("병아리 레벨별 누적 성장치", [1, 2, 3, 4, 5].map((l) => petLevelExp(l, chick.growExp, chick.maxLevel)), [0, 9, 23, 40, 60]);
expect("성장 0 → Lv.1", petLevel(0, 60, 5), 1);
expect("병아리 성장 8 → Lv.1, 9 → Lv.2", [petLevel(8, 60, 5), petLevel(9, 60, 5)], [1, 2]);
expect("다 자라는 성장치에서 최고 레벨", [petLevel(60, 60, 5), petLevel(220, 220, 10), petLevel(999, 160, 8)], [5, 10, 8]);
expect("다 자라기 1 전에는 최고 레벨 아님", [petLevel(59, 60, 5), petLevel(219, 220, 10)], [4, 9]);
for (const sp of [chick, { growExp: 90, maxLevel: 6 }, { growExp: 120, maxLevel: 7 }, { growExp: 160, maxLevel: 8 }, lamb]) {
  const steps = Array.from({ length: sp.maxLevel - 1 }, (_, i) => petLevelExp(i + 2, sp.growExp, sp.maxLevel) - petLevelExp(i + 1, sp.growExp, sp.maxLevel));
  expect(`성장 ${sp.growExp}/Lv.${sp.maxLevel}: 한 레벨 경험치가 0보다 크고 점점 커진다`, steps.every((d, i) => d > 0 && (i === 0 || d >= steps[i - 1])), true);
}
expect("종류마다 Lv.1→2 경험치가 다르다 (병아리 vs 아기 양)", petLevelExp(2, 60, 5) !== petLevelExp(2, 220, 10), true);
expect("진행 막대: 병아리 성장 15 → Lv.2, 6 / 14", [petLevelProgress(15, 60, 5).level, petLevelProgress(15, 60, 5).current, petLevelProgress(15, 60, 5).needed], [2, 6, 14]);
expect("진행 막대: 다 자람 → MAX", [petLevelProgress(60, 60, 5).isMax, petLevelProgress(60, 60, 5).ratio], [true, 1]);
expect("펫 이름: 앞뒤 공백 정리", cleanPetName("  콩이  "), "콩이");
expect("펫 이름: 10자 OK, 11자 NO, 빈칸 NO", [cleanPetName("가나다라마바사아자차"), cleanPetName("가나다라마바사아자차카"), cleanPetName("   ")], ["가나다라마바사아자차", null, null]);

if (failed) process.exit(1);
