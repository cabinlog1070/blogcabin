// 동물 농장 동물 그림 (SVG). 캐릭터처럼 코드로 그린다.
// viewBox 64×64, 발바닥이 y=58 근처. 단계(아기·청소년·어른)에 따라 크기가 커진다.
// 꼬리는 왼쪽에 있다 = 기본으로 오른쪽을 본다 (농장에서 걸을 때 좌우로 뒤집는다).
// 펫 꾸미기(리본·꽃·스카프)는 몸과 함께 커지도록 같은 묶음 안에 그린다.
import type { AnimalStage, PetAccessory } from "@/lib/farm";

const O = "#3b2a20";
const S = `stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`;
const eyes = `<circle cx="26" cy="30" r="2.4" fill="${O}"/><circle cx="38" cy="30" r="2.4" fill="${O}"/><circle cx="26.8" cy="29.2" r=".8" fill="#fff"/><circle cx="38.8" cy="29.2" r=".8" fill="#fff"/>`;
const blush = `<ellipse cx="21.5" cy="35" rx="3" ry="1.7" fill="#ff8fa3" opacity=".55"/><ellipse cx="42.5" cy="35" rx="3" ry="1.7" fill="#ff8fa3" opacity=".55"/>`;
const shadow = `<ellipse cx="32" cy="59" rx="15" ry="2.6" fill="#000" opacity=".14"/>`;

const ANIMALS: Record<string, string> = {
  // 병아리: 노란 동그라미, 주황 부리·발
  "animal.chick":
    `<path d="M16 42l-6-5l2 6l-4 1l7 2z" fill="#ffc93d" ${S}/>` +
    `<path d="M26 56l-2 3M26 56l1 3M38 56l-1 3M38 56l2 3" stroke="#f08a24" stroke-width="2" stroke-linecap="round"/>` +
    `<ellipse cx="32" cy="38" rx="17" ry="18" fill="#ffd84d" ${S}/>` +
    `<path d="M15.5 40q-5-2-4-7q4 1 5 4" fill="#ffd84d" ${S}/><path d="M48.5 40q5-2 4-7q-4 1-5 4" fill="#ffd84d" ${S}/>` +
    `<path d="M30 17q2-6 5-3q-3 0-3 4" fill="#ffd84d" ${S}/>` +
    eyes + blush + `<path d="M29 34l3 3l3-3z" fill="#f08a24" ${S}/>`,
  // 토끼: 흰 몸, 긴 귀, 분홍 귀 안쪽
  "animal.bunny":
    `<circle cx="15" cy="46" r="4.5" fill="#fff" ${S}/>` +
    `<ellipse cx="25" cy="13" rx="4.5" ry="12" fill="#fff" ${S}/><ellipse cx="25" cy="14" rx="2" ry="8" fill="#ffc1d6"/>` +
    `<ellipse cx="39" cy="13" rx="4.5" ry="12" fill="#fff" ${S}/><ellipse cx="39" cy="14" rx="2" ry="8" fill="#ffc1d6"/>` +
    `<ellipse cx="25" cy="55" rx="5" ry="3" fill="#fff" ${S}/><ellipse cx="39" cy="55" rx="5" ry="3" fill="#fff" ${S}/>` +
    `<ellipse cx="32" cy="38" rx="16" ry="16" fill="#fff" ${S}/>` +
    eyes + blush + `<path d="M30.5 34.5h3l-1.5 1.5z" fill="#ff8fa3"/><path d="M32 36v1.5M32 37.5q-2 1.5-3 0M32 37.5q2 1.5 3 0" fill="none" stroke="${O}" stroke-width="1.2" stroke-linecap="round"/>`,
  // 아기 돼지: 분홍, 납작 코, 세모 귀
  "animal.piglet":
    `<path d="M15 42q-6 0-5-4q1-3 4-1q2 2-1 3" fill="none" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M19 22l-2-9l9 5z" fill="#ffb3c7" ${S}/><path d="M45 22l2-9l-9 5z" fill="#ffb3c7" ${S}/>` +
    `<rect x="21" y="50" width="7" height="7" rx="3" fill="#ffb3c7" ${S}/><rect x="36" y="50" width="7" height="7" rx="3" fill="#ffb3c7" ${S}/>` +
    `<ellipse cx="32" cy="37" rx="18" ry="16" fill="#ffc7d6" ${S}/>` +
    eyes + blush + `<ellipse cx="32" cy="38" rx="6" ry="4" fill="#ff9fb8" ${S}/><circle cx="30" cy="38" r="1.1" fill="${O}"/><circle cx="34" cy="38" r="1.1" fill="${O}"/>`,
  // 송아지: 흰 바탕 검은 무늬, 작은 뿔, 코
  "animal.calf":
    `<path d="M16 42q-6 4-7 11" fill="none" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="9" cy="54" rx="2.4" ry="3" fill="#4a3a33"/>` +
    `<path d="M21 21q-3-6 1-8q1 4 3 6" fill="#f3e2c0" ${S}/><path d="M43 21q3-6-1-8q-1 4-3 6" fill="#f3e2c0" ${S}/>` +
    `<ellipse cx="14" cy="27" rx="5" ry="3" transform="rotate(-20 14 27)" fill="#fff" ${S}/><ellipse cx="50" cy="27" rx="5" ry="3" transform="rotate(20 50 27)" fill="#fff" ${S}/>` +
    `<rect x="21" y="50" width="7" height="7" rx="2" fill="#4a3a33" ${S}/><rect x="36" y="50" width="7" height="7" rx="2" fill="#4a3a33" ${S}/>` +
    `<ellipse cx="32" cy="36" rx="17" ry="17" fill="#fff" ${S}/>` +
    `<path d="M18 30q4-8 10-6q-2 6-10 6z" fill="#4a3a33"/><path d="M42 45q6-1 6 3q-4 3-7 0z" fill="#4a3a33"/>` +
    eyes + `<ellipse cx="32" cy="41" rx="8" ry="5.5" fill="#ffc7a8" ${S}/><circle cx="29.5" cy="41" r="1.1" fill="${O}"/><circle cx="34.5" cy="41" r="1.1" fill="${O}"/>`,
  // 아기 양: 몽글몽글 흰 털, 갈색 얼굴과 귀
  "animal.lamb":
    `<circle cx="13" cy="42" r="4" fill="#fffaf0" ${S}/>` +
    `<rect x="22" y="50" width="5" height="8" rx="2" fill="#6b4f3f" ${S}/><rect x="37" y="50" width="5" height="8" rx="2" fill="#6b4f3f" ${S}/>` +
    `<path d="M18 44a6 6 0 0 1 2-11a7 7 0 0 1 9-7a7 7 0 0 1 10 0a7 7 0 0 1 9 7a6 6 0 0 1 2 11a7 7 0 0 1-8 7a7 7 0 0 1-8 2a7 7 0 0 1-8-2a7 7 0 0 1-8-7z" fill="#fffaf0" ${S}/>` +
    `<ellipse cx="20" cy="30" rx="5" ry="2.6" transform="rotate(-25 20 30)" fill="#8a6a55" ${S}/><ellipse cx="44" cy="30" rx="5" ry="2.6" transform="rotate(25 44 30)" fill="#8a6a55" ${S}/>` +
    `<ellipse cx="32" cy="35" rx="9.5" ry="11" fill="#8a6a55" ${S}/>` +
    `<circle cx="28.5" cy="33" r="2" fill="${O}"/><circle cx="35.5" cy="33" r="2" fill="${O}"/><circle cx="29.1" cy="32.4" r=".7" fill="#fff"/><circle cx="36.1" cy="32.4" r=".7" fill="#fff"/>` +
    `<path d="M30 40q2 2 4 0" fill="none" stroke="${O}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M24 25a4 4 0 0 1 5-4a4 4 0 0 1 6 0a4 4 0 0 1 5 4z" fill="#fffaf0" ${S}/>`,
};

