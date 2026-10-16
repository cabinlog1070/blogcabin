import { connection } from "next/server";
import { Fragment, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { EGG_LEVEL_EVERY, EGG_PRICE, MAX_ACTIVE_ANIMALS, MAX_NEST_EGGS, POST_GROWTH, POTION_GROWTH, POTION_PRICE } from "@/lib/farm";
import {
  ATTENDANCE_STREAK_BONUS_EVERY,
  expForLevel,
  HOUSE_STAGE_LEVELS,
  MAX_LEVEL,
  POST_REWARD_MIN_LENGTH,
  REWARD_RULES as R,
} from "@/lib/game";
import type { T } from "@/lib/i18n";
import { INVITE_REWARD_COINS } from "@/lib/invite";
import { formatDateTime } from "@/lib/format";
import { INQUIRY_STATUS_CLASS, INQUIRY_STATUS_LABELS, INQUIRY_TOPIC_LABELS, type InquiryTopic } from "@/lib/inquiry";
import { getMe } from "@/server/dal";
import { getLocale, getT } from "@/server/i18n";
import { readApi } from "@/server/read-api";
import { InquiryForm } from "./inquiry-form";
import { FRESH_MINUTES as PASSWORD_FRESH_MINUTES } from "@backend/account/password-rules";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("문의하기") };
}

const n = (v: number) => v.toLocaleString();

/** 번역한 문장의 {이름} 자리에 아이콘·굵은 글씨 같은 요소를 넣는다 (t()가 vars에 없는 자리는 그대로 남긴다) */
function rich(text: string, nodes: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key && key in nodes ? <Fragment key={i}>{nodes[key]}</Fragment> : part;
  });
}

const EXP = <Icon name="exp" size={16} />;
const COIN = <Icon name="coin" size={16} />;
const icons = { exp: EXP, coin: COIN };

/** 자주 묻는 질문. 숫자는 게임 규칙(src/lib/game.ts·farm.ts)에서 가져와 규칙이 바뀌어도 맞게 보인다.
 *  id는 목록 key, q는 질문 (그린 아이콘이 섞일 수 있다) */
