"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="로그아웃"
      title="로그아웃"
      className="shrink-0 whitespace-nowrap text-xs text-ink-soft hover:text-ink sm:text-sm"
      onClick={async () => {
        const { error } = await authClient.signOut();
        if (error) {
          // 예: 로그인한 주소와 다른 주소로 열어 거부됨 (403)
          window.alert("로그아웃하지 못했어요. 새로고침한 뒤 다시 눌러 주세요.");
          return;
        }
        router.push("/");
        router.refresh();
      }}
    >
      {/* 좁은 화면은 헤더 자리가 모자라 문 그림만 보인다 */}
      <span aria-hidden className="sm:hidden">🚪</span>
      <span aria-hidden className="max-sm:hidden">로그아웃</span>
    </button>
  );
}
