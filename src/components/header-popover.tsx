"use client";

// 헤더 버튼(쪽지·레벨·내 정보) 아래에 뜨는 작은 창의 공통 동작.
// 헤더는 backdrop-filter 때문에 안쪽 fixed 요소를 가두므로 창은 body에 띄운다 (createPortal).
import { usePathname } from "next/navigation";
import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** 화면 가장자리와 띄우는 거리 (px) */
const MARGIN = 12;

export type PopoverBox = { top: number; left: number; width: number };

/**
 * 버튼 바로 아래, 창의 오른쪽 끝을 버튼 오른쪽 끝에 맞춘다.
 * 그러면 화면 밖으로 나가는 경우(휴대폰에서 버튼이 가운데쯤 있을 때)는 양옆 12px 안으로 당긴다.
 * 화면이 창보다 좁으면 왼쪽 12px ~ 오른쪽 12px를 꽉 채운다.
 */
export function anchoredBox(anchor: DOMRect, maxWidth: number): PopoverBox {
  const vw = document.documentElement.clientWidth; // 스크롤 막대를 뺀 폭
  const width = Math.min(maxWidth, vw - MARGIN * 2);
  const left = Math.min(Math.max(MARGIN, anchor.right - width), vw - MARGIN - width);
  return { top: Math.round(anchor.bottom + 6), left: Math.round(left), width };
}

export type HeaderPopover = {
  open: boolean;
  box: PopoverBox | null;
  /** 여는 버튼에 ref={...}로 붙인다 */
  setAnchor: (el: HTMLButtonElement | null) => void;
  /** 창에 붙인다 (PopoverPanel이 붙여 준다) */
  setPanel: (el: HTMLDivElement | null) => void;
  /** 열려 있으면 닫고, 닫혀 있으면 연다. 새로 열었으면 true */
  toggle: () => boolean;
  close: () => void;
};

/** 바깥을 누르거나 Esc를 누르거나 화면을 옮기면 닫힌다. 화면 크기가 바뀌면 자리를 다시 잡는다 */
export function useHeaderPopover(maxWidth: number): HeaderPopover {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<PopoverBox | null>(null);
  // 버튼·창 요소 (렌더 중에 읽지 않도록 ref 대신 콜백 ref + state로 둔다)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);

  // 화면을 옮기면 닫는다 (렌더 중에 이전 주소와 비교)
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!anchor?.contains(t) && !panel?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      anchor?.focus();
    };
    const onResize = () => {
      const r = anchor?.getBoundingClientRect();
      if (r) setBox(anchoredBox(r, maxWidth));
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, maxWidth, anchor, panel]);

  const toggle = () => {
    const next = !open;
    if (next) {
      const r = anchor?.getBoundingClientRect();
      if (r) setBox(anchoredBox(r, maxWidth));
    }
    setOpen(next);
    return next;
  };

  return { open, box, setAnchor, setPanel, toggle, close: () => setOpen(false) };
}

/** 열려 있을 때만 body에 그리는 창 (role="dialog"). data-* 같은 속성은 그대로 붙는다 */
export function PopoverPanel({
  open,
  box,
  panelRef,
  label,
  className = "",
  children,
  ...rest
}: {
  open: boolean;
  box: PopoverBox | null;
  /** useHeaderPopover의 setPanel */
  panelRef: (el: HTMLDivElement | null) => void;
  label: string;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "popover">) {
  if (!open || !box) return null;
  return createPortal(
    <div
      {...rest}
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{ top: box.top, left: box.left, width: box.width }}
      className={`card fixed z-40 ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
