import { connection } from "next/server";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { EGG_LEVEL_EVERY, EGG_PRICE, MAX_ACTIVE_ANIMALS, POST_GROWTH, POTION_GROWTH, POTION_PRICE } from "@/lib/farm";
import {
  ATTENDANCE_STREAK_BONUS_EVERY,
  expForLevel,
  HOUSE_STAGE_LEVELS,
  MAX_LEVEL,
  POST_REWARD_MIN_LENGTH,
  REWARD_RULES as R,
} from "@/lib/game";
import { INVITE_REWARD_COINS } from "@/lib/invite";

export const metadata = { title: "문의하기" };

const n = (v: number) => v.toLocaleString();

/** 자주 묻는 질문. 숫자는 게임 규칙(src/lib/game.ts·farm.ts)에서 가져와 규칙이 바뀌어도 맞게 보인다.
 *  id는 목록 key, q는 질문 (그린 아이콘이 섞일 수 있다) */
const FAQ: { id: string; q: ReactNode; a: ReactNode }[] = [
  {
    id: "earn",
    q: (
      <>
        <Icon name="coin" size={20} /> 코인과 <Icon name="exp" size={20} /> 경험치는 어떻게 모아요?
      </>
    ),
    a: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          출석 체크: 하루 한 번 <Icon name="exp" size={16} /> {R.attendance.exp} · <Icon name="coin" size={16} /> {R.attendance.coins}, {ATTENDANCE_STREAK_BONUS_EVERY}일 연속마다{" "}
          <Icon name="coin" size={16} /> {R.attendance_streak.coins} 보너스
        </li>
        <li>
          새 공개 글(본문 {POST_REWARD_MIN_LENGTH}자 이상): <Icon name="exp" size={16} /> {R.post.exp} · <Icon name="coin" size={16} /> {R.post.coins}, 하루 {R.post.dailyLimit}번까지
        </li>
        <li>
          남의 글에 댓글·답글: <Icon name="exp" size={16} /> {R.comment.exp} · <Icon name="coin" size={16} /> {R.comment.coins}, 하루 {R.comment.dailyLimit}번까지
        </li>
        <li>
          내 글이 공감을 받으면: <Icon name="exp" size={16} /> {R.like_received.exp} · <Icon name="coin" size={16} /> {R.like_received.coins}, 하루 {R.like_received.dailyLimit}번까지
        </li>
        <li>
          동물 농장에서 밥 주기·쓰다듬기: <Icon name="exp" size={16} /> {R.farm_care.exp}, 하루 {R.farm_care.dailyLimit}번까지
        </li>
        <li>
          친구 초대: 초대받아 가입한 친구가 첫 공개 글(본문 {POST_REWARD_MIN_LENGTH}자 이상)을 쓰면 나와 친구 둘 다 <Icon name="coin" size={16} /> {INVITE_REWARD_COINS}{" "}
          (초대 코드는 내 블로그 홈에 있어요)
        </li>
      </ul>
    ),
  },
  {
    id: "level",
    q: "레벨은 어떻게 올라요?",
    a: (
      <p>
        경험치가 쌓이면 레벨이 올라요. Lv.2는 <Icon name="exp" size={16} /> {n(expForLevel(2))}, Lv.5는 <Icon name="exp" size={16} /> {n(expForLevel(5))}, Lv.10은 <Icon name="exp" size={16} /> {n(expForLevel(10))}이
        필요하고, 최고 레벨은 Lv.{MAX_LEVEL}이에요. 헤더의 <b>Lv</b> 배지를 누르면 다음 레벨까지 남은 경험치가 보여요. 하루는 한국 시간 0시에
        바뀌어요.
      </p>
    ),
  },
  {
    id: "house",
    q: (
      <>
        <Icon name="home" size={20} /> 광장의 내 집은 언제 커져요?
      </>
    ),
    a: (
      <p>
        집 주인의 레벨에 따라 3단계로 커져요. Lv.1~{HOUSE_STAGE_LEVELS[2] - 1}은 1단계, Lv.{HOUSE_STAGE_LEVELS[2]}~{HOUSE_STAGE_LEVELS[3] - 1}은
        창문이 생긴 2단계, Lv.{HOUSE_STAGE_LEVELS[3]}부터는 다락방 창이 있는 3단계예요. 레벨은 내려가지 않아서 집도 작아지지 않아요. 지붕 색은
        꾸미기에서 고를 수 있어요.
      </p>
    ),
  },
  {
    id: "pet",
    q: (
      <>
        <Icon name="egg" size={20} /> 펫은 어떻게 키워요?
      </>
    ),
    a: (
      <p>
        광장의 동물 농장에서 알을 받아요. 첫 알은 무료이고, {EGG_LEVEL_EVERY}레벨마다 알을 하나 더 받아요. <Icon name="coin" size={16} /> {EGG_PRICE}로 살 수도 있어요. 한
        번에 {MAX_ACTIVE_ANIMALS}마리까지 키울 수 있어요. 밥 주기·쓰다듬기는 하루 한 번씩, 물약(<Icon name="coin" size={16} /> {POTION_PRICE})은 쓸 때마다 성장 +
        {POTION_GROWTH}, 공개 글로 보상을 받으면 키우는 동물마다 성장 +{POST_GROWTH}이에요. 다 키우면 보상과 카드를 받아요. 한 마리를
        골라 데리고 다니면 광장에서 따라와요.
      </p>
    ),
  },
  {
    id: "character",
    q: "캐릭터를 바꿀 수 있어요?",
    a: <p>캐릭터는 가입할 때 고른 그대로예요. 대신 상점에서 산 옷(상의·하의)·모자·신발로 꾸미고, 가구와 배경으로 미니룸을 꾸밀 수 있어요.</p>,
  },
  {
    id: "blog",
    q: "블로그 이름이나 주소를 바꾸고 싶어요",
    a: <p>오른쪽 위 내 얼굴을 누르고 [환경 설정]에서 블로그 이름과 소개를 바꿀 수 있어요. 블로그 주소(/@주소)는 바꿀 수 없어요.</p>,
  },
  {
    id: "leave",
    q: "회원 탈퇴는 어떻게 해요?",
    a: (
      <p>
        오른쪽 위 내 얼굴 → [환경 설정] 맨 아래 <b>회원 탈퇴</b>에서 할 수 있어요. 아이디로 가입했다면 비밀번호를 한 번 더 적어요. 탈퇴하면
        프로필·블로그·글·코인 기록·로그인 정보가 바로 지워지고 되돌릴 수 없어요. 남의 글에 남긴 댓글에 답글이 달려 있으면
        &apos;삭제된 댓글이에요&apos;로 자리만 남아요.
      </p>
    ),
  },
];

