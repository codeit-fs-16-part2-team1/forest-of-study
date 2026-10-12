-- ISS-005: 2단계. 한국 날짜는 서버가 지정하며 날짜 기본값을 만들지 않는다.
BEGIN;

CREATE TABLE "Routine" (
    "id" UUID NOT NULL,
    "studyId" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Routine_period" CHECK ("endsOn" IS NULL OR "startsOn" <= "endsOn"),
    CONSTRAINT "Routine_name_nonempty" CHECK (char_length("name") >= 1),
    CONSTRAINT "Routine_studyId_fkey" FOREIGN KEY ("studyId")
        REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RoutineHistory" (
    "routineId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RoutineHistory_pkey" PRIMARY KEY ("routineId", "recordDate"),
    CONSTRAINT "RoutineHistory_routineId_fkey" FOREIGN KEY ("routineId")
        REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Routine_studyId_startsOn_endsOn_idx"
    ON "Routine" ("studyId", "startsOn", "endsOn");

COMMIT;
