// 초대 코드(GAME-09)·검색어(BLOG-07)·지붕 색(TOWN-07) 규칙 테스트
// 실행: npm run test:rules
import { generateInviteCode, INVITE_ALPHABET, INVITE_CODE_RE, inviteLink, normalizeInviteCode } from "../src/lib/invite";
import { likePattern, parseSearchQuery } from "../src/lib/search";
import { ROOF_COLORS, roofHex } from "../src/lib/art/town";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// ── 초대 코드 ──
expect("글자 32개, 0·O·1·I 없음", [INVITE_ALPHABET.length, /[0O1I]/.test(INVITE_ALPHABET)], [32, false]);
const codes = Array.from({ length: 2000 }, () => generateInviteCode());
expect("만든 코드 2000개가 모두 6자리 규칙", codes.every((c) => INVITE_CODE_RE.test(c)), true);
expect("만든 코드에 0·O·1·I 없음", codes.some((c) => /[0O1I]/.test(c)), false);
expect("바이트 0 → A, 31 → 9", generateInviteCode(() => new Uint8Array([0, 31, 32, 63, 255, 8])), "A9A99J");
expect("소문자 입력 → 대문자", normalizeInviteCode("abc234"), "ABC234");
expect("앞뒤 공백 제거", normalizeInviteCode("  ABC234 "), "ABC234");
expect("빈 칸 → 초대 없음(\"\")", normalizeInviteCode("   "), "");
expect("없음(null) → \"\"", normalizeInviteCode(null), "");
expect("O(오) 포함 → null", normalizeInviteCode("ABCDE0"), null);
expect("I 포함 → null", normalizeInviteCode("ABCDEI"), null);
expect("5자리 → null", normalizeInviteCode("ABCDE"), null);
expect("7자리 → null", normalizeInviteCode("ABCDEFG"), null);
expect("초대 링크", inviteLink("http://localhost:3100", "ABC234"), "http://localhost:3100/?invite=ABC234");

// ── 검색어 ──
expect("q 없음 → 검색하지 않음", parseSearchQuery(undefined), { kind: "none" });
expect("공백만 → 검색어를 입력해 주세요", parseSearchQuery("   "), { kind: "empty" });
expect("앞뒤 공백 제거", parseSearchQuery("  고양이 "), { kind: "ok", q: "고양이" });
expect("50자 → 검색", parseSearchQuery("가".repeat(50)).kind, "ok");
expect("51자 → 검색하지 않음 (오류 없이)", parseSearchQuery("가".repeat(51)), { kind: "none" });
expect("배열이면 첫 값", parseSearchQuery(["a", "b"]), { kind: "ok", q: "a" });
expect("LIKE 특수 글자는 그대로 찾기", likePattern("50%_a\\b"), "%50\\%\\_a\\\\b%");

// ── 지붕 색 ──
expect("지붕 색 8가지", Object.keys(ROOF_COLORS), ["red", "orange", "yellow", "green", "sky", "blue", "purple", "brown"]);
expect("고른 색이 있으면 그 색", roofHex("sky", "bg.meadow"), ROOF_COLORS.sky.hex);
expect("고르지 않으면 배경 색 (초원)", roofHex(null, "bg.meadow"), "#2f855a");
expect("목록에 없는 값이면 배경 색", roofHex("pink", "bg.meadow"), "#2f855a");

if (failed) process.exit(1);
