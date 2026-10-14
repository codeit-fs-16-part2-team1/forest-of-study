import express from "express";
import { validatePasswordVerificationBody } from "../schemas/studyPassword.js";
import { checkStudyPassword } from "../services/studyPassword.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { uuidSchema } from "../utils/uuid.js";

const studyPasswordRouter = express.Router({ mergeParams: true });

studyPasswordRouter.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// API-AU-01은 본문 비밀번호를 확인한다. 보호 요청의 헤더 미들웨어는 사용하지 않는다.
studyPasswordRouter.post("/", async (req, res) => {
  const studyIdResult = uuidSchema.safeParse(req.params.studyId);
  if (!studyIdResult.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  if (req.body === undefined) {
    throw createApiError("VERIFICATION_REQUIRED");
  }

  const bodyResult = validatePasswordVerificationBody(req.body);
  if (!bodyResult.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  const data = await checkStudyPassword(
    studyIdResult.data,
    bodyResult.data.password,
  );
  return sendSuccess(res, data);
});

export default studyPasswordRouter;
