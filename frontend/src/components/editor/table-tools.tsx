"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n";
import { msg } from "@/lib/i18n";

// 표 크기 고르기 판: ROWS행 × COLS열까지. 더 크게는 표 도구로 늘린다
const ROWS = 8;
const COLS = 6;

/** 툴바의 표 버튼: 누르면 칸 판이 열리고, 고른 크기의 표(첫 행은 제목 행)를 넣는다 */
export function TablePicker({ editor, disabled, className = "" }: { editor: Editor | null; disabled: boolean; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ rows: 3, cols: 3 });
  // 휴대폰에서 버튼이 화면 오른쪽에 있으면 판을 버튼 오른쪽 끝에 맞춰 화면 밖으로 나가지 않게 한다
  const [alignRight, setAlignRight] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const insert = (rows: number, cols: number) => {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setOpen(false);
  };
  const title = t("표 넣기");
  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        disabled={!editor || disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const rect = box.current?.getBoundingClientRect();
          setAlignRight(!!rect && rect.left > window.innerWidth / 2);
          setOpen((o) => !o);
        }}
        className={`flex h-8 items-center justify-center rounded-lg px-1.5 text-sm font-bold transition disabled:opacity-40 sm:px-2 ${
          open ? "bg-paper text-ink" : "text-ink-soft hover:bg-paper hover:text-ink"
        }`}
      >
        {t("▦ 표")}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={`absolute top-full z-20 mt-1 rounded-xl border-2 border-line bg-paper p-2 shadow-lg ${alignRight ? "right-0" : "left-0"}`}
        >
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1.5rem)` }} onMouseLeave={() => setSize({ rows: 3, cols: 3 })}>
            {Array.from({ length: ROWS * COLS }, (_, i) => {
              const rows = Math.floor(i / COLS) + 1;
              const cols = (i % COLS) + 1;
              const on = rows <= size.rows && cols <= size.cols;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={t("{rows}행 × {cols}열", { cols, rows })}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setSize({ rows, cols })}
                  onFocus={() => setSize({ rows, cols })}
                  onClick={() => insert(rows, cols)}
                  className={`h-6 w-6 rounded border-2 ${on ? "border-sun bg-honey" : "border-line bg-cream/40"}`}
                />
              );
            })}
          </div>
          <p className="mt-1.5 text-center text-xs font-bold text-ink-soft" aria-live="polite">
            {t("{rows}행 × {cols}열", size)}
          </p>
        </div>
      )}
    </div>
  );
}

type TableAction = {
  label: string;
  title: string;
  run: (e: Editor) => boolean;
  can: (e: Editor) => boolean;
  danger?: boolean;
};

// 커서가 표 안에 있을 때 툴바 아래에 보이는 표 도구
export const TABLE_ACTIONS: TableAction[] = [
  { label: msg("＋ 위에 행"), title: msg("위에 행 넣기"), run: (e) => e.chain().focus().addRowBefore().run(), can: (e) => e.can().addRowBefore() },
  { label: msg("＋ 아래에 행"), title: msg("아래에 행 넣기"), run: (e) => e.chain().focus().addRowAfter().run(), can: (e) => e.can().addRowAfter() },
  { label: msg("＋ 왼쪽에 열"), title: msg("왼쪽에 열 넣기"), run: (e) => e.chain().focus().addColumnBefore().run(), can: (e) => e.can().addColumnBefore() },
  { label: msg("＋ 오른쪽에 열"), title: msg("오른쪽에 열 넣기"), run: (e) => e.chain().focus().addColumnAfter().run(), can: (e) => e.can().addColumnAfter() },
  { label: msg("－ 행"), title: msg("이 행 지우기"), run: (e) => e.chain().focus().deleteRow().run(), can: (e) => e.can().deleteRow() },
  { label: msg("－ 열"), title: msg("이 열 지우기"), run: (e) => e.chain().focus().deleteColumn().run(), can: (e) => e.can().deleteColumn() },
  { label: msg("칸 합치기·나누기"), title: msg("여러 칸을 끌어서 골라 합치거나, 합친 칸을 다시 나누기"), run: (e) => e.chain().focus().mergeOrSplit().run(), can: (e) => e.can().mergeOrSplit() },
  { label: msg("제목 행"), title: msg("첫 행을 제목 행으로 켜고 끄기"), run: (e) => e.chain().focus().toggleHeaderRow().run(), can: (e) => e.can().toggleHeaderRow() },
  { label: msg("🗑 표 지우기"), title: msg("표 지우기"), run: (e) => e.chain().focus().deleteTable().run(), can: (e) => e.can().deleteTable(), danger: true },
];

export function TableToolbar({ editor, enabled }: { editor: Editor; enabled: boolean[] }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b-2 border-line bg-honey/50 px-1.5 py-1 sm:gap-1 sm:px-2" role="toolbar" aria-label={t("표 도구")}>
      <span className="px-1 text-xs font-black text-sun-dark">{t("▦ 표")}</span>
      {TABLE_ACTIONS.map((a, i) => (
        <button
          key={a.title}
          type="button"
          title={t(a.title)}
          disabled={!enabled[i]}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => a.run(editor)}
          className={`h-7 rounded-lg px-1.5 text-xs font-bold transition disabled:opacity-40 sm:px-2 ${
            a.danger ? "text-berry hover:bg-paper" : "text-ink-soft hover:bg-paper hover:text-ink"
          }`}
        >
          {t(a.label)}
        </button>
      ))}
    </div>
  );
}
