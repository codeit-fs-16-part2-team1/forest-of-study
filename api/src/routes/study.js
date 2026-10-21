import express from "express";
import { validateCreateStudy, validateUpdateStudy, validateStudyListQuery, validateStudyBatchQuery, validateStudyIdParams } from "../schemas/study.js";
import { createStudy, updateStudy, getStudies, getStudiesByIds, getStudy, deleteStudy } from "../services/study.js";
import { verifyStudyPassword } from "../middlewares/verifyStudyPassword.js";
import { validatePasswordVerificationBody } from "../schemas/studyPassword.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess, sendPaginatedSuccess } from "../utils/apiResponse.js";
import { rejectQuery } from "../middlewares/rejectQuery.js";
import { validateCreateReaction } from "../schemas/reaction.js";
import { createReaction } from "../services/reaction.js";

const studyRouter = express.Router();

//스터디목록 조회 요청 -> 쿼리검사 단계 
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
    } else if (issues.every((issue) =>
      issue.path.length === 1 && ["backgroundKey", "backgroundColor"].includes(issue.path[0]))) {
      code = "INVALID_BACKGROUND";
    }
    throw createApiError(code);
  }
  const study = await createStudy(result.data);
  return sendSuccess(res, study, 201);
});


// /batch가 스터디 ID로 해석되지 않도록 상세 라우트보다 먼저 등록합니다.
studyRouter.get("/batch", async (req, res) => {
  const result = validateStudyBatchQuery(req.query);

  if (!result.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  const studies = await getStudiesByIds(result.data.ids);
  return sendSuccess(res, studies);
});

//상세조회 요청에서 스터디 ID 검사 
studyRouter.get("/:studyId", rejectQuery, async (req, res) => {
  const result = validateStudyIdParams(req.params);
  if (!result.success) {
    throw createApiError("VALIDATION_ERROR");
  }
  const study = await getStudy(result.data.studyId);
  return sendSuccess(res, study);
});

// 검증 미들웨어가 UUID·비밀번호 원문·존재 여부·bcrypt를 요청마다 확인한다.
studyRouter.patch("/:studyId", rejectQuery, verifyStudyPassword, async (req, res) => {
  const result = validateUpdateStudy(req.body);
  if (!result.success) {
    const onlyInvalidBackground = result.error.issues.every((issue) =>
      issue.path.length === 1 && ["backgroundKey", "backgroundColor"].includes(issue.path[0]));
    throw createApiError(onlyInvalidBackground ? "INVALID_BACKGROUND" : "VALIDATION_ERROR");
  }

  const study = await updateStudy(req.params.studyId, result.data);
  return sendSuccess(res, study);
});

// 삭제는 보호 요청 헤더 대신 삭제 모달의 본문 비밀번호를 검증한다.
studyRouter.delete("/:studyId", rejectQuery, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const paramsResult = validateStudyIdParams(req.params);
  if (!paramsResult.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  if (req.body === undefined) {
    throw createApiError("VERIFICATION_REQUIRED");
  }

  const bodyResult = validatePasswordVerificationBody(req.body);
  if (!bodyResult.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  await deleteStudy(paramsResult.data.studyId, bodyResult.data.password);
  return res.status(204).end();
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