/** 펫 꾸미기 그림 (머리 위 리본, 귀 옆 꽃, 목 스카프) */
const ACCESSORY: Record<Exclude<PetAccessory, "none">, string> = {
  ribbon: `<path d="M32 21l-7-5v10zM32 21l7-5v10z" fill="#ff5c8a" ${S}/><circle cx="32" cy="21" r="2.2" fill="#ff8fb0" ${S}/>`,
  flower:
    `<g transform="translate(44 22)">` +
    [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-4" rx="2.8" ry="4" transform="rotate(${a})" fill="#fff" ${S}/>`).join("") +
    `<circle r="2.6" fill="#ffd84d" ${S}/></g>`,
  scarf:
    `<path d="M18 46q14 7 28 0l1 4q-15 8-30 0z" fill="#3fa3e0" ${S}/>` +
    `<path d="M38 50l3 9l4-1l-2-9z" fill="#3fa3e0" ${S}/><path d="M22 48l1 3M27 50l1 3M32 51v3M37 50l-1 3M42 48l-1 3" stroke="#fff" stroke-width="1.2"/>`,
};
const STAGE_SCALE: Record<AnimalStage, number> = { baby: 0.62, teen: 0.82, adult: 1 };

function wrap(body: string, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${body}</svg>`;
}

/** 동물 SVG. 단계가 낮을수록 작게 (발바닥 기준으로 줄인다). accessory = 펫 꾸미기 */
export function animalSvg(assetKey: string, stage: AnimalStage, size = 64, accessory: PetAccessory = "none"): string {
  const body = (ANIMALS[assetKey] ?? ANIMALS["animal.chick"]) + (accessory !== "none" ? (ACCESSORY[accessory] ?? "") : "");
  const k = STAGE_SCALE[stage];
  return wrap(`${shadow}<g transform="translate(${32 - 32 * k} ${58 - 58 * k}) scale(${k})">${body}</g>`, size);
}

/** 아직 부화하지 않은 알 */
export function eggSvg(size = 64): string {
  return wrap(
    shadow +
      `<path d="M32 12c10 0 17 16 17 28s-8 18-17 18s-17-6-17-18s7-28 17-28z" fill="#fff6e3" ${S}/>` +
      `<circle cx="25" cy="34" r="3" fill="#ffd36e"/><circle cx="38" cy="26" r="2.4" fill="#9fd8ff"/><circle cx="37" cy="45" r="3.4" fill="#ffb3c7"/><circle cx="26" cy="49" r="2" fill="#b7e4a5"/>`,
    size,
  );
}

/** 아직 모으지 못한 동물의 실루엣 (카드 도감) */
export function silhouetteSvg(assetKey: string, size = 64): string {
  const body = (ANIMALS[assetKey] ?? ANIMALS["animal.chick"]).replace(/fill="[^"]*"/g, 'fill="#b9ad9d"').replace(/stroke="[^"]*"/g, 'stroke="#b9ad9d"');
  return wrap(`${shadow}${body}`, size);
}

export function toAnimalDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
