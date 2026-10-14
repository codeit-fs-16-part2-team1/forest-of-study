import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";

const challengePauseResumeSchema = z.strictObject({
  studyId: uuidSchema,
  challengeId: uuidSchema,
  body: z.undefined(),
});

export const validateChallengePauseResume = (request) =>
  challengePauseResumeSchema.safeParse(request);
