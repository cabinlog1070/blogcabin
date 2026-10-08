import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { ExitButton, HomeLogo } from "@/components/exit-button";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import { getViewer } from "@/server/dal";
import { getNotificationState } from "@/server/notifications";
import { getWallet } from "@/server/points";

/**
 * 모든 화면 맨 위 헤더 (TOWN-10): 왼쪽 로고, 오른쪽 유저 상태창(캐릭터 얼굴·닉네임·블로그 제목).
 * 쪽지(✉) 알림함은 레벨 배지 바로 왼쪽에 있다 (GAME-08).
 */
export async function SiteHeader() {
  const viewer = await getViewer();
  const member = viewer?.profile ? { ...viewer, profile: viewer.profile } : null;
  const [wallet, notice] = member
    ? await Promise.all([getWallet(member.userId), getNotificationState(member.userId)])
    : [null, null];

  return (
    <header className="sticky top-0 z-20 border-b-2 border-bark/30 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <HomeLogo href={member ? "/town" : "/"} />

        <div className="flex min-w-0 flex-1">
          <ExitButton />
        </div>

        {member && wallet && notice ? (
          <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell unread={notice.unread} popup={notice.popup} />
            {/* 좁은 화면에서도 레벨이 보이게 글씨와 여백만 줄인다 (GAME-02, 이슈 #5) */}
            <span className="whitespace-nowrap rounded-full bg-paper px-1.5 py-1 text-xs font-bold shadow-sm sm:px-2.5 sm:text-sm" title="레벨">
              Lv.{wallet.level}
            </span>
            <Link href="/wallet" className="whitespace-nowrap rounded-full bg-paper px-1.5 py-1 text-xs font-bold shadow-sm hover:text-leaf-dark sm:px-2.5 sm:text-sm" title="코인">
              🪙 {wallet.coins.toLocaleString()}
            </Link>
            {member.user.role === "admin" && (
              <Link href="/admin" className="whitespace-nowrap rounded-full bg-ink px-2 py-1 text-xs font-bold text-cream sm:px-2.5" title="관리자">
                👑<span className="max-sm:hidden"> 관리자</span>
              </Link>
            )}
            <div>
              <Link
                href={`/@${member.profile.blogSlug}`}
                className="flex items-center gap-1 rounded-2xl border-2 border-line bg-paper py-0.5 pl-0.5 pr-1.5 shadow-sm hover:border-sun sm:gap-2 sm:pr-3"
                title="내 블로그로"
                data-status-card
              >
                <CharacterBadge asset={member.profile.characterAsset} size={36} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <b className="max-w-[3.5rem] truncate text-sm sm:max-w-[9rem]" data-status-nickname>
                    {member.profile.nickname}
                  </b>
                  <span className="max-w-[9rem] truncate text-xs text-ink-soft max-sm:hidden" data-status-blog-title>
                    {member.profile.blogTitle}
                  </span>
                </span>
              </Link>
            </div>
            <SignOutButton />
          </div>
        ) : viewer ? (
          <SignOutButton />
        ) : (
          <Link href="/" className="btn shrink-0 bg-leaf text-sm text-white">
            시작하기
          </Link>
        )}
      </div>
    </header>
  );
}