const faq = (t: T): { id: string; q: ReactNode; a: ReactNode }[] => [
  {
    id: "earn",
    q: rich(t("{coin} 코인과 {exp} 경험치는 어떻게 모아요?"), { coin: <Icon name="coin" size={20} />, exp: <Icon name="exp" size={20} /> }),
    a: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          {rich(
            t("출석 체크: 하루 한 번 {exp} {attExp} · {coin} {attCoins}, {every}일 연속마다 {coin} {streakCoins} 보너스", {
              attExp: R.attendance.exp,
              attCoins: R.attendance.coins,
              every: ATTENDANCE_STREAK_BONUS_EVERY,
              streakCoins: R.attendance_streak.coins,
            }),
            icons,
          )}
        </li>
        <li>
          {rich(
            t("새 공개 글(본문 {min}자 이상): {exp} {gainExp} · {coin} {gainCoins}, 하루 {limit}번까지", {
              min: POST_REWARD_MIN_LENGTH,
              gainExp: R.post.exp,
              gainCoins: R.post.coins,
              limit: R.post.dailyLimit,
            }),
            icons,
          )}
        </li>
        <li>
          {rich(
            t("남의 글에 댓글·답글: {exp} {gainExp} · {coin} {gainCoins}, 하루 {limit}번까지", {
              gainExp: R.comment.exp,
              gainCoins: R.comment.coins,
              limit: R.comment.dailyLimit,
            }),
            icons,
          )}
        </li>
        <li>
          {rich(
            t("내 글이 공감을 받으면: {exp} {gainExp} · {coin} {gainCoins}, 하루 {limit}번까지", {
              gainExp: R.like_received.exp,
              gainCoins: R.like_received.coins,
              limit: R.like_received.dailyLimit,
            }),
            icons,
          )}
        </li>
        <li>
          {rich(
            t("동물 농장에서 밥 주기·쓰다듬기: {exp} {gainExp}, 하루 {limit}번까지", {
              gainExp: R.farm_care.exp,
              limit: R.farm_care.dailyLimit,
            }),
            icons,
          )}
        </li>
        <li>
          {rich(
            t("친구 초대: 초대받아 가입한 친구가 첫 공개 글(본문 {min}자 이상)을 쓰면 나와 친구 둘 다 {coin} {coins} (초대 코드는 내 블로그 홈에 있어요)", {
              min: POST_REWARD_MIN_LENGTH,
              coins: INVITE_REWARD_COINS,
            }),
            icons,
          )}
        </li>
      </ul>
    ),
  },
  {
    id: "level",
    q: t("레벨은 어떻게 올라요?"),
    a: (
      <p>
        {rich(
          t("경험치가 쌓이면 레벨이 올라요. Lv.2는 {exp} {lv2}, Lv.5는 {exp} {lv5}, Lv.10은 {exp} {lv10}이 필요하고, 최고 레벨은 Lv.{max}이에요. 헤더의 {badge} 배지를 누르면 다음 레벨까지 남은 경험치가 보여요. 하루는 한국 시간 0시에 바뀌어요.", { lv2: n(expForLevel(2)), lv5: n(expForLevel(5)), lv10: n(expForLevel(10)), max: MAX_LEVEL }),
          { exp: EXP, badge: <b>Lv</b> },
        )}
      </p>
    ),
  },
  {
    id: "house",
    q: (
      <>
        <Icon name="home" size={20} /> {t("광장의 내 집은 언제 커져요?")}
      </>
    ),
    a: (
      <p>
        {t("집 주인의 레벨에 따라 3단계로 커져요. Lv.1~{end1}은 1단계, Lv.{start2}~{end2}은 창문이 생긴 2단계, Lv.{start3}부터는 다락방 창이 있는 3단계예요. 레벨은 내려가지 않아서 집도 작아지지 않아요. 지붕 색은 꾸미기에서 고를 수 있어요.", {
            end1: HOUSE_STAGE_LEVELS[2] - 1,
            start2: HOUSE_STAGE_LEVELS[2],
            end2: HOUSE_STAGE_LEVELS[3] - 1,
            start3: HOUSE_STAGE_LEVELS[3],
          })}
      </p>
    ),
  },
  {
    id: "pet",
    q: (
      <>
        <Icon name="egg" size={20} /> {t("펫은 어떻게 키워요?")}
      </>
    ),
    a: (
      <p>
        {rich(
          t("광장의 동물 농장에서 알을 받아요. 첫 알은 무료이고, {every}레벨마다 알을 하나 더 받아요. {coin} {eggPrice}로 살 수도 있어요. 알 둥지에는 알을 {eggs}개까지 놓고, 풀밭에서는 한 번에 {max}마리까지 키울 수 있어요. 밥 주기·쓰다듬기는 하루 한 번씩, 물약({coin} {potionPrice})은 쓸 때마다 성장 + {potionGrowth}, 공개 글로 보상을 받으면 키우는 동물마다 성장 +{postGrowth}이에요. 다 키우면 보상과 카드를 받아요. 한 마리를 골라 데리고 다니면 광장에서 따라와요.", {
              every: EGG_LEVEL_EVERY,
              eggPrice: EGG_PRICE,
              eggs: MAX_NEST_EGGS,
              max: MAX_ACTIVE_ANIMALS,
              potionPrice: POTION_PRICE,
              potionGrowth: POTION_GROWTH,
              postGrowth: POST_GROWTH,
            }),
          icons,
        )}
      </p>
    ),
  },
  {
    id: "character",
    q: t("캐릭터를 바꿀 수 있어요?"),
    a: <p>{t("캐릭터는 가입할 때 고른 그대로예요. 대신 상점에서 산 옷(상의·하의)·모자·신발로 꾸미고, 가구와 배경으로 미니룸을 꾸밀 수 있어요.")}</p>,
  },
  {
    id: "blog",
    q: t("블로그 이름이나 주소를 바꾸고 싶어요"),
    a: <p>{t("오른쪽 위 내 얼굴을 누르고 [환경 설정]에서 블로그 이름과 소개를 바꿀 수 있어요. 블로그 주소(/@주소)는 바꿀 수 없어요.")}</p>,
  },
  {
    id: "password",
    q: t("비밀번호를 잊어버렸어요"),
    a: (
      <ul className="list-disc space-y-1 pl-5">
        <li>{t("카카오·구글을 연동해 두었다면: 로그인 화면의 간편 로그인으로 들어간 뒤, 내 얼굴 → [환경 설정] → [비밀번호 바꾸기]에서 지금 비밀번호 없이 새 비밀번호를 정할 수 있어요 (로그인하고 {minutes}분 안에).", { minutes: PASSWORD_FRESH_MINUTES })}</li>
        <li>{t("연동하지 않았다면: 아래 [문의 남기기]에서 [비밀번호]를 고르고 아이디·닉네임·블로그 이름·최근에 쓴 글 제목과 답받을 이메일을 적어 보내 주세요. 관리자가 본인인지 확인한 뒤 그 이메일로 임시 비밀번호를 알려 드려요. 로그인한 뒤 바로 새 비밀번호로 바꿔 주세요.")}</li>
        <li>{t("잊기 전에 미리 내 얼굴 메뉴의 [로그인 수단]에서 카카오나 구글을 연동해 두면 혼자서도 되찾을 수 있어요.")}</li>
      </ul>
    ),
  },
  {
    id: "leave",
    q: t("회원 탈퇴는 어떻게 해요?"),
    a: (
      <p>
        {rich(
          t("오른쪽 위 내 얼굴 → [환경 설정] 맨 아래 {withdraw}에서 할 수 있어요. 아이디로 가입했다면 비밀번호를 한 번 더 적어요. 탈퇴하면 프로필·블로그·글·코인 기록·로그인 정보가 바로 지워지고 되돌릴 수 없어요. 남의 글에 남긴 댓글에 답글이 달려 있으면 '삭제된 댓글이에요'로 자리만 남아요."),
          { withdraw: <b>{t("회원 탈퇴")}</b> },
        )}
      </p>
    ),
  },
];

