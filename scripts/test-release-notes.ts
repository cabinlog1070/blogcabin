// 릴리스 노트 데이터 검사: 날짜 형식, 최신이 위, 같은 날 묶음은 하나, 빈 묶음 없음
// 실행: npm run test:release-notes
import { RELEASE_NOTES } from "../src/lib/release-notes";

let failed = 0;
function expect(name: string, ok: boolean) {
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
}

expect("릴리스 노트가 하나 이상 있다", RELEASE_NOTES.length > 0);
for (const n of RELEASE_NOTES) {
  expect(`${n.date}: 날짜가 YYYY-MM-DD`, /^\d{4}-\d{2}-\d{2}$/.test(n.date) && !Number.isNaN(Date.parse(n.date)));
  expect(`${n.date}: 제목과 바뀐 점이 있다`, n.title.trim().length > 0 && n.changes.length > 0 && n.changes.every((c) => c.text.trim().length > 0));
  expect(`${n.date}: 같은 문장이 두 번 없다`, new Set(n.changes.map((c) => c.text)).size === n.changes.length);
}
const dates = RELEASE_NOTES.map((n) => n.date);
expect("최신 날짜가 맨 위", dates.every((d, i) => i === 0 || dates[i - 1] > d));

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
