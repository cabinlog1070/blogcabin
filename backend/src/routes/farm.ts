// 동물 농장 (TOWN-09): /api/v1/farm/…
// 성공하면 무슨 일이 있었는지(done)를 돌려주고, 화면이 보는 사람의 언어로 문장을 만든다
// (펫 이름의 조사·번역이 언어마다 달라서). 실패 문구는 한국어 문장과 그 안에 넣을 값(vars)
import { randomInt } from "node:crypto";
import { and, asc, eq, gt, ne, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { db } from "../db";
import { animalCares, animalSpecies, farmItems, pointLedger, profiles, userAnimals } from "../db/schema";
import { addGrowth, countAnimals, type GrowthResult } from "../farm/growth";
import {
  CARE_ACTIONS,
  type CareAction,
  cleanPetName,
  EGG_PRICE,
  levelEggLevels,
  MAX_ACTIVE_ANIMALS,
  MAX_NEST_EGGS,
  PET_ACCESSORIES,
  PET_COLORS,
  PET_NAME_MAX,
  type PetAccessory,
  type PetColor,
  pickWeighted,
  POTION_GROWTH,
  POTION_PRICE,
} from "../farm/rules";
import { getWallet, grantReward, lockUser, type Tx } from "../game/points";
import { todayKST } from "../game/rules";
import { BAD_REQUEST, readJson, requireViewer, type GuardEnv } from "../http/guard";
import { uniqueViolation } from "../lib/db-errors";
import { parseId } from "../lib/ids";

const msg = <S extends string>(text: S): S => text;
type Vars = Record<string, string | number>;
type Fail = { ok: false; error: string; vars?: Vars };
const fail = (error: string, vars?: Vars): Fail => ({ ok: false, error, vars });

/** 결과 문장에 넣을 펫: 이름이 종류 이름 그대로면 화면이 번역한다 */
export type PetName = { name: string; speciesName: string | null };

/** 성공했을 때 일어난 일 (화면 lib/farm-text.ts가 문장으로 바꾼다) */
export type FarmDone =
  | { kind: "claimEgg" }
  | { kind: "buyEgg"; price: number }
  | { kind: "hatch"; species: string }
  | { kind: "hatchAll"; species: string[]; left: number }
  | { kind: "care"; action: CareAction; growth: number; result: GrowthResult }
  | { kind: "buyPotion"; price: number }
  | { kind: "potion"; growth: number; result: GrowthResult }
  | { kind: "rename"; name: string }
  | { kind: "carry"; pet: PetName | null }
  | { kind: "display"; on: boolean }
  | { kind: "accessory"; pet: PetName }
  | { kind: "color"; pet: PetName };
export type FarmResult = { ok: true; done: FarmDone } | Fail;

const ok = (done: FarmDone): FarmResult => ({ ok: true, done });
const full = () => fail(msg("풀밭에서는 한 번에 {n}마리까지 키울 수 있어요. 다 키운 뒤에 부화시켜 주세요"), { n: MAX_ACTIVE_ANIMALS });
const nestFull = () => fail(msg("알 둥지에는 알을 {n}개까지 놓을 수 있어요. 먼저 부화시켜 주세요"), { n: MAX_NEST_EGGS });
const noSpecies = () => fail(msg("동물 종류가 없어요. npm run db:seed 를 실행해 주세요"));
const send = (c: Context, r: FarmResult) => c.json(r, r.ok ? 200 : 400);

/** 결과 문장에 넣을 펫 이름과 종류 이름 */
async function petName(tx: Tx | typeof db, name: string | null, speciesId: number | null): Promise<PetName> {
  if (speciesId === null) return { name: name ?? "", speciesName: null };
  const [sp] = await tx.select({ name: animalSpecies.name }).from(animalSpecies).where(eq(animalSpecies.id, speciesId));
  return { name: name ?? sp?.name ?? "", speciesName: sp?.name ?? null };
}

/**
 * 알 하나 부화: 종류는 비중에 따라 랜덤 (나올 펫이 정해진 알이면 그 펫), 성별도 랜덤, 이름은 종류 이름.
 * 부화한 종류 (내 알이 아니면 null)
 */
async function hatchOne(tx: Tx, userId: string, id: number, species: (typeof animalSpecies.$inferSelect)[]) {
  const [egg] = await tx
    .select({ eggSpeciesId: userAnimals.eggSpeciesId })
    .from(userAnimals)
    .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, userId), eq(userAnimals.status, "egg")));
  if (!egg) return null;
  const sp = species.find((s) => s.id === egg.eggSpeciesId) ?? pickWeighted(species, randomInt(1_000_000) / 1_000_000);
  const [hatched] = await tx
    .update(userAnimals)
    .set({ status: "growing", speciesId: sp.id, hatchedAt: new Date(), name: sp.name, gender: randomInt(2) ? "male" : "female" })
    .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, userId), eq(userAnimals.status, "egg")))
    .returning({ id: userAnimals.id });
  return hatched ? sp : null;
}

