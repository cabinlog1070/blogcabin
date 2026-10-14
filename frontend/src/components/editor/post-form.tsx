"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { savePost, type SavePostState } from "@/app/write/actions";
import { useLocale, useT } from "@/components/i18n";
import { POST_REWARD_MIN_LENGTH, REWARD_RULES } from "@/lib/game";
import { categoryLabel, type Locale, LOCALE_TAGS } from "@/lib/i18n";
import { DEFAULT_PIN_HOURS, PIN_HOUR_OPTIONS, toKstInput } from "@/lib/schedule";
import { postTextLength } from "@/lib/text-length";
import { RichEditor } from "./rich-editor";

type Category = { id: number; name: string };

export type PostFormValues = {
  postId?: number;
  title: string;
  contentHtml: string;
  categoryId: number | null;
  tags: string[];
  visibility: "public" | "private";
  /** 아직 안 올라간 예약 글이면 올라갈 시각 (한국 시간 "YYYY-MM-DDTHH:mm", POST-11) */
  publishAt?: string;
  /** 관리자 글을 광장 게시판 맨 위에 걸어 두는 시간 */
  pinHours?: number;
};

// ===== 임시 저장 (POST-08, spec 003 FR-063~068) =====
// 새 글만, 회원마다 1개, 이 브라우저(localStorage)에만. 서버·DB에는 저장하지 않는다.
type Draft = { title: string; categoryId: string; visibility: "public" | "private"; contentHtml: string; tags: string; savedAt: string };

