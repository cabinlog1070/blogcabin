// 블로그 방문자 수(BLOG-06)와 글 조회수(POST-06)의 "같은 사람" 구별 (spec 002 FR-039·FR-040, spec 003 FR-048)
// - 온보딩을 마친 로그인 회원: 회원 기준 `u:회원ID` (기기·브라우저가 달라도 한 사람)
// - 방문자(로그인 안 함, 온보딩 전): 브라우저 식별 쿠키 `bv_visitor`(무작위 UUID) 기준 `b:UUID`
// 하루 = 한국 시간 날짜(todayKST). 기록은 (대상, 날짜, 사람) 기본 키로 하루 한 번만 남는다. IP는 저장하지 않는다.
import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { blogVisits, postViews, posts } from "@/db/schema";
import { todayKST } from "@/lib/game";
import { getViewer } from "@/server/dal";

export const VISITOR_COOKIE = "bv_visitor";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * 지금 보는 사람의 키와 회원 ID. Server Action에서만 부른다 (쿠키를 새로 남길 수 있는 곳).
 * 방문자인데 쿠키가 없거나 형식이 틀리면(조작) 새 UUID를 만들어 1년 동안 남긴다.
 */
export async function currentViewerKey(): Promise<{ key: string; memberId: string | null }> {
  const viewer = await getViewer();
  if (viewer?.profile) return { key: `u:${viewer.userId}`, memberId: viewer.userId };

  const jar = await cookies();
  let id = jar.get(VISITOR_COOKIE)?.value ?? "";
  if (!UUID_RE.test(id)) {
    id = crypto.randomUUID();
    jar.set(VISITOR_COOKIE, id, {
      httpOnly: true, // 스크립트로 읽을 수 없다
      sameSite: "lax", // 다른 사이트 요청에는 실리지 않는다
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1년
    });
  }
  return { key: `b:${id}`, memberId: null };
}

/** 블로그 방문 수: 오늘(한국 시간)·전체 */
export async function getBlogVisitStats(blogId: number) {
  const [row] = await db
    .select({
      total: count(),
      today: sql<number>`COUNT(*) FILTER (WHERE ${blogVisits.date} = ${todayKST()})::int`,
    })
    .from(blogVisits)
    .where(eq(blogVisits.blogId, blogId));
  return { today: row?.today ?? 0, total: row?.total ?? 0 };
}

/** 오늘 처음 온 사람이면 1줄 남긴다. 같은 사람이 같은 날 다시 오거나 동시에 불러도 기본 키가 1줄만 남긴다 */
export async function addBlogVisit(blogId: number, visitorKey: string) {
  await db.insert(blogVisits).values({ blogId, date: todayKST(), visitorKey }).onConflictDoNothing();
}

/** 글 조회: 오늘 처음 연 사람이면 기록하고 조회수를 1 올린다. 지금 조회수를 돌려준다 */
export async function addPostView(postId: number, viewerKey: string) {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(postViews)
      .values({ postId, date: todayKST(), viewerKey })
      .onConflictDoNothing()
      .returning({ postId: postViews.postId });
    if (inserted.length) {
      // updated_at은 글 내용이 바뀔 때만 갱신되어야 하므로 그대로 둔다 ($onUpdate 덮어쓰기)
      await tx
        .update(posts)
        .set({ viewCount: sql`${posts.viewCount} + 1`, updatedAt: sql`${posts.updatedAt}` })
        .where(eq(posts.id, postId));
    }
    const [row] = await tx.select({ viewCount: posts.viewCount }).from(posts).where(eq(posts.id, postId));
    return row?.viewCount ?? 0;
  });
}

/** 탈퇴한 회원의 방문·조회 기록은 숫자만 남기고 회원과 이어지지 않게 무작위 키로 바꾼다 (AUTH-06, BLOG-06 FR-041) */
export async function anonymizeViewerKey(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string) {
  const anon = sql`'w:' || md5(random()::text || clock_timestamp()::text)`;
  await tx.update(blogVisits).set({ visitorKey: anon }).where(eq(blogVisits.visitorKey, `u:${userId}`));
  await tx.update(postViews).set({ viewerKey: anon }).where(eq(postViews.viewerKey, `u:${userId}`));
}