/** 문의하기 (공개 화면): 자주 묻는 질문 + 문의 남기기(문의함, 로그인 없이도) + 내 문의와 답 + 문의 메일(있으면) */
export default async function SupportPage(props: PageProps<"/support">) {
  // 배포 환경마다 다른 주소를 쓸 수 있게 요청 때 환경 변수를 읽는다
  await connection();
  const email = process.env.SUPPORT_EMAIL?.trim();
  const t = await getT();
  const locale = await getLocale();
  const FAQ = faq(t);
  const me = await getMe();
  const signedIn = Boolean(me.user);
  const mine = signedIn ? (await readApi.myInquiries()).rows : [];
  const sp = await props.searchParams;
  const initialTopic = typeof sp.topic === "string" && sp.topic in INQUIRY_TOPIC_LABELS ? (sp.topic as InquiryTopic) : "other";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">
        <Icon name="inquiry" size={34} className="-mt-1" /> {t("문의하기")}
      </h1>
      <p className="mt-1 text-ink-soft">{t("궁금한 게 있으면 먼저 아래 질문을 살펴봐 주세요.")}</p>

      <section className="card mt-6 p-2 sm:p-3" aria-labelledby="faq-title">
        <h2 id="faq-title" className="px-3 pb-1 pt-2 font-display text-xl">
          {t("자주 묻는 질문")}
        </h2>
        <div className="divide-y-2 divide-line/60" data-faq>
          {FAQ.map((f) => (
            <details key={f.id} className="group px-3 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">{f.q}</span>
                <span aria-hidden className="shrink-0 text-ink-soft transition-transform group-open:rotate-90">
                  ▸
                </span>
              </summary>
              <div className="mt-2 break-keep text-sm leading-relaxed text-ink-soft">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="card mt-6 p-5" aria-labelledby="inquiry-title" id="inquiry">
        <h2 id="inquiry-title" className="font-display text-xl">
          <Icon name="mail" size={26} className="-mt-1" /> {t("문의 남기기")}
        </h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          {signedIn ? t("관리자가 답하면 알림으로 알려 드리고, 아래 [내 문의]에서 답을 볼 수 있어요.") : t("비밀번호를 잊어 로그인할 수 없어도 보낼 수 있어요.")}
        </p>
        <InquiryForm signedIn={signedIn} initialTopic={initialTopic} />
        {email && (
          <p className="mt-4 border-t-2 border-line/60 pt-3 text-sm text-ink-soft" data-support-contact>
            {t("메일로도 문의할 수 있어요:")}{" "}
            <a href={`mailto:${email}`} className="font-bold text-leaf-dark underline">
              {email}
            </a>
          </p>
        )}
      </section>

      {signedIn && (
        <section className="card mt-6 p-5" aria-labelledby="my-inquiries-title" id="my-inquiries" data-my-inquiries>
          <h2 id="my-inquiries-title" className="font-display text-xl">
            {t("내 문의")}
          </h2>
          {mine.length ? (
            <ul className="mt-3 space-y-3">
              {mine.map((q) => (
                <li key={q.id} className="rounded-xl border-2 border-line/70 bg-paper p-3" data-inquiry={q.id}>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                    <span className="rounded-full bg-cream px-2 py-0.5 font-bold text-ink">{t(INQUIRY_TOPIC_LABELS[q.topic])}</span>
                    <span className={`rounded-full px-2 py-0.5 font-bold ${INQUIRY_STATUS_CLASS[q.status]}`}>{t(INQUIRY_STATUS_LABELS[q.status])}</span>
                    <span>{formatDateTime(q.createdAt, locale)}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{q.content}</p>
                  {q.answer && (
                    <div className="mt-3 rounded-lg bg-cream p-3 text-sm" data-inquiry-answer>
                      <p className="mb-1 text-xs font-bold text-leaf-dark">
                        {t("관리자 답")} · {q.answeredAt ? formatDateTime(q.answeredAt, locale) : ""}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{q.answer}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">{t("아직 보낸 문의가 없어요.")}</p>
          )}
        </section>
      )}
    </div>
  );
}
