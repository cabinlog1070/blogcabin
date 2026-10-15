// @주소 언급: 글자·글 HTML에서 언급을 찾고 블로그 링크로 바꾸는 규칙 (backend/src/blog/mention-text.ts)
// 실행: npm run test:mentions
import { sanitizePostHtml } from "../../backend/src/blog/sanitize";
import { linkMentions, mentionsIn, mentionsInHtml, splitMentions } from "../../backend/src/blog/mention-text";

let bad = false;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad = true;
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (기대 ${JSON.stringify(want)})`}`);
}

expect("글자 속 언급", mentionsIn("안녕 @jiwon, 그리고 @cabin_1!"), ["jiwon", "cabin_1"]);
expect("맨 앞·줄바꿈 뒤", mentionsIn("@abc\n@def"), ["abc", "def"]);
expect("한글 바로 뒤", mentionsIn("고마워요@jiwon"), ["jiwon"]);
expect("메일 주소는 아님", mentionsIn("a@jiwon.com 메일"), []);
expect("주소 안 /@는 아님", mentionsIn("blogcabin.java21.net/@jiwon"), []);
expect("짧거나 대문자로 이어지면 아님", mentionsIn("@ab @Jiwon @jiwonA"), []);
expect("겹치면 한 번", mentionsIn("@abc @abc"), ["abc"]);
expect("나누기", splitMentions("hi @abc!"), ["hi ", "abc", "!"]);
expect("언급 없으면 그대로", splitMentions("그냥 글"), ["그냥 글"]);

const known = new Set(["jiwon"]);
const html = sanitizePostHtml('<p>@jiwon 님, @nobody 님 <strong>@jiwon</strong></p><pre><code>@jiwon</code></pre><p><a href="https://x.com">@jiwon</a></p>');
const linked = linkMentions(html, known);
expect(
  "있는 주소만 링크, 코드·링크 안은 그대로",
  linked,
  '<p><a href="/@jiwon" data-mention>@jiwon</a> 님, @nobody 님 <strong><a href="/@jiwon" data-mention>@jiwon</a></strong></p>' +
    '<pre><code>@jiwon</code></pre><p><a href="https://x.com" target="_blank" rel="noopener noreferrer nofollow">@jiwon</a></p>',
);
expect("HTML 속 후보", mentionsInHtml(html), ["jiwon", "nobody"]);
expect("다시 정화해도 같은 링크 (새 탭 아님)", sanitizePostHtml(linked), linked);
expect("다시 저장해도 겹치지 않음", linkMentions(sanitizePostHtml(linked), known), linked);
expect("블로그가 없어지면 글자로", linkMentions(linked, new Set()), html);
// 에디터가 data-mention을 빼고 돌려줘도 다시 언급 링크가 된다
const fromEditor = sanitizePostHtml('<p><a href="/@jiwon" target="_blank">@jiwon</a></p>');
expect("에디터에서 돌아온 링크", linkMentions(fromEditor, known), '<p><a href="/@jiwon" data-mention>@jiwon</a></p>');
expect("언급처럼 꾸민 바깥 링크는 막음", sanitizePostHtml('<a href="javascript:alert(1)" data-mention>@x</a>').includes("javascript"), false);

if (bad) process.exit(1);
