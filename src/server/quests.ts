// 오늘의 퀘스트: 하루에 해 볼 만한 활동 5가지를 얼마나 했는지 보여 준다 (보상 없음, 상태만)
// 따로 테이블을 두지 않고 출석·글·공감·댓글·돌보기 기록에서 "오늘(한국 시간) 몇 번 했는지"를 센다
import "server-only";
import { sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { animalCares, attendances, blogs, comments, postLikes, posts, userAnimals } from "@/db/schema";
import { todayKST } from "@/lib/game";

export type QuestKey = "attend" | "post" | "like" | "comment" | "pet";

export type DailyQuest = {
  key: QuestKey;
  label: string;
  emoji: string;
  hint: string; // 어디서 무엇을 누르면 되는지 자세한 안내
  goal: number; // 몇 번 해야 끝나는지
  count: number; // 오늘 한 횟수 (goal을 넘지 않게 자른다)
  done: boolean;
  href: string; // 퀘스트를 하러 가는 곳
};

/** 글 쓰기 퀘스트로 치는 본문 길이 (공백을 뺀 글자 수) */
export const QUEST_POST_MIN_CHARS = 30;

const QUESTS: Omit<DailyQuest, "count" | "done">[] = [
  {
    key: "attend",
    label: "출석 체크하기",
    emoji: "📮",
    hint: "이 화면 위쪽의 「📮 출석하고 보상 받기」 버튼을 눌러요. 하루에 한 번 할 수 있어요.",
    goal: 1,
    href: "/attendance",
  },
  {
    key: "post",
    label: `${QUEST_POST_MIN_CHARS}자 이상 글 쓰기`,
    emoji: "✏️",
    hint: `글쓰기 화면에서 제목과 본문을 쓰고 「발행하기」를 눌러요. 본문이 띄어쓰기를 빼고 ${QUEST_POST_MIN_CHARS}자 이상이어야 해요.`,
    goal: 1,
    href: "/write",
  },
  {
    key: "like",
    label: "이웃 글에 공감 5개",
    emoji: "💛",
    hint: "📋 마을 소식에서 다른 이웃의 글을 열고, 글 아래 「♡ 공감」을 눌러요. 서로 다른 글 5개에 눌러야 하고, 내 글은 세지 않아요.",
    goal: 5,
    href: "/feed",
  },
  {
    key: "comment",
    label: "이웃에게 댓글 3개",
    emoji: "💬",
    hint: "📋 마을 소식에서 다른 이웃의 글을 열고, 글 아래 댓글 칸에 쓴 뒤 「댓글 등록」을 눌러요. 3개를 남겨야 하고, 내 글에 단 댓글은 세지 않아요.",
    goal: 3,
    href: "/feed",
  },
  {
    key: "pet",
    label: "펫 돌보기",
    emoji: "🐾",
    hint: "🐮 동물 농장에서 펫을 누르고, 열린 상태창에서 「밥 주기」나 「쓰다듬기」를 눌러요.",
    goal: 1,
    href: "/farm",
  },
];

export const DAILY_QUEST_COUNT = QUESTS.length;

/**
 * 오늘의 퀘스트 5개와 진행 횟수. today는 한국 시간 날짜(YYYY-MM-DD).
 * 한 요청 안에서 여러 곳(헤더·화면)이 불러도 한 번만 조회한다.
 */
export const getDailyQuests = cache(async (userId: string, today: string = todayKST()): Promise<DailyQuest[]> => {
  // 한국 시간 오늘 0시 (timestamptz). created_at 열과 비교한다
  const since = sql`(${today}::timestamp AT TIME ZONE 'Asia/Seoul')`;
  const { rows } = await db.execute<Record<QuestKey, number | string>>(sql`
    SELECT
      (
        SELECT count(*) FROM ${attendances}
        WHERE ${attendances.userId} = ${userId} AND ${attendances.date} = ${today}
      ) AS attend,
      (
        SELECT count(*) FROM ${posts} JOIN ${blogs} ON ${blogs.id} = ${posts.blogId}
        WHERE ${blogs.ownerId} = ${userId} AND ${posts.createdAt} >= ${since}
          AND char_length(regexp_replace(${posts.contentText}, '[[:space:]]', '', 'g')) >= ${QUEST_POST_MIN_CHARS}
      ) AS post,
      (
        SELECT count(*) FROM ${postLikes}
        JOIN ${posts} ON ${posts.id} = ${postLikes.postId}
        JOIN ${blogs} ON ${blogs.id} = ${posts.blogId}
        WHERE ${postLikes.userId} = ${userId} AND ${blogs.ownerId} <> ${userId} AND ${postLikes.createdAt} >= ${since}
      ) AS "like",
      (
        SELECT count(*) FROM ${comments}
        JOIN ${posts} ON ${posts.id} = ${comments.postId}
        JOIN ${blogs} ON ${blogs.id} = ${posts.blogId}
        WHERE ${comments.authorId} = ${userId} AND ${blogs.ownerId} <> ${userId}
          AND ${comments.deletedAt} IS NULL AND ${comments.createdAt} >= ${since}
      ) AS comment,
      (
        SELECT count(*) FROM ${animalCares} JOIN ${userAnimals} ON ${userAnimals.id} = ${animalCares.animalId}
        WHERE ${userAnimals.userId} = ${userId} AND ${animalCares.date} = ${today} AND ${animalCares.action} IN ('feed', 'pet')
      ) AS pet
  `);
  const row = rows[0];
  return QUESTS.map((q) => {
    const count = Math.min(Number(row?.[q.key] ?? 0), q.goal);
    return { ...q, count, done: count >= q.goal };
  });
});

/** 완료한 퀘스트 수 (광장의 "퀘스트 n/5" 같은 요약용) */
export function questProgress(quests: DailyQuest[]) {
  return { done: quests.filter((q) => q.done).length, total: quests.length };
}
