"use client";

import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useT } from "@/components/i18n";
import { Icon } from "@/components/icon";
import { PetArt, PetCard } from "@/components/pet-art";
import { eggSvg, silhouetteSvg, toAnimalDataUri } from "@/lib/art/animals";
import type { IconName } from "@/lib/art/icons";
import {
  animalStage,
  CARE_ACTIONS,
  type CareAction,
  formatMetDate,
  GENDER_LABEL,
  MAX_ACTIVE_ANIMALS,
  PET_ACCESSORIES,
  PET_COLORS,
  PET_NAME_MAX,
  type PetColor,
  petDisplayName,
  petLevel,
  petLevelProgress,
  POTION_GROWTH,
  STAGE_LABEL,
} from "@/lib/farm";
import type { T } from "@/lib/i18n";
import type { FarmAnimal, SpeciesCard } from "@/server/farm";
import {
  buyEgg,
  buyPotion,
  careAnimal,
  claimEgg,
  type FarmResult,
  hatchAllEggs,
  hatchEgg,
  renamePet,
  setCarriedPet,
  setDisplayedCard,
  setPetAccessory,
  setPetColor,
  givePotion,
} from "./actions";
import { FarmField, type FieldPet } from "./farm-field";

type FreeEgg = { kind: "starter"; label: string } | { kind: "level"; level: number; label: string };
type Pet = FarmAnimal & { name: string; assetKey: string; growExp: number; maxLevel: number };

/** 색 고르기 버튼의 동그란 견본 (기본 = 동물마다 다른 색이라 무지개) */
const COLOR_SWATCH: Record<PetColor, string> = {
  default: "conic-gradient(#f6a24e, #9fd88f, #8ccbe8, #f7b8c8, #f6a24e)",
  brown: "#c49468",
  yellow: "#ffe06e",
  red: "#f0847a",
  black: "#3f3735",
  white: "#fbf8f1",
  pink: "#f7b8c8",
  orange: "#ffb36b",
  mint: "#a8e6cf",
  sky: "#9fd3f0",
  purple: "#c9a8ea",
  gray: "#b8b2ae",
  green: "#a6d98a",
};

/** 돌보기 버튼 아이콘 (CARE_ACTIONS의 이모지 대신) */
const CARE_ICON: Record<CareAction, IconName> = { feed: "carrot", pet: "hand" };

const isPet = (a: FarmAnimal): a is Pet => a.status !== "egg" && !!a.assetKey && !!a.growExp && !!a.maxLevel && !!a.name;
/** 화면에 보이는 펫 이름: 기본 이름(종류 이름)은 번역한다 */
const shownName = (t: T, p: Pet) => petDisplayName(t, p.name, p.speciesName);
const toField = (t: T, p: Pet): FieldPet => ({ id: p.id, name: shownName(t, p), assetKey: p.assetKey, stage: animalStage(p.growth, p.growExp), accessory: p.accessory, color: p.color });

/* eslint-disable @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 next/image 최적화가 필요 없다 */

