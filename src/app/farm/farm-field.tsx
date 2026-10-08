"use client";

import { useEffect, useRef } from "react";
import { PetArt } from "@/components/pet-art";
import { eggSvg, toAnimalDataUri } from "@/lib/art/animals";
import { barnSvg, FENCE_H_TILE, FENCE_V_TILE, GRASS_TILE, haySvg, nestSvg, svgUri } from "@/lib/art/farm";
import type { AnimalStage, PetAccessory } from "@/lib/farm";

export type FieldPet = { id: number; name: string; assetKey: string; stage: AnimalStage; accessory: PetAccessory };
export type FieldEgg = { id: number };

// 펫이 돌아다니는 풀밭 영역 (농장 크기에 대한 비율). 위쪽은 둥지·헛간 자리
const AREA = { left: 0.08, right: 0.92, top: 0.36, bottom: 0.84 };
const SPEED = 46; // px/초
const PET_SIZE = 92;

type Walker = { x: number; y: number; tx: number; ty: number; wait: number; facing: 1 | -1; moving: boolean };

/** 처음 자리: 서버와 브라우저가 같은 값을 그리도록 순서로 정한다 (하이드레이션 불일치 방지) */
function startSpot(i: number, n: number) {
  const col = (i + 0.5) / Math.max(n, 1);
  return {
    x: AREA.left + (AREA.right - AREA.left) * col,
    y: AREA.top + (AREA.bottom - AREA.top) * (i % 2 ? 0.75 : 0.35),
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * 풀밭에 울타리를 친 농장. 키우는 펫이 천천히 돌아다닌다 (가만히 있다가 → 근처로 걷기, 걷는 쪽을 바라봄, 통통 튀기).
 * 위치는 매 프레임 React 상태가 아니라 DOM 스타일을 직접 바꾼다 (다시 그리기 없이 부드럽게).
 * 움직임 줄이기(prefers-reduced-motion) 설정이면 제자리에 서 있다.
 */
export function FarmField({
  pets,
  eggs,
  walkingPet,
  onPet,
  onEgg,
  onDecorate,
}: {
  pets: FieldPet[];
  eggs: FieldEgg[];
  walkingPet: FieldPet | null; // 데리고 다니는 펫 (농장에는 없고 "산책 중")
  onPet: (id: number) => void;
  onEgg: (id: number) => void;
  onDecorate: () => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const petRefs = useRef(new Map<number, HTMLButtonElement>());
  const walkers = useRef(new Map<number, Walker>());
  const petKey = pets.map((p) => p.id).join(",");

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const ids = petKey ? petKey.split(",").map(Number) : [];
    // 새로 온 펫은 처음 자리에서 시작, 사라진 펫은 지운다
    ids.forEach((id, i) => {
      if (!walkers.current.has(id)) {
        const s = startSpot(i, ids.length);
        walkers.current.set(id, { ...s, tx: s.x, ty: s.y, wait: rand(300, 2500), facing: i % 2 ? -1 : 1, moving: false });
      }
    });
    for (const id of walkers.current.keys()) if (!ids.includes(id)) walkers.current.delete(id);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = performance.now();
    const apply = (id: number, w: Walker) => {
      const el = petRefs.current.get(id);
      if (!el) return;
      el.style.left = `${(w.x * 100).toFixed(2)}%`;
      el.style.top = `${(w.y * 100).toFixed(2)}%`;
      el.style.zIndex = String(10 + Math.round(w.y * 100));
      el.dataset.moving = String(w.moving);
      el.dataset.facing = w.facing === 1 ? "right" : "left";
      const img = el.querySelector<HTMLElement>("[data-pet-img]");
      if (img) img.style.transform = `scaleX(${w.facing})`;
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const W = field.clientWidth || 1;
      const H = field.clientHeight || 1;
      for (const [id, w] of walkers.current) {
        if (reduce.matches) {
          w.moving = false;
        } else if (w.wait > 0) {
          w.wait -= dt;
          w.moving = false;
        } else {
          const dx = (w.tx - w.x) * W;
          const dy = (w.ty - w.y) * H;
          const dist = Math.hypot(dx, dy);
          if (dist < 2) {
            // 도착: 잠깐 쉬었다가 근처 다른 곳으로
            w.moving = false;
            w.wait = rand(1200, 4200);
            w.tx = Math.min(AREA.right, Math.max(AREA.left, w.x + rand(-0.28, 0.28)));
            w.ty = Math.min(AREA.bottom, Math.max(AREA.top, w.y + rand(-0.2, 0.2)));
          } else {
            const step = Math.min(dist, (SPEED * dt) / 1000);
            w.x += (dx / dist) * (step / W);
            w.y += (dy / dist) * (step / H);
            if (Math.abs(dx) > 1) w.facing = dx > 0 ? 1 : -1;
            w.moving = true;
          }
        }
        apply(id, w);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [petKey]);

  return (
    <div
      ref={fieldRef}
      className="relative isolate h-[clamp(380px,64dvh,620px)] w-full select-none overflow-hidden bg-[#9ed58b]"
      style={{ backgroundImage: `radial-gradient(ellipse at 50% 60%, #b3e29c 0%, transparent 70%), ${GRASS_TILE}` }}
      data-farm-field
      aria-label="동물 농장 풀밭. 펫을 누르면 상태창이 열려요"
      role="group"
    >
      {/* 울타리: 위·아래·왼쪽·오른쪽 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-11" style={{ backgroundImage: FENCE_H_TILE, backgroundRepeat: "repeat-x" }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[200] h-11" style={{ backgroundImage: FENCE_H_TILE, backgroundRepeat: "repeat-x" }} />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 top-0 z-[2] w-[22px]" style={{ backgroundImage: FENCE_V_TILE, backgroundRepeat: "repeat-y" }} />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 top-0 z-[2] w-[22px]" style={{ backgroundImage: FENCE_V_TILE, backgroundRepeat: "repeat-y" }} />

      {/* 헛간, 건초 (장식) */}
      {/* eslint-disable @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
      <img src={svgUri(barnSvg())} alt="" aria-hidden className="pointer-events-none absolute right-[5%] top-6 z-[3] w-[clamp(80px,14vw,140px)]" />
      <img src={svgUri(haySvg())} alt="" aria-hidden className="pointer-events-none absolute right-[22%] top-[20%] z-[3] w-[clamp(44px,6vw,70px)] max-sm:hidden" />

      {/* 알 둥지 */}
      <div className="absolute left-[6%] top-[12%] z-[4] w-[clamp(150px,26vw,240px)]" data-nest>
        <img src={svgUri(nestSvg())} alt="" aria-hidden className="pointer-events-none w-full" />
        <div className="absolute inset-x-[10%] top-[-14%] flex items-end justify-center gap-0.5">
          {eggs.map((e) => (
            <button
              key={e.id}
              type="button"
              data-egg-id={e.id}
              onClick={() => onEgg(e.id)}
              className="transition-transform hover:-translate-y-1 focus-visible:-translate-y-1"
              aria-label="알 살펴보기"
            >
              <img src={toAnimalDataUri(eggSvg(96))} alt="" width={54} height={54} className="pointer-events-none max-sm:h-11 max-sm:w-11" />
            </button>
          ))}
        </div>
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/85 px-2 text-xs font-bold text-ink-soft">
          🥚 알 둥지 {eggs.length > 0 ? eggs.length : ""}
        </span>
      </div>
      {/* eslint-enable @next/next/no-img-element */}

      {/* 돌아다니는 펫 */}
      {pets.map((p, i) => {
        const s = startSpot(i, pets.length);
        return (
          <button
            key={p.id}
            ref={(el) => {
              if (el) petRefs.current.set(p.id, el);
              else petRefs.current.delete(p.id);
            }}
            type="button"
            data-pet-id={p.id}
            data-moving="false"
            onClick={() => onPet(p.id)}
            className="group absolute flex -translate-x-1/2 -translate-y-full flex-col items-center outline-none"
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, zIndex: 10 + Math.round(s.y * 100) }}
            aria-label={`${p.name} 상태 보기`}
          >
            <span className="pet-body block">
              <span data-pet-img className="block transition-transform duration-150">
                <PetArt assetKey={p.assetKey} stage={p.stage} accessory={p.accessory} size={PET_SIZE} className="pointer-events-none drop-shadow-sm max-sm:h-[70px] max-sm:w-[70px]" />
              </span>
            </span>
            <span className="-mt-1 max-w-28 truncate rounded-full bg-white/90 px-2 text-xs font-bold text-ink shadow-sm group-hover:bg-sun group-focus-visible:bg-sun">
              {p.name}
            </span>
          </button>
        );
      })}

      {pets.length === 0 && eggs.length === 0 && !walkingPet && (
        <p className="absolute inset-x-6 top-1/2 z-[5] mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-white/85 p-4 text-center text-sm text-ink-soft">
          아직 농장이 조용해요. 아래 <b>알 받기</b>에서 첫 알을 받아 보세요!
        </p>
      )}

      {/* 데리고 다니는 펫: 농장에는 없고 산책 중 */}
      {walkingPet && (
        <button
          type="button"
          onClick={() => onPet(walkingPet.id)}
          data-walking-pet={walkingPet.id}
          className="absolute left-[6%] top-[46%] z-[6] flex items-center gap-1 rounded-full bg-white/90 py-0.5 pl-1 pr-3 text-xs font-bold shadow max-sm:top-[30%]"
        >
          <PetArt assetKey={walkingPet.assetKey} stage={walkingPet.stage} accessory={walkingPet.accessory} size={30} />
          🐾 {walkingPet.name} 산책 중
        </button>
      )}

      {/* 농장 가운데 아래: 펫 꾸미기 */}
      <button
        type="button"
        onClick={onDecorate}
        className="btn absolute bottom-3 left-1/2 z-[210] -translate-x-1/2 whitespace-nowrap bg-[#ff8fb0] text-white"
      >
        🎀 펫 꾸미기
      </button>
    </div>
  );
}
