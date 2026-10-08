"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { roofHex } from "@/lib/art/town";
import type { TownData, TownTarget } from "./types";

export function TownGame({ data, className = "" }: { data: TownData; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let starting = false;
    let cancelled = false;

    const onEnter = (target: TownTarget) => {
      router.push(target.kind === "link" ? target.href : "/");
    };

    // Phaser는 window가 필요해서 브라우저에서만 불러온다
    const blobUrls: string[] = [];
    const start = async () => {
      if (game || starting) return;
      starting = true;
      const Phaser = (await import("phaser")).default;
      const { createTownScene, townTextures } = await import("./scene");
      // 광장 그림(SVG)을 미리 이미지로 불러 둔다. 글꼴도 준비된 뒤에 글자를 그린다
      const images = new Map<string, HTMLImageElement>();
      await Promise.all([
        document.fonts.ready,
        ...townTextures(data).map(async ({ key, uri }) => {
          // 같은 SVG 주소를 다른 화면(꾸미기의 지붕 미리 보기 등)에서 작게 그린 적이 있으면,
          // 사파리는 그 작은 그림을 재사용해 광장의 집이 작게·한쪽에 붙어 보였다.
          // 그래서 광장 그림은 매번 새 주소(blob URL)로 불러 원래 크기로 그리게 한다.
          const blob = await (await fetch(uri)).blob();
          const url = URL.createObjectURL(blob);
          blobUrls.push(url);
          const img = new Image();
          img.src = url;
          await img.decode();
          images.set(key, img);
        }),
      ]);
      starting = false;
      // 불러오는 동안 화면을 떠났으면 만들지 않는다
      if (cancelled || !containerRef.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: "#8fd18a",
        physics: { default: "arcade", arcade: { debug: false } },
        scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
        scene: createTownScene(Phaser, data, images, onEnter, getComputedStyle(document.body).fontFamily),
      });
    };
    const stop = () => {
      game?.destroy(true);
      game = null;
      for (const url of blobUrls.splice(0)) URL.revokeObjectURL(url);
    };

    // 휴대폰에서도 광장을 띄운다 (2026-10-08 결정, 그 전에는 휴대폰에서 간단 메뉴만 보였다)
    void start();

    return () => {
      cancelled = true;
      stop();
    };
    // 광장 데이터가 바뀌면(새 이웃 등) 게임을 다시 만든다
  }, [data, router]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden bg-[#8fd18a] ${className}`}
      aria-label="중앙 광장. 방향키나 WASD로 움직이고 Space로 건물에 들어갑니다."
      // 집 단계 확인용 (TOWN-11, e2e): 캔버스 그림 대신 이 값으로 확인한다
      data-my-house-stage={data.myHouse?.stage ?? ""}
      data-neighbor-stages={data.neighbors.map((h) => `${h.slug}:${h.stage}`).join(",")}
      // 지붕 색 확인용 (TOWN-07, e2e): 실제로 칠하는 색
      data-my-roof={data.myHouse ? roofHex(data.myHouse.roofColor, data.myHouse.backgroundAsset) : ""}
      data-neighbor-roofs={data.neighbors.map((h) => `${h.slug}:${roofHex(h.roofColor, h.backgroundAsset)}`).join(",")}
      // 데리고 다니는 펫 (TOWN-09). 광장 씬이 펫을 그리면 캔버스에도 data-follow-pet이 붙는다
      data-carried-pet={data.player?.pet?.name ?? ""}
    />
  );
}
