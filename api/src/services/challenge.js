import { prisma } from "../lib/prisma.js";
import { buildChallengeResponse } from "../utils/challengeResponse.js";
import { createApiError } from "../utils/apiError.js";

const activeStatuses = ["RUNNING", "PAUSED"];
const latestOrder = [{ createdAt: "desc" }, { id: "desc" }];

const isActiveChallengeConflict = (error) => {
  if (error?.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return (
    target === "Challenge_one_active_per_study" ||
    (Array.isArray(target) && target.length === 1 && target[0] === "studyId")
  );
};

// 라우트에서 UUID·비밀번호를 검증한 뒤 호출한다.
export const getCurrentChallenge = async (studyId) =>
  prisma.$transaction(
    async (tx) => {
      const study = await tx.study.findUnique({
        where: { id: studyId },
        select: { id: true, points: true },
      });

      if (study === null) {
        throw createApiError("STUDY_NOT_FOUND");
      }

      const challenge = await tx.challenge.findFirst({
        where: { studyId, status: { in: activeStatuses } },
        orderBy: latestOrder,
      });

      let goalMinutes = challenge?.goalMinutes ?? 10;

      if (challenge === null) {
        const latestFinished = await tx.challenge.findFirst({
          where: { studyId, status: { in: ["RESET", "COMPLETED"] } },
          orderBy: latestOrder,
          select: { goalMinutes: true },
        });
        goalMinutes = latestFinished?.goalMinutes ?? 10;
      }

      const serverTime = new Date();

      return {
        challenge: buildChallengeResponse(challenge, serverTime),
        points: study.points,
        serverTime: serverTime.toISOString(),
        goalMinutes,
      };
    },
    // 집중 상태와 총점을 같은 DB 스냅샷에서 읽는다.
    { isolationLevel: "RepeatableRead" },
  );

// goalMinutes는 시작 요청 스키마로 검증·기본값 적용을 마친 값이다.
export const startChallenge = async (studyId, goalMinutes) => {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // 같은 스터디의 시작 요청은 Study 잠금을 얻은 순서대로 검사·생성한다.
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

        const active = await tx.challenge.findFirst({
          where: { studyId, status: { in: activeStatuses } },
          select: { id: true },
        });

        if (active !== null) {
          throw createApiError("CHALLENGE_CONFLICT");
        }

        const serverTime = new Date();
        const challenge = await tx.challenge.create({
          data: {
            studyId,
            goalMinutes,
            status: "RUNNING",
            elapsedMilliseconds: 0,
            lastStartedAt: serverTime,
            awardedPoints: 0,
          },
        });

        return {
          challenge: buildChallengeResponse(challenge, serverTime),
          points: study.points,
          settlement: null,
        };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch (error) {
    if (isActiveChallengeConflict(error)) {
      throw createApiError("CHALLENGE_CONFLICT");
    }
    throw error;
  }
};
