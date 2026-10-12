import Link from "next/link";
import { Icon } from "@/components/icon";
import { IconEmoji } from "@/components/icon-emoji";
import { Pagination, parsePage } from "@/components/pagination";
import type { IconName } from "@/lib/art/icons";
import { formatDateTime } from "@/lib/format";
import { msg, type T } from "@/lib/i18n";
import { requireMember } from "@/server/dal";
import { getLocale, getT } from "@/server/i18n";
import { getWallet, listLedger } from "@/server/points";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("경험치·코인 내역") };
}

// 원장 사유를 화면에 보일 아이콘과 이름으로 (GAME-07).
// emoji는 화면에 보이지 않고 글자로만 남는다 (예전 문구 "🤝 친구 초대" 그대로 읽히게, IconEmoji)
const REASON_LABEL: Record<string, { icon: IconName; emoji: string; text: string }> = {
  signup: { icon: "home", emoji: "🎉", text: msg("가입 축하") },
  attendance: { icon: "calendar", emoji: "📮", text: msg("출석") },
  attendance_streak: { icon: "campfire", emoji: "🔥", text: msg("연속 출석 보너스") },
  post: { icon: "write", emoji: "✏️", text: msg("글 작성") },
  comment: { icon: "comment", emoji: "💬", text: msg("댓글 작성") },
  like_received: { icon: "heart", emoji: "♥", text: msg("공감 받음") },
  purchase: { icon: "shop", emoji: "🏪", text: msg("아이템 구매") },
  farm_care: { icon: "carrot", emoji: "🥕", text: msg("동물 돌보기") },
  farm_grown: { icon: "achievement", emoji: "🏅", text: msg("동물 다 키움") },
  egg_purchase: { icon: "egg", emoji: "🥚", text: msg("알 구매") },
  potion_purchase: { icon: "potion", emoji: "🧪", text: msg("물약 구매") },
  invite: { icon: "invite", emoji: "🤝", text: msg("친구 초대") }, // 내가 초대한 친구가 첫 글을 씀 (GAME-09)
  invited: { icon: "invite", emoji: "🤝", text: msg("친구 초대") }, // 초대받아 가입하고 첫 글을 씀
  admin_grant: { icon: "achievement", emoji: "🎁", text: msg("관리자 지급") },
  social_link: { icon: "invite", emoji: "🔗", text: msg("소셜 로그인 연동") },
};

function Reason({ reason, t }: { reason: string; t: T }) {
  const label = REASON_LABEL[reason];
  if (!label) return reason;
  return (
    <>
      <IconEmoji name={label.icon} emoji={label.emoji} size={22} className="-mt-0.5" /> {t(label.text)}
    </>
  );
}

const signed = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : `−${Math.abs(n).toLocaleString()}`);

export default async function WalletPage(props: PageProps<"/wallet">) {
  const viewer = await requireMember();
  const t = await getT();
  const locale = await getLocale();
  const page = parsePage((await props.searchParams).page);
  const [wallet, ledger] = await Promise.all([getWallet(viewer.userId), listLedger(viewer.userId, page)]);
  const [coinsBefore, coinsAfter = ""] = t("코인은 {link}에서 쓸 수 있어요.").split("{link}");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">
        <Icon name="coin" size={34} className="-mt-1" /> {t("경험치·코인 내역")}
      </h1>

      <section className="card mt-6 grid grid-cols-3 gap-2 p-5 text-center">
        <div>
          <p className="text-sm text-ink-soft">{t("레벨")}</p>
          <p className="font-display text-3xl">Lv.{wallet.level}</p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">{t("누적 경험치")}</p>
          <p className="font-display text-3xl">
            <IconEmoji name="exp" emoji="✨" size={30} className="-mt-1" /> {wallet.exp.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">{t("코인")}</p>
          <p className="font-display text-3xl">
            <IconEmoji name="coin" emoji="🪙" size={30} className="-mt-1" /> {wallet.coins.toLocaleString()}
          </p>
        </div>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="mb-2 font-display text-xl">
          {t("기록")} <span className="text-base text-ink-soft">{t("{n}개", { n: ledger.total })}</span>
        </h2>
        {ledger.rows.length ? (
          <ul className="divide-y-2 divide-line/60">
            {ledger.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-3">
                <span className="min-w-0 flex-1">
                  <b>
                    <Reason reason={r.reason} t={t} />
                  </b>
                  {r.itemName && <span className="text-ink-soft"> · {t(r.itemName)}</span>}
                  <span className="block text-xs text-ink-soft">{formatDateTime(r.createdAt, locale)}</span>
                </span>
                {r.expDelta !== 0 && (
                  <span className="text-sm font-bold text-sky">
                    <IconEmoji name="exp" emoji="✨" size={18} className="-mt-0.5" /> {signed(r.expDelta)}
                  </span>
                )}
                {r.coinDelta !== 0 && (
                  <span className={`w-24 text-right font-bold ${r.coinDelta > 0 ? "text-leaf-dark" : "text-berry"}`}>
                    <IconEmoji name="coin" emoji="🪙" size={18} className="-mt-0.5" /> {signed(r.coinDelta)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-ink-soft">{t("아직 기록이 없어요")}</p>
        )}
        <Pagination page={ledger.page} pageCount={ledger.pageCount} hrefFor={(n) => `/wallet?page=${n}`} />
      </section>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {coinsBefore}
        <Link href="/shop" className="font-bold text-leaf-dark underline">
          {t("상점")}
        </Link>
        {coinsAfter}
      </p>
    </div>
  );
}
