import { Extension } from "@tiptap/core";

// 줄 간격 (문단·제목 단위). <p style="line-height: 2.2">로 담는다. 저장 화면에서 허용하는 값과 같아야 한다 (src/server/sanitize.ts)
export const DEFAULT_LINE_HEIGHT = "1.8"; // 글 본문 기본 (globals.css의 prose-blog). 이 값을 고르면 지정을 지운다
export const LINE_HEIGHTS = ["1.4", "1.6", DEFAULT_LINE_HEIGHT, "2.2", "2.6"];

const TYPES = ["paragraph", "heading"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeight = Extension.create({
  name: "lineHeight",
  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => (LINE_HEIGHTS.includes(el.style.lineHeight) ? el.style.lineHeight : null),
            renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (value) =>
        ({ commands }) =>
          TYPES.map((type) => commands.updateAttributes(type, { lineHeight: value })).some(Boolean),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          TYPES.map((type) => commands.resetAttributes(type, "lineHeight")).some(Boolean),
    };
  },
});
