"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { postTextLength } from "@/lib/text-length";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { BackgroundColor, Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/components/i18n";
import { attachmentPath, FILE_TYPES, IMAGE_TYPES } from "@/lib/attachments";
import { msg, type T } from "@/lib/i18n";
import { FileCard } from "./file-card";
import { DEFAULT_LINE_HEIGHT, LINE_HEIGHTS, LineHeight } from "./line-height";
import { TABLE_ACTIONS, TablePicker, TableToolbar } from "./table-tools";
import { filesFrom, useAttachmentUpload } from "./use-attachment-upload";

const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).map((e) => `.${e}`).join(",");
const FILE_ACCEPT = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(",");

// 사진은 이 사이트에 올린 것(/files/키)만 에디터에 둔다. 저장할 때 빠질 다른 사이트 사진이 보였다가 사라지지 않게
const imagePath = (src: string | null) => attachmentPath(src, typeof window === "undefined" ? "http://localhost" : window.location.origin);
const PostImage = Image.extend({
  parseHTML() {
    return [{ tag: "img[src]", getAttrs: (el) => (imagePath((el as HTMLElement).getAttribute("src")) ? null : false) }];
  },
  addAttributes() {
    return { ...this.parent?.(), src: { default: null, parseHTML: (el) => imagePath(el.getAttribute("src")) } };
  },
});

type ToolButton = {
  label: ReactNode;
  title: string;
  run: (e: Editor, t: T) => void;
  active?: (e: Editor) => boolean;
  className?: string;
  /** 휴대폰에서 이 버튼이 들어 있는 묶음 (없으면 맨 아래 줄에 늘 보인다) */
  group?: Group;
};

// 휴대폰 툴바: 네이버 블로그 앱처럼 한 줄에 묶음 버튼만 두고, 누르면 그 묶음의 도구가 한 줄 더 펼쳐진다
type Group = "font" | "align" | "block";
const GROUPS: { value: Group; title: string }[] = [
  { value: "font", title: msg("글자 꾸미기") },
  { value: "align", title: msg("정렬·줄 간격") },
  { value: "block", title: msg("목록·인용·링크·표") },
];

function GroupIcon({ group }: { group: Group }) {
  if (group === "font") return <span className="font-serif text-lg leading-none">T</span>;
  if (group === "align") return <AlignIcon align="center" />;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {[3, 9, 15].map((y) => (
        <Fragment key={y}>
          <circle cx="2.5" cy={y} r="1.5" fill="currentColor" />
          <rect x="6" y={y - 1} width="11" height="2" rx="1" fill="currentColor" />
        </Fragment>
      ))}
    </svg>
  );
}

// 문단 스타일: H2·H3 대신 티스토리처럼 이름으로 고른다. 저장되는 태그는 그대로 (제목 h2, 부제목 h3)
const BLOCK_STYLES = [
  { value: "p", label: msg("본문") },
  { value: "h2", label: msg("제목") },
  { value: "h3", label: msg("부제목") },
] as const;
type BlockStyle = (typeof BLOCK_STYLES)[number]["value"];

const blockStyleOf = (e: Editor): BlockStyle =>
  e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p";

const setBlockStyle = (e: Editor, style: BlockStyle) => {
  const chain = e.chain().focus();
  if (style === "p") chain.setParagraph().run();
  else chain.setHeading({ level: style === "h2" ? 2 : 3 }).run();
};

// 글자 크기 (px). 본문 기본은 16이라 16을 고르면 크기 지정을 지운다
const DEFAULT_FONT_SIZE = 16;
export const FONT_SIZES = [11, 13, 15, 16, 19, 24, 28, 30, 34, 38];

// 글자색·배경색 팔레트. 저장 화면에서 허용하는 값과 같아야 한다 (src/server/sanitize.ts)
export const TEXT_COLORS = ["#2e2118", "#6a5444", "#b83a29", "#e8590c", "#96500f", "#3d7a4a", "#2f6f9e", "#5f3dc4", "#c2255c", "#868e96"];
export const BACKGROUND_COLORS = ["#fff3bf", "#ffe8cc", "#ffe3e3", "#d3f9d8", "#d0ebff", "#e5dbff", "#f1f3f5"];

const ALIGNS = [
  { value: "left", title: msg("왼쪽 정렬") },
  { value: "center", title: msg("가운데 정렬") },
  { value: "right", title: msg("오른쪽 정렬") },
] as const;
type Align = (typeof ALIGNS)[number]["value"];

