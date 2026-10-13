"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { addCategory, deleteCategory, moveCategory, renameCategory, updateBlogInfo, type FormState } from "./actions";
import { categoryLabel } from "@/lib/i18n";
import { STATUS_MESSAGE_MAX } from "@/lib/status-message";

const input = "w-full rounded-xl border-2 border-line bg-paper px-3 py-2 outline-none focus:border-sun";

export function BlogInfoForm({ nickname, title, description, statusMessage }: { nickname: string; title: string; description: string; statusMessage: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBlogInfo, {});
  const t = useT();
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block font-bold">{t("닉네임")}</span>
        <input name="nickname" defaultValue={nickname} minLength={2} maxLength={12} required className={input} />
        <span className="mt-1 block text-sm text-ink-soft">{t("2~12자, 다른 주민과 겹치지 않게 지어 주세요")}</span>
      </label>
      <label className="block">
        <span className="mb-1 block font-bold">{t("블로그 이름")}</span>
        <input name="title" defaultValue={title} maxLength={12} required className={input} />
        <span className="mt-1 block text-sm text-ink-soft">{t("12자까지 쓸 수 있어요")}</span>
      </label>
      <label className="block">
        <span className="mb-1 block font-bold">{t("소개")}</span>
        <textarea name="description" defaultValue={description} maxLength={160} rows={2} className={input} placeholder={t("어떤 이야기를 쓰는 블로그인가요?")} />
      </label>
      <label className="block">
        <span className="mb-1 block font-bold">{t("상태 메시지")}</span>
        <input name="statusMessage" defaultValue={statusMessage ?? ""} maxLength={STATUS_MESSAGE_MAX} className={input} placeholder={t("오늘 기분이나 하고 싶은 말")} />
        <span className="mt-1 block text-sm text-ink-soft">{t("30자까지. 나를 즐겨찾기한 이웃이 광장에서 내 캐릭터에 다가오면 말풍선으로 보여요")}</span>
        <span className="mt-0.5 block text-sm text-ink-soft">{t("이모티콘은 말풍선에서 깨져 보여서 쓸 수 없어요")}</span>
      </label>
      <div className="flex items-center justify-end gap-3">
        {state.error && <span className="text-sm text-berry">{state.error}</span>}
        {state.ok && !state.error && <span className="text-sm text-leaf-dark">{t("저장했어요 ✓")}</span>}
        <button disabled={pending} className="btn bg-leaf text-white">{t("저장")}</button>
      </div>
    </form>
  );
}

type Category = { id: number; name: string; postCount: number };

function CategoryRow({ c, first, last }: { c: Category; first: boolean; last: boolean }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const label = categoryLabel(t, c.name);
  const [name, setName] = useState(label);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <div className="flex flex-col">
        <button type="button" disabled={first || pending} onClick={() => start(() => moveCategory(c.id, -1))} className="px-1 text-xs disabled:opacity-30" aria-label={t("{name} 위로", { name: label })}>▲</button>
        <button type="button" disabled={last || pending} onClick={() => start(() => moveCategory(c.id, 1))} className="px-1 text-xs disabled:opacity-30" aria-label={t("{name} 아래로", { name: label })}>▼</button>
      </div>
      {editing ? (
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className={`${input} w-auto flex-1 py-1`} aria-label={t("카테고리 이름")} autoFocus />
      ) : (
        <span className="flex-1">
          {label} <span className="text-sm text-ink-soft">({c.postCount})</span>
        </span>
      )}
      {editing ? (
        <>
          <button
            type="button"
            disabled={pending}
            className="text-sm font-bold text-leaf-dark"
            onClick={() =>
              start(async () => {
                const r = await renameCategory(c.id, name);
                if (r.error) setError(r.error);
                else {
                  setError("");
                  setEditing(false);
                }
              })
            }
          >
            {t("저장")}
          </button>
          <button type="button" className="text-sm text-ink-soft" onClick={() => { setEditing(false); setName(label); setError(""); }}>
            {t("취소")}
          </button>
        </>
      ) : (
        <>
          <button type="button" className="text-sm text-ink-soft hover:text-ink" onClick={() => setEditing(true)}>{t("이름 바꾸기")}</button>
          <button
            type="button"
            disabled={pending}
            className="text-sm text-ink-soft hover:text-berry"
            onClick={() => confirm(t("'{name}' 카테고리를 지울까요? 글은 남고 '카테고리 없음'이 돼요.", { name: label })) && start(() => deleteCategory(c.id))}
          >
            {t("삭제")}
          </button>
        </>
      )}
      {error && <span className="w-full text-sm text-berry">{error}</span>}
    </li>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCategory, {});
  const t = useT();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <div>
      <ul className="divide-y-2 divide-line/60">
        {categories.map((c, i) => (
          <CategoryRow key={c.id} c={c} first={i === 0} last={i === categories.length - 1} />
        ))}
      </ul>
      <form ref={ref} action={action} className="mt-3 flex gap-2">
        <input name="name" maxLength={20} placeholder={t("새 카테고리")} required className={input} aria-label={t("새 카테고리 이름")} />
        <button disabled={pending} className="btn shrink-0 bg-ink text-cream">{t("추가")}</button>
      </form>
      {state.error && <p className="mt-1 text-sm text-berry">{state.error}</p>}
    </div>
  );
}
