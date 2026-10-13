import { z } from "zod";

const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);

const completeChallengeSchema = z.strictObject({
  studyId: uuidSchema,
  challengeId: uuidSchema,
  body: z.undefined(),
});

// 경로가 대상을 지정한다. 경과 시간·포인트 등은 본문으로 받지 않는다.
export const validateCompleteChallenge = (request) =>
  completeChallengeSchema.safeParse(request);
