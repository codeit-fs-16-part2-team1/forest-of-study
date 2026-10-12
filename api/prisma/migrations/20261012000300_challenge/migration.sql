-- ISS-005: 3단계. docs/DB.md 7절의 CHECK와 부분 UNIQUE를 적용한다.
BEGIN;

CREATE TYPE "ChallengeStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'RESET');

CREATE TABLE "Challenge" (
    "id" UUID NOT NULL,
    "studyId" UUID NOT NULL,
    "goalMinutes" INTEGER NOT NULL DEFAULT 10,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'RUNNING',
    "elapsedMilliseconds" INTEGER NOT NULL DEFAULT 0,
    "lastStartedAt" TIMESTAMPTZ(3),
    "awardedPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Challenge_studyId_fkey" FOREIGN KEY ("studyId")
        REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Challenge_goal_range" CHECK ("goalMinutes" BETWEEN 10 AND 180),
    CONSTRAINT "Challenge_elapsed_range"
        CHECK ("elapsedMilliseconds" BETWEEN 0 AND "goalMinutes" * 60000),
    CONSTRAINT "Challenge_running_time" CHECK (
        ("status" = 'RUNNING' AND "lastStartedAt" IS NOT NULL)
        OR ("status" <> 'RUNNING' AND "lastStartedAt" IS NULL)
    ),
    CONSTRAINT "Challenge_award_state" CHECK (
        ("status" = 'COMPLETED'
            AND "elapsedMilliseconds" = "goalMinutes" * 60000
            AND "awardedPoints" = ("goalMinutes" / 10) + 3)
        OR ("status" <> 'COMPLETED' AND "awardedPoints" = 0)
    )
);

CREATE INDEX "Challenge_studyId_status_idx" ON "Challenge" ("studyId", "status");
CREATE INDEX "Challenge_studyId_createdAt_id_idx"
    ON "Challenge" ("studyId", "createdAt", "id");
CREATE UNIQUE INDEX "Challenge_one_active_per_study"
    ON "Challenge" ("studyId") WHERE "status" IN ('RUNNING', 'PAUSED');

COMMIT;
