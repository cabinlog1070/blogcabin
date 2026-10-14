// NF-03: 글 HTML 정화가 XSS 공격 문자열을 제거하는지 확인한다
// 실행: npm run test:sanitize
import { relaxNbsp, sanitizePostHtml } from "../src/server/sanitize";
// 글쓰기 화면 글자 수가 서버 보상 판단과 같은지도 함께 확인한다 (#18)
import "./test-text-length";
const cases = {
  script: '<p>안녕</p><script>alert(1)</script>',
  onerror: '<p><img src=x onerror="alert(1)">사진</p>',
  jsLink: '<p><a href="javascript:alert(1)">눌러</a></p>',
  onclick: '<p onclick="alert(1)">클릭</p>',
  iframe: '<iframe src="https://evil.example"></iframe><p>본문</p>',
  styleTag: '<style>body{display:none}</style><p>본문</p>',
  normal: '<h2>제목</h2><p><strong>굵게</strong> <a href="https://example.com">링크</a></p><pre><code>code</code></pre>',
};
for (const [name, html] of Object.entries(cases)) {
  const out = sanitizePostHtml(html);
  const bad = /<script|onerror|onclick|javascript:|<iframe|<style/i.test(out);
  console.log(`${bad ? "❌" : "✅"} ${name.padEnd(9)} → ${out}`);
}
const failed = Object.values(cases).some((html) => /<script|onerror|onclick|javascript:|<iframe|<style/i.test(sanitizePostHtml(html)));
if (failed) process.exit(1);

// POST-07·POST-09: 사진·파일 카드는 우리 저장소 주소(/files/키)만 남는다
{
  const KEY = "0123456789abcdef0123456789abcdef";
  const OTHER = "fedcba9876543210fedcba9876543210";
  const known = new Map([
    [KEY, { kind: "image" as const, name: "사진.png", size: 2048 }],
    [OTHER, { kind: "file" as const, name: "보고서 최종.pdf", size: 1258291 }],
  ]);
  let bad = 0;
  const expect = (name: string, got: string, ok: boolean) => {
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${name.padEnd(22)} → ${got}`);
  };
  const s = (html: string) => sanitizePostHtml(html, known);

  let out = s(`<img src="/files/${KEY}" alt="고양이" onerror="alert(1)">`);
  expect("우리 사진 남김", out, out === `<img src="/files/${KEY}" alt="고양이" />`);
  out = s('<img src="https://evil.example/x.png">');
  expect("다른 사이트 사진 뺌", out, out === "");
  out = s('<img src="data:image/png;base64,AAAA">');
  expect("data: 사진 뺌", out, out === "");
  out = s('<img src="javascript:alert(1)">');
  expect("javascript: 사진 뺌", out, out === "");
  out = s(`<img src="/files/${"a".repeat(32)}">`);
  expect("DB에 없는 사진 뺌", out, out === "");
  out = s(`<img src="/files/${OTHER}">`);
  expect("파일을 사진으로 쓰면 뺌", out, out === "");
  out = s(`<a href="/files/${OTHER}" data-file="" data-name="가짜.exe" data-size="1" onclick="x()"></a>`);
  expect(
    "파일 카드: DB 이름·크기",
    out,
    out.includes('data-name="보고서 최종.pdf"') && out.includes('data-size="1258291"') && out.includes('data-size-label="1.2MB"') &&
      out.includes('data-ext="pdf"') && out.includes('aria-label="보고서 최종.pdf 내려받기 (1.2MB)"') && !out.includes("onclick") && !out.includes("target"),
  );
  out = s(`<a href="/files/${"c".repeat(32)}" data-file="" data-name="없는파일.pdf"></a>`);
  expect("DB에 없는 파일 카드 뺌", out, out === "");
  out = s('<a href="https://evil.example/x.pdf" data-file="" data-name="x.pdf"></a>');
  expect("다른 주소 파일 카드 뺌", out, out === "");
  out = s('<p><a href="https://example.com">링크</a></p>');
  expect("보통 링크는 새 탭", out, out.includes('target="_blank"') && out.includes('rel="noopener noreferrer nofollow"'));
  out = s(`<div data-slider="" data-label="🎞" style="x" onclick="x()"><img src="/files/${KEY}" alt=""><img src="https://evil.example/x.png"></div>`);
  expect("사진 슬라이드 남김", out, out === `<div data-slider><img src="/files/${KEY}" alt="" /></div>`);
  out = s(`<div data-row="" data-label="▥" class="x"><img src="/files/${KEY}" alt=""><img src="/files/${KEY}" alt=""></div>`);
  expect("사진 나란히 남김", out, out === `<div data-row><img src="/files/${KEY}" alt="" /><img src="/files/${KEY}" alt="" /></div>`);
  out = sanitizePostHtml(`<img src="/files/${"b".repeat(32)}">`);
  expect("known 없으면 형식만 확인", out, out === `<img src="/files/${"b".repeat(32)}" />`);
  if (bad) process.exit(1);
}

// 글쓰기 툴바: 정렬·글자 크기·글자색·배경색은 남기고, 그 밖의 style은 지운다
{
  let bad = 0;
  const expect = (name: string, got: string, ok: boolean) => {
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${name.padEnd(22)} → ${got}`);
  };
  let out = sanitizePostHtml('<p style="text-align: center">가운데</p><h2 style="text-align: right">제목</h2>');
  expect("정렬 남김", out, out === '<p style="text-align:center">가운데</p><h2 style="text-align:right">제목</h2>');
  out = sanitizePostHtml('<p><span style="font-size: 24px; color: #b83a29; background-color: rgb(255, 243, 191)">강조</span></p>');
  expect("크기·색 남김", out, out.includes("font-size:24px") && out.includes("color:#b83a29") && out.includes("background-color:rgb(255, 243, 191)"));
  out = sanitizePostHtml('<p style="line-height: 2.2">넓게</p><h3 style="line-height: 1.4; text-align: center">좁게</h3><p style="line-height: 9">x</p>');
  expect("줄 간격 남김", out, out === '<p style="line-height:2.2">넓게</p><h3 style="line-height:1.4;text-align:center">좁게</h3><p>x</p>');
  out = sanitizePostHtml('<p style="line-height: 1.0">아주 좁게</p>');
  expect("줄 간격 1.0 남김", out, out === '<p style="line-height:1.0">아주 좁게</p>');
  out = sanitizePostHtml('<p style="position: fixed; text-align: justify"><span style="background-color: url(javascript:alert(1)); font-size: 900px">x</span></p>');
  expect("다른 style 지움", out, !/position|justify|url|900px/.test(out));
  if (bad) process.exit(1);
}

