// 서버 읽기 API의 답 모양 (backend/src/routes/…). 페이지는 serverApi로 부르고 이 모양으로 받는다
import "server-only";
import type { getAllTags, listFeed, searchBlogs, searchPosts } from "@backend/blog/lists";
import type { listLedger } from "@backend/game/ledger";
import type { listNotificationRows } from "@backend/notifications";
import type { GiftView } from "@backend/gifts/views";
import type { attendancePage } from "@backend/routes/attendance";
import type { closetPage } from "@backend/routes/closet";
import type { farmPage } from "@backend/routes/farm";
import type { shopPage } from "@backend/routes/shop";
import type { getWallet } from "@backend/game/points";
import type { getCarriedPet } from "@backend/town/houses";
import type { TownHouse, TownResident } from "@backend/town/types";
import { serverApi } from "./api";

type FeedList = Awaited<ReturnType<typeof listFeed>>;
type Tags = Awaited<ReturnType<typeof getAllTags>>;
/** 서버 함수가 돌려주는 값 (JSON을 거쳐도 …At 날짜는 serverApi가 Date로 되돌린다) */
type Out<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;

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
  shop: () => serverApi<Out<typeof shopPage>>("/shop"),
  closet: () => serverApi<Out<typeof closetPage>>("/closet"),
  farm: () => serverApi<Out<typeof farmPage>>("/farm"),
  attendance: () => serverApi<Out<typeof attendancePage>>("/attendance"),
  notifications: (page: number) =>
    serverApi<Out<typeof listNotificationRows> & { unread: number }>(`/notifications?page=${page}`),
  gifts: () => serverApi<{ gifts: GiftView[] }>("/notifications/gifts"),
  onboarding: () => serverApi<{ starters: { id: number; name: string; description: string | null; assetKey: string }[] }>("/onboarding"),
};
