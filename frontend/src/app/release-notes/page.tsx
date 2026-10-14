import { Icon } from "@/components/icon";
import { getLocale, getT } from "@/server/i18n";
import type { Locale } from "@/lib/i18n";
import { ReleaseImage } from "./release-image";
import { CURRENT_VERSION, RELEASE_KIND_LABEL, RELEASE_NOTES, type ReleaseChangeKind } from "@/lib/release-notes";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("릴리스 노트") };
}

const KIND_ORDER: ReleaseChangeKind[] = ["new", "improved", "fixed"];
const KIND_BADGE: Record<ReleaseChangeKind, string> = {
  new: "bg-leaf text-white",
  improved: "bg-honey text-sun-dark",
  fixed: "bg-moss text-leaf-dark",
};

/** "2026-10-12" → "2026년 10월 12일" (일본어 화면은 "2026年10月12日") */
const dateLabel = (d: string, locale: Locale) => {
  const [y, m, day] = d.split("-").map(Number);
  return locale === "ja" ? `${y}年${m}月${day}日` : `${y}년 ${m}월 ${day}일`;
};

/**
 * 릴리스 노트 (공개 화면): 날짜마다 접히는 묶음, 그 안에 그날 배포한 버전들. 내용은 src/lib/release-notes.ts
 * 접고 펴기는 <details>라서 자바스크립트 없이 된다. 가장 최근 날짜만 펼쳐 둔다
 */
export default async function ReleaseNotesPage() {
  const t = await getT();
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">
        <Icon name="notice" size={34} className="-mt-1" /> {t("릴리스 노트")}
      </h1>
      <p className="mt-1 text-ink-soft">{t("BlogCabin이 업데이트될 때마다 바뀐 점을 여기에 올려요.")}</p>
      <p className="mt-2 inline-block rounded-full border-2 border-line bg-paper px-3 py-0.5 text-sm font-bold" data-current-version>
        {t("지금 버전 {v}", { v: `v${CURRENT_VERSION}` })}
      </p>

      <ol className="mt-6 space-y-3" data-release-notes>
        {RELEASE_NOTES.map((day, i) => {
          const first = day.versions[0].version;
          const last = day.versions[day.versions.length - 1].version;
          return (
            <li key={day.date}>
              <details open={i === 0} className="card group" data-release={day.date}>
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 p-5 [&::-webkit-details-marker]:hidden">
                  <h2 className="font-display text-xl">
                    <time dateTime={day.date}>{dateLabel(day.date, locale)}</time>
                  </h2>
                  <span className="text-sm font-bold text-ink-soft">
                    {t("업데이트 {n}개", { n: day.versions.length })} · {first === last ? `v${first}` : `v${last} ~ v${first}`}
                  </span>
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" className="ml-auto shrink-0 self-center text-ink-soft transition group-open:rotate-180">
                    <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <ol className="space-y-5 border-t-2 border-line px-5 py-4">
                  {day.versions.map((v) => (
                    <li key={v.version} data-version={v.version}>
                      <h3 className="flex flex-wrap items-baseline gap-x-2 break-keep">
                        <span className="rounded-md bg-ink px-2 py-0.5 text-sm font-bold text-cream">v{v.version}</span>
                        <span className="font-bold">{t(v.title)}</span>
                      </h3>
                      {KIND_ORDER.map((kind) => {
                        const items = v.changes.filter((c) => c.kind === kind);
                        if (items.length === 0) return null;
                        return (
                          <section key={kind} className="mt-2">
                            <h4>
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${KIND_BADGE[kind]}`}>{t(RELEASE_KIND_LABEL[kind])}</span>
                            </h4>
                            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 break-keep text-sm leading-relaxed">
                              {items.map((c) => (
                                <li key={c.text}>
                                  {c.admin && <span className="mr-1 rounded border border-line px-1 text-xs font-bold text-ink-soft">{t("관리자")}</span>}
                                  {t(c.text)}
                                  {c.images && (
                                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                      {c.images.map((img) => (
                                        <ReleaseImage key={img.src} src={img.src} before={img.before} alt={t(img.alt)} />
                                      ))}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
