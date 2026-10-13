import { z } from "zod";

export const challengeStudyIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const validateChallengeStudyId = (studyId) =>
  challengeStudyIdSchema.safeParse(studyId);

export const startChallengeSchema = z.strictObject({
  goalMinutes: z.int().min(10).max(180).default(10),
});

// 검증 실패는 라우트에서 공통 API 오류로 변환한다. Zod 오류를 그대로 응답하지 않는다.
export const validateStartChallenge = (body) =>
  startChallengeSchema.safeParse(body);
