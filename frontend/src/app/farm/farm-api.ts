"use client";

// 농장 버튼들이 부르는 서버 API (/api/v1/farm/…). 결과는 화면 위쪽에 띄울 한 줄 문구로 바꿔 돌려준다.
// 성공하면 코인·펫·알이 바뀌므로 router.refresh()로 화면(헤더 코인 포함)을 다시 그린다
import { useRouter } from "next/navigation";
import type { FarmDone } from "@backend/routes/farm";
import { useLocale, useT } from "@/components/i18n";
import { api, errorText } from "@/lib/api";
import type { CareAction, PetAccessory, PetColor } from "@/lib/farm";
import { farmText } from "@/lib/farm-text";

export type FarmResult = { ok: boolean; text: string };

export function useFarmApi() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const call = async (path: string, method: "POST" | "PUT", body?: unknown): Promise<FarmResult> => {
    try {
      const { done } = await api<{ done: FarmDone }>(`/farm${path}`, { method, body: body ?? {} });
      router.refresh();
      return { ok: true, text: farmText(t, locale, done) };
    } catch (err) {
      return { ok: false, text: errorText(t, err) };
    }
  };

  return {
    /** 무료 알 받기: 농장 첫 알(starter) 또는 레벨 보상 알(5레벨마다) */
    claimEgg: (kind: "starter" | "level", level?: number) => call("/eggs/claim", "POST", { kind, level }),
    buyEgg: () => call("/eggs/buy", "POST"),
    hatchEgg: (animalId: number) => call("/eggs/hatch", "POST", { animalId }),
    hatchAllEggs: () => call("/eggs/hatch-all", "POST"),
    careAnimal: (animalId: number, action: CareAction) => call(`/pets/${animalId}/care`, "POST", { action }),
    buyPotion: () => call("/potions/buy", "POST"),
    givePotion: (animalId: number) => call(`/pets/${animalId}/potion`, "POST"),
    renamePet: (animalId: number, name: string) => call(`/pets/${animalId}/name`, "PUT", { name }),
    /** 데리고 다니기 (animalId) / 두고 다니기 (null) */
    setCarriedPet: (animalId: number | null) => call("/carried", "PUT", { animalId }),
    /** 프로필에 다 키운 동물 카드 전시 (null = 내리기) */
    setDisplayedCard: (animalId: number | null) => call("/displayed", "PUT", { animalId }),
    setPetAccessory: (animalId: number, accessory: PetAccessory) => call(`/pets/${animalId}/accessory`, "PUT", { accessory }),
    setPetColor: (animalId: number, color: PetColor) => call(`/pets/${animalId}/color`, "PUT", { color }),
  };
}
