import Link from "next/link";
import { Icon } from "@/components/icon";
import { SOCIAL_LINK_REWARD_COINS } from "@/lib/game";
import { requireUser } from "@/server/dal";

export const metadata = { title: "아이디에 합쳤어요" };

const LABELS: Record<string, string> = { kakao: "카카오", naver: "네이버", google: "Google" };
const names = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v.join(",") : (v ?? "")).split(",").map((p) => LABELS[p]).filter(Boolean);

/** [이미 아이디가 있어요]로 합친 뒤 결과 안내 (옮긴 소셜·이미 붙어 있어 옮기지 않은 소셜·받은 보상) */
export default async function AccountMergedPage(props: PageProps<"/account-setup/done">) {
  const viewer = await requireUser();
  const q = await props.searchParams;
  const moved = names(q.moved);
  const skipped = names(q.skipped);
  const rewarded = names(q.rewarded);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <section className="card space-y-4 p-6">
        <h1 className="font-display text-3xl">{q.refused ? "로그인했어요" : "내 아이디에 합쳤어요 🔗"}</h1>
        {q.refused && <p>이 소셜 계정은 이미 다른 정보가 있어서 합치지 못했어요. 쓰던 아이디로 로그인해 두었어요.</p>}
        {moved.length > 0 && <p>이제 {moved.join("·")} 로그인으로 들어와도 이 아이디의 집으로 와요.</p>}
        {skipped.length > 0 && (
          <p role="status" className="rounded-xl bg-honey p-3 text-sm">
            이 아이디에는 이미 다른 {skipped.join("·")} 계정이 연결돼 있어서, 방금 들어온 {skipped.join("·")} 계정은 붙이지 않았어요.
          </p>
        )}
        {rewarded.length > 0 && (
          <p className="inline-flex items-center gap-1 font-bold text-sun-dark">
            {rewarded.join("·")} 연동 보상 <Icon name="coin" size={18} /> {SOCIAL_LINK_REWARD_COINS * rewarded.length}을 받았어요!
          </p>
        )}
        <Link href="/town" className="btn block w-full bg-leaf py-3 text-center text-white">
          {viewer.profile ? "광장으로 가기" : "주민 등록하러 가기"}
        </Link>
      </section>
    </div>
  );
}
