import express from "express";
import { validateCreateStudy, validateStudyListQuery, validateStudyIdParams } from "../schemas/study.js";
import { createStudy, getStudies, getStudy } from "../services/study.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess, sendPaginatedSuccess } from "../utils/apiResponse.js";
import { rejectQuery } from "../middlewares/rejectQuery.js";
import { validateCreateReaction } from "../schemas/reaction.js";
import { createReaction } from "../services/reaction.js";

const studyRouter = express.Router();

studyRouter.get("/", async (req, res) => {
  const result = validateStudyListQuery(req.query);
  if (!result.success) throw createApiError("VALIDATION_ERROR");
  const { studies, pagination } = await getStudies(result.data);
  return sendPaginatedSuccess(res, studies, pagination);
});

studyRouter.post("/", rejectQuery, async (req, res) => {
  const result = validateCreateStudy(req.body);
  if (!result.success) {
    const issues = result.error.issues;
    let code = "VALIDATION_ERROR";
    if (issues.every((issue) => issue.code === "custom" && issue.path[0] === "passwordConfirm")) {
      code = "PASSWORD_CONFIRM_MISMATCH";
    } else if (issues.every((issue) => issue.code === "invalid_value" && issue.path[0] === "backgroundKey")) {
      code = "INVALID_BACKGROUND";
    }
    throw createApiError(code);
  }
  const study = await createStudy(result.data);
  return sendSuccess(res, study, 201);
});

studyRouter.get("/:studyId", rejectQuery, async (req, res) => {
  const result = validateStudyIdParams(req.params);
  if (!result.success) throw createApiError("VALIDATION_ERROR");
  const study = await getStudy(result.data.studyId);
  return sendSuccess(res, study);
});

// API-ST-07은 공개 API다. browserId는 비밀번호 인증 증명이 아니다.
studyRouter.post("/:studyId/reactions", rejectQuery, async (req, res) => {
  const idResult = validateStudyIdParams(req.params);
  if (!idResult.success) throw createApiError("VALIDATION_ERROR");
  const result = validateCreateReaction(req.body);
  if (!result.success) {
    const onlyInvalidEmoji = result.error.issues.every((issue) =>
      issue.code === "custom" && issue.path.length === 1 && issue.path[0] === "emoji");
    throw createApiError(onlyInvalidEmoji ? "INVALID_EMOJI" : "VALIDATION_ERROR");
  }
  const data = await createReaction({ studyId: idResult.data.studyId, ...result.data });
  return sendSuccess(res, data);
});

export default studyRouter;
