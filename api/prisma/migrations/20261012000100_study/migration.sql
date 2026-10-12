-- ISS-005: 빈 DB용 1단계. schema.prisma의 UUID는 Prisma Client가 생성한다.
BEGIN;

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "Study" (
    "id" UUID NOT NULL,
    "nickname" VARCHAR(10) NOT NULL,
    "name" VARCHAR(15) NOT NULL,
    "introduction" VARCHAR(100) NOT NULL,
    "backgroundKey" TEXT NOT NULL DEFAULT 'green',
    "passwordHash" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Study_points_nonnegative" CHECK ("points" >= 0)
);

CREATE INDEX "Study_createdAt_id_idx" ON "Study" ("createdAt", "id");
CREATE INDEX "Study_points_id_idx" ON "Study" ("points", "id");

COMMIT;
