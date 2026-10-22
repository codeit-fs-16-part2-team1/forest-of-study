BEGIN;
ALTER TABLE "Routine" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 1;
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "studyId" ORDER BY "createdAt", "id")::integer AS n
  FROM "Routine" WHERE "endsOn" IS NULL
)
UPDATE "Routine" r SET "position" = ranked.n FROM ranked WHERE r."id" = ranked."id";
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_position_positive" CHECK ("position" >= 1);
COMMIT;
