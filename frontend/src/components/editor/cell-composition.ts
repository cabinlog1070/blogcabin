import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

// 표 칸에 한글을 치면 글자 순서가 뒤집히던 문제 ("종류" → "류종").
// 맥 사파리(2026-10-15 사용자 기록): 빈 칸에서 첫 글자 조합이 끝날 때 칸 속 문단을 지우고
// 조합한 글자를 굵은 글씨(<b>)로 칸 밖(표의 행)에 넣는다. ProseMirror가 그 글자를 칸에 되돌리지만
// 굵은 글씨가 붙고 커서는 칸 맨 앞에 남아, 다음 글자부터 앞에 들어가 순서가 뒤집힌다.
// 그래서 조합이 막 끝났는데 칸의 글자는 그대로이고 모양(문단·굵기)이나 커서만 바뀌었으면 조합 전 칸으로 되돌린다.
// 예전에 짐작한 다른 모양(글자가 칸 맨 앞으로 옮겨지거나 커서만 튀는 것)도 그대로 고친다.
// 이벤트 순서가 브라우저마다 달라서 조합 시작·끝 무렵 모두 보고, 모양이 아주 좁아(표 칸 안) 모든 브라우저에서 켠다.

const key = new PluginKey("cellComposition");
const CELL_TYPES = new Set(["tableCell", "tableHeader"]);

/** 표 칸 안 글자만 있는 문단에서의 커서 (아니면 null) */
function cellCaret(state: EditorState) {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock || !CELL_TYPES.has($from.node(-1)?.type.name ?? "")) return null;
  const text = $from.parent.textContent;
  // 줄바꿈·그림이 섞이면 글자 위치와 문서 위치가 어긋난다
  if ($from.parent.content.size !== text.length) return null;
  return { blockStart: $from.start(), caret: $from.parentOffset, text };
}

/** 같은 자리에서 시작하는 글자만 있는 문단의 글자 (아니면 null) */
function blockTextAt(state: EditorState, blockStart: number) {
  if (blockStart > state.doc.content.size) return null;
  const $pos = state.doc.resolve(blockStart);
  const block = $pos.parent;
  if (!block.isTextblock || $pos.start() !== blockStart) return null;
  const text = block.textContent;
  return block.content.size === text.length ? text : null;
}

function move(state: EditorState, blockStart: number, from: number, length: number, to: number, caretAfter: number) {
  const text = state.doc.textBetween(blockStart + from, blockStart + from + length);
  const tr = state.tr.delete(blockStart + from, blockStart + from + length).insertText(text, blockStart + to);
  tr.setSelection(TextSelection.create(tr.doc, blockStart + caretAfter));
  return tr.setMeta(key, true);
}

/** 조합이 끝나며 칸의 글자는 그대로인데 문단·굵기·커서가 바뀌었으면 조합 전 칸으로 (맥 사파리) */
export function fixCommitReshape(oldState: EditorState, newState: EditorState): Transaction | null {
  const was = cellCaret(oldState);
  if (!was || was.caret === 0) return null;
  const cellPos = oldState.selection.$from.before(-1);
  const oldCell = oldState.doc.nodeAt(cellPos);
  const newCell = cellPos < newState.doc.content.size ? newState.doc.nodeAt(cellPos) : null;
  if (!oldCell || !newCell || newCell.type !== oldCell.type || newCell.textContent !== oldCell.textContent) return null;
  const sameCaret = newState.selection.empty && newState.selection.from === oldState.selection.from;
  if (newCell.eq(oldCell) && sameCaret) return null;
  // 새 칸 안에 커서가 있어야 (다른 칸으로 옮겨 간 것은 건드리지 않는다)
  const { from } = newState.selection;
  if (from <= cellPos || from >= cellPos + newCell.nodeSize) return null;
  const tr = newState.tr.replaceWith(cellPos + 1, cellPos + newCell.nodeSize - 1, oldCell.content);
  tr.setSelection(TextSelection.create(tr.doc, oldState.selection.from));
  return tr.setMeta(key, true);
}

/** 커서 자리에 들어갔어야 할 새 글자가 다른 자리에 들어갔으면 커서 자리로 */
export function fixMisplacedInsert(oldState: EditorState, newState: EditorState): Transaction | null {
  const was = cellCaret(oldState);
  if (!was) return null;
  const after = blockTextAt(newState, was.blockStart);
  const before = was.text;
  if (after === null) return null;
  const added = after.length - before.length;
  if (added <= 0) return null;
  const insertedAt = (k: number) => after.slice(0, k) === before.slice(0, k) && after.slice(k + added) === before.slice(k);
  if (insertedAt(was.caret)) return null;
  for (let k = 0; k <= before.length; k++) {
    if (k !== was.caret && insertedAt(k)) return move(newState, was.blockStart, k, added, was.caret, was.caret + added);
  }
  return null;
}

/** 커서 바로 앞 글자(방금 조합한 글자)가 칸 문단 맨 앞으로 옮겨졌으면 제자리로 */
export function fixMovedToStart(oldState: EditorState, newState: EditorState): Transaction | null {
  const was = cellCaret(oldState);
  if (!was || was.caret < 2) return null;
  const after = blockTextAt(newState, was.blockStart);
  const before = was.text;
  if (after === null || after.length !== before.length || after === before) return null;
  // 옮겨진 글자가 짧은 것부터: before[m..caret)이 맨 앞으로 갔는지
  for (let m = was.caret - 1; m > 0; m--) {
    if (after === before.slice(m, was.caret) + before.slice(0, m) + before.slice(was.caret)) {
      const length = was.caret - m;
      return move(newState, was.blockStart, 0, length, m, was.caret);
    }
  }
  return null;
}

/** 커서가 칸 문단 맨 앞으로 튀었으면 원래 자리로 (글자는 그대로일 때) */
export function fixCaretJump(oldState: EditorState, newState: EditorState): Transaction | null {
  const was = cellCaret(oldState);
  const now = newState.selection;
  if (!was || was.caret === 0 || !now.empty || now.$from.parentOffset !== 0) return null;
  if (now.$from.start() !== was.blockStart || !oldState.doc.eq(newState.doc)) return null;
  return newState.tr.setSelection(TextSelection.create(newState.doc, oldState.selection.from)).setMeta(key, true);
}

export const CellComposition = Extension.create({
  name: "cellComposition",
  addProseMirrorPlugins() {
    // 조합 중이거나 조합이 막 시작·끝났을 때만 고친다 (붙여 넣기·되돌리기·클릭 같은 다른 변경은 건드리지 않는다)
    let composing = false;
    let lastEvent = 0;
    const nearComposition = (ms: number) => composing || Date.now() - lastEvent < ms;
    return [
      new Plugin({
        key,
        props: {
          handleDOMEvents: {
            compositionstart: () => {
              composing = true;
              lastEvent = Date.now();
              return false;
            },
            compositionend: () => {
              composing = false;
              lastEvent = Date.now();
              return false;
            },
          },
        },
        appendTransaction(trs, oldState, newState) {
          if (trs.some((tr) => tr.getMeta(key)) || trs.some((tr) => tr.getMeta("pointer"))) return null;
          if (!trs.some((tr) => tr.docChanged)) return nearComposition(500) ? fixCaretJump(oldState, newState) : null;
          if (!nearComposition(1000)) return null;
          return fixCommitReshape(oldState, newState) ?? fixMisplacedInsert(oldState, newState) ?? fixMovedToStart(oldState, newState);
        },
      }),
    ];
  },
});
