import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";

const challengeResetSchema = z.strictObject({
  studyId: uuidSchema,
  challengeId: uuidSchema,
  body: z.undefined(),
});

export const validateChallengeReset = (request) =>
  challengeResetSchema.safeParse(request);
