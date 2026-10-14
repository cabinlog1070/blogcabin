"use client";
// 릴리스 노트의 화면 사진: 작은 사진을 누르면 화면 가득 크게 본다 (<dialog>, 바깥이나 Esc로 닫힘)
// before가 있으면 [바뀌기 전]·[바뀐 뒤]를 나란히 보여 준다
/* eslint-disable @next/next/no-img-element -- 미리 줄여 둔 webp라 next/image 최적화가 필요 없다 */
import { useRef } from "react";
import { useT } from "@/components/i18n";

export function ReleaseImage({ src, alt, before }: { src: string; alt: string; before?: string }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const shots = before
    ? [
        { src: before, label: t("바뀌기 전") },
        { src, label: t("바뀐 뒤") },
      ]
    : [{ src, label: "" }];

  return (
    <figure data-release-image>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="group flex w-full cursor-zoom-in gap-2 rounded-xl border-2 border-line bg-paper p-1.5 text-left transition hover:border-leaf"
        aria-label={`${alt} (${t("크게 보기")})`}
      >
        {shots.map((s) => (
          <span key={s.src} className="relative min-w-0 flex-1">
            <img src={s.src} alt="" loading="lazy" decoding="async" className="max-h-64 w-full rounded-lg object-contain" />
            {s.label && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-bold text-cream">{s.label}</span>}
          </span>
        ))}
      </button>
      <figcaption className="mt-1 text-xs text-ink-soft">{alt}</figcaption>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto max-h-[92vh] w-[min(1200px,94vw)] max-w-none overflow-auto rounded-2xl border-2 border-line bg-cream p-3 backdrop:bg-ink/70"
        aria-label={alt}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          {shots.map((s) => (
            <div key={s.src} className="relative min-w-0 flex-1">
              <img src={s.src} alt={s.label ? `${alt} (${s.label})` : alt} className="w-full rounded-lg" />
              {s.label && <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2.5 py-0.5 text-sm font-bold text-cream">{s.label}</span>}
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-3 text-sm text-ink-soft">
          <span className="flex-1">{alt}</span>
          <button type="button" onClick={() => dialog.current?.close()} className="btn btn-sub shrink-0 py-1.5 text-sm" autoFocus>
            {t("닫기")}
          </button>
        </p>
      </dialog>
    </figure>
  );
}
