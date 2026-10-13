import express from "express";
import { countGraphemes } from "../utils/string.js";
import { uuidSchema } from "../utils/uuid.js";
import { createApiError } from "../utils/apiError.js";

import {
  createRoutine,
  getTodayRoutines,
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
    throw createApiError("VALIDATION_ERROR");
  }

  const name = body.name.trim();
  const length = countGraphemes(name);
  if (length < 1 || length > 20) {
    throw createApiError("VALIDATION_ERROR");
  }

  const routine = await createRoutine({ studyId: req.params.studyId, name });
  return res.status(201).json({ data: routine });
});

routineRouter.get("/", async (req, res) => {
  const result = await getTodayRoutines({ studyId: req.params.studyId });
  return res.status(200).json({ data: result });
});

export default routineRouter;