// 낱말 사이 nbsp는 보통 띄어쓰기로 (붙여 넣거나 한글 입력기가 넣은 nbsp 때문에 읽는 화면에서 줄이 안 바뀌던 문제)
{
  let bad = 0;
  const expect = (name: string, got: string, ok: boolean) => {
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${name.padEnd(22)} → ${JSON.stringify(got)}`);
  };
  let out = sanitizePostHtml("<p>아악‼️&nbsp;까아악‼️ 아아악\u00a0끝</p>");
  expect("낱말 사이 nbsp 풀기", out, out === "<p>아악‼️ 까아악‼️ 아아악 끝</p>");
  out = sanitizePostHtml("<p>칸&nbsp;&nbsp;&nbsp;띄움</p><p>&nbsp;들여쓰기</p><p>&nbsp;</p>");
  expect("일부러 띄운 칸은 그대로", out, !out.includes("칸 ") && out.includes("\u00a0들여쓰기") && out.includes("<p>\u00a0</p>"));
  out = relaxNbsp("<p>예전&nbsp;글 A&amp;&nbsp;B</p>");
  expect("예전 글 보여 줄 때", out, out === "<p>예전 글 A&amp;&nbsp;B</p>");
  if (bad) process.exit(1);
}

// 표: 칸·제목 칸·합치기는 남기고, 표 크기 style과 colgroup은 지운 뒤 가로 스크롤 상자로 감싼다
{
  let bad = 0;
  const expect = (name: string, got: string, ok: boolean) => {
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${name.padEnd(22)} → ${got}`);
  };
  const editorHtml =
    '<table style="min-width: 75px"><colgroup><col style="min-width: 25px"><col style="min-width: 25px"></colgroup><tbody>' +
    '<tr><th colspan="1" rowspan="1"><p>이름</p></th><th><p style="text-align: center">점수</p></th></tr>' +
    '<tr><td colspan="2" style="text-align: right" onclick="alert(1)"><p>합친 칸</p></td></tr></tbody></table>';
  let out = sanitizePostHtml(editorHtml);
  expect(
    "표 남김",
    out,
    out ===
      '<div class="table-scroll"><table><tbody><tr><th><p>이름</p></th><th><p style="text-align:center">점수</p></th></tr>' +
        '<tr><td colspan="2" style="text-align:right"><p>합친 칸</p></td></tr></tbody></table></div>',
  );
  expect("다시 정화해도 상자 하나", sanitizePostHtml(out), sanitizePostHtml(out) === out);
  out = sanitizePostHtml('<table><tr><td rowspan="999" colspan="x" style="position: fixed">x</td></tr></table>');
  expect("이상한 합치기·style 지움", out, !/rowspan|colspan|position/.test(out));
  out = sanitizePostHtml('<div class="evil"><p>x</p></div>');
  expect("다른 div는 빠짐", out, out === "<p>x</p>");
  if (bad) process.exit(1);
}
