"use client";

import { useEffect } from "react";

// 사파리(아이폰·아이패드·맥, 아이폰의 크롬도 같은 엔진)는 <img>·CSS 배경으로 넣은 SVG의 필터를
// 화면 픽셀 밀도와 상관없이 1배로 그려 늘려 보여 준다. 크레용 그림은 선과 종이 결을 모두 필터로 그려서
// 아이폰(3배)에서는 그림 전체가 뭉개져 보였다 (크롬·안드로이드는 선명하다).
// 그래서 사파리에서만, 그림(SVG data URI)을 화면에 보이는 실제 픽셀 크기로 한 번 그려(PNG) 바꿔 끼운다.
// 그림 크기를 SVG의 width·height로 키워서 그리면 필터도 그 크기로 계산돼 선명하다.

const SVG = "data:image/svg+xml";
const MAX_SIDE = 4096;
const rasters = new Map<string, Promise<string | null>>(); // "해시@가로x세로" → PNG blob URL

function needsCrispArt(): boolean {
  const ua = navigator.userAgent;
  return (window.devicePixelRatio || 1) > 1 && /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(ua);
}

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

/** data URI → SVG 글 */
function svgText(uri: string): string | null {
  const comma = uri.indexOf(",");
  try {
    return uri.slice(0, comma).includes(";base64") ? atob(uri.slice(comma + 1)) : decodeURIComponent(uri.slice(comma + 1));
  } catch {
    return null;
  }
}