export function FarmView({
  active,
  grown,
  freeEggs,
  nestLeft,
  fieldLeft,
  maxEggs,
  coins,
  potions,
  species,
  displayedId,
  eggPrice,
  potionPrice,
  eggEvery,
}: {
  active: FarmAnimal[];
  grown: FarmAnimal[];
  freeEggs: FreeEgg[];
  nestLeft: number; // 알 둥지에 남은 자리
  fieldLeft: number; // 풀밭(키우는 동물)에 남은 자리
  maxEggs: number;
  coins: number;
  potions: number;
  species: SpeciesCard[];
  displayedId: number | null;
  eggPrice: number;
  potionPrice: number;
  eggEvery: number;
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<FarmResult | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [decorId, setDecorId] = useState<number | null>(null); // 꾸미는 펫 (null이면 꾸미기 창이 닫혀 있다)
  const run = (fn: () => Promise<FarmResult>) => start(async () => setMessage(await fn()));

  // 결과 문구는 3초 뒤에 저절로 사라진다 (새 문구가 오면 다시 3초)
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const eggs = active.filter((a) => a.status === "egg");
  const growing = active.filter(isPet);
  const grownPets = grown.filter(isPet);
  const allPets = [...growing, ...grownPets];
  const carried = allPets.find((p) => p.carried) ?? null;
  const fieldPets = growing.filter((p) => !p.carried).map((p) => toField(t, p));
  const opened = [...active, ...grown].find((a) => a.id === openId) ?? null;
  const decorPet = allPets.find((p) => p.id === decorId) ?? null;
  const openDecorate = (id?: number) => {
    setOpenId(null);
    setDecorId(id ?? carried?.id ?? allPets[0]?.id ?? 0);
  };
  const [potionsBefore, potionsAfter = ""] = t("가방 속 물약 {n}개").split("{n}");

  return (
    <>
      {/* 결과 문구: 상태창 위에도 보이도록 화면 위쪽에 띄운다 */}
      <p
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed left-1/2 top-[calc(var(--header-h)+10px)] z-[80] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-paper px-4 py-2 text-center text-sm font-bold shadow-lg transition-opacity ${
          message ? "opacity-100" : "opacity-0"
        } ${message?.ok ? "text-leaf-dark" : "text-berry"}`}
      >
        {message?.text}
      </p>

      <FarmField
        pets={fieldPets}
        eggs={eggs.map((e) => ({ id: e.id }))}
        walkingPet={carried ? toField(t, carried) : null}
        onPet={setOpenId}
        onEgg={setOpenId}
        onHatchAll={fieldLeft > 0 && !pending ? () => run(hatchAllEggs) : null}
        onDecorate={() => openDecorate()}
      />

      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 md:grid-cols-2">
        {/* 알 받기 */}
        <section className="card p-4">
          <h2 className="font-display text-xl">
            <Icon name="egg" size={26} className="-mt-1" /> {t("알 받기")}
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            {nestLeft <= 0
              ? t("알 둥지가 꽉 찼어요. 부화시킨 뒤에 받을 수 있어요")
              : t("레벨 {every}마다 무료 알을 하나씩 받아요 · 알 둥지 남은 자리 {left} / {max}", { every: eggEvery, left: nestLeft, max: maxEggs })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {freeEggs.map((egg) => (
              <button
                key={egg.kind === "level" ? egg.level : "starter"}
                type="button"
                disabled={pending || nestLeft <= 0}
                onClick={() => run(() => claimEgg(egg.kind, egg.kind === "level" ? egg.level : undefined))}
                className="btn bg-sun py-1.5 text-sm text-ink"
              >
                <Icon name="egg" size={18} /> {t("{label} (무료)", { label: egg.kind === "level" ? t(egg.label, { level: egg.level }) : t(egg.label) })}
              </button>
            ))}
            <button
              type="button"
              disabled={pending || nestLeft <= 0 || coins < eggPrice}
              onClick={() => run(buyEgg)}
              className="btn bg-paper py-1.5 text-sm text-ink"
            >
              <Icon name="coin" size={18} /> {t("{price}으로 알 사기", { price: eggPrice })}
            </button>
          </div>
          {eggs.length > 0 && (
            <button
              type="button"
              disabled={pending || fieldLeft <= 0}
              onClick={() => run(hatchAllEggs)}
              className="btn mt-3 bg-leaf py-1.5 text-sm text-white"
              data-hatch-all-card
            >
              <Icon name="egg" size={18} /> {t("알 {n}개 한 번에 부화시키기", { n: Math.min(eggs.length, Math.max(fieldLeft, 0)) || eggs.length })}
            </button>
          )}
        </section>

        {/* 농장 가게: 물약 */}
        <section className="card p-4">
          <h2 className="font-display text-xl">
            <Icon name="potion" size={26} className="-mt-1" /> {t("농장 가게")}
          </h2>
          <p className="mt-1 text-xs text-ink-soft">{t("물약 하나를 쓰면 경험치 +{growth}. 하루 횟수 제한 없이, 가진 만큼 쓸 수 있어요.", { growth: POTION_GROWTH })}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-cream px-3 py-1 text-sm" data-potions={potions}>
              {potionsBefore}
              <b>{potions}</b>
              {potionsAfter}
            </span>
            <button type="button" disabled={pending || coins < potionPrice} onClick={() => run(buyPotion)} className="btn bg-paper py-1.5 text-sm text-ink">
              <Icon name="coin" size={18} /> {t("{price}으로 물약 사기", { price: potionPrice })}
            </button>
          </div>
        </section>

        {/* 내 동물 목록 (풀밭에서 누르기 어려울 때도 여기서 상태창을 연다) */}
        <section className="card p-4 md:col-span-2">
          <h2 className="font-display text-xl">
            <Icon name="pet" size={26} className="-mt-1" /> {t("내 동물")}{" "}
            <span className="text-sm text-ink-soft">
              {t("키우는 중 {n} / {max}", { n: growing.length, max: MAX_ACTIVE_ANIMALS })} · {t("알 {n} / {max}", { n: eggs.length, max: maxEggs })}
            </span>
          </h2>
          {growing.length + eggs.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">{t("아직 키우는 동물이 없어요. 위에서 알을 받아 보세요!")}</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("키우는 동물")}>
              {eggs.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setOpenId(e.id)} className="btn bg-paper py-1.5 text-sm text-ink">
                    <Icon name="egg" size={18} /> {t("알 (부화 전)")}
                  </button>
                </li>
              ))}
              {growing.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpenId(p.id)} className="btn bg-paper py-1 pl-1 text-sm text-ink" aria-label={t("{name} 상태창 열기", { name: shownName(t, p) })}>
                    <PetArt assetKey={p.assetKey} stage={animalStage(p.growth, p.growExp)} accessory={p.accessory} color={p.color} size={32} />
                    {shownName(t, p)} · Lv.{petLevel(p.growth, p.growExp, p.maxLevel)}
                    {p.carried && (
                      <span className="text-xs text-sky">
                        <Icon name="pet" size={14} /> {t("산책 중")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 카드 도감 */}
        <section className="card p-4 md:col-span-2" data-card-book>
          <h2 className="font-display text-xl">
            <Icon name="guestbook" size={26} className="-mt-1" /> {t("카드 도감")}{" "}
            <span className="text-sm text-ink-soft">
              {t("{have} / {total}종 · 카드 {cards}장", { have: new Set(grownPets.map((p) => p.assetKey)).size, total: species.length, cards: grownPets.length })}
            </span>
          </h2>
          <p className="mt-1 text-xs text-ink-soft">{t("다 키운 동물은 카드가 돼요. 카드를 누르면 데리고 다니거나 블로그 프로필에 전시할 수 있어요.")}</p>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {species.map((sp) => {
              const mine = grownPets.filter((p) => p.assetKey === sp.assetKey);
              return (
                <li
                  key={sp.id}
                  data-species-slot={sp.assetKey}
                  data-collected={mine.length > 0}
                  className={`flex flex-col items-center rounded-2xl border-2 p-2 text-center ${mine.length ? "border-sun bg-honey" : "border-dashed border-line bg-cream"}`}
                >
                  {mine.length ? (
                    <PetArt assetKey={sp.assetKey} stage="adult" size={56} />
                  ) : (
                    <img src={toAnimalDataUri(silhouetteSvg(sp.assetKey, 112))} alt="" width={56} height={56} aria-hidden />
                  )}
                  <span className="text-xs font-bold">{mine.length ? t(sp.name) : "???"}</span>
                  <span className="text-[10px] text-ink-soft">{mine.length ? t("{n}장", { n: mine.length }) : t("Lv.{level}까지", { level: sp.maxLevel })}</span>
                </li>
              );
            })}
          </ul>
          {grownPets.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-3" aria-label={t("내 카드")}>
              {grownPets.map((p) => (
                <li key={p.id} data-card-id={p.id}>
                  <button type="button" onClick={() => setOpenId(p.id)} className="relative block" aria-label={t("{name} 카드 보기", { name: shownName(t, p) })}>
                    <PetCard
                      pet={{ name: shownName(t, p), assetKey: p.assetKey, accessory: p.accessory, color: p.color, level: p.maxLevel }}
                      speciesName={p.speciesName ? t(p.speciesName) : ""}
                      grownAt={p.grownAt}
                      locale={locale}
                    />
                    {displayedId === p.id && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-leaf px-2 text-[11px] font-bold text-white">
                        <Icon name="achievement" size={14} /> {t("전시 중")}
                      </span>
                    )}
                    {p.carried && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sky px-2 text-[11px] font-bold text-white">
                        <Icon name="pet" size={14} /> {t("산책 중")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {opened && (
        <Modal label={isPet(opened) ? t("{name} 상태창", { name: shownName(t, opened) }) : t("알")} onClose={() => setOpenId(null)}>
          {isPet(opened) ? (
            <PetStatus
              key={opened.id}
              pet={opened}
              pending={pending}
              potions={potions}
              displayed={displayedId === opened.id}
              run={run}
              onDecorate={() => openDecorate(opened.id)}
            />
          ) : (
            <div className="flex flex-col items-center p-6 text-center">
              <img src={toAnimalDataUri(eggSvg(192))} alt="" width={96} height={96} aria-hidden />
              <h2 className="mt-2 font-display text-2xl">{t("알")}</h2>
              <p className="text-sm text-ink-soft">{t("무엇이 나올지 몰라요. 성별도 태어날 때 정해져요.")}</p>
              {fieldLeft <= 0 && <p className="mt-2 text-sm font-bold text-berry">{t("풀밭이 꽉 찼어요. 다 키운 뒤에 부화시켜 주세요")}</p>}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" disabled={pending || fieldLeft <= 0} onClick={() => run(() => hatchEgg(opened.id))} className="btn bg-leaf text-white">
                  <Icon name="egg" size={20} /> {t("부화시키기")}
                </button>
                {eggs.length > 1 && (
                  <button
                    type="button"
                    disabled={pending || fieldLeft <= 0}
                    onClick={() => {
                      setOpenId(null);
                      run(hatchAllEggs);
                    }}
                    className="btn bg-sun text-ink"
                  >
                    <Icon name="egg" size={20} /> {t("모두 부화시키기")}
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {decorId !== null && (
        <Modal label={t("펫 꾸미기")} onClose={() => setDecorId(null)}>
          <div className="p-5" data-decorate-panel>
            <h2 className="font-display text-2xl">
              <Icon name="hat" size={30} className="-mt-1" /> {t("펫 꾸미기")}
            </h2>
            <p className="text-sm text-ink-soft">{t("꾸밀 펫을 골라 주세요. 무료예요. 농장, 상태창, 광장, 카드에 모두 보여요.")}</p>
            {allPets.length === 0 ? (
              <p className="mt-4 rounded-xl bg-cream p-4 text-center text-sm text-ink-soft">{t("아직 꾸밀 펫이 없어요. 알을 부화시켜 보세요!")}</p>
            ) : (
              <>
                <PetPicker title={t("농장에서 키우는 펫")} pets={growing} selectedId={decorPet?.id ?? null} onPick={setDecorId} />
                <PetPicker title={t("다 자란 동물 카드")} pets={grownPets} selectedId={decorPet?.id ?? null} onPick={setDecorId} />
                {decorPet ? (
                  <PetDecorator key={decorPet.id} pet={decorPet} pending={pending} run={run} />
                ) : (
                  <p className="mt-4 rounded-xl bg-cream p-4 text-center text-sm text-ink-soft">{t("위에서 꾸밀 펫을 눌러 주세요")}</p>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/** 펫 상태창: 사진, 이름(바꾸기), 성별, 만난 날, 레벨·경험치, 돌보기, 데리고 다니기 */
function PetStatus({
  pet,
  pending,
  potions,
  displayed,
  run,
  onDecorate,
}: {
  pet: Pet;
  pending: boolean;
  potions: number;
  displayed: boolean;
  run: (fn: () => Promise<FarmResult>) => void;
  onDecorate: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pet.name);
  const stage = animalStage(pet.growth, pet.growExp);
  const progress = petLevelProgress(pet.growth, pet.growExp, pet.maxLevel);
  const isGrown = pet.status === "grown";

  return (
    <div className="p-5" data-pet-status={pet.id}>
      <div className="flex items-start gap-4">
        <div
          className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-4 border-bark/70 bg-gradient-to-b from-[#dff3d2] to-[#b6e09f]"
          data-pet-portrait
        >
          <PetArt assetKey={pet.assetKey} stage={stage} accessory={pet.accessory} color={pet.color} size={92} />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          {editing ? (
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const r = await renamePet(pet.id, name);
                  if (r.ok) setEditing(false);
                  return r;
                });
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={PET_NAME_MAX}
                aria-label={t("펫 이름")}
                autoFocus
                className="w-full min-w-0 rounded-lg border-2 border-line px-2 py-1 font-display text-lg"
              />
              <button type="submit" disabled={pending} className="btn shrink-0 bg-leaf px-2.5 py-1 text-sm text-white">
                {t("저장")}
              </button>
            </form>
          ) : (
            <h2 className="flex items-center gap-1 font-display text-2xl">
              <span className="truncate" data-pet-name>
                {shownName(t, pet)}
              </span>
              <button type="button" onClick={() => setEditing(true)} className="flex shrink-0 items-center gap-0.5 rounded-lg border-2 border-line px-1.5 font-sans text-xs font-bold text-ink-soft hover:bg-cream">
                <Icon name="write" size={16} /> {t("이름 바꾸기")}
              </button>
            </h2>
          )}
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            <dt className="text-ink-soft">{t("종류")}</dt>
            <dd>
              {pet.speciesName ? t(pet.speciesName) : pet.speciesName} · {t(STAGE_LABEL[stage])}
            </dd>
            <dt className="text-ink-soft">{t("성별")}</dt>
            <dd data-pet-gender>{pet.gender ? t(GENDER_LABEL[pet.gender]) : "-"}</dd>
            <dt className="text-ink-soft">{t("만난 날")}</dt>
            <dd data-pet-met>{pet.hatchedAt ? formatMetDate(new Date(pet.hatchedAt), locale) : "-"}</dd>
          </dl>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-cream p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-xl" data-pet-level={progress.level}>
            Lv.{progress.level} <span className="text-sm text-ink-soft">{t("/ 다 자라면 Lv.{level}", { level: pet.maxLevel })}</span>
          </span>
          <span className="whitespace-nowrap text-sm" data-pet-exp={progress.current}>
            {progress.isMax ? (
              <>
                {t("다 자랐어요")} <Icon name="exp" size={16} />
              </>
            ) : (
              t("경험치 {current} / {needed}", { current: progress.current, needed: progress.needed })
            )}
          </span>
        </div>
        <div
          className="mt-1.5 h-3 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label={t("펫 경험치")}
          aria-valuenow={progress.current}
          aria-valuemax={progress.needed || 1}
        >
          <div className="h-full bg-leaf transition-[width]" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink-soft" data-pet-growth={pet.growth}>
          {t("총 성장 {growth} / {max}", { growth: pet.growth, max: pet.growExp })}
          {!isGrown && (
            <>
              {" "}
              · {t("다 키우면")} <Icon name="exp" size={14} /> {pet.rewardExp} · <Icon name="coin" size={14} /> {pet.rewardCoins}
            </>
          )}
        </p>
      </div>

      {!isGrown && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {CARE_ACTIONS.map((c) => {
            const done = pet.caredToday.includes(c.action);
            return (
              <button
                key={c.action}
                type="button"
                disabled={pending || done}
                onClick={() => run(() => careAnimal(pet.id, c.action))}
                className="btn flex-col gap-0 bg-paper px-1 py-1.5 text-sm text-ink"
                title={done ? t("오늘은 했어요") : t("경험치 +{growth} (하루 한 번)", { growth: c.growth })}
              >
                <span>
                  <Icon name={CARE_ICON[c.action]} size={18} /> {done ? t("완료") : t(c.label)}
                </span>
                <span className="text-[10px] font-normal text-ink-soft">{done ? t("내일 또 해요") : t("+{growth} · 하루 한 번", { growth: c.growth })}</span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={pending || potions <= 0}
            onClick={() => run(() => givePotion(pet.id))}
            className="btn flex-col gap-0 bg-paper px-1 py-1.5 text-sm text-ink"
          >
            <span>
              <Icon name="potion" size={18} /> {t("물약 쓰기")}
            </span>
            <span className="text-[10px] font-normal text-ink-soft">
              {t("+{growth} · {n}개", { growth: POTION_GROWTH, n: potions })}
            </span>
          </button>
        </div>
      )}

      <button type="button" onClick={onDecorate} className="btn mt-3 w-full bg-[#ffe3ec] py-2 text-sm text-ink" data-status-decorate>
        <Icon name="hat" size={18} /> {t("꾸미기 · 이름 · 색 바꾸기")}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={pending || pet.carried} onClick={() => run(() => setCarriedPet(pet.id))} className="btn bg-sky py-2 text-sm text-white">
          <Icon name="pet" size={18} /> {t("데리고 다니기")}
        </button>
        <button type="button" disabled={pending || !pet.carried} onClick={() => run(() => setCarriedPet(null))} className="btn bg-paper py-2 text-sm text-ink">
          <Icon name="home" size={18} /> {t("두고 다니기")}
        </button>
      </div>
      <p className="mt-1 text-center text-xs text-ink-soft">
        {pet.carried ? (
          <>
            <Icon name="pet" size={14} /> {t("지금 함께 다니는 중이에요. 광장과 내 미니룸에서 보여요")}
          </>
        ) : (
          t("데리고 다닐 수 있는 펫은 한 마리예요")
        )}
      </p>

      {isGrown && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setDisplayedCard(displayed ? null : pet.id))}
          className={`btn mt-3 w-full py-2 text-sm ${displayed ? "bg-paper text-ink" : "bg-sun text-ink"}`}
        >
          <Icon name="achievement" size={18} />
          {displayed ? t("프로필에 전시 중 · 내리기") : t("프로필에 전시하기")}
        </button>
      )}
    </div>
  );
}

/** 꾸미기 창의 펫 고르기 줄 (농장 펫 / 다 자란 카드) */
function PetPicker({ title, pets, selectedId, onPick }: { title: string; pets: Pet[]; selectedId: number | null; onPick: (id: number) => void }) {
  const t = useT();
  if (pets.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="text-xs font-bold text-ink-soft">{title}</h3>
      <ul className="mt-1 flex gap-1.5 overflow-x-auto pb-1">
        {pets.map((p) => (
          <li key={p.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onPick(p.id)}
              aria-pressed={selectedId === p.id}
              data-decorate-pick={p.id}
              className={`flex w-16 flex-col items-center rounded-2xl border-2 p-1 text-[11px] font-bold ${selectedId === p.id ? "border-[#ff8fb0] bg-[#ffe3ec]" : "border-line bg-cream"}`}
            >
              <PetArt assetKey={p.assetKey} stage={animalStage(p.growth, p.growExp)} accessory={p.accessory} color={p.color} size={44} />
              <span className="w-full truncate">{shownName(t, p)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 고른 펫 한 마리 꾸미기: 이름, 꾸미기, 색 */
function PetDecorator({ pet, pending, run }: { pet: Pet; pending: boolean; run: (fn: () => Promise<FarmResult>) => void }) {
  const t = useT();
  const [name, setName] = useState(shownName(t, pet));
  const label = shownName(t, pet);
  return (
    <div className="mt-3 rounded-2xl bg-cream p-3" data-decorate-pet={pet.id}>
      <div className="flex items-center gap-3">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-bark/70 bg-gradient-to-b from-[#dff3d2] to-[#b6e09f]">
          <PetArt assetKey={pet.assetKey} stage={animalStage(pet.growth, pet.growExp)} accessory={pet.accessory} color={pet.color} size={80} />
        </div>
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => renamePet(pet.id, name));
          }}
        >
          <label className="text-xs font-bold text-ink-soft" htmlFor={`pet-name-${pet.id}`}>
            {t("이름")}
          </label>
          <div className="mt-0.5 flex gap-1">
            <input
              id={`pet-name-${pet.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={PET_NAME_MAX}
              data-decorate-name
              className="w-full min-w-0 rounded-lg border-2 border-line bg-paper px-2 py-1 font-display text-lg"
            />
            <button type="submit" disabled={pending || !name.trim() || name.trim() === label} className="btn shrink-0 bg-leaf px-2.5 py-1 text-sm text-white">
              {t("바꾸기")}
            </button>
          </div>
        </form>
      </div>
      <h3 className="mt-3 text-xs font-bold text-ink-soft">{t("꾸미기")}</h3>
      <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={t("{name} 꾸미기", { name: label })}>
        {PET_ACCESSORIES.map((a) => (
          <button
            key={a.value}
            type="button"
            aria-pressed={pet.accessory === a.value}
            disabled={pending}
            onClick={() => run(() => setPetAccessory(pet.id, a.value))}
            className={`rounded-full border-2 px-2.5 py-1 text-xs font-bold ${pet.accessory === a.value ? "border-[#ff8fb0] bg-[#ffe3ec]" : "border-line bg-paper"}`}
          >
            {t(a.label)}
          </button>
        ))}
      </div>
      <h3 className="mt-3 text-xs font-bold text-ink-soft">{t("색")}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("{name} 색", { name: label })}>
        {PET_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={pet.color === c.value}
            disabled={pending}
            onClick={() => run(() => setPetColor(pet.id, c.value))}
            data-pet-color={c.value}
            title={t(c.label)}
            className={`flex items-center gap-1 rounded-full border-2 py-0.5 pl-0.5 pr-2 text-xs font-bold ${pet.color === c.value ? "border-[#ff8fb0] bg-[#ffe3ec]" : "border-line bg-paper"}`}
          >
            <span aria-hidden className="inline-block h-4 w-4 rounded-full border border-ink/20" style={{ background: COLOR_SWATCH[c.value] }} />
            {t(c.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 가운데 뜨는 창 (Esc·바깥 누르기·✕로 닫기). 휴대폰에서는 아래에서 올라오는 모양 */
function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  // 열릴 때 한 번만 창에 초점을 옮긴다 (다시 그릴 때마다 옮기면 이름 입력 칸의 초점을 빼앗는다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    boxRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-4 border-bark/70 bg-paper shadow-2xl outline-none sm:rounded-3xl"
      >
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-[1] rounded-full px-2 py-0.5 text-ink-soft hover:bg-cream" aria-label={t("닫기")}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
