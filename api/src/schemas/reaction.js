import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";
import { isValidEmoji } from "../utils/emoji.js";

const createReactionSchema = z.strictObject({
  browserId: uuidSchema,
  emoji: z.string().refine(isValidEmoji),
});

export const validateCreateReaction = (body) => createReactionSchema.safeParse(body);
