// 오늘의 퀘스트 횟수 세기: 따로 테이블을 두지 않고 출석·글·공감·댓글·돌보기 기록에서 "오늘(한국 시간) 몇 번 했는지"를 센다.
// 광장 API(진행 n/5)와 화면의 퀘스트 목록(frontend/src/server/quests.ts, 문장은 화면 언어로)이 같이 쓴다
import { sql } from "drizzle-orm";
import { db } from "../db";
import { animalCares, attendances, blogs, comments, postLikes, posts, userAnimals } from "../db/schema";
import { todayKST } from "../game/rules";

import { QUEST_GOALS, QUEST_POST_MIN_CHARS, type QuestKey } from "./quest-rules";

export { QUEST_GOALS, QUEST_POST_MIN_CHARS, type QuestKey };

/** 오늘 한 횟수 (goal을 넘지 않게 자른다). today는 한국 시간 날짜(YYYY-MM-DD) */
export async function countDailyQuests(userId: string, today: string = todayKST()): Promise<Record<QuestKey, number>> {
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
        WHERE ${blogs.ownerId} = ${userId} AND ${posts.createdAt} >= ${since} AND ${posts.createdAt} <= now()
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
  const keys = Object.keys(QUEST_GOALS) as QuestKey[];
  return Object.fromEntries(keys.map((k) => [k, Math.min(Number(row?.[k] ?? 0), QUEST_GOALS[k])])) as Record<QuestKey, number>;
}

/** 완료한 퀘스트 수 (광장의 "퀘스트 n/5" 같은 요약용) */
export function questProgressOf(counts: Record<QuestKey, number>) {
  const keys = Object.keys(QUEST_GOALS) as QuestKey[];
  return { done: keys.filter((k) => counts[k] >= QUEST_GOALS[k]).length, total: keys.length };
}
