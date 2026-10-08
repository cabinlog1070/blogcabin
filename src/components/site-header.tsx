import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { ExitButton, HomeLogo } from "@/components/exit-button";
import { Icon } from "@/components/icon";
import { IconEmoji } from "@/components/icon-emoji";
import { LevelBadge } from "@/components/level-badge";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileMenu } from "@/components/profile-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { enabledProviders } from "@/lib/auth";
import { getViewer, getViewerLoginMethods } from "@/server/dal";
import { getNotificationState } from "@/server/notifications";
import { getWallet } from "@/server/points";

/**
 * 모든 화면 맨 위 헤더 (TOWN-10): 왼쪽 로고, 오른쪽 유저 상태창(캐릭터 얼굴·닉네임·블로그 제목).
 * 쪽지 알림함은 레벨 배지 바로 왼쪽에 있다 (GAME-08). 레벨을 누르면 경험치 창,
 * 상태창을 누르면 내 정보 메뉴(내 블로그·환경 설정·문의하기·로그아웃)가 뜬다.
 * 휴대폰(360~430px)에서도 가로로 넘치지 않게 상태창은 얼굴만 보인다.
 */
export async function SiteHeader() {
  const viewer = await getViewer();
  const member = viewer?.profile ? { ...viewer, profile: viewer.profile } : null;
  const [wallet, notice, loginMethods] = member
    ? await Promise.all([getWallet(member.userId), getNotificationState(member.userId), getViewerLoginMethods()])
    : [null, null, null];

  return (
    <header className="sticky top-0 z-20 border-b-2 border-bark/30 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <HomeLogo href={member ? "/town" : "/"} />

        <div className="flex min-w-0 flex-1">
          <ExitButton />
        </div>

        {member && wallet && notice && loginMethods ? (
          <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell unread={notice.unread} popup={notice.popup} />
            <LevelBadge
              level={wallet.level}
              exp={wallet.exp}
              current={wallet.current}
              needed={wallet.needed}
              ratio={wallet.ratio}
              isMax={wallet.isMax}
            />
            <Link href="/wallet" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-paper px-1.5 py-1 text-xs font-bold shadow-sm hover:text-leaf-dark sm:px-2.5 sm:text-sm" title="코인">
              <Icon name="coin" size={18} className="size-4 sm:size-[18px]" />
              {wallet.coins.toLocaleString()}
            </Link>
            {member.user.role === "admin" && (
              // 이름은 예전처럼 "👑 관리자" (e2e가 이 이름으로 찾는다)
              <Link href="/admin" className="inline-flex items-center whitespace-nowrap rounded-full bg-ink px-2 py-1 text-xs font-bold text-cream sm:px-2.5" title="관리자">
                <IconEmoji name="level" emoji="👑" size={18} className="size-4 sm:size-[18px]" />
                <span className="ml-1 max-sm:hidden"> 관리자</span>
              </Link>
            )}
            <ProfileMenu
              face={<CharacterBadge asset={member.profile.characterAsset} size={36} />}
              bigFace={<CharacterBadge asset={member.profile.characterAsset} size={64} />}
              nickname={member.profile.nickname}
              blogTitle={member.profile.blogTitle}
              blogSlug={member.profile.blogSlug}
              linked={loginMethods}
              providers={enabledProviders}
            />
          </div>
        ) : viewer ? (
          // 온보딩을 마치기 전에는 상태창이 없으니 로그아웃 버튼만 둔다
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
