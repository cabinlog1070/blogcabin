import Link from "next/link";
import { Icon } from "@/components/icon";
import { formatDateTime } from "@/lib/format";
import { INQUIRY_STATUS_CLASS, INQUIRY_STATUS_LABELS, INQUIRY_TOPIC_LABELS, type InquiryStatus } from "@/lib/inquiry";
import { requireAdmin } from "@/server/dal";
import { getLocale, getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { InquiryAnswerForm, InquiryStatusButton } from "./inquiry-actions";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("문의함") };
}

const TABS = ["waiting", "answered", "closed", "all"] as const;

/** 관리자 문의함: 상태별 문의 목록, 회원 문의에 답하기, 처리 완료로 두기 (backend/src/inquiries) */
export default async function AdminInquiriesPage(props: PageProps<"/admin/inquiries">) {
  await requireAdmin();
  const t = await getT();
  const locale = await getLocale();
  const sp = await props.searchParams;
  const tab = TABS.find((x) => x === sp.status) ?? "waiting";
  const { rows, counts } = await readApi.admin.inquiries(tab === "all" ? "" : tab);
  const total = counts.waiting + counts.answered + counts.closed;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm">
        <Link href="/admin" className="text-sky underline">{t("관리자")}</Link> › {t("문의함")}
      </p>
      <h1 className="mt-1 font-display text-3xl">
        <Icon name="mail" size={34} className="-mt-1" /> {t("문의함")}
      </h1>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label={t("문의 상태")}>
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/admin/inquiries?status=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${tab === k ? "border-leaf bg-leaf text-white" : "border-line bg-paper text-ink-soft"}`}
          >
            {k === "all" ? t("전체") : t(INQUIRY_STATUS_LABELS[k])} {k === "all" ? total : counts[k as InquiryStatus]}
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <ul className="mt-5 space-y-4" data-admin-inquiries>
          {rows.map((q) => (
            <li key={q.id} className="card p-5" data-admin-inquiry={q.id}>
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className="rounded-full bg-cream px-2 py-0.5 font-bold text-ink">{t(INQUIRY_TOPIC_LABELS[q.topic])}</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${INQUIRY_STATUS_CLASS[q.status]}`}>{t(INQUIRY_STATUS_LABELS[q.status])}</span>
                <span>{formatDateTime(q.createdAt, locale)}</span>
              </p>
              <p className="mt-2 text-sm">
                {q.userId ? (
                  <>
                    <Link href={`/admin/members/${q.userId}`} className="font-bold text-sky underline">
                      {q.nickname ?? q.username ?? t("이 회원")}
                    </Link>{" "}
                    <span className="text-ink-soft">({q.username ?? t("소셜")})</span>
                  </>
                ) : (
                  <span data-guest-inquiry>
                    <b>{t("로그인 없이 보냄")}</b> · {t("적어 준 아이디: {username}", { username: q.guestUsername ?? "-" })}
                    {q.guestMatchId && (
                      <>
                        {" "}
                        <Link href={`/admin/members/${q.guestMatchId}`} className="text-sky underline">
                          {t("이 아이디 회원 보기")}
                        </Link>
                      </>
                    )}
                    <br />
                    {t("답받을 이메일:")}{" "}
                    <a href={`mailto:${q.contactEmail}`} className="font-bold text-leaf-dark underline">
                      {q.contactEmail}
                    </a>
                  </span>
                )}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border-2 border-line/60 p-3 text-sm">{q.content}</p>

              {q.userId ? (
                <InquiryAnswerForm id={q.id} answer={q.answer} answeredAt={q.answeredAt ? formatDateTime(q.answeredAt, locale) : null} />
              ) : (
                <p className="mt-3 break-keep text-xs text-ink-soft">
                  {t("로그인 없이 보낸 문의는 사이트에서 답을 볼 수 없어요. 적어 준 이메일로 답한 뒤 [처리 완료]를 눌러 주세요. 비밀번호 문의면 닉네임·블로그 이름·최근 글이 회원 정보와 맞는지 먼저 확인해 주세요.")}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <InquiryStatusButton id={q.id} closed={q.status === "closed"} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-ink-soft">{t("이 상태의 문의가 없어요.")}</p>
      )}
    </div>
  );
}
