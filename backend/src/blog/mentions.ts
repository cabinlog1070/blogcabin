// @블로그주소로 다른 회원 언급하기 (글·댓글, 2026-10-15)
// 블로그 주소(/@주소, 영문 소문자·숫자·_ 3~20자)로 부른다. 로그인 아이디는 남에게 보이면 안 되는 값이라 쓰지 않는다.
// 글은 저장할 때 HTML 안의 @주소를 블로그 링크로 바꿔 두고, 댓글은 글자 그대로 두고 읽을 때 있는 주소만 알려 준다.
import { inArray } from "drizzle-orm";
import { db } from "../db";
import { blogs } from "../db/schema";
import { canSeePrivatePosts } from "./access";
import { MAX_MENTIONS } from "./mention-text";

export { linkMentions, mentionsIn, mentionsInHtml } from "./mention-text";

/** 주소들 가운데 실제로 있는 블로그 (주소 → 주인 회원 ID) */
export async function findMentionedBlogs(slugs: string[]): Promise<Map<string, string>> {
  if (!slugs.length) return new Map();
  const rows = await db.select({ slug: blogs.slug, ownerId: blogs.ownerId }).from(blogs).where(inArray(blogs.slug, slugs));
  return new Map(rows.map((r) => [r.slug, r.ownerId]));
}

/**
 * 언급 알림을 받을 회원: 있는 블로그 주인 가운데 그 글을 볼 수 있는 사람만 (최대 MAX_MENTIONS명).
 * 아직 안 올라간 예약 글은 아무에게도 보내지 않는다. 비공개 글은 서로 이웃·관리자만 (canSeePrivatePosts)
 */
export async function mentionTargets(
  post: { visibility: "public" | "private"; ownerId: string; published: boolean },
  owners: string[],
): Promise<string[]> {
  if (!post.published) return [];
  const limited = owners.slice(0, MAX_MENTIONS);
  if (post.visibility === "public") return limited;
  const seen = await Promise.all(limited.map((id) => canSeePrivatePosts(id, post.ownerId)));
  return limited.filter((_, i) => seen[i]);
}
