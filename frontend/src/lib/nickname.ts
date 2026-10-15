import { z } from "zod";
import { NICKNAME_MAX, NICKNAME_MIN, NICKNAME_TOO_LONG, NICKNAME_TOO_SHORT } from "@backend/blog/profile-rules";

// 관리자 닉네임·공지 블로그 이름은 서버(블로그 관리 API)와 같은 것을 쓴다
export { ADMIN_BLOG_TITLE, ADMIN_NICKNAME } from "@backend/blog/profile-rules";

/** 닉네임 규칙: 온보딩(AUTH-02)과 블로그 관리 기본 정보(BLOG-03)가 함께 쓴다. 중복은 DB UNIQUE가 막는다 (AUTH-03) */
export const nicknameSchema = z.string().trim().min(NICKNAME_MIN, NICKNAME_TOO_SHORT).max(NICKNAME_MAX, NICKNAME_TOO_LONG);
