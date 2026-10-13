import express from "express";
import { isValidRecordDate } from "../utils/date.js";
import { countGraphemes } from "../utils/string.js";
import {
  routineErrorMessages,
  sendRoutineError,
  handleRoutineError,
} from "../utils/routineError.js";

import {
  createRoutine,
  getTodayRoutines,
  setRoutineCheck,
} from "../services/routineService.js";

const routineRouter = express.Router({ mergeParams: true });
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

routineRouter.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!uuidPattern.test(req.params.studyId)) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidStudyId,
    );
  }
  if (Object.keys(req.query).length > 0) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.unsupportedQuery,
    );
  }
  next();
});

// 개발 단계: 비밀번호 검증 없이 실행한다.
// 추후 이 위치에 공통 비밀번호 검증 미들웨어를 연결하고 아래 핸들러는 유지한다.
routineRouter.post("/", async (req, res) => {
  const body = req.body;
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof body.name !== "string"
  ) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidBody,
    );
  }

  const name = body.name.trim();
  const length = countGraphemes(name);
  if (length < 1 || length > 20) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidName,
    );
  }

  try {
    const routine = await createRoutine({ studyId: req.params.studyId, name });
    return res.status(201).json({ data: routine });
  } catch (error) {
    return handleRoutineError(res, error);
  }
});

routineRouter.get("/", async (req, res) => {
  try {
    const result = await getTodayRoutines({ studyId: req.params.studyId });
    return res.status(200).json({ data: result });
  } catch (error) {
    return handleRoutineError(res, error);
  }
});

routineRouter.put("/:routineId/check", async (req, res) => {
  const { studyId, routineId } = req.params;
  if (!uuidPattern.test(routineId)) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidRoutineId,
    );
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
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidCheckBody,
    );
  }
  if (!isValidRecordDate(body.recordDate)) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidRecordDate,
    );
  }

  try {
    const result = await setRoutineCheck({
      studyId,
      routineId,
      recordDate: body.recordDate,
      completed: body.completed,
    });
    return res.status(200).json({ data: result });
  } catch (error) {
    return handleRoutineError(res, error);
  }
});

export default routineRouter;
