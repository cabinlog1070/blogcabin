"use client";

// 글·댓글에서 @를 치면 내가 이웃한 사람(캐릭터·닉네임·@블로그주소)이 뜨는 목록 (SOC-06)
// 고르면(누르기, Enter, Tab) 친 "@글자"를 "@블로그주소 "로 바꾼다. 맞는 이웃이 없으면 목록을 닫아 그냥 칠 수 있다
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { CharacterBadge } from "@/components/character";
import { useT } from "@/components/i18n";
import { blogApi, type MentionCandidate } from "@/lib/blog-api";

/** 한 번에 보이는 이웃 수 */
const MAX_SHOWN = 8;
const POPUP_WIDTH = 280;

// 커서 바로 앞의 "@글자" (메일 주소 a@b, 주소 /@abc 처럼 앞에 글자가 붙은 @는 아니다. mention-text.ts의 MENTION과 같은 기준)
const QUERY = /(?:^|[^A-Za-z0-9_@./])@([^\s@]{0,20})$/;

/** 커서 앞 글자에서 지금 치고 있는 @언급 (없으면 null) */
export function mentionQueryAt(textBefore: string): string | null {
  return QUERY.exec(textBefore)?.[1] ?? null;
}

// 이웃 목록은 화면에서 처음 @를 칠 때 한 번만 받는다
let neighborsCache: Promise<MentionCandidate[]> | null = null;
function loadNeighbors() {
  neighborsCache ??= blogApi.myNeighbors().then(
    (r) => r.neighbors,
    () => {
      neighborsCache = null; // 실패하면 다음 @에서 다시
      return [];
    },
  );
  return neighborsCache;
}

function matches(list: MentionCandidate[], query: string) {
  const q = query.toLowerCase();
  return list.filter((n) => n.slug.startsWith(q) || n.nickname.toLowerCase().includes(q)).slice(0, MAX_SHOWN);
}

/** x·y: 커서 바로 아래(감싼 상자 기준), width: 감싼 상자 폭 */
type Place = { x: number; y: number; width: number };
type Open = { query: string } & Place;

/**
 * @ 목록 상태. 입력칸이 커서 앞 글자와 위치(입력칸을 감싼 상자 기준)를 알려 주면(update) 목록을 열고 닫는다.
 * onKeyDown은 목록이 열렸을 때 ↑↓·Enter·Tab·Esc를 먹고 true를 돌려준다
 */
export function useMentionPicker(onPick: (slug: string, query: string) => void) {
  const [neighbors, setNeighbors] = useState<MentionCandidate[] | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  const shown = useMemo(() => (open && neighbors ? matches(neighbors, open.query) : []), [open, neighbors]);
  const visible = shown.length > 0;

  const update = useCallback((textBefore: string | null, at: () => Place) => {
    const query = textBefore === null ? null : mentionQueryAt(textBefore);
    if (query === null) {
      setOpen(null);
      return;
    }
    setOpen((prev) => {
      if (prev?.query !== query) setActive(0);
      return { query, ...at() };
    });
    loadNeighbors().then(setNeighbors);
  }, []);

  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  });
  const pick = useCallback(
    (n: MentionCandidate) => {
      if (!open) return;
      pickRef.current(n.slug, open.query);
      setOpen(null);
    },
    [open],
  );

  /** 목록이 열려 있으면 키를 먹는다 (한글 조합 중 Enter는 그대로) */
  const onKeyDown = useCallback(
    (e: Pick<KeyboardEvent, "key" | "preventDefault" | "nativeEvent"> | globalThis.KeyboardEvent): boolean => {
      if (!visible) return false;
      const composing = "nativeEvent" in e ? e.nativeEvent.isComposing : e.isComposing;
      if (composing) return false;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + d + shown.length) % shown.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(shown[Math.min(active, shown.length - 1)]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(null);
        return true;
      }
      return false;
    },
    [visible, shown, active, pick],
  );

  return { open: visible ? open : null, shown, active, setActive, pick, update, close: () => setOpen(null), onKeyDown };
}

/** @ 목록 상자. 위치는 감싼 상자(relative) 기준, 오른쪽으로 넘치지 않게 당긴다 */
export function MentionList({ picker }: { picker: ReturnType<typeof useMentionPicker> }) {
  const t = useT();
  const { open, shown, active, setActive, pick } = picker;
  if (!open) return null;
  const width = Math.min(POPUP_WIDTH, open.width);
  const left = Math.max(0, Math.min(open.x, open.width - width));
  return (
    <div
      data-mention-list
      role="listbox"
      aria-label={t("내 이웃")}
      className="absolute z-30 rounded-2xl border-2 border-line bg-paper p-1.5 text-sm shadow-pop"
      style={{ left, top: open.y + 4, width }}
    >
      <p className="mx-2 mb-1 mt-0.5 text-xs text-ink-soft">{t("💛 내 이웃")}</p>
      {shown.map((n, i) => (
        <button
          key={n.slug}
          type="button"
          role="option"
          aria-selected={i === active}
          // 누르는 동안 입력칸의 커서(포커스)를 잃지 않게
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(i)}
          onClick={() => pick(n)}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${i === active ? "bg-honey" : ""}`}
        >
          <CharacterBadge asset={n.characterAsset} size={30} />
          <span className="truncate font-bold">{n.nickname}</span>
          <span className="truncate text-leaf-dark">@{n.slug}</span>
        </button>
      ))}
    </div>
  );
}

/** 입력칸(textarea) 속 커서 위치: 같은 모양의 보이지 않는 상자에 글자를 똑같이 놓고 잰다 (입력칸 왼쪽 위 기준) */
export function caretInTextarea(el: HTMLTextAreaElement) {
  const style = getComputedStyle(el);
  const mirror = document.createElement("div");
  for (const p of ["boxSizing", "width", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "wordBreak", "overflowWrap"] as const) {
    mirror.style[p] = style[p];
  }
  Object.assign(mirror.style, { position: "absolute", visibility: "hidden", whiteSpace: "pre-wrap", top: "0", left: "-9999px" });
  mirror.textContent = el.value.slice(0, el.selectionStart);
  const mark = document.createElement("span");
  mark.textContent = "​";
  mirror.appendChild(mark);
  document.body.appendChild(mirror);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
  const pos = { x: mark.offsetLeft, y: mark.offsetTop - el.scrollTop + lineHeight };
  mirror.remove();
  return pos;
}

/** 댓글·답글 입력칸에 @ 목록을 붙인다: 입력칸을 감싼 relative 상자 안에 <MentionList>를 두고 이 이벤트들을 textarea에 건다 */
export function useTextareaMentions(textRef: RefObject<HTMLTextAreaElement | null>) {
  const picker = useMentionPicker((slug, query) => {
    const el = textRef.current;
    if (!el) return;
    const end = el.selectionStart;
    const start = end - query.length - 1; // "@" 자리
    const insert = `@${slug} `;
    el.setRangeText(insert, start, end, "end");
    el.focus();
  });
  const refresh = () => {
    const el = textRef.current;
    if (!el) return;
    const collapsed = el.selectionStart === el.selectionEnd;
    picker.update(collapsed ? el.value.slice(0, el.selectionStart) : null, () => {
      const c = caretInTextarea(el);
      return { x: el.offsetLeft + c.x, y: el.offsetTop + c.y, width: el.offsetParent?.clientWidth ?? el.clientWidth };
    });
  };
  return {
    picker,
    textareaProps: {
      onInput: refresh,
      onClick: refresh,
      onKeyUp: (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") refresh();
      },
      onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => {
        picker.onKeyDown(e);
      },
      onBlur: () => picker.close(),
    },
  };
}
