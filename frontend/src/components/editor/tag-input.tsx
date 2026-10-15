"use client";

import { useState } from "react";
import { useT } from "@/components/i18n";
import { useAutoClear } from "@/components/use-auto-clear";

// 글쓰기 태그 칸 (POST-04): 쓴 태그를 하나씩 둥근 칩으로 보여 준다.
// 쉼표·#·엔터로 끊고, 빈 칸에서 지우기를 누르면 마지막 태그를 뺀다. 서버(backend/src/routes/posts.ts의 parseTags)와 같은 규칙으로 다듬는다
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 20;

const tidy = (raw: string) => raw.trim().replace(/\s+/g, " ").toLowerCase();
const pieces = (raw: string) => raw.split(/[,#\n]/);

function parse(text: string) {
  const out: string[] = [];
  for (const p of pieces(text)) {
    const tag = tidy(p);
    if (tag && tag.length <= MAX_TAG_LENGTH && !out.includes(tag) && out.length < MAX_TAGS) out.push(tag);
  }
  return out;
}

/** 폼에는 name="tags"로 "a, b, c"를 보낸다. onChange도 같은 글자(임시 저장용, 아직 끊지 않은 글자 포함) */
export function TagInput({ initialText, onChange }: { initialText: string; onChange?: (text: string) => void }) {
  const t = useT();
  const [tags, setTags] = useState(() => parse(initialText));
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  useAutoClear(notice, () => setNotice(""));

  const report = (nextTags: string[], nextText: string) => onChange?.([...nextTags, ...(tidy(nextText) ? [tidy(nextText)] : [])].join(", "));

  /** 글자 조각들을 태그로 붙인다. 10개가 차거나 너무 길면 알린다 */
  const add = (raw: string[], rest: string) => {
    const next = [...tags];
    let message = "";
    for (const p of raw) {
      const tag = tidy(p);
      if (!tag || next.includes(tag)) continue;
      if (tag.length > MAX_TAG_LENGTH) message = t("태그는 {n}자까지 쓸 수 있어요.", { n: MAX_TAG_LENGTH });
      else if (next.length >= MAX_TAGS) message = t("태그는 {n}개까지 넣을 수 있어요.", { n: MAX_TAGS });
      else next.push(tag);
    }
    if (message) setNotice(message);
    setTags(next);
    setText(rest);
    report(next, rest);
  };

  const remove = (tag: string) => {
    const next = tags.filter((x) => x !== tag);
    setTags(next);
    report(next, text);
  };

  const full = tags.length >= MAX_TAGS;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border-2 border-line bg-paper px-2 py-1.5 focus-within:border-sun">
        <input type="hidden" name="tags" value={[...tags, tidy(text)].filter(Boolean).join(", ")} />
        {tags.map((tag) => (
          <span key={tag} data-tag className="inline-flex items-center gap-1 rounded-full border-2 border-line bg-honey py-0.5 pl-3 pr-1 text-sm font-bold text-ink">
            #{tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={t("{tag} 태그 빼기", { tag })}
              className="grid size-5 place-items-center rounded-full text-ink-soft hover:bg-cream hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => {
            const parts = pieces(e.currentTarget.value);
            // 쉼표·#·줄바꿈 앞까지는 태그로, 마지막 조각은 계속 쓰는 중
            if (parts.length > 1) add(parts.slice(0, -1), parts.at(-1) ?? "");
            else {
              setText(e.currentTarget.value);
              report(tags, e.currentTarget.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return; // 한글 조합 중 엔터는 글자 확정
            if (e.key === "Enter") {
              e.preventDefault(); // 엔터로 글이 발행되지 않게
              add([text], "");
            } else if (e.key === "Backspace" && text === "" && tags.length) {
              remove(tags[tags.length - 1]);
            }
          }}
          onBlur={() => text.trim() && add([text], "")}
          placeholder={tags.length ? (full ? "" : t("태그 더 넣기")) : t("태그 (쉼표나 엔터로 구분, 최대 10개)  예: git, 회고")}
          aria-label={t("태그")}
          maxLength={300}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 outline-none"
        />
        <span className="ml-auto px-1 text-xs tabular-nums text-ink-soft" aria-hidden>
          {tags.length}/{MAX_TAGS}
        </span>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-bold text-berry">
        {notice}
      </p>
    </div>
  );
}
