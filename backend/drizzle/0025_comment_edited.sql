-- 댓글 수정 (2026-10-13): 고친 적 있으면 마지막으로 고친 시각
ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp with time zone;