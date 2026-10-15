import { prisma } from "../lib/prisma.js";
import { createApiError } from "../utils/apiError.js";
import { buildChallengeResponse } from "../utils/challenge-response.js";

const buildResetResponse = (challenge, points, serverTime) => ({
  challenge: buildChallengeResponse(challenge, serverTime),
  points,
  settlement: null,
});

// 라우트에서 UUID·비밀번호를 검증한 뒤 호출한다.
export const resetChallenge = (studyId, challengeId) =>
  prisma.$transaction(
    async (tx) => {
      // 시작·정지·재개·완료와 같은 잠금 순서를 사용한다.
      const studies = await tx.$queryRaw`
        SELECT "id", "points"
        FROM "Study"
        WHERE "id" = ${studyId}::uuid
        FOR UPDATE
      `;
      const study = studies[0];
      if (study === undefined) {
        throw createApiError("STUDY_NOT_FOUND");
      }

      const challenges = await tx.$queryRaw`
        SELECT "id", "studyId", "goalMinutes", "status"::text AS "status",
               "elapsedMilliseconds", "lastStartedAt", "awardedPoints", "createdAt"
        FROM "Challenge"
        WHERE "id" = ${challengeId}::uuid AND "studyId" = ${studyId}::uuid
        FOR UPDATE
      `;
      const challenge = challenges[0];
      if (challenge === undefined) {
        throw createApiError("CHALLENGE_NOT_FOUND");
      }

      const serverTime = new Date();
      if (challenge.status === "RESET") {
        return buildResetResponse(challenge, study.points, serverTime);
      }
      if (challenge.status !== "PAUSED") {
        throw createApiError("INVALID_CHALLENGE_STATE");
      }

      // 목표·누적 경과·생성 시각은 이력으로 보존하고 상태만 종료한다.
      // PAUSED의 lastStartedAt=null·awardedPoints=0은 DB 제약으로 보장된다.
      const transition = await tx.challenge.updateMany({
        where: { id: challenge.id, studyId: study.id, status: "PAUSED" },
        data: { status: "RESET" },
      });
      if (transition.count !== 1) {
        throw createApiError("INVALID_CHALLENGE_STATE");
      }

      const reset = await tx.challenge.findUniqueOrThrow({
        where: { id: challenge.id },
      });
      return buildResetResponse(reset, study.points, serverTime);
    },
    { isolationLevel: "ReadCommitted" },
  );
