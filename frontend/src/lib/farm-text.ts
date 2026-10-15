// 농장 API가 돌려준 일(done)을 보는 사람의 언어로 한 줄 문장으로 만든다.
// 펫 이름은 바꾸지 않았으면(종류 이름 그대로) 번역하고, 한국어는 받침에 맞는 조사를 붙인다
import type { FarmDone, PetName } from "@backend/routes/farm";
import type { GrowthResult } from "@backend/farm/growth";
import { CARE_ACTIONS, petDisplayName, withJosa } from "@/lib/farm";
import type { Locale, T } from "@/lib/i18n";

/** 성장 결과를 한 줄로: 다 자랐으면 보상, 레벨이 올랐으면 새 레벨 */
function growthText(t: T, locale: Locale, base: string, { grown, leveled }: GrowthResult) {
  const subject = (a: { name: string; speciesName: string }) => withJosa(locale, petDisplayName(t, a.name, a.speciesName), "이", "가");
  if (grown[0])
    return t("🎉 {subject} 다 자랐어요! 경험치 +{exp}, 🪙 +{coins} · 카드 도감에 모였어요", {
      subject: subject(grown[0]),
      exp: grown[0].rewardExp,
      coins: grown[0].rewardCoins,
    });
  if (leveled[0]) return t("{base} · 🐣 {subject} Lv.{level}이 되었어요!", { base, subject: subject(leveled[0]), level: leveled[0].level });
  return base;
}

const shown = (t: T, pet: PetName) => petDisplayName(t, pet.name, pet.speciesName);

export function farmText(t: T, locale: Locale, done: FarmDone): string {
  switch (done.kind) {
    case "claimEgg":
      return t("🥚 알을 받았어요! [부화시키기]를 눌러 보세요");
    case "buyEgg":
      return t("🥚 알을 샀어요! (🪙 −{price})", { price: done.price });
    case "hatch":
      return t("🐣 {subject} 태어났어요!", { subject: withJosa(locale, t(done.species), "이", "가") });
    case "hatchAll": {
      const text = t("🐣 {n}마리가 태어났어요! {names}", { n: done.species.length, names: done.species.map((s) => t(s)).join(", ") });
      return done.left > 0 ? `${text} · ${t("풀밭이 꽉 차서 알 {n}개는 둥지에 남았어요", { n: done.left })}` : text;
    }
    case "care": {
      const care = CARE_ACTIONS.find((c) => c.action === done.action);
      const base = t("{emoji} {label} 완료! 경험치 +{growth}", { emoji: care?.emoji ?? "", label: care ? t(care.label) : "", growth: done.growth });
      return growthText(t, locale, base, done.result);
    }
    case "buyPotion":
      return t("🧪 물약을 샀어요! (🪙 −{price})", { price: done.price });
    case "potion":
      return growthText(t, locale, t("🧪 물약을 썼어요! 경험치 +{growth}", { growth: done.growth }), done.result);
    case "rename":
      return t("✏️ 이름을 {name} 바꿨어요", { name: withJosa(locale, done.name, "으로", "로") });
    case "carry":
      if (!done.pet) return t("🏡 펫을 농장에 두고 다녀요");
      return t("🐾 {name} 함께 다녀요! 광장과 내 미니룸에서 볼 수 있어요", {
        name: withJosa(locale, shown(t, done.pet) || t("펫"), "과", "와"),
      });
    case "display":
      return done.on ? t("🏅 프로필에 카드를 전시했어요! 내 블로그 홈에서 보여요") : t("프로필 전시를 내렸어요");
    case "accessory":
      return t("🎀 {name} 꾸미기를 바꿨어요", { name: shown(t, done.pet) });
    case "color":
      return t("🎨 {name} 색을 바꿨어요", { name: shown(t, done.pet) });
  }
}
