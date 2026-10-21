import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";
import { countGraphemes } from "../utils/string.js";
import { isValidRecordDate } from "../utils/date.js";

const routineIdSchema = z.strictObject({ routineId: uuidSchema });
const routineNameSchema = z.string().trim().refine((value) => {
  const length = countGraphemes(value);
  return length >= 1 && length <= 20;
});
const stickerColorSchema = z.number().int().min(1).max(18);
const createRoutineSchema = z.strictObject({
  name: routineNameSchema,
  stickerColor: stickerColorSchema,
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
    stickerColor: stickerColorSchema.optional(),
  })).max(18),
  endIds: z.array(batchRoutineIdSchema).max(18),
  order: z.array(z.union([
    z.strictObject({ routineId: batchRoutineIdSchema }),
    z.strictObject({ createIndex: z.number().int().min(0).max(17) }),
  ])).max(18).optional(),
}).refine(({ creates, updates, endIds, order }) => {
  if (order) {
    const keys = order.map((item) => item.routineId ?? `new-${item.createIndex}`);
    if (new Set(keys).size !== keys.length || order.some((item) =>
      item.routineId ? endIds.includes(item.routineId) : item.createIndex >= creates.length)) return false;
    if (order.filter((item) => item.createIndex !== undefined).length !== creates.length) return false;
  }
  const ids = [...updates.map((routine) => routine.routineId), ...endIds];
  // 같은 ID의 중복 변경과 수정·종료 충돌을 모두 거절한다.
  return ids.length <= 18 && new Set(ids).size === ids.length;
});

export const validateCreateRoutine = (body) => createRoutineSchema.safeParse(body);
export const validateRoutineId = (routineId) => routineIdSchema.safeParse({ routineId });
export const validateRoutineCheck = (body) => routineCheckSchema.safeParse(body);
export const validateRoutineBatch = (body) => routineBatchSchema.safeParse(body);
