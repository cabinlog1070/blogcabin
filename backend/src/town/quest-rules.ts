// 오늘의 퀘스트 규칙 숫자. DB를 쓰지 않아서 화면(frontend/src/server/quests.ts)도 같이 읽는다
export type QuestKey = "attend" | "post" | "like" | "comment" | "pet";

/** 퀘스트마다 몇 번 해야 끝나는지 (화면에 보이는 순서) */
export const QUEST_GOALS: Record<QuestKey, number> = { attend: 1, post: 1, like: 5, comment: 3, pet: 1 };

/** 글 쓰기 퀘스트로 치는 본문 길이 (공백을 뺀 글자 수) */
export const QUEST_POST_MIN_CHARS = 30;
