"use client";
// 글 번역 (POST-10): 글이 지금 화면 언어와 다른 말이면 본문 위에 번역 버튼을 띄운다.
// - 브라우저 번역 기능(Chrome Translator API)이 있으면 이 자리에서 제목·본문을 번역하고 원문과 오갈 수 있다
// - 없으면(사파리·휴대폰 등) 파파고 웹사이트를 새 탭으로 연다
// 번역은 주민의 기기·파파고에서 하고 서버는 관여하지 않는다. 원문은 DB에 그대로 있다.
import { createContext, useContext, useEffect, useState } from "react";
import { PostSliders } from "@/components/blog/post-sliders";
import { useLocale, useT } from "@/components/i18n";
import type { Locale } from "@/lib/i18n";
import { papagoUrl } from "@/lib/translate";

// Chrome 138+ 데스크톱의 브라우저 내장 번역 (타입이 아직 TypeScript에 없다)
type BrowserTranslator = { translate(text: string): Promise<string>; destroy?(): void };
type TranslatorAvailability = "unavailable" | "downloadable" | "downloading" | "available";
type TranslatorStatic = {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorAvailability>;
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<BrowserTranslator>;
};
const browserTranslator = () =>
  typeof window === "undefined" ? undefined : (window as unknown as { Translator?: TranslatorStatic }).Translator;

type State =
  | { kind: "idle" }
  | { kind: "working"; progress: number | null }
  | { kind: "done"; title: string; html: string; showing: "translated" | "original" }
  | { kind: "failed" };

type Ctx = {
  from: Locale;
  to: Locale;
  title: string;
  html: string;
  text: string;
  state: State;
  setState: (s: State) => void;
};
const TranslateContext = createContext<Ctx | null>(null);

export function PostTranslateProvider({
  from,
  title,
  html,
  text,
  children,
}: {
  /** 글이 쓰인 말 (detectPostLanguage). 화면 언어와 같거나 모르면 null: 번역 버튼을 띄우지 않는다 */
  from: Locale | null;
  title: string;
  html: string;
  text: string;
  children: React.ReactNode;
}) {
  const to = useLocale();
  const [state, setState] = useState<State>({ kind: "idle" });
  const value = from && from !== to ? { from, to, title, html, text, state, setState } : null;
  return <TranslateContext.Provider value={value}>{children}</TranslateContext.Provider>;
}

const shown = (ctx: Ctx | null) => (ctx?.state.kind === "done" && ctx.state.showing === "translated" ? ctx.state : null);

export function PostTitle({ title }: { title: string }) {
  const done = shown(useContext(TranslateContext));
  return (
    <h1 className="font-display text-3xl leading-snug sm:text-4xl">
      {done ? done.title : title}
    </h1>
  );
}

export function PostBody({ html }: { html: string }) {
  const done = shown(useContext(TranslateContext));
  // 저장할 때 sanitize-html로 정화한 HTML만 넣는다. 번역본은 그 HTML의 글자만 바꾼 것이다
  return (
    <>
      <div className="prose-blog mt-6" data-post-body dangerouslySetInnerHTML={{ __html: lazyImages(done ? done.html : html) }} />
      {/* 원문·번역을 바꾸면 본문 HTML이 새로 들어가므로, 슬라이드 화살표도 새로 붙인다 */}
      <PostSliders key={done ? "translated" : "original"} />
    </>
  );
}

/**
 * 글 사진은 화면 가까이 왔을 때 받는다 (2026-10-15, 휴대폰에서 사진이 늦게 뜬다는 제보).
 * 아래쪽 사진이 위쪽 사진과 데이터를 나눠 쓰지 않아 처음 보이는 사진이 먼저 뜬다. 맨 위 두 장은 바로 받는다
 */
export function lazyImages(html: string) {
  let n = 0;
  return html.replace(/<img\b/g, (tag) => (n++ < 2 ? `${tag} decoding="async"` : `${tag} loading="lazy" decoding="async"`));
}

