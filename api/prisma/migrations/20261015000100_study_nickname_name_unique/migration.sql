-- ADR-064: 스터디의 저장된 nickname/name 조합만 중복을 금지한다.
-- 기존 데이터를 변경하지 않는다. 중복이 있으면 전체 migration을 중단한다.
BEGIN;

LOCK TABLE "Study" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Study"
        GROUP BY "nickname", "name"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Study nickname/name duplicates exist. Review data before applying this migration.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX "Study_nickname_name_key" ON "Study" ("nickname", "name");

COMMIT;
