"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/components/i18n";

/**
 * 글 본문의 사진 슬라이드(<div data-slider>)에 화살표와 "1 / 3" 표시, 아래 진행 막대를 붙인다.
 * 넘기기는 CSS 가로 스크롤(scroll-snap)이라 휴대폰은 손가락으로 밀면 되고, 컴퓨터는 화살표나 ←·→ 키로 넘긴다.
 * 본문은 저장된 HTML을 그대로 넣은 것이라 React가 그리지 않아서, 열린 뒤 직접 붙이고 닫힐 때 떼어 낸다
 */
export function PostSliders() {
  const t = useT();
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = anchor.current?.parentElement;
    if (!root) return;
    const cleanups = [...root.querySelectorAll<HTMLElement>(".prose-blog div[data-slider]")].map((slider) => {
      const count = slider.querySelectorAll(":scope > img").length;
      if (count < 2) return () => {};
      const frame = document.createElement("div");
      frame.className = "slider-frame";
      slider.replaceWith(frame);
      frame.append(slider);
      slider.tabIndex = 0;
      slider.setAttribute("role", "region");
      slider.setAttribute("aria-label", t("사진 슬라이드 ({n}장)", { n: count }));

      const button = (cls: string, label: string, text: string, step: number) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = cls;
        b.setAttribute("aria-label", label);
        b.textContent = text;
        b.addEventListener("click", () => go(index() + step));
        frame.append(b);
        return b;
      };
      const prev = button("slider-prev", t("이전 사진"), "‹", -1);
      const next = button("slider-next", t("다음 사진"), "›", 1);
      const counter = document.createElement("span");
      counter.className = "slider-count";
      counter.setAttribute("aria-hidden", "true");
      const bar = document.createElement("span");
      bar.className = "slider-bar";
      bar.setAttribute("aria-hidden", "true");
      const thumb = document.createElement("span");
      bar.append(thumb);
      frame.append(counter, bar);

      const index = () => Math.round(slider.scrollLeft / Math.max(1, slider.clientWidth));
      const go = (i: number) => {
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        slider.scrollTo({ left: Math.max(0, Math.min(count - 1, i)) * slider.clientWidth, behavior: smooth ? "smooth" : "auto" });
      };
      const update = () => {
        const i = Math.max(0, Math.min(count - 1, index()));
        counter.textContent = `${i + 1} / ${count}`;
        prev.hidden = i === 0;
        next.hidden = i === count - 1;
        thumb.style.width = `${100 / count}%`;
        thumb.style.transform = `translateX(${i * 100}%)`;
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        go(index() + (e.key === "ArrowRight" ? 1 : -1));
      };
      slider.addEventListener("scroll", update, { passive: true });
      slider.addEventListener("keydown", onKey);
      window.addEventListener("resize", update);
      update();

      return () => {
        slider.removeEventListener("scroll", update);
        slider.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", update);
        slider.removeAttribute("tabindex");
        slider.removeAttribute("role");
        slider.removeAttribute("aria-label");
        frame.replaceWith(slider);
      };
    });
    return () => cleanups.forEach((c) => c());
  }, [t]);

  return <span ref={anchor} hidden />;
}
