import { redirect } from "next/navigation";
import { needsAccountSetup, getViewerLoginMethods, requireSignedIn } from "@/server/dal";
import { WithdrawForm } from "@/app/settings/account/withdraw-form";
import { SetupForms } from "./setup-forms";

export const metadata = { title: "아이디 만들기" };

const LABELS: Record<string, string> = { kakao: "카카오", naver: "네이버", google: "Google" };

/**
 * 한 회원 = 아이디 하나: 소셜로 처음 들어와 아이디·비밀번호가 없는 회원이 다른 화면보다 먼저 오는 곳.
 * 아이디를 새로 만들거나, 쓰던 아이디에 이 소셜 로그인을 합친다 (src/server/dal.ts requireUser가 이리로 보낸다)
 */
export default async function AccountSetupPage() {
  const viewer = await requireSignedIn();
  if (!(await needsAccountSetup())) redirect("/town");
  const methods = await getViewerLoginMethods();
  const providerLabel = methods.map((m) => LABELS[m]).filter(Boolean).join("·") || "소셜";

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-3xl">아이디를 만들어 주세요 🔑</h1>
      <p className="mt-2 text-ink-soft">
        {providerLabel}로 들어왔어요. 아이디를 하나 만들어 두면 어느 소셜로 들어와도 같은 집으로 와요.
      </p>
      <section className="card mt-6 p-6">
        <SetupForms providerLabel={providerLabel} canMerge={!viewer.profile} />
      </section>
      {/* 아이디를 만들지 않고 그만두는 길 (AUTH-06). 이 회원은 다른 화면으로 갈 수 없어서 탈퇴도 여기서 한다 */}
      <section className="card mt-6 p-6" aria-label={viewer.profile ? "회원 탈퇴" : "그만두기"}>
        <h2 className="mb-2 font-display text-lg">{viewer.profile ? "탈퇴하고 싶어요" : "아이디를 만들고 싶지 않아요"}</h2>
        <p className="mb-4 text-sm text-ink-soft">
          {viewer.profile
            ? "탈퇴하면 프로필·블로그·글·코인 기록·로그인 정보가 바로 지워지고 되돌릴 수 없어요."
            : `그만두면 방금 들어온 ${providerLabel} 로그인 정보를 지우고 나가요. 나중에 언제든 다시 들어올 수 있어요.`}
        </p>
        <WithdrawForm
          needsPassword={false}
          label={viewer.profile ? "회원 탈퇴" : "그만두고 나가기"}
          confirmMessage={
            viewer.profile
              ? "정말 탈퇴할까요? 블로그·글·코인 기록이 모두 지워지고 되돌릴 수 없어요."
              : `${providerLabel} 로그인 정보를 지우고 나갈까요?`
          }
        />
      </section>
    </div>
  );
}
