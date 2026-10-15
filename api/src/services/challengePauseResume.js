import { prisma } from "../lib/prisma.js";
import { createApiError } from "../utils/apiError.js";
import { calculateElapsedMilliseconds } from "../utils/challengeTime.js";
import { buildChallengeResponse } from "../utils/challengeResponse.js";

const buildChangeResponse = (challenge, points, serverTime) => ({
  challenge: buildChallengeResponse(challenge, serverTime),
  points,
  settlement: null,
});

// 라우트에서 UUID·비밀번호를 검증한 뒤 호출한다.
const changeChallenge = (studyId, challengeId, action) =>
  prisma.$transaction(
    async (tx) => {
      // 시작·완료와 같은 잠금 순서를 사용한다.
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

      // 잠금을 얻은 뒤 시각을 잡아 대기한 시간도 실행 구간에 포함한다.
      const serverTime = new Date();
      if (action === "pause" && challenge.status === "PAUSED") {
        return buildChangeResponse(challenge, study.points, serverTime);
      }

      const expectedStatus = action === "pause" ? "RUNNING" : "PAUSED";
      if (challenge.status !== expectedStatus) {
        throw createApiError("INVALID_CHALLENGE_STATE");
      }

      const elapsedMilliseconds = calculateElapsedMilliseconds(challenge, serverTime);
      if (elapsedMilliseconds >= challenge.goalMinutes * 60000) {
        throw createApiError("CHALLENGE_FINISHED");
      }

      const data = action === "pause"
        ? { status: "PAUSED", elapsedMilliseconds, lastStartedAt: null }
        : { status: "RUNNING", lastStartedAt: serverTime };
      const transition = await tx.challenge.updateMany({
        where: { id: challenge.id, studyId: study.id, status: expectedStatus },
        data,
      });
      if (transition.count !== 1) {
        throw createApiError("INVALID_CHALLENGE_STATE");
      }

      // 정지·재개는 경과와 실행 시각만 바꾸며 지급량과 총점을 건드리지 않는다.
      const updatedChallenge = await tx.challenge.findUniqueOrThrow({
        where: { id: challenge.id },
      });
      return buildChangeResponse(updatedChallenge, study.points, serverTime);
    },
    { isolationLevel: "ReadCommitted" },
  );

export const pauseChallenge = (studyId, challengeId) =>
  changeChallenge(studyId, challengeId, "pause");

export const resumeChallenge = (studyId, challengeId) =>
  changeChallenge(studyId, challengeId, "resume");