/** 문의하기 (공개 화면): 자주 묻는 질문 + 문의 메일 */
export default async function SupportPage() {
  // 배포 환경마다 다른 주소를 쓸 수 있게 요청 때 환경 변수를 읽는다
  await connection();
  const email = process.env.SUPPORT_EMAIL?.trim();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">
        <Icon name="inquiry" size={34} className="-mt-1" /> 문의하기
      </h1>
      <p className="mt-1 text-ink-soft">궁금한 게 있으면 먼저 아래 질문을 살펴봐 주세요.</p>

      <section className="card mt-6 p-2 sm:p-3" aria-labelledby="faq-title">
        <h2 id="faq-title" className="px-3 pb-1 pt-2 font-display text-xl">
          자주 묻는 질문
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

      <section className="card mt-6 p-5" aria-labelledby="contact-title" data-support-contact>
        <h2 id="contact-title" className="font-display text-xl">
          <Icon name="mail" size={26} className="-mt-1" /> 직접 문의하기
        </h2>
        {email ? (
          <p className="mt-2">
            답을 찾지 못했다면 메일로 알려 주세요:{" "}
            <a href={`mailto:${email}`} className="font-bold text-leaf-dark underline">
              {email}
            </a>
          </p>
        ) : (
          <p className="mt-2 text-ink-soft">문의 메일은 곧 열어요. 조금만 기다려 주세요!</p>
        )}
      </section>
    </div>
  );
}
