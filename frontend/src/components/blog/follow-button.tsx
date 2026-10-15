"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/components/i18n";
import { blogApi } from "@/lib/blog-api";

/** 남의 블로그 헤더의 이웃 버튼: 누르면 이웃 추가 / 끊기. 끝나면 헤더(이웃 수·☆)를 다시 그린다 */
export function FollowButton({ ownerId, following }: { ownerId: string; following: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await blogApi.toggleFollow(ownerId).catch(() => {});
          router.refresh();
        })
      }
      className={`btn whitespace-nowrap ${following ? "bg-paper text-ink" : "bg-sky text-white"}`}
    >
      {following ? t("✓ 이웃") : t("+ 이웃 추가")}
    </button>
  );
}
