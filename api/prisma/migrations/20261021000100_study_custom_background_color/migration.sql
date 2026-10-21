-- 기존 스터디는 backgroundKey를 유지하고 backgroundColor는 NULL로 시작한다.
BEGIN;

ALTER TABLE "Study" ADD COLUMN "backgroundColor" TEXT;

ALTER TABLE "Study"
ADD CONSTRAINT "Study_background_color_check" CHECK (
  (
    "backgroundKey" = 'custom'
    AND "backgroundColor" IS NOT NULL
    AND char_length("backgroundColor") = 7
    AND "backgroundColor" ~ '^#[0-9a-f]{6}$'
  )
  OR (
    "backgroundKey" <> 'custom'
    AND "backgroundColor" IS NULL
  )
);

COMMIT;
