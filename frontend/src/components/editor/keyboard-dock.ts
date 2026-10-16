"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";

// 글쓰기 도구 줄 자리: 컴퓨터에서는 머리말 바로 밑에 붙어 따라오고(top),
// 휴대폰에서 본문을 쓰는 동안 키보드가 올라오면 키보드 바로 위에 붙는다(docked, bottom = 키보드 높이).
// 키보드를 알아채지 못하면(앱 안 미리보기처럼 키보드 높이를 알려 주지 않는 곳) 컴퓨터처럼 위에 따라오게 둔다
const PHONE = "(max-width: 639px)"; // Tailwind sm 아래
const KEYBOARD_MIN = 120; // 이만큼 가려지거나 줄어야 키보드로 본다 (주소창이 접히는 정도는 무시)

export function useKeyboardDock(editor: Editor | null) {
  const [dock, setDock] = useState({ top: 0, docked: false, bottom: 0 });

  useEffect(() => {
    if (!editor) return;
    const phone = window.matchMedia(PHONE);
    let fullHeight = window.innerHeight; // 키보드가 없을 때 창 높이 (안드로이드는 키보드가 올라오면 창이 줄어든다)
    let timer = 0;

    const place = () => {
      const header = document.querySelector("header");
      const top = header && getComputedStyle(header).position === "sticky" ? header.getBoundingClientRect().height : 0;
      const vv = window.visualViewport;
      // 아이폰 사파리는 창은 그대로 두고 보이는 곳만 줄인다 → 가려진 높이만큼 올린다
      const bottom = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      const writing = editor.isFocused;
      if (!writing) fullHeight = Math.max(fullHeight, window.innerHeight);
      const keyboard = bottom > KEYBOARD_MIN || fullHeight - window.innerHeight > KEYBOARD_MIN;
      const docked = phone.matches && writing && keyboard;
      setDock((d) => (d.top === top && d.docked === docked && d.bottom === bottom ? d : { top, docked, bottom }));
    };
    // 키보드는 포커스 조금 뒤에 다 올라온다
    const placeSoon = () => {
      place();
      window.clearTimeout(timer);
      timer = window.setTimeout(place, 350);
    };

    place();
    editor.on("focus", placeSoon);
    editor.on("blur", placeSoon);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    phone.addEventListener("change", place);
    return () => {
      window.clearTimeout(timer);
      editor.off("focus", placeSoon);
      editor.off("blur", placeSoon);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      phone.removeEventListener("change", place);
    };
  }, [editor]);

  return dock;
}
