import Link from "next/link";
import { Icon } from "@/components/icon";
import { ItemArt } from "@/components/item-art";
import { formatDateTime } from "@/lib/format";
import { requireMember } from "@/server/dal";
import { listReceivedGifts } from "@/server/gifts";
import { getLocale, getT } from "@/server/i18n";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("받은 선물") };
}

/** 받은 선물 (관리자 선물): 보낸 사람, 함께 보낸 말, 받은 코인·아이템. 최신 50개 */
export default async function GiftsPage() {
  const viewer = await requireMember();
  const t = await getT();
  const locale = await getLocale();
  const gifts = await listReceivedGifts(viewer.userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">
        <Icon name="gift" size={34} className="-mt-1" /> {t("받은 선물")}
      </h1>
      {gifts.length ? (
        <ul className="mt-6 space-y-4" data-gift-list>
          {gifts.map((g) => (
            <li key={g.id} className="card p-5">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="font-bold">{t("{who}님이 보낸 선물", { who: g.senderName ?? t("관리자") })}</p>
                <span className="ml-auto text-xs text-ink-soft">{formatDateTime(g.createdAt, locale)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-honey px-4 py-3">{g.message}</p>
              {(g.coins > 0 || g.items.length > 0) && (
                <ul className="mt-3 flex flex-wrap items-end gap-2">
                  {g.coins > 0 && (
                    <li className="flex h-16 items-center gap-1 rounded-xl bg-cream px-3 font-bold">
                      <Icon name="coin" size={22} /> {t("{n}코인", { n: g.coins.toLocaleString() })}
                    </li>
                  )}
                  {g.items.map((it) => (
                    <li key={it.id} className="w-20 text-center">
                      <ItemArt type={it.type} assetKey={it.assetKey} className="h-16" characterSize={56} />
                      <span className="mt-1 block truncate text-xs font-bold">{t(it.name)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="card mt-6 py-10 text-center text-ink-soft">{t("아직 받은 선물이 없어요")}</p>
      )}
      <p className="mt-6 text-sm text-ink-soft">
        {t("받은 아이템은 꾸미기에서 바로 쓸 수 있어요.")}{" "}
        <Link href="/closet" className="font-bold text-leaf-dark underline">
          {t("꾸미기로 가기")}
        </Link>
      </p>
    </div>
  );
}
