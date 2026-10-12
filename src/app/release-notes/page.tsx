import { Icon } from "@/components/icon";
import { getLocale, getT } from "@/server/i18n";
import type { Locale } from "@/lib/i18n";
import { RELEASE_KIND_LABEL, RELEASE_NOTES, type ReleaseChangeKind } from "@/lib/release-notes";

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

/** 릴리스 노트 (공개 화면): 배포한 날마다 무엇이 바뀌었는지. 내용은 src/lib/release-notes.ts */
export default async function ReleaseNotesPage() {
  const t = await getT();
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">
        <Icon name="notice" size={34} className="-mt-1" /> {t("릴리스 노트")}
      </h1>
      <p className="mt-1 text-ink-soft">{t("BlogCabin이 업데이트될 때마다 바뀐 점을 여기에 올려요.")}</p>

      <ol className="mt-6 space-y-6" data-release-notes>
        {RELEASE_NOTES.map((note) => (
          <li key={note.date} className="card p-5" data-release={note.date}>
            <h2 className="font-display text-xl">
              <time dateTime={note.date}>{dateLabel(note.date, locale)}</time>
            </h2>
            <p className="mt-0.5 break-keep font-bold text-ink-soft">{t(note.title)}</p>
            {KIND_ORDER.map((kind) => {
              const items = note.changes.filter((c) => c.kind === kind);
              if (items.length === 0) return null;
              return (
                <section key={kind} className="mt-4">
                  <h3>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${KIND_BADGE[kind]}`}>{t(RELEASE_KIND_LABEL[kind])}</span>
                  </h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 break-keep text-sm leading-relaxed">
                    {items.map((c) => (
                      <li key={c.text}>
                        {c.admin && <span className="mr-1 rounded border border-line px-1 text-xs font-bold text-ink-soft">{t("관리자")}</span>}
                        {t(c.text)}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </li>
        ))}
      </ol>
    </div>
  );
}
