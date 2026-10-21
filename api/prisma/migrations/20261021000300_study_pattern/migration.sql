BEGIN;

ALTER TABLE "Study"
  ADD COLUMN "patternKey" TEXT,
  ADD COLUMN "patternColor" TEXT;

ALTER TABLE "Study"
  ADD CONSTRAINT "Study_pattern_check" CHECK (
    ("patternKey" IS NULL AND "patternColor" IS NULL)
    OR (
      "backgroundKey" = 'custom'
      AND "patternKey" IS NOT NULL
      AND "patternKey" IN ('dots', 'stripes', 'waves')
      AND "patternColor" IS NOT NULL
      AND char_length("patternColor") = 7
      AND "patternColor" ~ '^#[0-9a-f]{6}$'
    )
  );

COMMIT;
