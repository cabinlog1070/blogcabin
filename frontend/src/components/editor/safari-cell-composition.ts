import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

// 사파리(맥·아이폰)에서 표 칸에 한글을 치면 글자 순서가 뒤집히던 문제 ("종류" → "류종").
// 사파리는 칸 안에서 조합이 끝나면 조합한 글자를 칸 밖(표의 행)으로 옮겨 버리고,
// ProseMirror는 그 글자를 칸의 맨 앞에 다시 넣는다. 한글은 글자(음절)마다 조합이 끝나므로
// 두 번째 글자부터 매번 칸 맨 앞에 들어가 순서가 뒤집힌다.
// 조합이 끝나자마자 커서가 칸 맨 앞으로 튀면 원래 자리로 돌리고,
// 조합한 글자가 칸 맨 앞(커서가 아닌 다른 자리)으로 옮겨지거나 끼어들었으면 커서 자리로 옮긴다.

const key = new PluginKey("safariCellComposition");
const isWebKit = () => typeof navigator !== "undefined" && /Apple Computer/.test(navigator.vendor);
const CELL_TYPES = new Set(["tableCell", "tableHeader"]);

/** 바로 앞 커서 자리에 넣었어야 할 글자가 다른 자리에 들어갔으면 옮기는 트랜잭션 */
export function fixMisplacedInsert(oldState: EditorState, newState: EditorState): Transaction | null {
  const { $from, empty } = oldState.selection;
  if (!empty || !$from.parent.isTextblock || !CELL_TYPES.has($from.node(-1)?.type.name ?? "")) return null;
  const blockStart = $from.start();
  const mapped = newState.doc.resolve(Math.min(blockStart, newState.doc.content.size));
  const block = mapped.parent;
  if (!block.isTextblock || mapped.start() !== blockStart) return null;
  const before = $from.parent.textContent;
  const after = block.textContent;
  // 글자만 있는 문단에서만 (줄바꿈·그림이 섞이면 글자 위치와 문서 위치가 어긋난다)
  if ($from.parent.content.size !== before.length || block.content.size !== after.length) return null;
  const added = after.length - before.length;
  if (added <= 0) return null;
  const caret = $from.parentOffset;
  const insertedAt = (k: number) => after.slice(0, k) === before.slice(0, k) && after.slice(k + added) === before.slice(k);
  if (insertedAt(caret)) return null;
  for (let k = 0; k <= before.length; k++) {
    if (k === caret || !insertedAt(k)) continue;
    const text = after.slice(k, k + added);
    const tr = newState.tr.delete(blockStart + k, blockStart + k + added).insertText(text, blockStart + caret);
    tr.setSelection(TextSelection.create(tr.doc, blockStart + caret + added));
    return tr.setMeta(key, true);
  }
  return null;
}

/** 방금 조합한 글자(커서 바로 앞)가 칸 문단 맨 앞으로 옮겨졌으면 제자리로 */
export function fixMovedToStart(oldState: EditorState, newState: EditorState, composed: string): Transaction | null {
  const { $from, empty } = oldState.selection;
  if (!empty || !$from.parent.isTextblock || !CELL_TYPES.has($from.node(-1)?.type.name ?? "")) return null;
  const blockStart = $from.start();
  const block = newState.doc.resolve(Math.min(blockStart, newState.doc.content.size)).parent;
  const before = $from.parent.textContent;
  const after = block.textContent;
  if (!block.isTextblock || $from.parent.content.size !== before.length || block.content.size !== after.length) return null;
  const caret = $from.parentOffset;
  const from = caret - composed.length;
  if (from <= 0 || before.slice(from, caret) !== composed) return null;
  if (after !== composed + before.slice(0, from) + before.slice(caret)) return null;
  const tr = newState.tr.delete(blockStart, blockStart + composed.length).insertText(composed, blockStart + from);
  tr.setSelection(TextSelection.create(tr.doc, blockStart + caret));
  return tr.setMeta(key, true);
}

/** 조합이 끝나자마자 커서가 칸 문단 맨 앞으로 튀었으면 원래 자리로 */
export function fixCaretJump(oldState: EditorState, newState: EditorState): Transaction | null {
  const was = oldState.selection;
  const now = newState.selection;
  if (!was.empty || !now.empty || was.$from.parentOffset === 0 || now.$from.parentOffset !== 0) return null;
  if (!was.$from.parent.isTextblock || !CELL_TYPES.has(was.$from.node(-1)?.type.name ?? "")) return null;
  if (now.$from.start() !== was.$from.start() || !oldState.doc.eq(newState.doc)) return null;
  return newState.tr.setSelection(TextSelection.create(newState.doc, was.from)).setMeta(key, true);
}

export const SafariCellComposition = Extension.create({
  name: "safariCellComposition",
  addProseMirrorPlugins() {
    if (!isWebKit()) return [];
    // 조합 중이거나 조합이 막 끝났을 때만 고친다 (붙여 넣기·되돌리기 같은 다른 변경은 건드리지 않는다)
    let composing = false;
    let endedAt = 0;
    let composed = "";
    return [
      new Plugin({
        key,
        props: {
          handleDOMEvents: {
            compositionstart: () => {
              composing = true;
              return false;
            },
            compositionend: (_view, event) => {
              composing = false;
              composed = (event as CompositionEvent).data ?? "";
              endedAt = Date.now();
              return false;
            },
          },
        },
        appendTransaction(trs, oldState, newState) {
          if (trs.some((tr) => tr.getMeta(key))) return null;
          if (!trs.some((tr) => tr.docChanged)) return Date.now() - endedAt < 500 ? fixCaretJump(oldState, newState) : null;
          if (!composing && Date.now() - endedAt > 1000) return null;
          return fixMisplacedInsert(oldState, newState) ?? (composed ? fixMovedToStart(oldState, newState, composed) : null);
        },
      }),
    ];
  },
});
