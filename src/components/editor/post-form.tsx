"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { savePost, type SavePostState } from "@/app/write/actions";
import { POST_REWARD_MIN_LENGTH, REWARD_RULES } from "@/lib/game";
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
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/**
 * 글쓰기 폼. draftKey가 있으면(새 글) 처음 열 때 임시 글을 불러올지 한 번 묻고,
 * 불러오면 그 값으로 폼을 새로 그린다 (에디터·입력칸이 처음 값을 만들 때만 쓰기 때문에 key로 다시 만든다)
 */
export function PostForm({ categories, initial, draftKey }: { categories: Category[]; initial: PostFormValues; draftKey?: string }) {
  const [seed, setSeed] = useState({ values: initial, key: "initial" });
  const asked = useRef(false);

  useEffect(() => {
    if (!draftKey || asked.current) return;
    asked.current = true; // 개발 모드에서 효과가 두 번 돌아도 한 번만 묻는다
    const draft = readDraft(draftKey);
    if (!draft || isEmptyDraft(draft)) return;
    if (!window.confirm("작성 중이던 글이 있어요. 불러올까요?")) return; // 아니면 빈 화면, 임시 글은 다음 저장 때 덮어쓴다
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
  }, [draftKey, categories]);

  return <PostFormFields key={seed.key} categories={categories} initial={seed.values} draftKey={draftKey} />;
}

function PostFormFields({ categories, initial, draftKey }: { categories: Category[]; initial: PostFormValues; draftKey?: string }) {
  const [state, action, pending] = useActionState<SavePostState, FormData>(savePost, {});
  const [html, setHtml] = useState(initial.contentHtml);
  const [length, setLength] = useState(0);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [uploading, setUploading] = useState(false); // 첨부를 올리는 중에는 발행하지 않는다 (POST-07)
  const isNew = !initial.postId;
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

      <input
        name="title"
        onInput={(e) => {
          const value = e.currentTarget.value;
          setFields((f) => ({ ...f, title: value }));
        }}
        defaultValue={v?.title ?? initial.title}
        placeholder="제목"
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
          aria-label="카테고리"
        >
          <option value="">카테고리 없음</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex rounded-xl border-2 border-line bg-paper p-0.5" role="radiogroup" aria-label="공개 설정">
          {(["public", "private"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visibility === v}
              onClick={() => setVisibility(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${visibility === v ? "bg-ink text-cream" : "text-ink-soft"}`}
            >
              {v === "public" ? "🌍 공개" : "🔒 비공개"}
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
        placeholder="태그 (쉼표로 구분, 최대 10개)  예: git, 회고"
        className="w-full rounded-xl border-2 border-line bg-paper px-3 py-2.5"
        aria-label="태그"
        maxLength={300}
      />

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-ink-soft">
          {length.toLocaleString()}자 ·{" "}
          {isNew ? (
            rewardable ? (
              <span className="font-bold text-leaf-dark">
                저장하면 ✨ 경험치 {REWARD_RULES.post.exp} · 🪙 {REWARD_RULES.post.coins} 보상 (하루 {REWARD_RULES.post.dailyLimit}번까지)
              </span>
            ) : visibility === "private" ? (
              "비공개 글은 보상이 없어요"
            ) : (
              `${POST_REWARD_MIN_LENGTH}자 이상 쓰면 보상을 받아요`
            )
          ) : (
            "글을 고치고 있어요"
          )}
          {draftKey && (
            <span className="mt-0.5 block text-xs" data-draft-status>
              {savedAt ? `임시 저장됨 ${hhmm(savedAt)}` : "작성 중인 글은 이 브라우저에 자동 저장돼요."}
            </span>
          )}
        </p>
        <div className="flex items-center gap-3">
          {state.error && <span className="text-sm font-bold text-berry">{state.error}</span>}
          <button type="submit" disabled={pending || uploading} className="btn bg-leaf text-white">
            {uploading ? "첨부를 올리는 중..." : pending ? "저장하는 중..." : isNew ? "발행하기" : "수정 완료"}
          </button>
        </div>
      </div>
    </form>
  );
}
