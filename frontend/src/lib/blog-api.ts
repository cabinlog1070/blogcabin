// 블로그 버튼들이 부르는 서버 API (/api/v1/blog/…, /api/v1/my-blog/…).
// 실패하면 ApiError를 던진다: 화면은 errorText(t, err)로 보여 주고, 글·댓글이 바뀌었으면 router.refresh()
import { api } from "@/lib/api";

export type MentionCandidate = { slug: string; nickname: string; characterAsset: string };

const post = <R = unknown>(path: string, body: unknown = {}) => api<R>(path, { method: "POST", body });
const put = <R = unknown>(path: string, body: unknown = {}) => api<R>(path, { method: "PUT", body });
const del = (path: string) => api(path, { method: "DELETE" });

/**
 * 같은 기록 요청이 동시에 두 번 가지 않게 한 번으로 합친다. 처음 오는 방문자는 아직 식별 쿠키가 없어서,
 * 두 요청이 동시에 가면 서버가 쿠키를 둘 만들어 두 사람으로 센다 (개발 모드는 화면이 효과를 두 번 실행한다)
 */
const inFlight = new Map<string, Promise<unknown>>();
function once<R>(key: string, run: () => Promise<R>): Promise<R> {
  const running = inFlight.get(key);
  if (running) return running as Promise<R>;
  const p = run().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

export const blogApi = {
  /** 공감 / 공감 취소 */
  toggleLike: (postId: number) => post<{ liked: boolean }>(`/blog/posts/${postId}/like`),
  /** 댓글·답글 달기 */
  addComment: (postId: number, content: string, parentId?: number) => post(`/blog/posts/${postId}/comments`, { content, parentId }),
  editComment: (commentId: number, content: string) => put(`/blog/comments/${commentId}`, { content }),
  toggleCommentLike: (commentId: number) => post<{ liked: boolean }>(`/blog/comments/${commentId}/like`),
  deleteComment: (commentId: number) => del(`/blog/comments/${commentId}`),
  /** 내가 이웃한 사람 (@ 언급 목록) */
  myNeighbors: () => api<{ neighbors: MentionCandidate[] }>("/blog/neighbors"),
  /** 이웃 추가 / 끊기 */
  toggleFollow: (userId: string) => post<{ following: boolean }>(`/blog/neighbors/${encodeURIComponent(userId)}/toggle`),
  /** 이웃 추가만 (이미 이웃이면 그대로) */
  addNeighbor: (userId: string) => put(`/blog/neighbors/${encodeURIComponent(userId)}`),
  setFavorite: (userId: string, favorite: boolean) => put(`/blog/neighbors/${encodeURIComponent(userId)}/favorite`, { favorite }),
  /** 방문자 수·조회수: 오늘 처음 온 사람이면 센다 (로그인하지 않아도 부른다) */
  recordBlogVisit: (blogId: number) => once(`visit:${blogId}`, () => post<{ today: number; total: number }>(`/blog/blogs/${blogId}/visit`)),
  recordPostView: (postId: number) => once(`view:${postId}`, () => post<{ viewCount: number }>(`/blog/posts/${postId}/view`)),
};

export const myBlogApi = {
  updateInfo: (info: { nickname: string; title: string; description: string; statusMessage: string }) => put("/my-blog/info", info),
  addCategory: (name: string) => post("/my-blog/categories", { name }),
  renameCategory: (categoryId: number, name: string) => put(`/my-blog/categories/${categoryId}`, { name }),
  deleteCategory: (categoryId: number) => del(`/my-blog/categories/${categoryId}`),
  moveCategory: (categoryId: number, direction: -1 | 1) => post(`/my-blog/categories/${categoryId}/move`, { direction }),
};
