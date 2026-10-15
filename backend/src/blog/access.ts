// 글을 누가 볼 수 있는가 (POST-05 공개·비공개, POST-11 예약 글). 블로그 API와 화면의 글 읽기가 같이 쓴다
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../db";
import { blogs, follows, posts, users } from "../db/schema";

/**
 * 올라간 글: 올라갈 시각(created_at)이 지났다. 예약 글(POST-11)은 그 시각 전까지 주인에게만 보이고,
 * 시각이 되면 따로 바꾸는 일 없이 이 조건으로 목록·광장·검색에 나타난다
 */
export const isPublished = sql<boolean>`${posts.createdAt} <= now()`;

/** 서로 이웃: 두 사람이 서로를 이웃으로 추가했다. 비공개 글은 주인과 서로 이웃만 본다 */
export async function isMutualNeighbor(a: string, b: string) {
  if (a === b) return false;
  const rows = await db
    .select({ x: follows.followerId })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, a), eq(follows.followeeId, b)),
        and(eq(follows.followerId, b), eq(follows.followeeId, a)),
      ),
    );
  return rows.length === 2;
}

/** 이 사람이 이 블로그 주인의 비공개 글을 볼 수 있는가 (주인, 서로 이웃, 관리자) */
export async function canSeePrivatePosts(viewerId: string | null, ownerId: string) {
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;
  const [viewer] = await db.select({ role: users.role }).from(users).where(eq(users.id, viewerId));
  return viewer?.role === "admin" || isMutualNeighbor(viewerId, ownerId);
}

/** 글과 그 글의 블로그 주인 (공개 글이거나, 내 글이거나, 서로 이웃의 비공개 글일 때만. 아직 안 올라간 예약 글은 주인만) */
export async function findVisiblePost(postId: number, viewerId: string) {
  const [row] = await db
    .select({ id: posts.id, visibility: posts.visibility, ownerId: blogs.ownerId, published: isPublished })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(posts.id, postId));
  if (!row) return null;
  if (!row.published && row.ownerId !== viewerId) return null;
  if (row.visibility === "private" && !(await canSeePrivatePosts(viewerId, row.ownerId))) return null;
  return row;
}