/** 키우는 중인 내 동물인지 */
async function isGrowing(tx: Tx, userId: string, id: number) {
  const [animal] = await tx
    .select({ id: userAnimals.id })
    .from(userAnimals)
    .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, userId), eq(userAnimals.status, "growing")));
  return !!animal;
}

class NotMine extends Error {}

export const farmRoutes = new Hono<GuardEnv>()
  .use(requireViewer("member"))
  /** 무료 알 받기: { kind: "starter" } 농장 첫 알, { kind: "level", level } 레벨 보상 알(5레벨마다) */
  .post("/eggs/claim", async (c) => {
    const { userId } = c.get("viewer");
    const body = await readJson(c);
    const kind = body.kind;
    const level = typeof body.level === "number" ? body.level : undefined;
    if (kind !== "starter" && kind !== "level") return send(c, fail(BAD_REQUEST));
    try {
      const result = await db.transaction(async (tx): Promise<FarmResult> => {
        await lockUser(tx, userId);
        if ((await countAnimals(tx, userId, "egg")) >= MAX_NEST_EGGS) return nestFull();
        if (kind === "level") {
          const wallet = await getWallet(userId, tx);
          if (!level || !levelEggLevels(wallet.level).includes(level)) return fail(msg("아직 받을 수 없는 알이에요"));
        }
        await tx.insert(userAnimals).values({ userId, source: kind, sourceLevel: kind === "level" ? level : null });
        return ok({ kind: "claimEgg" });
      });
      return send(c, result);
    } catch (err) {
      // 같은 알을 두 번 받으려 하면 고유 인덱스(starter, level)에 막힌다
      if (uniqueViolation(err) !== null) return c.json(fail(msg("이미 받은 알이에요")), 409);
      throw err;
    }
  })
  /** 코인으로 알 사기 */
  .post("/eggs/buy", async (c) => {
    const { userId } = c.get("viewer");
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, userId);
      if ((await countAnimals(tx, userId, "egg")) >= MAX_NEST_EGGS) return nestFull();
      const wallet = await getWallet(userId, tx);
      if (wallet.coins < EGG_PRICE) return fail(msg("코인이 {n}개 부족해요"), { n: EGG_PRICE - wallet.coins });
      const [egg] = await tx.insert(userAnimals).values({ userId, source: "shop" }).returning({ id: userAnimals.id });
      await tx.insert(pointLedger).values({ userId, reason: "egg_purchase", coinDelta: -EGG_PRICE, refId: String(egg.id) });
      return ok({ kind: "buyEgg", price: EGG_PRICE });
    });
    return send(c, result);
  })
  /** 알 하나 부화 (풀밭 자리가 있어야 한다): { animalId } */
  .post("/eggs/hatch", async (c) => {
    const { userId } = c.get("viewer");
    const id = parseId((await readJson(c)).animalId);
    if (id === null) return send(c, fail(BAD_REQUEST));
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, userId);
      const species = await tx.select().from(animalSpecies);
      if (!species.length) return noSpecies();
      if ((await countAnimals(tx, userId, "growing")) >= MAX_ACTIVE_ANIMALS) return full();
      const sp = await hatchOne(tx, userId, id, species);
      if (!sp) return fail(msg("부화시킬 수 있는 알이 아니에요"));
      return ok({ kind: "hatch", species: sp.name });
    });
    return send(c, result);
  })
  /** 둥지의 알 한 번에 부화: 풀밭 남은 자리만큼 오래된 알부터 */
  .post("/eggs/hatch-all", async (c) => {
    const { userId } = c.get("viewer");
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, userId);
      const species = await tx.select().from(animalSpecies);
      if (!species.length) return noSpecies();
      const room = MAX_ACTIVE_ANIMALS - (await countAnimals(tx, userId, "growing"));
      if (room <= 0) return full();
      const eggs = await tx
        .select({ id: userAnimals.id })
        .from(userAnimals)
        .where(and(eq(userAnimals.userId, userId), eq(userAnimals.status, "egg")))
        .orderBy(asc(userAnimals.id))
        .limit(room);
      if (!eggs.length) return fail(msg("부화시킬 알이 없어요"));
      const names: string[] = [];
      for (const egg of eggs) {
        const sp = await hatchOne(tx, userId, egg.id, species);
        if (sp) names.push(sp.name);
      }
      return ok({ kind: "hatchAll", species: names, left: await countAnimals(tx, userId, "egg") });
    });
    return send(c, result);
  })
  /** 돌보기: { action }. 동물 한 마리에 같은 돌보기는 하루 한 번. 성장치 + 경험치 조금 */
  .post("/pets/:id/care", async (c) => {
    const { userId } = c.get("viewer");
    const id = parseId(c.req.param("id"));
    const action = (await readJson(c)).action;
    const care = CARE_ACTIONS.find((a) => a.action === action); // 물 주기(water)는 더 이상 받지 않는다
    if (id === null || !care) return send(c, fail(BAD_REQUEST));
    try {
      const result = await db.transaction(async (tx): Promise<FarmResult> => {
        await lockUser(tx, userId);
        if (!(await isGrowing(tx, userId, id))) return fail(msg("돌볼 수 있는 동물이 아니에요"));
        await tx.insert(animalCares).values({ animalId: id, action: care.action, date: todayKST() });
        await grantReward(tx, userId, "farm_care", id);
        const growth = await addGrowth(tx, userId, care.growth, [id]);
        return ok({ kind: "care", action: care.action, growth: care.growth, result: growth });
      });
      return send(c, result);
    } catch (err) {
      if (uniqueViolation(err) !== null) return c.json(fail(msg("오늘은 이미 {label}를 했어요"), { label: care.label }), 409);
      throw err;
    }
  })
  /** 물약 사기: 🪙 50, 가방(farm_items)에 하나 더한다 */
  .post("/potions/buy", async (c) => {
    const { userId } = c.get("viewer");
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, userId);
      const wallet = await getWallet(userId, tx);
      if (wallet.coins < POTION_PRICE) return fail(msg("코인이 {n}개 부족해요"), { n: POTION_PRICE - wallet.coins });
      await tx
        .insert(farmItems)
        .values({ userId, kind: "potion", quantity: 1 })
        .onConflictDoUpdate({ target: [farmItems.userId, farmItems.kind], set: { quantity: sql`${farmItems.quantity} + 1` } });
      await tx.insert(pointLedger).values({ userId, reason: "potion_purchase", coinDelta: -POTION_PRICE });
      return ok({ kind: "buyPotion", price: POTION_PRICE });
    });
    return send(c, result);
  })
  /** 물약 쓰기: 가진 물약 하나로 성장 +30. 하루 횟수 제한은 없다 */
  .post("/pets/:id/potion", async (c) => {
    const { userId } = c.get("viewer");
    const id = parseId(c.req.param("id"));
    if (id === null) return send(c, fail(BAD_REQUEST));
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, userId);
      if (!(await isGrowing(tx, userId, id))) return fail(msg("물약을 쓸 수 있는 동물이 아니에요"));
      const [used] = await tx
        .update(farmItems)
        .set({ quantity: sql`${farmItems.quantity} - 1` })
        .where(and(eq(farmItems.userId, userId), eq(farmItems.kind, "potion"), gt(farmItems.quantity, 0)))
        .returning({ quantity: farmItems.quantity });
      if (!used) return fail(msg("물약이 없어요. 농장 가게에서 사 주세요"));
      const growth = await addGrowth(tx, userId, POTION_GROWTH, [id]);
      return ok({ kind: "potion", growth: POTION_GROWTH, result: growth });
    });
    return send(c, result);
  })
  /** 펫 이름 바꾸기 (1~10자): { name } */
  .put("/pets/:id/name", async (c) => {
    const { userId } = c.get("viewer");
    const id = parseId(c.req.param("id"));
    const raw = (await readJson(c)).name;
    const name = typeof raw === "string" ? cleanPetName(raw) : null;
    if (id === null) return send(c, fail(BAD_REQUEST));
    if (!name) return send(c, fail(msg("이름은 1~{max}자로 지어 주세요"), { max: PET_NAME_MAX }));
    const [row] = await db
      .update(userAnimals)
      .set({ name })
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, userId), ne(userAnimals.status, "egg")))
      .returning({ id: userAnimals.id });
    if (!row) return send(c, fail(msg("이름을 바꿀 수 있는 동물이 아니에요")));
    return send(c, ok({ kind: "rename", name }));
  })
  /** 데리고 다니기 { animalId } / 두고 다니기 { animalId: null }. 한 마리만: 다른 펫을 고르면 바뀐다 */
  .put("/carried", async (c) => {
    const { userId } = c.get("viewer");
    const raw = (await readJson(c)).animalId ?? null;
    const id = raw === null ? null : parseId(raw);
    if (raw !== null && id === null) return send(c, fail(BAD_REQUEST));
    try {
      const result = await db.transaction(async (tx): Promise<FarmResult> => {
        await lockUser(tx, userId);
        // 먼저 지금 데리고 다니는 펫을 내려놓는다 (부분 고유 인덱스: 회원당 carried 한 마리)
        await tx
          .update(userAnimals)
          .set({ carried: false })
          .where(and(eq(userAnimals.userId, userId), eq(userAnimals.carried, true)));
        if (id === null) return ok({ kind: "carry", pet: null });
        const [pet] = await tx
          .update(userAnimals)
          .set({ carried: true })
          .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, userId), ne(userAnimals.status, "egg")))
          .returning({ name: userAnimals.name, speciesId: userAnimals.speciesId });
        // 내 펫이 아니면 내려놓은 것까지 되돌린다
        if (!pet) throw new NotMine();
        return ok({ kind: "carry", pet: await petName(tx, pet.name, pet.speciesId) });
      });
      return send(c, result);
    } catch (err) {
      if (err instanceof NotMine) return send(c, fail(msg("데리고 다닐 수 있는 동물이 아니에요")));
      throw err;
    }
  })
  /** 프로필에 다 키운 동물 카드 하나 전시 { animalId } (null = 내리기) */
  .put("/displayed", async (c) => {
    const { userId } = c.get("viewer");
    const raw = (await readJson(c)).animalId ?? null;
    const id = raw === null ? null : parseId(raw);
    if (raw !== null && id === null) return send(c, fail(BAD_REQUEST));
    if (id !== null) {
      const [grown] = await db
        .select({ id: userAnimals.id })
        .from(userAnimals)
        .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, userId), eq(userAnimals.status, "grown")));
      if (!grown) return send(c, fail(msg("다 키운 내 동물만 전시할 수 있어요")));
    }
    await db.update(profiles).set({ displayedAnimalId: id }).where(eq(profiles.userId, userId));
    return send(c, ok({ kind: "display", on: id !== null }));
  })
  /** 펫 꾸미기 (무료): { accessory } 없음·리본·꽃·스카프 */
  .put("/pets/:id/accessory", async (c) => {
    const { userId } = c.get("viewer");
    const id = parseId(c.req.param("id"));
    const accessory = (await readJson(c)).accessory;
    if (id === null || !PET_ACCESSORIES.some((a) => a.value === accessory)) return send(c, fail(BAD_REQUEST));
    const [row] = await db
      .update(userAnimals)
      .set({ accessory: accessory as PetAccessory })
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, userId), ne(userAnimals.status, "egg")))
      .returning({ name: userAnimals.name, speciesId: userAnimals.speciesId });
    if (!row) return send(c, fail(msg("꾸밀 수 있는 동물이 아니에요")));
    return send(c, ok({ kind: "accessory", pet: await petName(db, row.name, row.speciesId) }));
  })
  /** 펫 색 바꾸기 (무료): { color } 기본·갈색·노란색… */
  .put("/pets/:id/color", async (c) => {
    const { userId } = c.get("viewer");
    const id = parseId(c.req.param("id"));
    const color = (await readJson(c)).color;
    if (id === null || !PET_COLORS.some((x) => x.value === color)) return send(c, fail(BAD_REQUEST));
    const [row] = await db
      .update(userAnimals)
      .set({ color: color as PetColor })
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, userId), ne(userAnimals.status, "egg")))
      .returning({ name: userAnimals.name, speciesId: userAnimals.speciesId });
    if (!row) return send(c, fail(msg("꾸밀 수 있는 동물이 아니에요")));
    return send(c, ok({ kind: "color", pet: await petName(db, row.name, row.speciesId) }));
  });
