import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";
import { countGraphemes } from "../utils/string.js";
import { isValidRecordDate } from "../utils/date.js";

const routineIdSchema = z.strictObject({ routineId: uuidSchema });
const createRoutineSchema = z.strictObject({
  name: z.string().trim().refine((value) => {
    const length = countGraphemes(value);
    return length >= 1 && length <= 20;
  }),
});
const routineCheckSchema = z.strictObject({
  recordDate: z.string().refine(isValidRecordDate),
  completed: z.boolean(),
});

export const validateCreateRoutine = (body) => createRoutineSchema.safeParse(body);
export const validateRoutineId = (routineId) => routineIdSchema.safeParse({ routineId });
export const validateRoutineCheck = (body) => routineCheckSchema.safeParse(body);
