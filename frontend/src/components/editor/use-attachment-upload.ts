"use client";

import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { useT } from "@/components/i18n";
import { ATTACH_MESSAGES, attachmentKind, attachmentProblem } from "@/lib/attachments";
import { msg } from "@/lib/i18n";
import { ROW_MAX } from "./image-slider";

/** 사진을 묶어 넣는 방식: 옆으로 넘기는 슬라이드, 한 줄에 나란히 */
export type ImageGroup = "imageSlider" | "imageRow";

type Uploaded = { key: string; url: string; kind: "image" | "file"; name: string; size: number };

export const BUSY_MESSAGE = msg("다른 파일을 올리는 중이에요. 끝난 뒤 다시 넣어 주세요");

/** 파일 하나를 /api/uploads로 올린다. 실패하면 보여줄 문구를 담아 던진다 */
async function uploadOne(file: File): Promise<Uploaded> {
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/uploads", { method: "POST", body });
  } catch {
    throw new Error(ATTACH_MESSAGES.failed);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? ATTACH_MESSAGES.failed);
  return data as Uploaded;
}

/**
 * 버튼·붙여 넣기·끌어다 놓기로 고른 파일들을 차례로 올려 본문에 넣는다 (POST-07 사진, POST-09 파일).
 * 사진은 <img>, 나머지는 파일 카드. 형식·크기가 맞지 않는 파일은 건너뛰고 문구로 알려준다.
 * group을 주면 사진을 다 올린 뒤 슬라이드나 나란히 놓기 묶음으로 넣는다 (그 묶음의 사진을 고른 채면 그 묶음에 더한다)
 */
export function useAttachmentUpload(editor: Editor | null) {
  const t = useT();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const busy = useRef(false);

  const upload = useCallback(
    async (files: File[], at?: number, group?: ImageGroup) => {
      if (!editor || !files.length) return;
      if (busy.current) {
        const busyMessage = t(BUSY_MESSAGE);
        setErrors((prev) => [...prev.filter((e) => e !== busyMessage), busyMessage]);
        return;
      }
      const problems: string[] = [];
      const ok = files.filter((f) => {
        const problem = attachmentProblem(f.name, f.size);
        if (problem) problems.push(`${f.name}: ${t(problem)}`);
        return !problem;
      });
      setErrors(problems);
      if (!ok.length) return;

      busy.current = true;
      // 올리는 동안 사용자가 글을 고쳐도 넣을 자리가 따라가도록 모든 변경에 맞춰 옮긴다
      let pos = at ?? editor.state.selection.to;
      const track = ({ transaction }: { transaction: { mapping: { map: (p: number) => number } } }) => {
        pos = transaction.mapping.map(pos);
      };
      editor.on("transaction", track);
      // 방금 넣은 것 바로 뒤로 커서를 옮긴다. 글자 자리로 옮겨 두어야 다음 글자가 사진을 덮어쓰지 않는다
      const insert = (content: Parameters<Editor["commands"]["insertContentAt"]>[1], at = pos) => {
        editor.chain().insertContentAt(Math.min(at, editor.state.doc.content.size), content).run();
        pos = editor.state.selection.to;
        const $end = editor.state.doc.resolve(pos);
        const next = TextSelection.findFrom($end, 1, true) ?? TextSelection.findFrom($end, -1, true);
        if (next) editor.view.dispatch(editor.state.tr.setSelection(next));
      };
      const groupImages: { type: "image"; attrs: { src: string; alt: string } }[] = [];
      try {
        for (const [i, file] of ok.entries()) {
          setProgress({ done: i, total: ok.length });
          try {
            const up = await uploadOne(file);
            if (editor.isDestroyed) return;
            if (group && up.kind === "image") {
              groupImages.push({ type: "image", attrs: { src: up.url, alt: "" } });
              continue;
            }
            const node =
              up.kind === "image"
                ? { type: "image", attrs: { src: up.url, alt: "" } }
                : { type: "fileCard", attrs: { href: up.url, name: up.name, size: up.size } };
            insert(node);
          } catch (err) {
            // 서버가 돌려준 문구(ATTACH_MESSAGES의 한국어)도 화면 언어로 바꾼다
            problems.push(`${file.name}: ${t(err instanceof Error ? err.message : ATTACH_MESSAGES.failed)}`);
            setErrors([...problems]);
          }
        }
        if (groupImages.length && group && !editor.isDestroyed) {
          let rest = groupImages;
          let at = Math.min(pos, editor.state.doc.content.size);
          const $at = editor.state.doc.resolve(at);
          if ($at.parent.type.name === group) {
            // 고른 묶음에 더한다. 나란히는 한 줄에 ROW_MAX장까지라 넘치는 사진은 바로 아래 새 줄로
            const room = group === "imageRow" ? ROW_MAX - $at.parent.childCount : rest.length;
            const now = rest.slice(0, room);
            rest = rest.slice(now.length);
            if (now.length) insert(now, $at.end());
            at = $at.after() + now.length; // 사진 한 장은 문서에서 한 칸
          }
          if (rest.length) {
            const size = group === "imageRow" ? ROW_MAX : rest.length;
            const chunks = Array.from({ length: Math.ceil(rest.length / size) }, (_, i) => rest.slice(i * size, (i + 1) * size));
            // 한 장뿐인 묶음은 넘기거나 나란히 놓을 것이 없으니 보통 사진으로
            insert(chunks.map((c) => (c.length > 1 ? { type: group, content: c } : c[0])), at);
          }
        }
      } finally {
        editor.off("transaction", track);
        setProgress(null);
        busy.current = false;
      }
      if (editor.isDestroyed) return;
      // 그사이 제목·태그 칸으로 옮겨 갔으면 포커스를 빼앗지 않는다
      const active = document.activeElement;
      const root = editor.view.dom.closest("[data-rich-editor]");
      if (!active || active === document.body || root?.contains(active)) editor.commands.focus();
    },
    [editor, t],
  );

  return { upload, progress, errors, clearErrors: () => setErrors([]) };
}

/** 붙여 넣기·끌어다 놓기에서 파일만 꺼낸다 */
export function filesFrom(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.size > 0 || attachmentKind(f.name));
}