function readDraft(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (typeof d !== "object" || d === null || typeof d.contentHtml !== "string") return null;
    return {
      title: String(d.title ?? ""),
      categoryId: String(d.categoryId ?? ""),
      visibility: d.visibility === "private" ? "private" : "public",
      contentHtml: d.contentHtml,
      tags: String(d.tags ?? ""),
      savedAt: String(d.savedAt ?? ""),
    };
  } catch {
    return null; // 저장소를 쓸 수 없거나 값이 깨졌으면 없는 것으로
  }
}
/** 제목(앞뒤 공백 제거)도 본문 글자도 없으면 비어 있다 → 저장하지도, 불러올지 묻지도 않는다 */
const isEmptyDraft = (d: Pick<Draft, "title" | "contentHtml">) => !d.title.trim() && postTextLength(d.contentHtml) === 0;
const hhmm = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(LOCALE_TAGS[locale], { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/**
 * 글쓰기 폼. draftKey가 있으면(새 글) 처음 열 때 임시 글을 불러올지 한 번 묻고,
 * 불러오면 그 값으로 폼을 새로 그린다 (에디터·입력칸이 처음 값을 만들 때만 쓰기 때문에 key로 다시 만든다)
 */
export function PostForm({
  categories,
  initial,
  draftKey,
  isAdmin = false,
}: {
  categories: Category[];
  initial: PostFormValues;
  draftKey?: string;
  isAdmin?: boolean;
}) {
  const t = useT();
  const [seed, setSeed] = useState({ values: initial, key: "initial" });
  const asked = useRef(false);

  useEffect(() => {
    if (!draftKey || asked.current) return;
    asked.current = true; // 개발 모드에서 효과가 두 번 돌아도 한 번만 묻는다
    const draft = readDraft(draftKey);
    if (!draft || isEmptyDraft(draft)) return;
    if (!window.confirm(t("작성 중이던 글이 있어요. 불러올까요?"))) return; // 아니면 빈 화면, 임시 글은 다음 저장 때 덮어쓴다
    const categoryId = Number(draft.categoryId);
    // 그 사이 지워진 카테고리면 `카테고리 없음` (서버도 내 블로그에 없는 카테고리는 저장하지 않는다)
    const known = categories.some((c) => c.id === categoryId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장소는 화면이 열린 뒤에만 읽을 수 있다
    setSeed({
      key: "draft",
      values: {
        title: draft.title,
        contentHtml: draft.contentHtml,
        categoryId: known ? categoryId : null,
        tags: draft.tags ? [draft.tags] : [],
        visibility: draft.visibility,
      },
    });
  }, [draftKey, categories, t]);

  return <PostFormFields key={seed.key} categories={categories} initial={seed.values} draftKey={draftKey} isAdmin={isAdmin} />;
}

/** 게시 시간 고르기 이름: 1시간 · 하루 (24시간) · 7일 (168시간) */
function pinLabel(t: ReturnType<typeof useT>, hours: number) {
  if (hours === 0) return t("걸지 않기");
  if (hours % 24 === 0) return t("{d}일 ({h}시간)", { d: hours / 24, h: hours });
  return t("{h}시간", { h: hours });
}

function PostFormFields({
  categories,
  initial,
  draftKey,
  isAdmin,
}: {
  categories: Category[];
  initial: PostFormValues;
  draftKey?: string;
  isAdmin: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [state, action, pending] = useActionState<SavePostState, FormData>(savePost, {});
  const [html, setHtml] = useState(initial.contentHtml);
  const [length, setLength] = useState(0);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [uploading, setUploading] = useState(false); // 첨부를 올리는 중에는 발행하지 않는다 (POST-07)
  const isNew = !initial.postId;
  // 예약 발행 (POST-11): 새 글이나 아직 안 올라간 예약 글만 올리는 때를 고른다
  const canSchedule = isNew || Boolean(initial.publishAt);
  const [publishMode, setPublishMode] = useState<"now" | "schedule">(initial.publishAt ? "schedule" : "now");
  const [publishAt, setPublishAt] = useState(initial.publishAt ?? "");
  const [pinHours, setPinHours] = useState(initial.pinHours ?? (isNew ? DEFAULT_PIN_HOURS : 0));
  const pinOptions: number[] = PIN_HOUR_OPTIONS.includes(pinHours as (typeof PIN_HOUR_OPTIONS)[number])
    ? [...PIN_HOUR_OPTIONS]
    : [...PIN_HOUR_OPTIONS, pinHours].sort((a, b) => a - b);
  const scheduling = canSchedule && publishMode === "schedule";
  // 오류로 돌아오면 서버가 돌려준 입력값을, 아니면 처음 값을 쓴다
  const v = state.values;
  const rewardable = isNew && visibility === "public" && length >= POST_REWARD_MIN_LENGTH;

  // 임시 저장: 칸 중 하나라도 바뀐 뒤 입력이 2초 멈추면 이 브라우저에 덮어쓴다 (새 글만)
  const [fields, setFields] = useState({
    title: initial.title,
    categoryId: initial.categoryId ? String(initial.categoryId) : "",
    tags: initial.tags.join(", "),
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const firstSnapshot = useRef<string | null>(null);
  useEffect(() => {
    if (!draftKey) return;
    const draft = { ...fields, visibility, contentHtml: html };
    const snapshot = JSON.stringify(draft);
    // 처음 그려질 때(에디터가 만들어지며 부르는 onChange 포함)는 바뀐 게 아니라서 저장하지 않는다
    if (firstSnapshot.current === null || firstSnapshot.current === snapshot) {
      firstSnapshot.current ??= snapshot;
      return;
    }
    if (isEmptyDraft(draft)) return;
    const timer = setTimeout(() => {
      const at = new Date().toISOString();
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ ...draft, savedAt: at }));
        setSavedAt(at);
      } catch {
        // 저장소를 쓸 수 없으면 임시 저장만 조용히 건너뛴다 (글쓰기·발행은 그대로)
      }
    }, 2000);
    // 다음 입력이 오거나 화면을 떠나면(발행 뒤 이동) 타이머를 취소한다
    return () => clearTimeout(timer);
  }, [draftKey, fields, visibility, html]);

  return (
    <form action={action} className="space-y-4">
      {initial.postId && <input type="hidden" name="postId" value={initial.postId} />}
      <input type="hidden" name="contentHtml" value={html} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="publishMode" value={scheduling ? "schedule" : "now"} />
      {isAdmin && <input type="hidden" name="pinHours" value={pinHours} />}

      <input
        name="title"
        onInput={(e) => {
          const value = e.currentTarget.value;
          setFields((f) => ({ ...f, title: value }));
        }}
        defaultValue={v?.title ?? initial.title}
        placeholder={t("제목")}
        maxLength={100}
        required
        className="w-full border-b-2 border-line bg-transparent px-1 py-3 font-display text-3xl outline-none focus:border-sun"
      />

      <div className="flex flex-wrap gap-3">
        <select
          // select는 그린 뒤 defaultValue를 바꿔도 폼 초기화 기준이 그대로라, 오류로 돌아오면 새로 그린다
          key={v ? `restored-${v.categoryId}` : "initial"}
          name="categoryId"
          onChange={(e) => {
            const value = e.currentTarget.value;
            setFields((f) => ({ ...f, categoryId: value }));
          }}
          defaultValue={v?.categoryId ?? initial.categoryId ?? ""}
          className="rounded-xl border-2 border-line bg-paper px-3 py-2"
          aria-label={t("카테고리")}
        >
          <option value="">{t("카테고리 없음")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(t, c.name)}
            </option>
          ))}
        </select>

        <div className="flex rounded-xl border-2 border-line bg-paper p-0.5" role="radiogroup" aria-label={t("공개 설정")}>
          {(["public", "private"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visibility === v}
              onClick={() => setVisibility(v)}
              title={v === "public" ? t("누구나 볼 수 있어요") : t("나와 서로 이웃(서로 이웃 추가한 사이)만 볼 수 있어요")}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${visibility === v ? "bg-ink text-cream" : "text-ink-soft"}`}
            >
              {v === "public" ? t("🌍 공개") : t("🔒 서로 이웃만")}
            </button>
          ))}
        </div>
      </div>

      <RichEditor
        initialHtml={initial.contentHtml}
        onChange={(h, n) => {
          setHtml(h);
          setLength(n);
        }}
        onUploadingChange={setUploading}
      />

      <input
        name="tags"
        onInput={(e) => {
          const value = e.currentTarget.value;
          setFields((f) => ({ ...f, tags: value }));
        }}
        defaultValue={v?.tags ?? initial.tags.join(", ")}
        placeholder={t("태그 (쉼표로 구분, 최대 10개)  예: git, 회고")}
        className="w-full rounded-xl border-2 border-line bg-paper px-3 py-2.5"
        aria-label={t("태그")}
        maxLength={300}
      />

      {(canSchedule || isAdmin) && (
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-4 text-sm">
          {canSchedule && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{t("올리는 때")}</span>
              <div className="flex rounded-xl border-2 border-line bg-paper p-0.5" role="radiogroup" aria-label={t("올리는 때")}>
                {(["now", "schedule"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={publishMode === m}
                    onClick={() => {
                      setPublishMode(m);
                      // 처음 예약을 누르면 다음 정각 한 시간 뒤를 넣어 둔다
                      if (m === "schedule" && !publishAt) {
                        const next = new Date();
                        next.setMinutes(0, 0, 0);
                        next.setHours(next.getHours() + 2);
                        setPublishAt(toKstInput(next));
                      }
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold ${publishMode === m ? "bg-ink text-cream" : "text-ink-soft"}`}
                  >
                    {m === "now" ? t("지금 올리기") : t("⏰ 예약하기")}
                  </button>
                ))}
              </div>
              {scheduling && (
                <label className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    name="publishAt"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.currentTarget.value)}
                    required
                    className="rounded-xl border-2 border-line bg-paper px-3 py-1.5"
                    aria-label={t("올라갈 날짜와 시간")}
                  />
                  <span className="text-xs text-ink-soft">{t("한국 시간")}</span>
                </label>
              )}
            </div>
          )}
          {isAdmin && (
            <label className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{t("📌 광장 게시판 맨 위에 걸어 두기")}</span>
              <select
                value={pinHours}
                onChange={(e) => setPinHours(Number(e.currentTarget.value))}
                className="rounded-xl border-2 border-line bg-paper px-3 py-1.5"
              >
                {pinOptions.map((h) => (
                  <option key={h} value={h}>
                    {pinLabel(t, h)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink-soft">{t("올라간 때부터 세요")}</span>
            </label>
          )}
          {scheduling && <p className="basis-full text-xs text-ink-soft">{t("예약한 글은 그 시간이 될 때까지 나만 볼 수 있어요.")}</p>}
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-ink-soft">
          {t("{n}자", { n: length.toLocaleString(LOCALE_TAGS[locale]) })} ·{" "}
          {isNew ? (
            rewardable ? (
              <span className="font-bold text-leaf-dark">
                {t("저장하면 ✨ 경험치 {exp} · 🪙 {coins} 보상 (하루 {limit}번까지)", {
                  exp: REWARD_RULES.post.exp,
                  coins: REWARD_RULES.post.coins,
                  limit: REWARD_RULES.post.dailyLimit,
                })}
              </span>
            ) : visibility === "private" ? (
              t("서로 이웃만 보는 비공개 글은 보상이 없어요")
            ) : (
              t("{n}자 이상 쓰면 보상을 받아요", { n: POST_REWARD_MIN_LENGTH })
            )
          ) : (
            t("글을 고치고 있어요")
          )}
          {draftKey && (
            <span className="mt-0.5 block text-xs" data-draft-status>
              {savedAt ? t("임시 저장됨 {time}", { time: hhmm(savedAt, locale) }) : t("작성 중인 글은 이 브라우저에 자동 저장돼요.")}
            </span>
          )}
        </p>
        <div className="flex items-center gap-3">
          {state.error && <span className="text-sm font-bold text-berry">{state.error}</span>}
          <button type="submit" disabled={pending || uploading} className="btn bg-leaf text-white">
            {uploading ? t("첨부를 올리는 중...") : pending ? t("저장하는 중...") : isNew ? (scheduling ? t("예약하기") : t("발행하기")) : t("수정 완료")}
          </button>
        </div>
      </div>
    </form>
  );
}
