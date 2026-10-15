// 블로그 방문자 수(BLOG-06)·글 조회수(POST-06)는 서버(방문 기록 API)와 같은 코드를 쓴다
import "server-only";

export { getBlogVisitStats } from "@backend/blog/visits";
