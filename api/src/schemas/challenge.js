import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";

export const challengeStudyIdSchema = uuidSchema;

export const validateChallengeStudyId = (studyId) =>
  challengeStudyIdSchema.safeParse(studyId);

export const startChallengeSchema = z.strictObject({
  goalMinutes: z.int().min(10).max(180).default(10),
});

// 검증 실패는 라우트에서 공통 API 오류로 변환한다. Zod 오류를 그대로 응답하지 않는다.
export const validateStartChallenge = (body) =>
  startChallengeSchema.safeParse(body);