/** SVG 글의 원래 크기 (width·height, 없으면 viewBox) */
function svgSize(text: string): { w: number; h: number } | null {
  const head = /<svg\b[^>]*>/.exec(text)?.[0] ?? "";
  const w = /\swidth=["']([\d.]+)["']/.exec(head)?.[1], h = /\sheight=["']([\d.]+)["']/.exec(head)?.[1];
  if (w && h) return { w: +w, h: +h };
  const vb = /\sviewBox=["'][\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)["']/.exec(head);
  return vb ? { w: +vb[1], h: +vb[2] } : null;
}

/** SVG를 W×H 픽셀로 그린 PNG의 blob URL */
function rasterize(text: string, W: number, H: number): Promise<string | null> {
  const k = Math.min(1, MAX_SIDE / Math.max(W, H));
  W = Math.max(1, Math.round(W * k));
  H = Math.max(1, Math.round(H * k));
  const key = `${hashOf(text)}@${W}x${H}`;
  let job = rasters.get(key);
  if (!job) {
    job = (async () => {
      // 여는 <svg> 태그의 width·height만 W×H로 바꾼다 (viewBox는 그대로라 그림이 그만큼 커진다)
      const sized = text.replace(/<svg\b[^>]*>/, (head) => head.replace(/\s(?:width|height)=["'][^"']*["']/g, "").replace(/^<svg\b/, `<svg width="${W}" height="${H}"`));
      const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        canvas.getContext("2d")!.drawImage(img, 0, 0, W, H);
        const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        return png ? URL.createObjectURL(png) : null;
      } catch {
        return null;
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    rasters.set(key, job);
  }
  return job;
}

/** background-image 같은 쉼표 목록을 괄호·따옴표 밖의 쉼표로 나눈다 */
function splitLayers(value: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = "", start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out;
}

const layerUri = (layer: string) => /^url\(\s*(["']?)(data:image\/svg\+xml[\s\S]*)\1\s*\)$/.exec(layer)?.[2] ?? null;

type Done = { key: string; value: string };
const state = new WeakMap<HTMLElement, { orig: string; origSize?: string; done?: Done }>();

async function fixImg(img: HTMLImageElement, dpr: number) {
  const src = img.getAttribute("src") ?? "";
  let s = state.get(img);
  if (!s || (src !== s.orig && src !== s.done?.value)) {
    if (!src.startsWith(SVG)) return;
    s = { orig: src };
    state.set(img, s);
  }
  const bw = img.offsetWidth, bh = img.offsetHeight;
  const text = svgText(s.orig), size = text && svgSize(text);
  if (!text || !size || !bw || !bh) return;
  const fit = getComputedStyle(img).objectFit;
  // 기본(fill)은 상자 크기 그대로(SVG 안의 비율 맞춤도 그대로), contain·cover는 그림 비율대로
  let w = bw, h = bh;
  if (fit !== "fill") {
    const r = fit === "cover" ? Math.max(bw / size.w, bh / size.h) : fit === "none" ? 1 : Math.min(bw / size.w, bh / size.h, fit === "scale-down" ? 1 : Infinity);
    w = size.w * r;
    h = size.h * r;
  }
  const key = `${Math.round(w * dpr)}x${Math.round(h * dpr)}`;
  if (s.done?.key === key) return;
  const url = await rasterize(text, w * dpr, h * dpr);
  if (!url || img.getAttribute("src") !== (s.done?.value ?? s.orig)) return;
  s.done = { key, value: url };
  img.setAttribute("src", url);
}

async function fixBackground(el: HTMLElement, dpr: number) {
  const bg = el.style.backgroundImage;
  let s = state.get(el);
  if (!s || (bg !== s.orig && bg !== s.done?.value)) {
    if (!bg.includes(SVG)) return;
    s = { orig: bg, origSize: el.style.backgroundSize };
    state.set(el, s);
  }
  const bw = el.clientWidth, bh = el.clientHeight;
  if (!bw || !bh) return;
  const layers = splitLayers(s.orig);
  el.style.backgroundSize = s.origSize ?? "";
  const sizes = splitLayers(getComputedStyle(el).backgroundSize);
  const keys: string[] = [];
  const jobs = layers.map(async (layer, i) => {
    const uri = layerUri(layer);
    const text = uri && svgText(uri), size = text && svgSize(text);
    const spec = sizes[i % sizes.length] ?? "auto";
    if (!text || !size) return { layer, size: spec };
    // 배경 한 장이 화면에서 차지하는 크기
    const [sx, sy = "auto"] = spec.split(/\s+/);
    let w = size.w, h = size.h;
    const len = (v: string, box: number) => (v.endsWith("%") ? (parseFloat(v) / 100) * box : parseFloat(v));
    if (spec === "cover" || spec === "contain") {
      const r = (spec === "cover" ? Math.max : Math.min)(bw / size.w, bh / size.h);
      w = size.w * r;
      h = size.h * r;
    } else if (sx !== "auto" && sy !== "auto") {
      w = len(sx, bw);
      h = len(sy, bh);
    } else if (sx !== "auto") {
      w = len(sx, bw);
      h = (size.h * w) / size.w;
    } else if (sy !== "auto") {
      h = len(sy, bh);
      w = (size.w * h) / size.h;
    }
    keys.push(`${Math.round(w * dpr)}x${Math.round(h * dpr)}`);
    const url = await rasterize(text, w * dpr, h * dpr);
    // auto는 그림 원래 크기로 깔리므로, 커진 PNG를 원래 크기로 줄여 깔도록 크기를 적는다
    return url ? { layer: `url("${url}")`, size: spec === "cover" || spec === "contain" ? spec : `${w}px ${h}px` } : { layer, size: spec };
  });
  const out = await Promise.all(jobs);
  const key = keys.join(",");
  if (el.style.backgroundImage !== (s.done?.value ?? s.orig)) {
    if (!s.done) el.style.backgroundSize = s.origSize ?? "";
    return;
  }
  if (s.done?.key === key) return;
  const value = out.map((o) => o.layer).join(", ");
  el.style.backgroundImage = value;
  el.style.backgroundSize = out.map((o) => o.size).join(", ");
  s.done = { key, value: el.style.backgroundImage };
}

/** 사파리에서 크레용 그림(SVG)을 화면 픽셀 크기의 PNG로 바꿔 끼워 선명하게 보이게 한다 */
export function CrispArt() {
  useEffect(() => {
    if (!needsCrispArt()) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const queue = new Set<HTMLElement>();
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      while (queue.size) {
        const el = queue.values().next().value!;
        queue.delete(el);
        if (!el.isConnected) continue;
        try {
          if (el instanceof HTMLImageElement) await fixImg(el, dpr);
          else await fixBackground(el, dpr);
        } catch {}
      }
      running = false;
    };
    const resize = new ResizeObserver((entries) => {
      for (const e of entries) queue.add(e.target as HTMLElement);
      void run();
    });
    const watched = new WeakSet<Element>();
    const add = (el: HTMLElement) => {
      queue.add(el);
      if (!watched.has(el)) {
        watched.add(el);
        resize.observe(el);
      }
    };
    const scan = (root: ParentNode) => {
      for (const el of root.querySelectorAll<HTMLElement>(`img[src^="${SVG}"], [style*="${SVG}"]`)) add(el);
    };
    scan(document);
    void run();
    const mutations = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "attributes") {
          const el = m.target as HTMLElement;
          const s = state.get(el);
          const now = el instanceof HTMLImageElement ? el.getAttribute("src") : el.style.backgroundImage;
          // 내가 바꿔 끼운 값이면 넘어간다
          if (s?.done && now === s.done.value) continue;
          if (now?.includes(SVG)) add(el);
        } else {
          for (const n of m.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            if ((n instanceof HTMLImageElement && n.getAttribute("src")?.startsWith(SVG)) || n.style.backgroundImage.includes(SVG)) add(n);
            scan(n);
          }
        }
      }
      void run();
    });
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "style"] });
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);
  return null;
}
