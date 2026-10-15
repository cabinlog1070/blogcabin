// 중앙 광장 (TOWN-04·08·09·11·12): GET /api/v1/town
// 회원: 내 집, 즐겨찾기한 이웃의 집(최대 10), 🏘 이웃집 패널(내 이웃 전부), 돌아다니는 이웃 주민, 데리고 다니는 펫, 출석·퀘스트 진행.
// 로그인하지 않은 방문자: 인기 블로그 100곳 중 무작위 10곳의 집만
import { Hono } from "hono";
import { memberOrNull, type GuardEnv } from "../http/guard";
import { favoriteHouses, getCarriedPet, getMyHouse, getNeighbors, getPopularHouses, getResidents, hasAttendedToday } from "../town/houses";
import { countDailyQuests, questProgressOf } from "../town/quests";

export const townRoutes = new Hono<GuardEnv>().get("/", async (c) => {
  const viewer = await memberOrNull(c);
  if (!viewer) {
    const houses = await getPopularHouses();
    return c.json({ member: false, myHouse: null, neighbors: houses, panel: houses, residents: [], attendedToday: false, quests: null, pet: null });
  }
  const { userId } = viewer;
  const [panel, myHouse, attendedToday, pet, quests, residents] = await Promise.all([
    getNeighbors(userId),
    getMyHouse(userId),
    hasAttendedToday(userId),
    getCarriedPet(userId),
    countDailyQuests(userId),
    getResidents(userId),
  ]);
  return c.json({ member: true, myHouse, neighbors: favoriteHouses(panel), panel, residents, attendedToday, quests: questProgressOf(quests), pet });
});
