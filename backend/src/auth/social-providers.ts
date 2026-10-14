// 화면(브라우저 코드 포함)도 같이 읽는 값이라 DB 코드를 import하지 않는다

/** 소셜 로그인 연동 보상: 카카오·네이버·구글 각각 한 번씩 (최대 300) */
export const SOCIAL_LINK_REWARD_COINS = 100;
export const SOCIAL_PROVIDERS = ["google", "kakao", "naver"] as const;