function AlignIcon({ align }: { align: Align }) {
  const widths = [16, 10, 16, 10];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {widths.map((w, i) => {
        const x = align === "left" ? 1 : align === "right" ? 17 - w : (18 - w) / 2;
        return <rect key={i} x={x} y={2 + i * 4} width={w} height="2" rx="1" fill="currentColor" />;
      })}
    </svg>
  );
}

// "colors" 자리에 글자색·배경색 버튼, "lineHeight" 자리에 줄 간격 고르기, "table" 자리에 표 넣기가 들어간다.
// 컴퓨터는 "row"에서 줄을 바꿔 두 줄 (글꼴·정렬 / 줄 간격·목록부터)
const TOOLS: (ToolButton | "sep" | "colors" | "row" | "lineHeight" | "table")[] = [
  { label: "B", title: msg("굵게"), group: "font", className: "font-black", run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
  { label: "I", title: msg("기울임"), group: "font", className: "italic font-serif", run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
  { label: "U", title: msg("밑줄"), group: "font", className: "underline underline-offset-2", run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive("underline") },
  { label: "S", title: msg("취소선"), group: "font", className: "line-through", run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive("strike") },
  "colors",
  "sep",
  ...ALIGNS.map(
    (a): ToolButton => ({
      label: <AlignIcon align={a.value} />,
      title: a.title,
      group: "align",
      run: (e) => e.chain().focus().setTextAlign(a.value).run(),
      // 정렬을 고른 적 없는 문단은 왼쪽 정렬로 본다
      active: (e) => (a.value === "left" ? !e.isActive({ textAlign: "center" }) && !e.isActive({ textAlign: "right" }) : e.isActive({ textAlign: a.value })),
    }),
  ),
  "row",
  "lineHeight",
  "sep",
  { label: msg("• 목록"), title: msg("글머리 목록"), group: "block", run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
  { label: msg("1. 목록"), title: msg("번호 목록"), group: "block", run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
  { label: msg("❝ 인용"), title: msg("인용"), group: "block", run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
  { label: msg("</> 코드"), title: msg("코드 블록"), group: "block", run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive("codeBlock") },
  { label: msg("― 구분선"), title: msg("구분선"), group: "block", run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    label: msg("🔗 링크"),
    title: msg("링크"),
    group: "block",
    run: (e, t) => {
      const prev = e.getAttributes("link").href as string | undefined;
      const url = window.prompt(t("링크 주소 (비우면 링크 해제)"), prev ?? "https://");
      if (url === null) return;
      if (!url || url === "https://") e.chain().focus().extendMarkRange("link").unsetLink().run();
      else e.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    },
    active: (e) => e.isActive("link"),
  },
  "table",
  "sep",
  { label: "↶", title: msg("되돌리기"), className: "max-sm:ml-auto", run: (e) => e.chain().focus().undo().run() },
  { label: "↷", title: msg("다시 실행"), run: (e) => e.chain().focus().redo().run() },
];

const SELECT_CLASS =
  "h-8 rounded-lg border-2 border-line bg-paper px-2 text-sm font-bold text-ink outline-none hover:border-sun focus:border-sun disabled:opacity-40";

/** 글자색·배경색: 버튼을 누르면 색 판이 열린다 */
function ColorPicker({
  editor,
  kind,
  current,
}: {
  editor: Editor | null;
  kind: "color" | "background";
  current: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const colors = kind === "color" ? TEXT_COLORS : BACKGROUND_COLORS;
  const title = kind === "color" ? t("글자색") : t("글자 배경색");
  const apply = (c: string | null) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (kind === "color") (c ? chain.setColor(c) : chain.unsetColor()).run();
    else (c ? chain.setBackgroundColor(c) : chain.unsetBackgroundColor()).run();
    setOpen(false);
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        disabled={!editor}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 flex-col items-center justify-center rounded-lg px-1 text-sm font-black sm:px-2 transition ${open ? "bg-paper text-ink" : "text-ink-soft hover:bg-paper hover:text-ink"}`}
      >
        <span
          className="leading-none"
          style={kind === "background" ? { background: current ?? BACKGROUND_COLORS[0], padding: "0 2px", borderRadius: 2 } : undefined}
        >
          {t("가")}
        </span>
        {kind === "color" && <span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: current ?? "var(--color-ink)" }} />}
      </button>
      {/* 휴대폰에서는 색 버튼이 첫 줄 오른쪽 끝에 있어 색 판을 버튼 오른쪽에 맞춘다 */}
      {open && (
        <div role="menu" aria-label={title} className="absolute right-0 top-full z-20 sm:right-auto sm:left-0 mt-1 w-44 rounded-xl border-2 border-line bg-paper p-2 shadow-lg">
          <div className="grid grid-cols-5 gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                role="menuitem"
                title={c}
                aria-label={`${title} ${c}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply(c)}
                className={`h-6 w-6 rounded-md border-2 ${current === c ? "border-ink" : "border-line"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            type="button"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(null)}
            className="mt-2 w-full rounded-lg py-1 text-xs font-bold text-ink-soft hover:bg-cream hover:text-ink"
          >
            {kind === "color" ? t("기본 색으로") : t("배경색 없애기")}
          </button>
        </div>
      )}
    </div>
  );
}

export function RichEditor({
  initialHtml,
  onChange,
  onUploadingChange,
}: {
  initialHtml: string;
  onChange: (html: string, textLength: number) => void;
  /** 첨부를 올리는 동안 true (그동안 발행 버튼을 막는다) */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const t = useT();
  // 붙여 넣기·끌어다 놓기는 에디터 설정(처음 한 번 만들어짐) 안에서 불리므로 최신 함수를 ref로 넘긴다
  const uploadRef = useRef<(files: File[], at?: number) => void>(() => {});
  const editor = useEditor({
    extensions: [
      PostImage.configure({ inline: false, allowBase64: false }), // 사진 (POST-07)
      FileCard, // 파일 카드 (POST-09)
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      TextStyle, // 글자 크기·색을 <span style>로 담는다
      FontSize,
      Color,
      BackgroundColor,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      LineHeight,
      TableKit, // 표: 칸 안의 글은 문단이라 정렬·글꼴 도구를 그대로 쓴다
      Placeholder.configure({ placeholder: t("오늘 배운 것, 생각한 것, 무엇이든 적어 보세요 ✏️") }),
    ],
    content: initialHtml,
    immediatelyRender: false, // 서버 렌더링과 어긋나지 않게 브라우저에서 처음 그린다
    editorProps: {
      attributes: {
        class: "prose-blog min-h-[360px] px-5 py-4 outline-none",
        "aria-label": t("본문"),
      },
      // 사진·파일을 붙여 넣거나(Ctrl+V) 끌어다 놓으면 올려서 넣는다. 여러 개도 한 번에
      handlePaste: (_view, event) => {
        const files = filesFrom(event.clipboardData?.files);
        if (!files.length) return false;
        // 엑셀·키노트처럼 글자와 그림을 함께 복사하면 글자를 붙여 넣는다 (스크린샷·파일 복사는 글자가 없다)
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (html && new DOMParser().parseFromString(html, "text/html").body.textContent?.trim()) return false;
        uploadRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = filesFrom(event.dataTransfer?.files);
        if (moved || !files.length) return false;
        event.preventDefault();
        uploadRef.current(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
      // 에디터 안에서 파일 카드를 누르면 내려받지 않고 고르기만 한다 (링크로 이동하지 않게)
      handleDOMEvents: {
        click: (_view, event) => {
          if ((event.target as Element | null)?.closest?.("a[data-file]")) event.preventDefault();
          return false;
        },
      },
    },
    // 글자 수는 서버가 보상을 판단하는 규칙과 같게 센다 (#18)
    onUpdate: ({ editor }) => onChange(editor.getHTML(), postTextLength(editor.getHTML())),
    onCreate: ({ editor }) => onChange(editor.getHTML(), postTextLength(editor.getHTML())),
  });

  const { upload, progress, errors, clearErrors } = useAttachmentUpload(editor);
  useEffect(() => {
    uploadRef.current = upload;
  }, [upload]);
  useEffect(() => {
    onUploadingChange?.(!!progress);
  }, [progress, onUploadingChange]);
  // 파일을 에디터 밖(제목·여백)에 떨어뜨려도 브라우저가 그 파일을 열어 쓰던 글을 잃지 않게 막는다
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pick = (input: HTMLInputElement | null) => {
    if (!input) return;
    upload(filesFrom(input.files));
    input.value = ""; // 같은 파일을 다시 고를 수 있게
  };

  // 버튼 활성 상태는 선택이 바뀔 때마다 다시 계산한다
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      const style = editor.getAttributes("textStyle") as { fontSize?: string; color?: string; backgroundColor?: string };
      return {
        tools: TOOLS.map((tool) => (typeof tool !== "string" && tool.active ? tool.active(editor) : false)),
        block: blockStyleOf(editor),
        fontSize: style.fontSize ? parseInt(style.fontSize, 10) || DEFAULT_FONT_SIZE : DEFAULT_FONT_SIZE,
        color: style.color ?? null,
        background: style.backgroundColor ?? null,
        inTable: editor.isActive("table"),
        canInsertTable: !editor.isActive("table") && !editor.isActive("codeBlock"),
        tableActions: TABLE_ACTIONS.map((a) => a.can(editor)),
        lineHeight: (editor.getAttributes(editor.isActive("heading") ? "heading" : "paragraph").lineHeight as string | null) ?? DEFAULT_LINE_HEIGHT,
      };
    },
  });
  const active = state?.tools;
  // 휴대폰에서 펼친 묶음 (컴퓨터에서는 쓰지 않는다)
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const inGroup = (group: Group) => (group === openGroup ? "max-sm:order-4" : "max-sm:hidden");

  return (
    <div data-rich-editor className="overflow-hidden rounded-2xl border-2 border-line bg-paper focus-within:border-sun">
      <div className="flex flex-wrap items-center gap-0.5 border-b-2 border-line bg-cream/60 p-1.5 sm:gap-1 sm:p-2" role="toolbar" aria-label={t("글꼴 도구")}>
        {GROUPS.map((g) => (
          <button
            key={g.value}
            type="button"
            title={t(g.title)}
            aria-label={t(g.title)}
            aria-expanded={openGroup === g.value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenGroup((o) => (o === g.value ? null : g.value))}
            className={`flex h-8 min-w-9 items-center justify-center rounded-lg px-2 transition sm:hidden ${
              openGroup === g.value ? "bg-paper text-leaf ring-2 ring-line" : "text-ink-soft"
            }`}
          >
            <GroupIcon group={g.value} />
          </button>
        ))}
        {/* 휴대폰 첫 줄: 묶음 버튼 · 사진·파일 · 되돌리기 (order로 순서를 정한다), 펼친 묶음은 아랫줄에 */}
        {openGroup && <span className="order-3 my-1 h-px basis-full bg-line sm:hidden" aria-hidden="true" />}
        <select
          aria-label={t("문단 스타일")}
          title={t("문단 스타일")}
          disabled={!editor}
          value={state?.block ?? "p"}
          onChange={(e) => editor && setBlockStyle(editor, e.currentTarget.value as BlockStyle)}
          className={`${SELECT_CLASS} w-20 sm:w-24 ${inGroup("font")}`}
        >
          {BLOCK_STYLES.map((b) => (
            <option key={b.value} value={b.value}>
              {t(b.label)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("글자 크기")}
          title={t("글자 크기")}
          disabled={!editor}
          value={state?.fontSize ?? DEFAULT_FONT_SIZE}
          onChange={(e) => {
            if (!editor) return;
            const size = Number(e.currentTarget.value);
            const chain = editor.chain().focus();
            (size === DEFAULT_FONT_SIZE ? chain.unsetFontSize() : chain.setFontSize(`${size}px`)).run();
          }}
          className={`${SELECT_CLASS} w-14 sm:w-16 ${inGroup("font")}`}
        >
          {/* 목록에 없는 크기(붙여 넣은 글 등)도 지금 값으로 보이게 */}
          {[...new Set([...FONT_SIZES, state?.fontSize ?? DEFAULT_FONT_SIZE])].sort((a, b) => a - b).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="mx-1 h-5 w-px bg-line max-sm:hidden" />
        {TOOLS.map((tool, i) =>
          tool === "sep" ? (
            <span key={i} className="mx-1 h-5 w-px bg-line max-sm:hidden" />
          ) : tool === "row" ? (
            // 너비 100%짜리 빈 칸으로 줄을 바꾼다
            <span key={i} className="basis-full max-sm:hidden" aria-hidden="true" />
          ) : tool === "lineHeight" ? (
            <select
              key={i}
              aria-label={t("줄 간격")}
              title={t("줄 간격")}
              disabled={!editor}
              value={state?.lineHeight ?? DEFAULT_LINE_HEIGHT}
              onChange={(e) => {
                if (!editor) return;
                const value = e.currentTarget.value;
                const chain = editor.chain().focus();
                (value === DEFAULT_LINE_HEIGHT ? chain.unsetLineHeight() : chain.setLineHeight(value)).run();
              }}
              className={`${SELECT_CLASS} w-20 ${inGroup("align")}`}
            >
              {LINE_HEIGHTS.map((v) => (
                <option key={v} value={v}>
                  ↕ {v}
                </option>
              ))}
            </select>
          ) : tool === "table" ? (
            // 표 안이나 코드 블록 안에는 표를 넣지 않는다
            <TablePicker key={i} editor={editor} disabled={!state?.canInsertTable} className={inGroup("block")} />
          ) : tool === "colors" ? (
            <div key={i} className={`flex gap-0.5 sm:gap-1 ${inGroup("font")}`}>
              <ColorPicker editor={editor} kind="color" current={state?.color ?? null} />
              <ColorPicker editor={editor} kind="background" current={state?.background ?? null} />
            </div>
          ) : (
            <button
              key={tool.title}
              type="button"
              title={t(tool.title)}
              aria-pressed={active?.[i] ?? false}
              disabled={!editor}
              onMouseDown={(e) => e.preventDefault()} // 버튼이 포커스를 가져가 커서 위치를 잃지 않게
              onClick={() => editor && tool.run(editor, t)}
              className={`flex h-8 min-w-7 items-center justify-center rounded-lg px-1.5 text-sm font-bold transition sm:min-w-8 sm:px-2 ${tool.className ?? ""} ${
                tool.group ? inGroup(tool.group) : "max-sm:order-2"
              } ${
                active?.[i] ? "bg-ink text-cream" : "text-ink-soft hover:bg-paper hover:text-ink"
              }`}
            >
              {typeof tool.label === "string" ? t(tool.label) : tool.label}
            </button>
          ),
        )}
        <span className="mx-1 h-5 w-px bg-line max-sm:hidden" />
        <button
          type="button"
          title={t("사진 올리기 (PNG·JPG·GIF·WEBP, 10MB까지)")}
          disabled={!editor || !!progress}
          onClick={() => imageInput.current?.click()}
          className="rounded-lg px-2.5 py-1 text-sm font-bold text-ink-soft transition hover:bg-paper hover:text-ink disabled:opacity-40 max-sm:order-1 max-sm:px-2"
        >
          <span className="max-sm:hidden">{t("🖼 사진")}</span>
          <span className="text-base sm:hidden">🖼</span>
        </button>
        <button
          type="button"
          title={t("파일 올리기 (PDF·한글·오피스·ZIP 등, 30MB까지)")}
          disabled={!editor || !!progress}
          onClick={() => fileInput.current?.click()}
          className="rounded-lg px-2.5 py-1 text-sm font-bold text-ink-soft transition hover:bg-paper hover:text-ink disabled:opacity-40 max-sm:order-1 max-sm:px-2"
        >
          <span className="max-sm:hidden">{t("📎 파일")}</span>
          <span className="text-base sm:hidden">📎</span>
        </button>
        <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} multiple hidden aria-label={t("사진 고르기")} onChange={(e) => pick(e.currentTarget)} />
        <input ref={fileInput} type="file" accept={FILE_ACCEPT} multiple hidden aria-label={t("파일 고르기")} onChange={(e) => pick(e.currentTarget)} />
      </div>
      {(progress || errors.length > 0) && (
        <div className="border-b-2 border-line bg-cream/40 px-4 py-2 text-sm" role="status" aria-live="polite">
          {progress && (
            <p className="font-bold text-ink-soft">
              {t("올리는 중... ({done}/{total})", { done: progress.done + 1, total: progress.total })}
            </p>
          )}
          {errors.length > 0 && (
            <div className="flex items-start justify-between gap-3">
              <ul className="font-bold text-berry">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <button type="button" onClick={clearErrors} className="shrink-0 text-ink-soft hover:text-ink" aria-label={t("안내 닫기")}>
                ✕
              </button>
            </div>
          )}
        </div>
      )}
      {editor && state?.inTable && <TableToolbar editor={editor} enabled={state.tableActions} />}
      <EditorContent editor={editor} />
    </div>
  );
}
