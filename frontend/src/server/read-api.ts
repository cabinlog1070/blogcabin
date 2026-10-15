// 서버 읽기 API의 답 모양 (backend/src/routes/feed.ts·town.ts·wallet.ts). 페이지는 serverApi로 부르고 이 모양으로 받는다
import "server-only";
import type { getAllTags, listFeed, searchBlogs, searchPosts } from "@backend/blog/lists";
import type { listLedger } from "@backend/game/ledger";
import type { getWallet } from "@backend/game/points";
import type { getCarriedPet } from "@backend/town/houses";
import type { TownHouse, TownResident } from "@backend/town/types";
import { serverApi } from "./api";

type FeedList = Awaited<ReturnType<typeof listFeed>>;
type Tags = Awaited<ReturnType<typeof getAllTags>>;

export const readApi = {
  feed: (page: number, tag?: string) =>
    serverApi<{ list: FeedList; tags: Tags; member: boolean }>(`/feed?${new URLSearchParams({ page: String(page), ...(tag ? { tag } : {}) })}`),
  following: (page: number) => serverApi<{ list: FeedList; tags: Tags }>(`/feed/following?page=${page}`),
  search: (q: string, page: number) =>
    serverApi<{ blogs: Awaited<ReturnType<typeof searchBlogs>>; posts: Awaited<ReturnType<typeof searchPosts>> }>(
      `/search?${new URLSearchParams({ q, page: String(page) })}`,
    ),
  town: () =>
    serverApi<{
      member: boolean;
      myHouse: TownHouse | null;
      neighbors: TownHouse[];
      panel: TownHouse[];
      residents: TownResident[];
      attendedToday: boolean;
      quests: { done: number; total: number } | null;
      pet: Awaited<ReturnType<typeof getCarriedPet>>;
    }>("/town"),
  wallet: (page: number) =>
    serverApi<{ wallet: Awaited<ReturnType<typeof getWallet>>; ledger: Awaited<ReturnType<typeof listLedger>> }>(`/wallet?page=${page}`),
};
