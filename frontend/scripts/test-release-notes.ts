// 릴리스 노트 데이터 검사: 날짜 형식, 최신이 위, 같은 날 묶음은 하나, 빈 묶음 없음,
// 화면 사진은 public/release-notes/<그 버전>/ 아래에 실제로 있고 설명(alt)이 있다,
// 버전 번호 형식·겹침 없음·최신이 위(새 기능이 있으면 가운데 숫자를, 아니면 끝 숫자를 올린다)
// 실행: npm run test:release-notes
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RELEASE_NOTES } from "../src/lib/release-notes";

let failed = 0;
function expect(name: string, ok: boolean) {
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
}

const parse = (v: string) => v.split(".").map(Number);

expect("릴리스 노트가 하나 이상 있다", RELEASE_NOTES.length > 0);
for (const day of RELEASE_NOTES) {
  expect(`${day.date}: 날짜가 YYYY-MM-DD`, /^\d{4}-\d{2}-\d{2}$/.test(day.date) && !Number.isNaN(Date.parse(day.date)));
  expect(`${day.date}: 버전이 하나 이상 있다`, day.versions.length > 0);
  for (const v of day.versions) {
    expect(`v${v.version}: 번호가 1.2.3 모양`, /^\d+\.\d+\.\d+$/.test(v.version));
    expect(`v${v.version}: 제목과 바뀐 점이 있다`, v.title.trim().length > 0 && v.changes.length > 0 && v.changes.every((c) => c.text.trim().length > 0));
    for (const img of v.changes.flatMap((c) => c.images ?? [])) {
      for (const src of [img.src, img.before].filter((s): s is string => !!s)) {
        const ok = src.startsWith(`/release-notes/${v.version}/`) && /\.(webp|png|jpg)$/.test(src) && existsSync(join("public", src));
        expect(`v${v.version}: 사진 ${src}이 public/release-notes/${v.version}/ 에 있다`, ok);
      }
      expect(`v${v.version}: 사진 ${img.src}에 설명이 있다`, img.alt.trim().length > 0);
    }
  }
}
const dates = RELEASE_NOTES.map((d) => d.date);
expect("최신 날짜가 맨 위, 같은 날은 한 묶음", dates.every((d, i) => i === 0 || dates[i - 1] > d));
const all = RELEASE_NOTES.flatMap((d) => d.versions);
expect("같은 버전 번호가 두 번 없다", new Set(all.map((v) => v.version)).size === all.length);
const texts = all.flatMap((v) => v.changes.map((c) => c.text));
expect("같은 문장이 두 번 없다", new Set(texts).size === texts.length);
// 위(새 버전)와 바로 아래(앞 버전)를 비교한다
for (let i = 0; i + 1 < all.length; i++) {
  const [now, prev] = [parse(all[i].version), parse(all[i + 1].version)];
  const hasNew = all[i].changes.some((c) => c.kind === "new");
  const ok = hasNew
    ? (now[0] === prev[0] && now[1] === prev[1] + 1 && now[2] === 0) || (now[0] === prev[0] + 1 && now[1] === 0 && now[2] === 0)
    : now[0] === prev[0] && now[1] === prev[1] && now[2] === prev[2] + 1;
  expect(`v${all[i].version}: v${all[i + 1].version} 다음 번호 (${hasNew ? "새 기능 → 가운데 숫자" : "끝 숫자"})`, ok);
}

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
