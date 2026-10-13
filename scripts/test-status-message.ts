// 상태 메시지 이모티콘 검사 테스트 (TOWN-12, 광장 말풍선에서 이모티콘이 깨지는 문제)
// 실행: npm run test:status-message
import { hasEmoji, stripEmoji } from "../src/lib/status-message";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

expect("그림 이모티콘 🎸 → 막음", hasEmoji("기타 연습 🎸"), true);
expect("💕 → 막음", hasEmoji("私のATMさん💕"), true);
expect("빨간 하트 ❤️(그림 표시) → 막음", hasEmoji("❤️"), true);
expect("가족(이음 글자) → 막음", hasEmoji("👨‍👩‍👧"), true);
expect("피부색 👍🏽 → 막음", hasEmoji("👍🏽"), true);
expect("국기 🇰🇷 → 막음", hasEmoji("🇰🇷"), true);
expect("키캡 1️⃣ → 막음", hasEmoji("1️⃣"), true);
expect("한국어 → 통과", hasEmoji("광장에서 만나요 ㅋㅋ ㅠㅠ"), false);
expect("일본어·전각 기호 → 통과", hasEmoji("今日もいい天気！"), false);
expect("글자 기호 ♥ ♪ ★ ☆ → 통과", hasEmoji("하트♥ 노래♪ ★☆"), false);
expect("얼굴 문자 (^o^) → 통과", hasEmoji("~(^o^)~"), false);

expect("이모티콘만 빼고 남긴다", stripEmoji("こんにちは、私のATMさん💕"), "こんにちは、私のATMさん");
expect("가운데 이모티콘 뒤 공백 정리", stripEmoji("기타 🎸 연습"), "기타 연습");
expect("이모티콘뿐이면 null", stripEmoji("👨‍👩‍👧 🇰🇷"), null);
expect("null → null", stripEmoji(null), null);

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
