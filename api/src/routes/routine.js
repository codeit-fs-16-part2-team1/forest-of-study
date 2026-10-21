import express from "express";
import { uuidSchema } from "../utils/uuid.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { verifyStudyPassword } from "../middlewares/verifyStudyPassword.js";
import { rejectQuery } from "../middlewares/rejectQuery.js";
import { validateCreateRoutine, validateRoutineId, validateRoutineCheck, validateRoutineBatch } from "../schemas/routine.js";
import { createRoutine, getTodayRoutines, setRoutineCheck } from "../services/routineService.js";
import { saveRoutineBatch } from "../services/routineBatchService.js";

const routineRouter = express.Router({ mergeParams: true });

routineRouter.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!uuidSchema.safeParse(req.params.studyId).success) {
    return next(createApiError("VALIDATION_ERROR"));
  }
  next();
});
routineRouter.use(rejectQuery);
routineRouter.use(verifyStudyPassword);

routineRouter.post("/", async (req, res) => {
  const result = validateCreateRoutine(req.body);
  if (!result.success) throw createApiError("VALIDATION_ERROR");
  const routine = await createRoutine({ studyId: req.params.studyId, ...result.data });
  return sendSuccess(res, routine, 201);
});

routineRouter.get("/", async (req, res) => {
  const result = await getTodayRoutines({ studyId: req.params.studyId });
  return sendSuccess(res, result);
});

routineRouter.patch("/batch", async (req, res) => {
  const result = validateRoutineBatch(req.body);
  if (!result.success) throw createApiError("VALIDATION_ERROR");
  const routines = await saveRoutineBatch({
    studyId: req.params.studyId,
    ...result.data,
  });
  return sendSuccess(res, routines);
});

routineRouter.put("/:routineId/check", async (req, res) => {
  const idResult = validateRoutineId(req.params.routineId);
  const bodyResult = validateRoutineCheck(req.body);
  if (!idResult.success || !bodyResult.success) throw createApiError("VALIDATION_ERROR");
  const result = await setRoutineCheck({
    studyId: req.params.studyId,
    routineId: idResult.data.routineId,
    ...bodyResult.data,
  });
  return sendSuccess(res, result);
});

export default routineRouter;
