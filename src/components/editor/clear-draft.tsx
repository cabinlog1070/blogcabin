"use client";

import { useEffect } from "react";
import { draftStorageKey } from "@/lib/draft";

/** 새 글 발행에 성공해 글 상세로 왔을 때 임시 글을 지운다 (POST-08). 발행이 실패하면 이 화면에 오지 않으므로 남는다 */
export function ClearDraft({ userId }: { userId: string }) {
  useEffect(() => {
    try {
      window.localStorage.removeItem(draftStorageKey(userId));
    } catch {
      // 저장소를 쓸 수 없으면 지울 것도 없다
    }
  }, [userId]);
  return null;
}
