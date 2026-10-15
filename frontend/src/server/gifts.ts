import "server-only";

// 관리자 선물 (2026-10-13). 보내기는 서버의 관리자 API(backend/src/gifts/send.ts),
// 받은 선물 보기는 서버 코드(알림 API)와 같은 것을 쓴다
export { getUnseenGifts, listReceivedGifts, type GiftView } from "@backend/gifts/views";
