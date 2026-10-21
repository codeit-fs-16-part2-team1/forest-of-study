BEGIN;

ALTER TABLE "Study" ADD COLUMN "textColor" TEXT;

ALTER TABLE "Study"
  ADD CONSTRAINT "Study_text_color_check" CHECK (
    "textColor" IS NULL
    OR (
      "backgroundKey" = 'custom'
      AND char_length("textColor") = 7
      AND "textColor" ~ '^#[0-9a-f]{6}$'
    )
  );

COMMIT;
