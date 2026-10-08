// 회원 탈퇴 (AUTH-06, spec 001 FR-030·FR-031, spec 004 FR-008)
import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachments, comments, users } from "@/db/schema";
import { lockUser } from "@/server/points";
import { deleteAttachment } from "@/server/storage";
import { anonymizeViewerKey } from "@/server/visits";

/**
 * 회원과 그 회원의 개인정보·블로그·글·코인 기록·로그인 정보를 지운다.
 * 대부분은 users를 지울 때 외래 키 CASCADE로 함께 지워진다 (docs/02-erd.md 3.8).
 * 남의 글에 단 댓글만 댓글 삭제와 같은 규칙으로 따로 처리한다:
 *  - 다른 회원의 답글이 남아 있는 원댓글 → 작성자·내용을 비우고 `삭제된 댓글이에요` 자리로 남긴다 (답글은 그대로)
 *  - 그 밖의 댓글(답글 없는 원댓글, 답글) → 완전히 지운다
 *  - 그 결과 살아 있는 답글이 하나도 없게 된 "삭제된 자리"도 지운다
 * 다른 회원이 이미 받은 보상(경험치·코인)은 원장에 그대로 남는다 (회수하지 않음).
 */
export async function deleteMember(userId: string) {
  const files = await db.select({ key: attachments.key }).from(attachments).where(eq(attachments.userId, userId));

  await db.transaction(async (tx) => {
    await lockUser(tx, userId); // 이 회원의 보상·구매가 동시에 처리되지 않게
    const mine = eq(comments.authorId, userId);
    // 다른 회원의 살아 있는 답글이 있는 댓글
    const hasOthersLiveReply = sql`EXISTS (
      SELECT 1 FROM comments AS reply WHERE reply.parent_id = ${comments.id}
        AND reply.deleted_at IS NULL AND (reply.author_id IS NULL OR reply.author_id <> ${userId})
    )`;
    const touchedPosts = await tx.selectDistinct({ postId: comments.postId }).from(comments).where(mine);

    await tx.delete(comments).where(and(mine, sql`NOT ${hasOthersLiveReply}`));
    await tx
      .update(comments)
      .set({ authorId: null, content: "삭제된 댓글이에요", deletedAt: sql`COALESCE(${comments.deletedAt}, now())` })
      .where(mine);
    // 답글이 모두 사라진 삭제된 자리 정리 (spec 004 FR-008 (3))
    if (touchedPosts.length) {
      await tx.delete(comments).where(
        and(
          inArray(
            comments.postId,
            touchedPosts.map((p) => p.postId),
          ),
          isNull(comments.parentId),
          isNotNull(comments.deletedAt),
          sql`NOT EXISTS (SELECT 1 FROM comments AS reply WHERE reply.parent_id = ${comments.id} AND reply.deleted_at IS NULL)`,
        ),
      );
    }

    // 블로그 방문·글 조회 숫자는 줄지 않게 남기되, 회원과 이어지지 않게 키를 바꾼다 (BLOG-06 FR-041)
    await anonymizeViewerKey(tx, userId);
    // 회원 삭제 → 세션·계정(로그인 정보)·프로필·블로그·글·원장·이웃·공감·알림·첨부 정보·농장이 CASCADE로 함께 지워진다.
    // 나를 초대한 사람으로 적힌 칸(profiles.invited_by)은 비워진다 (SET NULL)
    await tx.delete(users).where(eq(users.id, userId));
  });

  // 저장소의 첨부 파일도 지운다 (DB가 지워진 뒤라 실패해도 다시 열 수 없다)
  await Promise.all(files.map((f) => deleteAttachment(f.key).catch(() => undefined)));
}
