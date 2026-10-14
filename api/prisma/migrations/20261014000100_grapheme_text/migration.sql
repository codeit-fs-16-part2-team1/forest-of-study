-- ADR-056~057 / ISS-005: 그래핌 길이는 서버에서 검사하고 문자열은 TEXT로 저장한다.
-- 기존 값·NOT NULL·Routine_name_nonempty는 유지한다. 시드 초기화는 별도로 실행한다.
BEGIN;

ALTER TABLE "Study"
    ALTER COLUMN "nickname" TYPE TEXT,
    ALTER COLUMN "name" TYPE TEXT,
    ALTER COLUMN "introduction" TYPE TEXT;

ALTER TABLE "Routine"
    ALTER COLUMN "name" TYPE TEXT;

COMMIT;
