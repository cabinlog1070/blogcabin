// @주소 언급을 글자에서 찾는 규칙 (DB를 쓰지 않아 화면도 @backend/blog/mention-text로 같이 읽는다)
// 블로그 주소는 영문 소문자·숫자·_ 3~20자 (blogs_slug_check)

/** 한 글·댓글에서 알림을 보내는 언급 수 상한 (알림 도배 막기) */
export const MAX_MENTIONS = 10;

// 앞이 글자·숫자·_·@·.·/ 이면(메일 주소 a@b.com, 주소 /@abc 등) 언급이 아니다. 뒤도 주소 글자로 이어지면 아니다
export const MENTION = /(^|[^A-Za-z0-9_@./])@([a-z0-9_]{3,20})(?![A-Za-z0-9_])/g;

/** 글자 속 @주소 (나온 순서, 겹치지 않게) */
export function mentionsIn(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(MENTION)) found.add(m[2]);
  return [...found];
}

/** 링크로 바꾸지 않는 곳: 이미 링크인 글자, 코드 */
const SKIP_TAGS = new Set(["a", "code", "pre"]);
const MENTION_LINK = /<a href="\/@([a-z0-9_]{3,20})"[^>]*>@\1<\/a>/g;

/** 정화한 글 HTML을 태그와 글자 조각으로 나눠, 링크·코드 밖의 글자 조각에만 fn을 적용한다 */
function mapText(html: string, fn: (text: string) => string): string {
  const skip: string[] = [];
  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        const tag = /^<(\/?)([a-z0-9]+)/i.exec(part);
        const name = tag?.[2].toLowerCase();
        if (name && SKIP_TAGS.has(name) && !part.endsWith("/>")) {
          if (tag![1]) skip.pop();
          else skip.push(name);
        }
        return part;
      }
      return skip.length ? part : fn(part);
    })
    .join("");
}

/** 글 HTML 속 @주소 후보 (링크·코드 안은 빼고). 예전에 만든 언급 링크도 다시 본다 */
export function mentionsInHtml(html: string): string[] {
  const found = new Set<string>();
  mapText(html.replace(MENTION_LINK, "@$1"), (text) => {
    for (const slug of mentionsIn(text)) found.add(slug);
    return text;
  });
  return [...found];
}

/**
 * 정화한 글 HTML의 @주소를 블로그 링크로 바꾼다. 있는 블로그(known)만 링크가 된다.
 * 예전에 만든 언급 링크는 먼저 글자로 되돌렸다가 다시 만든다 (주소를 지우거나 바꿔도 맞게)
 */
export function linkMentions(html: string, known: Set<string>): string {
  return mapText(html.replace(MENTION_LINK, "@$1"), (text) =>
    text.replace(MENTION, (all, before: string, slug: string) =>
      known.has(slug) ? `${before}<a href="/@${slug}" data-mention>@${slug}</a>` : all,
    ),
  );
}

/** 댓글처럼 글자 그대로인 내용을 [글자, 언급 주소, 글자, …]로 나눈다. 홀수 칸이 @주소 (있는 블로그인지는 따로 확인) */
export function splitMentions(text: string): string[] {
  const parts: string[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const at = m.index! + m[1].length;
    parts.push(text.slice(last, at), m[2]);
    last = at + 1 + m[2].length;
  }
  parts.push(text.slice(last));
  return parts;
}
