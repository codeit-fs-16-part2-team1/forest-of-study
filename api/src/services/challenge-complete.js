import { prisma } from "../lib/prisma.js";
import { checkChallengeCompletion } from "../utils/challenge-completion.js";
import { calculateChallengePoints } from "../utils/challenge-points.js";
import { calculateElapsedMilliseconds } from "../utils/challenge-time.js";
import { buildChallengeResponse } from "../utils/challenge-response.js";
import { createApiError } from "../utils/apiError.js";

export const createCompleteChallengeService = () => {
  // UUID·비밀번호 검증을 마친 라우트에서 호출한다. 완료 요청 본문은 받지 않는다.
  return async (studyId, challengeId) =>
    prisma.$transaction(
      async (tx) => {
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
        const actualElapsedMilliseconds =
          challenge.status === "RUNNING" || challenge.status === "PAUSED"
            ? calculateElapsedMilliseconds(challenge, serverTime)
            : challenge.elapsedMilliseconds;
        const decision = checkChallengeCompletion(
          challenge,
          actualElapsedMilliseconds,
        );

        if (decision.isAlreadyCompleted) {
          return {
            challenge: buildChallengeResponse(challenge, serverTime),
            points: study.points,
            settlement: {
              challengeId: challenge.id,
              elapsedPoints: 0,
              goalPoints: 0,
              awardedPoints: 0,
            },
          };
        }

        if (!decision.canComplete) {
          throw createApiError(decision.errorCode);
        }

        const award = calculateChallengePoints(challenge.goalMinutes);
        const transition = await tx.challenge.updateMany({
          where: {
            id: challenge.id,
            studyId: study.id,
            status: { in: ["RUNNING", "PAUSED"] },
          },
          data: {
            status: "COMPLETED",
            elapsedMilliseconds: challenge.goalMinutes * 60000,
            lastStartedAt: null,
            awardedPoints: award.awardedPoints,
          },
        });

        // 완료 전환이 정확히 한 행에 성공한 경우에만 총점을 증가시킨다.
        if (transition.count !== 1) {
          throw createApiError("INVALID_CHALLENGE_STATE");
        }

        const updatedStudy = await tx.study.update({
          where: { id: study.id },
          data: { points: { increment: award.awardedPoints } },
          select: { points: true },
        });
        const completedChallenge = await tx.challenge.findUniqueOrThrow({
          where: { id: challenge.id },
        });

        // 응답 구성까지 성공해야 커밋된다. 콜백이 오류를 던지면 전체가 롤백된다.
        return {
          challenge: buildChallengeResponse(completedChallenge, serverTime),
          points: updatedStudy.points,
          settlement: {
            challengeId: completedChallenge.id,
            ...award,
          },
        };
      },
      { isolationLevel: "ReadCommitted" },
    );
};
