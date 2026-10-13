"use client";

// 미니룸에 놓은 펫 (SHOP-05, 2026-10-13): 놓은 자리에서 시작해 방 바닥을 자유롭게 돌아다닌다.
// 서버와 브라우저가 같은 첫 화면을 그리도록(hydration) 처음에는 놓은 자리에 서 있다가, 화면이 뜬 뒤에 걷기 시작한다.
// "동작 줄이기"(prefers-reduced-motion)를 켠 기기에서는 놓은 자리에 가만히 있는다.
import { useEffect, useState, type HTMLAttributes } from "react";
import { PetArt } from "@/components/pet-art";
import type { RoomPet } from "@/components/character";
import { clampPetSpot, roomDepth, type RoomSpot } from "@/lib/shop";

/** 한 걸음: 지금 자리에서 너무 멀지 않은 바닥 위 아무 곳 */
function nextSpot(from: RoomSpot): RoomSpot {
  const dx = (Math.random() - 0.5) * 50;
  const dy = (Math.random() - 0.5) * 14;
  return clampPetSpot({ x: from.x + dx, y: from.y + dy });
}

export function WanderingPet({
  pet,
  spot,
  wander = true,
  title,
  className = "",
  ...rest
}: {
  pet: RoomPet;
  spot: RoomSpot;
  /** false면 놓은 자리에 가만히 (꾸미기 화면에서 끌어 옮길 때) */
  wander?: boolean;
  title?: string;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const [at, setAt] = useState<RoomSpot>(spot);
  const [facingLeft, setFacingLeft] = useState(false);
  const [moveMs, setMoveMs] = useState(0);
  const [walking, setWalking] = useState(false);

  // 놓은 자리가 바뀌면(끌어 옮김) 그 자리로 바로 간다 (렌더 중에 비교: React 문서의 "props가 바뀔 때 state 맞추기")
  const [placedAt, setPlacedAt] = useState<RoomSpot>(spot);
  if (placedAt.x !== spot.x || placedAt.y !== spot.y) {
    setPlacedAt(spot);
    setMoveMs(0);
    setAt(spot);
  }

  useEffect(() => {
    if (!wander || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    let here = spot;
    const step = () => {
      // 가끔은 그 자리에서 쉰다
      if (Math.random() < 0.3) {
        timer = setTimeout(step, 1500 + Math.random() * 2000);
        return;
      }
      const to = nextSpot(here);
      const dist = Math.hypot(to.x - here.x, (to.y - here.y) * 2);
      const ms = Math.max(800, dist * 90); // 미니룸 폭 1%에 0.09초쯤
      setFacingLeft(to.x < here.x);
      setMoveMs(ms);
      setWalking(true);
      setAt(to);
      here = to;
      timer = setTimeout(() => {
        setWalking(false);
        timer = setTimeout(step, 600 + Math.random() * 1800);
      }, ms);
    };
    timer = setTimeout(step, 800 + Math.random() * 1200);
    return () => clearTimeout(timer);
  }, [wander, spot.x, spot.y]); // eslint-disable-line react-hooks/exhaustive-deps -- 놓은 자리에서 다시 시작

  return (
    <div
      {...rest}
      title={title}
      data-room-pet={pet.name}
      data-room-pet-placed
      data-walking={walking || undefined}
      className={`absolute -translate-x-1/2 -translate-y-full drop-shadow ${className}`}
      style={{
        left: `${at.x}%`,
        top: `${at.y}%`,
        zIndex: roomDepth("pet", at.y),
        transition: moveMs ? `left ${moveMs}ms linear, top ${moveMs}ms linear` : undefined,
      }}
    >
      {/* 걷는 동안은 통통 뛴다 (globals.css pet-hop) */}
      <span className={`block ${walking ? "animate-[pet-hop_0.45s_ease-in-out_infinite]" : ""}`}>
        <PetArt
          assetKey={pet.assetKey}
          stage={pet.stage}
          accessory={pet.accessory}
          color={pet.color}
          size={72}
          className="pointer-events-none h-[9.5cqw] w-[9.5cqw]"
          // 펫 그림은 오른쪽을 본다: 왼쪽으로 걸을 때만 뒤집는다
          style={facingLeft ? { transform: "scaleX(-1)" } : undefined}
        />
      </span>
    </div>
  );
}
