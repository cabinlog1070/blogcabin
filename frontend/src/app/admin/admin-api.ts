// 관리자 화면이 부르는 서버 API (/api/v1/admin/…, backend/src/routes/admin.ts)
import { api } from "@/lib/api";

export type GrantResult = { ok: true; nickname: string; coins: number; exp: number; level: number; balance: number };
export type GiftResult = { ok: true; sent: string[]; skipped: string[] };

export const adminApi = {
  deletePost: (postId: number) => api(`/admin/posts/${postId}`, { method: "DELETE" }),
  deleteComment: (commentId: number) => api(`/admin/comments/${commentId}`, { method: "DELETE" }),
  withdrawMember: (userId: string) => api<{ ok: true; name: string | null }>(`/admin/members/${encodeURIComponent(userId)}/withdraw`, { method: "POST" }),
  resetPassword: (userId: string) =>
    api<{ ok: true; username: string | null; tempPassword: string }>(`/admin/members/${encodeURIComponent(userId)}/password-reset`, { method: "POST" }),
  grant: (body: { userId: string; coins: string; exp: string; maxCoins: boolean; maxExp: boolean }) =>
    api<GrantResult>("/admin/grant", { method: "POST", body }),
  sendGift: (body: { message: string; coins: string; itemIds: number[]; speciesIds: number[]; userIds: string[]; everyone: boolean }) =>
    api<GiftResult>("/admin/gifts", { method: "POST", body }),
};
