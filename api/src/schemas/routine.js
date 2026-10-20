import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";
import { countGraphemes } from "../utils/string.js";
import { isValidRecordDate } from "../utils/date.js";

const routineIdSchema = z.strictObject({ routineId: uuidSchema });
const routineNameSchema = z.string().trim().refine((value) => {
  const length = countGraphemes(value);
  return length >= 1 && length <= 20;
});
const createRoutineSchema = z.strictObject({
  name: routineNameSchema,
});
const routineCheckSchema = z.strictObject({
  recordDate: z.string().refine(isValidRecordDate),
  completed: z.boolean(),
});
const batchRoutineIdSchema = uuidSchema.transform((value) => value.toLowerCase());
const routineBatchSchema = z.strictObject({
  creates: z.array(createRoutineSchema).max(18),
  updates: z.array(z.strictObject({
    routineId: batchRoutineIdSchema,
    name: routineNameSchema,
  })).max(18),
  endIds: z.array(batchRoutineIdSchema).max(18),
}).refine(({ updates, endIds }) => {
  const ids = [...updates.map((routine) => routine.routineId), ...endIds];
  // 같은 ID의 중복 변경과 수정·종료 충돌을 모두 거절한다.
  return ids.length <= 18 && new Set(ids).size === ids.length;
});

export const validateCreateRoutine = (body) => createRoutineSchema.safeParse(body);
export const validateRoutineId = (routineId) => routineIdSchema.safeParse({ routineId });
export const validateRoutineCheck = (body) => routineCheckSchema.safeParse(body);
export const validateRoutineBatch = (body) => routineBatchSchema.safeParse(body);
