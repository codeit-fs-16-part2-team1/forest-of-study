-- 그래핌 기준 20글자를 허용하도록 저장 타입만 변경한다.
-- 기존 값과 NOT NULL·Routine_name_nonempty 제약은 유지한다.
ALTER TABLE "Routine"
ALTER COLUMN "name" TYPE TEXT;
