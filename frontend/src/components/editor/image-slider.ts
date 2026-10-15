import { mergeAttributes, Node } from "@tiptap/core";

/** 한 줄에 나란히 놓는 사진은 이 장 수까지 */
export const ROW_MAX = 5;

/**
 * 사진 묶음 두 가지. 저장 모양은 <div data-slider> 또는 <div data-row> 안에 <img>들
 * (backend/src/blog/sanitize.ts가 이 모양만 남긴다).
 * - imageSlider: 글 읽는 화면에서 한 장씩 옆으로 넘겨 본다. 화살표·장 수 표시는 src/components/blog/post-sliders.tsx가 붙인다
 * - imageRow: 한 줄에 ROW_MAX장까지 나란히 놓는다
 */
const imageGroup = (name: "imageSlider" | "imageRow", attr: "data-slider" | "data-row", content: string) =>
  Node.create<{ label: string }>({
    name,
    group: "block",
    content,
    draggable: true,
    isolating: true,

    addOptions() {
      return { label: "" };
    },

    parseHTML() {
      return [{ tag: `div[${attr}]` }];
    },

    renderHTML({ HTMLAttributes }) {
      // data-label은 에디터에서만 보이는 안내 (저장할 때 정화하면서 빠진다)
      return ["div", mergeAttributes(HTMLAttributes, { [attr]: "", "data-label": this.options.label }), 0];
    },
  });

export const ImageSlider = imageGroup("imageSlider", "data-slider", "image+");
export const ImageRow = imageGroup("imageRow", "data-row", `image{1,${ROW_MAX}}`);
