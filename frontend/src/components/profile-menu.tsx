"use client";

// 헤더 유저 상태창 (TOWN-10). 얼굴(+넓은 화면은 닉네임·블로그 제목)을 누르면 내 정보 메뉴가 뜬다:
// 큰 얼굴·닉네임·블로그 제목, 연결된 로그인 수단(AUTH-05), 내 블로그·환경 설정·문의하기·릴리스 노트·로그아웃
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PopoverPanel, useHeaderPopover } from "@/components/header-popover";
import { useT } from "@/components/i18n";
import { Icon } from "@/components/icon";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useSignOut } from "@/components/sign-out-button";
import { authClient } from "@/lib/auth-client";
import { SOCIAL_LINK_REWARD_COINS } from "@/lib/game";
import { msg, type T } from "@/lib/i18n";

type SocialProvider = "google" | "kakao" | "naver";

/** accounts.provider_id → 화면 이름 */
const LOGIN_METHODS: { id: "credential" | SocialProvider; label: string }[] = [
  { id: "credential", label: msg("아이디 로그인") },
  { id: "kakao", label: msg("카카오") },
  { id: "naver", label: msg("네이버") },
  { id: "google", label: "Google" },
];

/** 연동이 실패해 돌아왔을 때 (Better Auth가 errorCallbackURL 뒤에 ?error=코드를 붙인다) */
const LINK_FAILED = "link_failed";
/** 연동에 성공해 돌아왔을 때 (?linked=kakao) */
const LINKED = "linked";
// 연동하러 가기 전에 그 소셜 보상을 이미 받았었는지 기억해 둔다 (돌아왔을 때 "받았어요"를 처음 받은 경우에만 보여 주려고)
const BEFORE_KEY = "bc_link_rewarded_before";
const rememberRewarded = (provider: string, before: boolean) => {
  try {
    sessionStorage.setItem(BEFORE_KEY, JSON.stringify({ provider, before }));
  } catch {}
};
const rewardedBefore = (provider: string) => {
  try {
    const v = JSON.parse(sessionStorage.getItem(BEFORE_KEY) ?? "null") as { provider: string; before: boolean } | null;
    sessionStorage.removeItem(BEFORE_KEY);
    return v?.provider === provider && v.before;
  } catch {
    return false;
  }
};
const linkErrorText = (t: T, code: string | null) =>
  code === "account_already_linked_to_different_user"
    ? t("이 계정은 이미 다른 회원에 연결돼 있어서 연동하지 못했어요.")
    : t("계정을 연동하지 못했어요. 잠시 뒤에 다시 해 주세요.");

const menuItem = "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold hover:bg-cream";

