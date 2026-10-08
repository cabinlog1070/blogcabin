// 오늘의 퀘스트: 하루에 해 볼 만한 활동 5가지를 했는지 보여 준다 (보상 없음, 상태만)
// 따로 테이블을 두지 않고 출석·글·공감·댓글·돌보기 기록에서 "오늘(한국 시간) 한 적이 있는지"만 계산한다
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
  hint: string; // 무엇을 하면 되는지 한 줄 안내
  done: boolean;
  href: string; // 퀘스트를 하러 가는 곳
};

const QUESTS: Omit<DailyQuest, "done">[] = [
  { key: "attend", label: "출석 체크하기", emoji: "📮", hint: "출석 체크에서 오늘 출석해요", href: "/attendance" },
  { key: "post", label: "글 쓰기", emoji: "✏️", hint: "내 블로그에 새 글을 하나 써요", href: "/write" },
  { key: "like", label: "이웃 글에 공감하기", emoji: "💛", hint: "다른 사람의 글에 공감을 눌러요", href: "/feed" },
  { key: "comment", label: "댓글 달기", emoji: "💬", hint: "글에 따뜻한 댓글을 남겨요", href: "/feed" },
  { key: "pet", label: "펫 돌보기", emoji: "🐾", hint: "농장에서 밥을 주거나 쓰다듬어요", href: "/farm" },
];

export const DAILY_QUEST_COUNT = QUESTS.length;

/**
 * 오늘의 퀘스트 5개와 완료 여부. today는 한국 시간 날짜(YYYY-MM-DD).
 * 한 요청 안에서 여러 곳(헤더·화면)이 불러도 한 번만 조회한다.
 */
export const getDailyQuests = cache(async (userId: string, today: string = todayKST()): Promise<DailyQuest[]> => {
  // 한국 시간 오늘 0시 (timestamptz). created_at 열과 비교한다
  const since = sql`(${today}::timestamp AT TIME ZONE 'Asia/Seoul')`;
  const { rows } = await db.execute<Record<QuestKey, boolean>>(sql`
    SELECT
      EXISTS (
        SELECT 1 FROM ${attendances}
        WHERE ${attendances.userId} = ${userId} AND ${attendances.date} = ${today}
      ) AS attend,
      EXISTS (
        SELECT 1 FROM ${posts} JOIN ${blogs} ON ${blogs.id} = ${posts.blogId}
        WHERE ${blogs.ownerId} = ${userId} AND ${posts.createdAt} >= ${since}
      ) AS post,
      EXISTS (
        SELECT 1 FROM ${postLikes}
        JOIN ${posts} ON ${posts.id} = ${postLikes.postId}
        JOIN ${blogs} ON ${blogs.id} = ${posts.blogId}
        WHERE ${postLikes.userId} = ${userId} AND ${blogs.ownerId} <> ${userId} AND ${postLikes.createdAt} >= ${since}
      ) AS "like",
      EXISTS (
        SELECT 1 FROM ${comments}
        WHERE ${comments.authorId} = ${userId} AND ${comments.deletedAt} IS NULL AND ${comments.createdAt} >= ${since}
      ) AS comment,
      EXISTS (
        SELECT 1 FROM ${animalCares} JOIN ${userAnimals} ON ${userAnimals.id} = ${animalCares.animalId}
        WHERE ${userAnimals.userId} = ${userId} AND ${animalCares.date} = ${today} AND ${animalCares.action} IN ('feed', 'pet')
      ) AS pet
  `);
  const row = rows[0];
  return QUESTS.map((q) => ({ ...q, done: Boolean(row?.[q.key]) }));
});

/** 완료한 퀘스트 수 (광장의 "퀘스트 n/5" 같은 요약용) */
export function questProgress(quests: DailyQuest[]) {
  return { done: quests.filter((q) => q.done).length, total: quests.length };
}
