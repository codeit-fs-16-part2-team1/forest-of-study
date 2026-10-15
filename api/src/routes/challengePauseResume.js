import { rejectQuery } from "../middlewares/rejectQuery.js";
import express from "express";
import { validateChallengePauseResume } from "../schemas/challengePauseResume.js";
import { pauseChallenge, resumeChallenge } from "../services/challengePauseResume.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const createChallengePauseResumeRouter = ({ verifyStudyPassword }) => {
  if (typeof verifyStudyPassword !== "function") {
    throw new TypeError("정지·재개 라우터에 공통 비밀번호 검증 함수를 연결해주세요.");
  }

  const router = express.Router({ mergeParams: true });
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(rejectQuery);

  const validateRequest = (req, res, next) => {
    const result = validateChallengePauseResume({
      studyId: req.params.studyId,
      challengeId: req.params.challengeId,
      body: req.body,
    });
    const hasBody = Number(req.get("Content-Length") ?? 0) > 0
      || req.get("Transfer-Encoding") !== undefined;
    if (!result.success || hasBody) {
      return next(createApiError("VALIDATION_ERROR"));
    }
    next();
  };

  router.post("/:challengeId/pause", validateRequest, verifyStudyPassword, async (req, res) => {
    const data = await pauseChallenge(req.params.studyId, req.params.challengeId);
    return sendSuccess(res, data);
  });

  router.post("/:challengeId/resume", validateRequest, verifyStudyPassword, async (req, res) => {
    const data = await resumeChallenge(req.params.studyId, req.params.challengeId);
    return sendSuccess(res, data);
  });

  return router;
};
