// 오늘의 퀘스트: 하루에 해 볼 만한 활동 5가지를 얼마나 했는지 보여 준다 (보상 없음, 상태만)
// 횟수는 서버 코드(backend/src/town/quests.ts, 광장 API도 쓴다)가 세고, 여기엔 화면에 보이는 문장을 둔다
import "server-only";
import type { T } from "@/lib/i18n";
import { msg } from "@/lib/i18n";
import { QUEST_GOALS, QUEST_POST_MIN_CHARS, type QuestKey } from "@backend/town/quest-rules";

export { QUEST_POST_MIN_CHARS, type QuestKey } from "@backend/town/quest-rules";

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

const QUESTS: Omit<DailyQuest, "count" | "done" | "goal">[] = [
  {
    key: "attend",
    label: msg("출석 체크하기"),
    emoji: "📮",
    hint: msg("이 화면 위쪽의 「📮 출석하고 보상 받기」 버튼을 눌러요. 하루에 한 번 할 수 있어요."),
    href: "/attendance",
  },
  {
    key: "post",
    label: msg("{n}자 이상 글 쓰기"),
    emoji: "✏️",
    hint: msg("글쓰기 화면에서 제목과 본문을 쓰고 「발행하기」를 눌러요. 본문이 띄어쓰기를 빼고 {n}자 이상이어야 해요."),
    href: "/write",
  },
  {
    key: "like",
    label: msg("이웃 글에 공감 5개"),
    emoji: "💛",
    hint: msg("📋 마을 소식에서 다른 이웃의 글을 열고, 글 아래 「♡ 공감」을 눌러요. 서로 다른 글 5개에 눌러야 하고, 내 글은 세지 않아요."),
    href: "/feed",
  },
  {
    key: "comment",
    label: msg("이웃에게 댓글 3개"),
    emoji: "💬",
    hint: msg("📋 마을 소식에서 다른 이웃의 글을 열고, 글 아래 댓글 칸에 쓴 뒤 「댓글 등록」을 눌러요. 3개를 남겨야 하고, 내 글에 단 댓글은 세지 않아요."),
    href: "/feed",
  },
  {
    key: "pet",
    label: msg("펫 돌보기"),
    emoji: "🐾",
    hint: msg("🐮 동물 농장에서 펫을 누르고, 열린 상태창에서 「밥 주기」나 「쓰다듬기」를 눌러요."),
    href: "/farm",
  },
];

/** 오늘의 퀘스트 5개: 서버(출석 읽기 API)가 센 횟수에 화면 언어의 이름·안내를 붙인다 */
export function presentQuests(t: T, counts: Record<QuestKey, number>): DailyQuest[] {
  const vars = { n: QUEST_POST_MIN_CHARS };
  return QUESTS.map((q) => {
    const count = counts[q.key];
    const goal = QUEST_GOALS[q.key];
    return { ...q, label: t(q.label, vars), hint: t(q.hint, vars), goal, count, done: count >= goal };
  });
}

/** 완료한 퀘스트 수 (광장의 "퀘스트 n/5" 같은 요약용) */
export function questProgress(quests: DailyQuest[]) {
  return { done: quests.filter((q) => q.done).length, total: quests.length };
}
