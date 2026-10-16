"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n";
import { roofHex } from "@/lib/art/town";
import type { TownData, TownTarget } from "./types";

// 광장 그림(SVG)을 한 번 그려 둔 비트맵. 크레용 결 필터 때문에 SVG를 그리는 데 시간이 걸려서,
// 그린 결과를 PNG로 브라우저 캐시(Cache Storage)에 남겨 두고 다음에 광장에 올 때(새로고침 포함) 바로 쓴다.
// 그림 주소(SVG 내용)가 같으면 같은 그림이라, 그림이 바뀌면 키도 바뀐다.
const rasterCache = new Map<string, HTMLCanvasElement>();
// 이웃 주민이 많으면 광장 그림이 150장을 넘는다(주민 모습마다 9장). 모자라면 광장에 다시 올 때마다 몇 장씩 새로 그렸다
const RASTER_CACHE_MAX = 400;
// v2 (2026-10-13): 삼성 인터넷에서 다크 모드 등으로 뿌옇게 바뀐 그림이 v1에 남아, 광장이 계속 흐리게 보였다.
// 이름을 바꿔 예전 저장분을 모두 버리고 새로 그린다
const STORE = "town-raster-v2";
const OLD_STORES = ["town-raster-v1"];
const STORE_MAX = 800;

/** 문자열 → 짧은 해시 (FNV-1a 두 벌) */
function hashOf(text: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

async function openStore(): Promise<Cache | null> {
  try {
    if (typeof caches === "undefined") return null;
    for (const old of OLD_STORES) void caches.delete(old).catch(() => {});
    // 삼성 인터넷은 그린 그림을 PNG로 저장할 때 색이 바뀌어(다크 모드·추적 방지) 다음 방문부터 광장이 뿌옇게 보였다.
    // 그래서 삼성 인터넷에서는 저장하지 않고 매번 새로 그린다 (크롬 등은 그대로 저장)
    if (/SamsungBrowser/i.test(navigator.userAgent)) {
      void caches.delete(STORE).catch(() => {});
      return null;
    }
    return await caches.open(STORE);
  } catch {
    return null;
  }
}

/** 그림 → 원래 크기로 그린 캔버스 */
async function drawToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  // 같은 SVG 주소를 다른 화면(꾸미기의 지붕 미리 보기 등)에서 작게 그린 적이 있으면,
  // 사파리는 그 작은 그림을 재사용해 광장의 집이 작게·한쪽에 붙어 보였다.
  // 그래서 광장 그림은 새 주소(blob URL)로 불러 원래 크기로 그린다.
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const rasterKey = (uri: string) => `/__town-raster/${hashOf(uri)}.png`;

// 같은 그림(예: 내 캐릭터와 같은 모습의 이웃)을 동시에 두 번 그리지 않게, 그리는 중인 것은 함께 기다린다
const drawing = new Map<string, Promise<HTMLCanvasElement>>();

/** SVG data URI → 그린 캔버스 (이 탭에서 그린 적 있으면 그대로, 브라우저 캐시에 있으면 PNG로, 없으면 새로 그린다) */
async function rasterize(uri: string, store: Cache | null): Promise<{ canvas: HTMLCanvasElement; fresh: boolean }> {
  const hit = rasterCache.get(uri);
  if (hit) return { canvas: hit, fresh: false };
  const busy = drawing.get(uri);
  if (busy) return { canvas: await busy, fresh: false };
  const job = rasterizeOnce(uri, store);
  const shared = job.then((r) => r.canvas);
  shared.catch(() => {}); // 실패는 처음 부른 쪽이 받는다
  drawing.set(uri, shared);
  try {
    return await job;
  } finally {
    drawing.delete(uri);
  }
}

async function rasterizeOnce(uri: string, store: Cache | null): Promise<{ canvas: HTMLCanvasElement; fresh: boolean }> {
  let canvas: HTMLCanvasElement | null = null;
  let fresh = false;
  try {
    const saved = await store?.match(rasterKey(uri));
    if (saved) canvas = await drawToCanvas(await saved.blob());
  } catch {}
  if (!canvas) {
    canvas = await drawToCanvas(await (await fetch(uri)).blob());
    fresh = true;
    saveFresh(uri, canvas, store);
  }
  if (rasterCache.size >= RASTER_CACHE_MAX) rasterCache.delete(rasterCache.keys().next().value!);
  rasterCache.set(uri, canvas);
  return { canvas, fresh };
}

/**
 * 여러 장을 동시에 준비한다. 저장해 둔 PNG를 푸는 일은 브라우저가 따로 해서, 한 장씩 기다리던 때보다 다시 올 때 훨씬 빠르다.
 * 새로 그리는 SVG도 불러오기·풀기를 겹쳐서 기다리는 틈이 줄어든다
 */
async function rasterizeAll(
  list: { key: string; uri: string }[],
  store: Cache | null,
  onEach: (key: string, canvas: HTMLCanvasElement, fresh: boolean) => void,
  isCancelled: () => boolean,
  workers = 4,
) {
  let next = 0;
  const work = async () => {
    while (next < list.length && !isCancelled()) {
      const { key, uri } = list[next++];
      const { canvas, fresh } = await rasterize(uri, store);
      onEach(key, canvas, fresh);
    }
  };
  await Promise.all(Array.from({ length: Math.min(workers, list.length) }, work));
}

/**
 * 캔버스 → PNG. 크롬의 toBlob은 브라우저가 한가할 때까지 미뤄서, 광장이 움직이기 시작하면 한참 걸렸다.
 * 그래서 되는 브라우저에서는 OffscreenCanvas에 옮겨 바꾼다
 */
async function toPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const off = new OffscreenCanvas(canvas.width, canvas.height);
      const ctx = off.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, 0);
        return await off.convertToBlob({ type: "image/png" });
      }
    }
  } catch {}
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** 새로 그린 그림을 PNG로 브라우저 캐시에 남긴다 (기다리지 않는다: 그동안 다음 그림을 그린다) */
function saveFresh(uri: string, canvas: HTMLCanvasElement, store: Cache | null) {
  if (!store) return;
  void toPng(canvas).then((png) => {
    if (png) return store.put(rasterKey(uri), new Response(png, { headers: { "content-type": "image/png" } }));
  }).catch(() => {});
}