/** 본문 위 번역 줄 */
export function TranslateBar() {
  const ctx = useContext(TranslateContext);
  const t = useT();
  // 브라우저 번역을 쓸 수 있는지는 화면이 뜬 뒤에야 안다 (서버에서는 모른다)
  const [inBrowser, setInBrowser] = useState<boolean | null>(null);
  useEffect(() => {
    if (!ctx) return;
    const api = browserTranslator();
    Promise.resolve(api ? api.availability({ sourceLanguage: ctx.from, targetLanguage: ctx.to }) : "unavailable")
      .then((a) => setInBrowser(a !== "unavailable"))
      .catch(() => setInBrowser(false));
  }, [ctx?.from, ctx?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ctx) return null;
  const { from, to, state, setState } = ctx;
  const fromName = from === "ja" ? t("일본어") : t("한국어");
  const toName = to === "ja" ? t("일본어") : t("한국어");
  const papago = papagoUrl(from, to, `${ctx.title}\n\n${ctx.text}`);

  const run = async () => {
    const api = browserTranslator();
    if (!api) return;
    setState({ kind: "working", progress: null });
    try {
      // 처음 한 번은 번역 모델을 내려받는다 (버튼을 누른 그 순간에 시작해야 브라우저가 허락한다)
      const translator = await api.create({
        sourceLanguage: from,
        targetLanguage: to,
        monitor(m) {
          m.addEventListener("downloadprogress", (e) => {
            const loaded = (e as Event & { loaded?: number }).loaded;
            if (typeof loaded === "number") setState({ kind: "working", progress: Math.round(loaded * 100) });
          });
        },
      });
      setState({ kind: "working", progress: null });
      const [title, html] = await Promise.all([translator.translate(ctx.title), translateHtml(ctx.html, (s) => translator.translate(s))]);
      translator.destroy?.();
      setState({ kind: "done", title, html, showing: "translated" });
    } catch {
      setState({ kind: "failed" });
    }
  };

  return (
    <div data-translate-bar className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-cream px-4 py-2 text-sm text-ink-soft">
      {state.kind === "done" ? (
        <>
          <span>
            {state.showing === "translated"
              ? t("🌐 {from}로 쓴 글을 {to}로 번역했어요 (자동 번역)", { from: fromName, to: toName })
              : t("🌐 원문을 보고 있어요")}
          </span>
          <button
            type="button"
            className="font-bold text-leaf-dark underline-offset-2 hover:underline"
            onClick={() => setState({ ...state, showing: state.showing === "translated" ? "original" : "translated" })}
          >
            {state.showing === "translated" ? t("원문 보기") : t("번역 보기")}
          </button>
        </>
      ) : state.kind === "working" ? (
        <span aria-live="polite">
          {state.progress !== null && state.progress < 100
            ? t("🌐 번역 준비 중… {p}%", { p: state.progress })
            : t("🌐 번역하는 중…")}
        </span>
      ) : (
        <>
          <span>{t("🌐 {from}로 쓴 글이에요", { from: fromName })}</span>
          {inBrowser && state.kind !== "failed" ? (
            <button type="button" className="font-bold text-leaf-dark underline-offset-2 hover:underline" onClick={run}>
              {t("{to}로 번역하기", { to: toName })}
            </button>
          ) : inBrowser === false || state.kind === "failed" ? (
            <a
              href={papago}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-leaf-dark underline-offset-2 hover:underline"
            >
              {t("파파고로 번역하기 ↗")}
            </a>
          ) : null}
          {state.kind === "failed" && <span className="text-berry">{t("이 브라우저에서 번역하지 못했어요")}</span>}
        </>
      )}
    </div>
  );
}

const BLOCKS = "p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,figcaption,pre";
// 이것만 들어 있는 문단은 문단 글자를 통째로 번역한다 (굵게·기울임은 번역본에서 빠진다)
const PLAIN_INLINE = new Set(["B", "STRONG", "I", "EM", "U", "S", "SPAN", "MARK", "CODE", "BR"]);

/**
 * 글 HTML의 글자만 번역한다. 태그·속성은 손대지 않으므로 정화한 HTML 그대로 안전하다.
 * 문단 단위로 번역해야 문장이 자연스러워서, 링크·사진이 없는 문단은 통째로, 있는 문단은 글자 조각마다 번역한다.
 */
async function translateHtml(html: string, tr: (s: string) => Promise<string>) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const leaves = [...root.querySelectorAll<HTMLElement>(BLOCKS)].filter((el) => !el.querySelector(BLOCKS));
  const jobs: Promise<void>[] = [];
  const textNodes = (el: Node) => {
    const out: Text[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) out.push(walker.currentNode as Text);
    return out;
  };
  const one = (node: Text) => {
    const s = node.data;
    if (!s.trim()) return;
    jobs.push(tr(s).then((r) => void (node.data = r)));
  };
  for (const el of leaves) {
    if (!el.textContent?.trim()) continue;
    const plain = [...el.querySelectorAll("*")].every((c) => PLAIN_INLINE.has(c.tagName));
    if (plain && el.tagName !== "PRE") {
      // 줄바꿈(<br>)은 살린다
      const lines = textOfBlock(el);
      jobs.push(
        Promise.all(lines.map((l) => (l.trim() ? tr(l) : Promise.resolve(l)))).then((out) => {
          el.replaceChildren();
          out.forEach((l, i) => {
            if (i > 0) el.append(document.createElement("br"));
            el.append(l);
          });
        }),
      );
    } else {
      textNodes(el).forEach(one);
    }
  }
  // 문단 밖에 바로 놓인 글자 (드물다)
  const inLeaves = (n: Node) => leaves.some((el) => el.contains(n));
  textNodes(root)
    .filter((n) => !inLeaves(n))
    .forEach(one);
  await Promise.all(jobs);
  return root.innerHTML;
}

/** 문단 글자를 <br> 기준으로 나눈다 */
function textOfBlock(el: HTMLElement) {
  const lines = [""];
  const walk = (n: Node) => {
    for (const c of n.childNodes) {
      if (c.nodeType === Node.TEXT_NODE) lines[lines.length - 1] += (c as Text).data;
      else if ((c as Element).tagName === "BR") lines.push("");
      else walk(c);
    }
  };
  walk(el);
  return lines;
}
