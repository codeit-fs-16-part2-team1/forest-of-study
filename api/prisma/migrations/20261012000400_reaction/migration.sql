-- ISS-005: 4단계. 응원 browserId는 인증·타이머 조작권으로 사용하지 않는다.
BEGIN;

CREATE TABLE "Reaction" (
    "studyId" UUID NOT NULL,
    "browserId" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("studyId", "browserId", "emoji"),
    CONSTRAINT "Reaction_studyId_fkey" FOREIGN KEY ("studyId")
        REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Reaction_studyId_emoji_idx" ON "Reaction" ("studyId", "emoji");

COMMIT;
