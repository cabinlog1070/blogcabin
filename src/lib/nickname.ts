import { z } from "zod";
import { msg } from "@/lib/i18n";

/** 닉네임 규칙: 온보딩(AUTH-02)과 블로그 관리 기본 정보(BLOG-03)가 함께 쓴다. 중복은 DB UNIQUE가 막는다 (AUTH-03) */
export const nicknameSchema = z
  .string()
  .trim()
  .min(2, msg("닉네임은 2자 이상이에요"))
  .max(12, msg("닉네임은 12자까지예요"));

/** 관리자 계정의 닉네임 (AUTH-08). 회원은 쓸 수 없다 */
export const ADMIN_NICKNAME = "관리자";
