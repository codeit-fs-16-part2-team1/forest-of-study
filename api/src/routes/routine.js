import express from "express";
import { isValidRecordDate } from "../utils/date.js";
import { countGraphemes } from "../utils/string.js";
import { uuidSchema } from "../utils/uuid.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { verifyStudyPassword } from "../middlewares/verifyStudyPassword.js";

import {
  createRoutine,
  getTodayRoutines,
  setRoutineCheck,
} from "../services/routineService.js";

const routineRouter = express.Router({ mergeParams: true });

routineRouter.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!uuidSchema.safeParse(req.params.studyId).success) {
    return next(createApiError("VALIDATION_ERROR"));
  }
  if (Object.keys(req.query).length > 0) {
    return next(createApiError("VALIDATION_ERROR"));
  }
  next();
});

// 페이지 진입 확인 여부와 관계없이 보호 요청마다 비밀번호를 검증한다.
routineRouter.use(verifyStudyPassword);

routineRouter.post("/", async (req, res) => {
  const body = req.body;
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof body.name !== "string"
  ) {
    throw createApiError("VALIDATION_ERROR");
  }

  const name = body.name.trim();
  const length = countGraphemes(name);
  if (length < 1 || length > 20) {
    throw createApiError("VALIDATION_ERROR");
  }

  const routine = await createRoutine({ studyId: req.params.studyId, name });
  return sendSuccess(res, routine, 201);
});

routineRouter.get("/", async (req, res) => {
  const result = await getTodayRoutines({ studyId: req.params.studyId });
  return sendSuccess(res, result);
});

routineRouter.put("/:routineId/check", async (req, res) => {
  const { studyId, routineId } = req.params;
  if (!uuidSchema.safeParse(routineId).success) {
    throw createApiError("VALIDATION_ERROR");
  }

  const body = req.body;
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 2 ||
    typeof body.recordDate !== "string" ||
    typeof body.completed !== "boolean"
  ) {
    throw createApiError("VALIDATION_ERROR");
  }
  if (!isValidRecordDate(body.recordDate)) {
    throw createApiError("VALIDATION_ERROR");
  }

  const result = await setRoutineCheck({
    studyId,
    routineId,
    recordDate: body.recordDate,
    completed: body.completed,
  });
  return sendSuccess(res, result);
});

export default routineRouter;
