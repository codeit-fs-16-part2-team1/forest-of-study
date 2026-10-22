BEGIN;

-- 기존 키·색상·행은 보존하고 새 패턴 2종을 허용한다.
-- 새 키가 저장된 후 앱을 되돌려도 이 확장된 제약은 유지해야 한다.
ALTER TABLE "Study" DROP CONSTRAINT "Study_pattern_check";

ALTER TABLE "Study"
  ADD CONSTRAINT "Study_pattern_check" CHECK (
    ("patternKey" IS NULL AND "patternColor" IS NULL)
    OR (
      "backgroundKey" = 'custom'
      AND "patternKey" IS NOT NULL
      AND "patternKey" IN ('dots', 'waves', 'stripes', 'leaves', 'paper')
      AND "patternColor" IS NOT NULL
      AND char_length("patternColor") = 7
      AND "patternColor" ~ '^#[0-9a-f]{6}$'
    )
  );

COMMIT;