export function ProfileMenu({
  face,
  bigFace,
  nickname,
  blogTitle,
  blogSlug,
  linked,
  rewarded,
  providers,
}: {
  /** 헤더에 보이는 얼굴 (서버에서 그린 CharacterBadge) */
  face: ReactNode;
  /** 메뉴 안의 큰 얼굴 */
  bigFace: ReactNode;
  nickname: string;
  blogTitle: string;
  blogSlug: string;
  /** 이 회원에 연결된 accounts.provider_id 목록 */
  linked: string[];
  /** 연동 보상(🪙 100)을 이미 받은 소셜 */
  rewarded: string[];
  /** 키가 설정돼 켜진 소셜 로그인 (서버 backend/src/auth의 enabledProviders, GET /api/v1/me가 준다) */
  providers: Record<SocialProvider, boolean>;
}) {
  const { open, box, setAnchor, setPanel, toggle, close } = useHeaderPopover(288); // 18rem
  const signOut = useSignOut();
  const t = useT();
  const [linking, setLinking] = useState<SocialProvider | null>(null);

  // 소셜 연동이 실패해 돌아왔으면 주소를 먼저 깨끗하게 돌려 놓고 한 번 알려 준다
  // (주소를 먼저 바꿔야 개발 모드에서 효과가 두 번 불려도 한 번만 뜬다)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(LINK_FAILED)) return;
    window.history.replaceState(null, "", window.location.pathname);
    window.alert(linkErrorText(t, params.get("error")));
  }, [t]);

  // 연동에 성공해 돌아왔으면 보상을 받았는지 한 번 알려 준다 (이미 받은 소셜이면 연동했다고만)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get(LINKED);
    if (!provider) return;
    window.history.replaceState(null, "", window.location.pathname);
    const label = LOGIN_METHODS.find((m) => m.id === provider)?.label;
    const name = label ? t(label) : provider;
    window.alert(
      rewarded.includes(provider) && !rewardedBefore(provider)
        ? t("{name} 연동 완료! 🪙 {coins}을 받았어요.", { name, coins: SOCIAL_LINK_REWARD_COINS })
        : t("{name} 연동을 마쳤어요.", { name }),
    );
  }, [rewarded, t]);

  // 연결된 것은 ✓, 켜져 있지만 연결 안 된 소셜은 [연동하기]. 꺼진 소셜은 보이지 않는다
  const rows = LOGIN_METHODS.filter((m) => linked.includes(m.id) || (m.id !== "credential" && providers[m.id]));

  const link = async (provider: SocialProvider) => {
    setLinking(provider);
    const here = window.location.pathname;
    // 성공하면 소셜 로그인 화면으로 갔다가 지금 화면으로 돌아온다 (돌아오면 헤더를 새로 그려 ✓가 보인다)
    rememberRewarded(provider, rewarded.includes(provider));
    const { error } = await authClient.linkSocial({ provider, callbackURL: `${here}?${LINKED}=${provider}`, errorCallbackURL: `${here}?${LINK_FAILED}=1` });
    if (error) {
      setLinking(null);
      window.alert(linkErrorText(t, null));
    }
  };

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("내 정보 ({nickname})", { nickname })}
        title={t("내 정보")}
        data-status-card
        // 휴대폰은 자리가 모자라 얼굴만 보인다. 닉네임·블로그 제목은 메뉴 안에 있다
        className="flex items-center gap-2 rounded-2xl border border-line bg-paper p-0.5 shadow-sm hover:border-sun sm:pr-3"
      >
        {face}
        <span className="flex min-w-0 flex-col text-left leading-tight max-sm:hidden">
          <b className="max-w-[9rem] truncate text-sm" data-status-nickname>
            {nickname}
          </b>
          <span className="max-w-[9rem] truncate text-xs text-ink-soft" data-status-blog-title>
            {blogTitle}
          </span>
        </span>
      </button>

      <PopoverPanel open={open} box={box} panelRef={setPanel} label={t("내 정보")} className="max-h-[80dvh] overflow-y-auto" data-profile-menu>
        <div className="flex items-center gap-3 border-b-2 border-line px-4 py-3">
          {bigFace}
          <div className="min-w-0">
            <p className="truncate font-display text-xl" data-menu-nickname>
              {nickname}
            </p>
            <p className="truncate text-sm text-ink-soft" data-menu-blog-title>
              {blogTitle}
            </p>
          </div>
        </div>

        <section className="border-b-2 border-line px-4 py-3" aria-labelledby="login-methods-title">
          <h3 id="login-methods-title" className="text-xs font-bold text-ink-soft">
            {t("로그인 수단")}
          </h3>
          <ul className="mt-1.5 space-y-1.5" data-login-methods>
            {rows.map((m) => {
              const on = linked.includes(m.id);
              return (
                <li key={m.id} className="flex min-h-8 items-center gap-2 text-sm" data-login-method={m.id} data-linked={on ? "true" : "false"}>
                  <span className="min-w-0 flex-1 truncate">{t(m.label)}</span>
                  {on ? (
                    <span className="font-bold text-leaf-dark">✓ {t("연결됨")}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => link(m.id as SocialProvider)}
                      disabled={linking !== null}
                      className="btn bg-paper px-2.5 py-1 text-xs text-ink"
                    >
                      {linking === m.id ? t("여는 중...") : t("연동하기")}
                    </button>
                  )}
                  {!on && !rewarded.includes(m.id) && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-sun-dark" data-link-reward>
                      +<Icon name="coin" size={14} />
                      {SOCIAL_LINK_REWARD_COINS}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex items-center justify-between gap-2 border-b-2 border-line px-4 py-3">
          <h3 className="text-xs font-bold text-ink-soft">{t("언어")}</h3>
          <LanguageSwitcher />
        </section>

        <nav className="py-1" aria-label={t("내 메뉴")}>
          <Link href={`/@${blogSlug}`} onClick={close} className={menuItem}>
            <Icon name="home" /> {t("내 블로그")}
          </Link>
          <Link href="/settings/blog" onClick={close} className={menuItem}>
            <Icon name="settings" /> {t("환경 설정")}
          </Link>
          <Link href="/support" onClick={close} className={menuItem}>
            <Icon name="inquiry" /> {t("문의하기")}
          </Link>
          <Link href="/release-notes" onClick={close} className={menuItem}>
            <Icon name="notice" /> {t("릴리스 노트")}
          </Link>
          <button
            type="button"
            onClick={() => {
              close();
              void signOut();
            }}
            className={`${menuItem} border-t-2 border-line text-ink-soft hover:text-ink`}
          >
            <Icon name="logout" /> {t("로그아웃")}
          </button>
        </nav>
      </PopoverPanel>
    </>
  );
}
