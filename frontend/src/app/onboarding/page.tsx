import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INVITE_COOKIE, normalizeInviteCode } from "@/lib/invite";
import { requireUser } from "@/server/dal";
import { getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("마을 주민 등록") };
}

export default async function OnboardingPage() {
  const viewer = await requireUser();
  if (viewer.profile) redirect("/town");
  const t = await getT();

  const { starters } = await readApi.onboarding();
  // 초대 링크로 들어왔으면 그 코드로 칸을 미리 채운다 (GAME-09, src/proxy.ts가 쿠키에 남김)
  const invited = normalizeInviteCode((await cookies()).get(INVITE_COOKIE)?.value) ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl">{t("마을 주민 등록 📜")}</h1>
      <p className="mt-2 text-ink-soft">
        {viewer.user.name
          ? t("반가워요, {name}님! 마을에서 쓸 이름과 블로그, 함께할 캐릭터를 정해 주세요.", { name: viewer.user.name })
          : t("반가워요! 마을에서 쓸 이름과 블로그, 함께할 캐릭터를 정해 주세요.")}
      </p>
      <OnboardingForm starters={starters} defaultNickname={viewer.user.name?.slice(0, 12) ?? ""} defaultInviteCode={invited} />
    </div>
  );
}
