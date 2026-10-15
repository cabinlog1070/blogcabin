// API를 부른 회원의 역할과 블로그 (글·카테고리는 "내 블로그"에만 쓴다)
import { eq } from "drizzle-orm";
import { db } from "../db";
import { blogs, users } from "../db/schema";

export async function getMemberBlog(userId: string) {
  const [row] = await db
    .select({ role: users.role, blogId: blogs.id, blogSlug: blogs.slug })
    .from(users)
    .innerJoin(blogs, eq(blogs.ownerId, users.id))
    .where(eq(users.id, userId));
  return row ?? null;
}
