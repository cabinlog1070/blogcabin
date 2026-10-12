import { mergeAttributes, Node } from "@tiptap/core";

/**
 * 사진 슬라이드: 사진 여러 장을 한 줄로 묶어 글 읽는 화면에서 옆으로 넘겨 본다.
 * 저장 모양은 <div data-slider><img ...><img ...></div> (src/server/sanitize.ts가 이 모양만 남긴다).
 * 읽는 화면의 화살표·장 수 표시는 src/components/blog/post-sliders.tsx가 붙인다
 */
export const ImageSlider = Node.create<{ label: string }>({
  name: "imageSlider",
  group: "block",
  content: "image+",
  draggable: true,
  isolating: true,

  addOptions() {
    return { label: "" };
  },

  parseHTML() {
    return [{ tag: "div[data-slider]" }];
  },

  renderHTML({ HTMLAttributes }) {
    // data-label은 에디터에서만 보이는 안내 (저장할 때 정화하면서 빠진다)
    return ["div", mergeAttributes(HTMLAttributes, { "data-slider": "", "data-label": this.options.label }), 0];
  },
});
