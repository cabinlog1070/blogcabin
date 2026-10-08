"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { authClient } from "@/lib/auth-client";

/** 로그아웃하고 첫 화면으로 (헤더 내 정보 메뉴와 온보딩 중 헤더가 같이 쓴다) */
export function useSignOut() {
  const router = useRouter();
  return async () => {
    const { error } = await authClient.signOut();
    if (error) {
      // 예: 로그인한 주소와 다른 주소로 열어 거부됨 (403)
      window.alert("로그아웃하지 못했어요. 새로고침한 뒤 다시 눌러 주세요.");
      return;
    }
    router.push("/");
    router.refresh();
  };
}

/** 온보딩을 마치기 전 헤더의 로그아웃 버튼 (회원은 내 정보 메뉴에서 로그아웃한다) */
export function SignOutButton() {
  const signOut = useSignOut();
  return (
    <button
      type="button"
      aria-label="로그아웃"
      title="로그아웃"
      className="shrink-0 whitespace-nowrap text-xs text-ink-soft hover:text-ink sm:text-sm"
      onClick={signOut}
    >
      {/* 좁은 화면은 헤더 자리가 모자라 문 그림만 보인다 */}
      <Icon name="logout" size={22} className="sm:hidden" />
      <span aria-hidden className="max-sm:hidden">로그아웃</span>
    </button>
  );
}