/** 옛 그림이 쌓이지 않게: 너무 많아지면 비운다 */
async function trimStore(store: Cache | null) {
  try {
    if (store && (await store.keys()).length > STORE_MAX) await caches.delete(STORE);
  } catch {}
}

export function TownGame({ data, className = "" }: { data: TownData; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useT();
  // 광장을 준비하는 동안 빈 초록 화면 대신 안내를 보여 준다 (그린 그림 수 / 전체)
  const [loading, setLoading] = useState<{ done: number; total: number } | null>({ done: 0, total: 0 });

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let observer: ResizeObserver | null = null;
    let starting = false;
    let cancelled = false;

    const onEnter = (target: TownTarget) => {
      router.push(target.kind === "link" ? target.href : "/");
    };

    // Phaser는 window가 필요해서 브라우저에서만 불러온다
    const start = async () => {
      if (game || starting) return;
      starting = true;
      setLoading({ done: 0, total: 0 });
      // 게임 엔진(Phaser)은 크니까 그림을 준비하는 동안 같이 받아 둔다
      const phaserLoad = import("phaser");
      const { createTownScene, townTextures } = await import("./scene");
      // 광장 그림(SVG)을 미리 그려 둔다. 그리는 동안 진행 상황을 보여 준다. 글꼴도 준비된 뒤에 글자를 그린다
      const textures = townTextures(data, t);
      const first = textures.filter((x) => !x.later);
      const later = textures.filter((x) => x.later);
      const images = new Map<string, HTMLCanvasElement>();
      setLoading({ done: 0, total: first.length });
      const store = await openStore();
      await trimStore(store);
      let lastPaint = 0;
      await rasterizeAll(first, store, (key, canvas, isFresh) => {
        images.set(key, canvas);
        if (!isFresh) return;
        // 진행 표시는 0.1초마다만 바꾼다 (자주 다시 그리면 그만큼 느려진다)
        const now = performance.now();
        if (now - lastPaint > 100) {
          lastPaint = now;
          setLoading({ done: images.size, total: first.length });
        }
      }, () => cancelled);
      if (cancelled) return;
      const Phaser = (await phaserLoad).default;
      await document.fonts.ready;
      starting = false;
      // 불러오는 동안 화면을 떠났으면 만들지 않는다
      if (cancelled || !containerRef.current) return;
      // 캔버스를 화면의 실제 픽셀 수(devicePixelRatio배)로 그리고 CSS로 줄여 보여 준다.
      // 예전에는 CSS 크기로 그린 뒤 휴대폰이 2~3배로 늘려 보여서 글자가 흐릿하게 깨졌다
      const el = containerRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const size = () => [Math.max(1, Math.round(el.clientWidth * dpr)), Math.max(1, Math.round(el.clientHeight * dpr))] as const;
      const [w, h] = size();
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: el,
        backgroundColor: "#8aba5c",
        // 안드로이드(갤럭시 등): 한 번에 여러 그림 장을 섞어 그리면 일부 그래픽 칩에서 움직이는 주민이 깜빡이고
        // 집이 사라졌다(2026-10-13 제보). 한 번에 한 장씩 그리게 해 그 문제를 피한다 (그리는 횟수는 조금 늘어난다)
        render: /Android/i.test(navigator.userAgent) ? { maxTextures: 1 } : undefined,
        physics: { default: "arcade", arcade: { debug: false } },
        scale: { mode: Phaser.Scale.NONE, width: w, height: h, zoom: 1 / dpr, autoRound: false },
        scene: createTownScene(Phaser, data, images, onEnter, t, getComputedStyle(document.body).fontFamily, dpr),
      });
      observer = new ResizeObserver(() => {
        const [nw, nh] = size();
        if (game && (game.scale.width !== nw || game.scale.height !== nh)) game.scale.resize(nw, nh);
      });
      observer.observe(el);
      // 첫 장면을 그리면 안내를 내리고, 뒤로 미룬 그림(주민의 걷는 모습·동작 소품·불꽃)을 그려 넣는다
      const g = game;
      g.events.once("postrender", () => {
        setLoading(null);
        void (async () => {
          const extra = new Map<string, HTMLCanvasElement>();
          await rasterizeAll(later, store, (key, canvas) => extra.set(key, canvas), () => cancelled, 2);
          if (cancelled || game !== g) return;
          // 한꺼번에 넣는다: 이웃 주민은 걷는 모습·소품이 모두 있어야 움직이기 시작한다 (residents.ts)
          for (const [key, canvas] of extra) if (!g.textures.exists(key)) g.textures.addCanvas(key, canvas);
        })();
      });
    };
    const stop = () => {
      observer?.disconnect();
      observer = null;
      game?.destroy(true);
      game = null;
    };

    // 휴대폰에서도 광장을 띄운다 (2026-10-08 결정, 그 전에는 휴대폰에서 간단 메뉴만 보였다)
    void start();

    return () => {
      cancelled = true;
      stop();
    };
    // 광장 데이터가 바뀌면(새 이웃 등) 게임을 다시 만든다
  }, [data, router, t]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden bg-[#8aba5c]"
        aria-label={t("중앙 광장. 방향키나 WASD로 움직이고 Space로 건물에 들어갑니다.")}
        // 집 단계 확인용 (TOWN-11, e2e): 캔버스 그림 대신 이 값으로 확인한다
        data-my-house-stage={data.myHouse?.stage ?? ""}
        data-neighbor-stages={data.neighbors.map((h) => `${h.slug}:${h.stage}`).join(",")}
        // 지붕 색 확인용 (TOWN-07, e2e): 실제로 칠하는 색
        data-my-roof={data.myHouse ? roofHex(data.myHouse.roofColor, data.myHouse.backgroundAsset) : ""}
        data-neighbor-roofs={data.neighbors.map((h) => `${h.slug}:${roofHex(h.roofColor, h.backgroundAsset)}`).join(",")}
        // 데리고 다니는 펫 (TOWN-09). 광장 씬이 펫을 그리면 캔버스에도 data-follow-pet이 붙는다
        data-carried-pet={data.player?.pet?.name ?? ""}
      />
      {loading && (
        <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center" data-town-loading>
          <p className="rounded-full bg-paper/95 px-5 py-2.5 font-display text-lg text-ink shadow-md">
            {loading.total ? t("🏕 광장 준비 중 {percent}%", { percent: Math.round((loading.done / loading.total) * 100) }) : t("🏕 광장 준비 중…")}
          </p>
        </div>
      )}
    </div>
  );
}
