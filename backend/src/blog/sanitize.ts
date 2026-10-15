// 글 HTML 정화 (글쓰기 API가 저장 전에, 화면이 보여 주기 전에 쓴다). 허용 태그를 늘리면 화면의 에디터(frontend/src/components/editor)도 같이 고친다
import sanitizeHtml from "sanitize-html";
import { ATTACHMENT_URL_RE, extensionOf, fileCardLabelKo as fileCardLabel, formatBytes } from "../attachments/rules";

/** 저장할 때 확인한 첨부 정보 (키 → DB의 원래 이름·크기·종류) */
export type KnownAttachments = Map<string, { kind: "image" | "file"; name: string; size: number }>;

// 에디터의 정렬·줄 간격·글자 크기·글자색·배경색만 style로 남긴다. 값 모양을 좁게 잡아 url(), expression() 같은 것은 들어올 수 없다
const COLOR_RE = [/^#[0-9a-f]{3}([0-9a-f]{3})?$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i];
// 줄 간격은 에디터 목록(frontend/src/components/editor/line-height.ts)의 값만
const ALIGN_STYLE = { "text-align": [/^(left|center|right)$/], "line-height": [/^(1(\.0)?|1\.2|1\.4|1\.6|1\.8|2\.2|2\.6)$/] };
const CELL_STYLE = { "text-align": [/^(left|center|right)$/] };
const SPAN_STYLE = { "font-size": [/^([89]|[1-6]\d|7[0-2])px$/], color: COLOR_RE, "background-color": COLOR_RE };

const attachmentKey = (url: string | undefined) => ATTACHMENT_URL_RE.exec(url ?? "")?.[1] ?? null;

function cellSpans(tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const out = { ...attribs };
  for (const key of ["colspan", "rowspan"]) {
    const n = Number(out[key]);
    if (Number.isInteger(n) && n > 1 && n <= 50) out[key] = String(n);
    else delete out[key];
  }
  return { tagName, attribs: out };
}

// 에디터가 만들 수 있는 태그만 허용한다. <script>, onClick 같은 속성은 모두 제거된다 (XSS 방지)
function options(known?: KnownAttachments): sanitizeHtml.IOptions {
  return {
    allowedTags: [
      "p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "code", "pre", "span",
      "blockquote", "ul", "ol", "li", "a", "hr", "img", "div",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "data-mention", "data-file", "data-name", "data-size", "data-size-label", "data-ext", "aria-label"],
      img: ["src", "alt"],
      div: ["data-slider", "data-row"], // 사진 슬라이드 <div data-slider>, 나란히 놓기 <div data-row> (에디터의 image-slider.ts)
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      span: ["style"],
      th: ["colspan", "rowspan", "style"],
      td: ["colspan", "rowspan", "style"],
    },
    allowedStyles: { p: ALIGN_STYLE, h1: ALIGN_STYLE, h2: ALIGN_STYLE, h3: ALIGN_STYLE, span: SPAN_STYLE, th: CELL_STYLE, td: CELL_STYLE },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // 사진 슬라이드·나란히 놓기가 아닌 div(표 스크롤 상자 등)는 허용하지 않는 이름으로 바꿔 껍데기만 빼고 안은 남긴다
      div: (tagName, attribs): sanitizeHtml.Tag =>
        "data-slider" in attribs || "data-row" in attribs ? { tagName, attribs } : { tagName: "unwrap", attribs: {} },
      // 표 칸 합치기 (colspan·rowspan)는 1~50 숫자만
      th: cellSpans,
      td: cellSpans,
      a: (tagName, attribs): sanitizeHtml.Tag => {
        // 파일 카드 (POST-09): 이름·크기는 요청에 적힌 값 대신 DB 값을 쓴다
        if ("data-file" in attribs) {
          const info = known?.get(attachmentKey(attribs.href) ?? "");
          const name = info?.name ?? attribs["data-name"] ?? "";
          const size = info?.size ?? (Number(attribs["data-size"]) || 0);
          return {
            tagName,
            attribs: {
              href: attribs.href ?? "",
              "data-file": "",
              "data-name": name,
              "data-size": String(size),
              "data-size-label": formatBytes(size),
              "data-ext": extensionOf(name),
              "aria-label": fileCardLabel(name, size),
            },
          };
        }
        // @주소 언급 (backend/src/blog/mentions.ts): 우리 블로그로 가는 링크라 같은 탭에서
        if ("data-mention" in attribs && /^\/@[a-z0-9_]{3,20}$/.test(attribs.href ?? "")) {
          return { tagName, attribs: { href: attribs.href!, "data-mention": "" } };
        }
        // 외부 링크는 새 탭으로, 원래 페이지에 접근하지 못하게
        return { tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } };
      },
    },
    // 사진·파일 카드는 우리 저장소 주소(/files/키)만 남긴다. 저장할 때는 DB에 있는 첨부만 (POST-07)
    exclusiveFilter: (frame) => {
      const isImage = frame.tag === "img";
      const isFileCard = frame.tag === "a" && "data-file" in frame.attribs;
      if (!isImage && !isFileCard) return false;
      const key = attachmentKey(isImage ? frame.attribs.src : frame.attribs.href);
      if (!key) return true;
      if (!known) return false;
      const info = known.get(key);
      return !info || info.kind !== (isImage ? "image" : "file");
    },
  };
}

/**
 * 글 HTML 정화. known을 주면 그 첨부만 남기고 파일 카드의 이름·크기를 DB 값으로 맞춘다 (savePost).
 * known 없이 부르면 주소 형식만 확인한다
 */
export function sanitizePostHtml(html: string, known?: KnownAttachments): string {
  return wrapTables(relaxNbsp(sanitizeHtml(html, options(known))));
}

/**
 * 낱말 사이 줄이 안 바뀌는 공백(nbsp)을 보통 띄어쓰기로 바꾼다.
 * 한글 입력기나 붙여 넣기로 들어온 nbsp는 그 앞뒤 낱말을 한 덩어리로 묶어, 읽는 화면(keep-all)에서 줄이 안 바뀌고 칸 밖으로 넘친다.
 * 공백이 둘 이상 이어진 곳(일부러 띄운 칸)과 태그 바로 앞뒤는 그대로 둔다. 저장할 때와 예전 글을 보여 줄 때 모두 쓴다
 */
export function relaxNbsp(html: string): string {
  return html.replace(/(?<=[^\s<>;])(?:\u00a0|&nbsp;|&#160;|&#xa0;)(?=[^\s<>&])/gi, " ");
}

/**
 * 표마다 가로 스크롤 상자(div.table-scroll)로 감싼다. 휴대폰에서 넓은 표가 본문 칸을 밀어내지 않고 표만 옆으로 밀린다.
 * 상자 div는 정화에서 허용하지 않아 먼저 빠지므로, 이미 정화한 글을 다시 정화해도 상자가 겹치지 않는다.
 * 에디터는 이 div를 무시하고 표만 읽는다
 */
function wrapTables(html: string): string {
  return html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, "</table></div>");
}

/** HTML 안의 첨부 키 (/files/키) */
export function attachmentKeysIn(html: string): string[] {
  return [...new Set([...html.matchAll(/\/files\/([a-f0-9]{32})/g)].map((m) => m[1]))];
}

/** 태그를 뺀 순수 글자: 요약, 검색, 보상 글자 수 확인용 */
export function htmlToText(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|h[1-3]|li|blockquote|pre)>/g, "\n$&"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function excerpt(text: string, length = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}
