import express from "express";
import { validateChallengeReset } from "../schemas/challengeReset.js";
import { resetChallenge } from "../services/challengeReset.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const createChallengeResetRouter = ({ verifyStudyPassword }) => {
  if (typeof verifyStudyPassword !== "function") {
    throw new TypeError("초기화 라우터에 공통 비밀번호 검증 함수를 연결해주세요.");
  }

  const router = express.Router({ mergeParams: true });
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  router.post(
    "/:challengeId/reset",
    (req, res, next) => {
      const result = validateChallengeReset({
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
    },
    verifyStudyPassword,
    async (req, res) => {
      const data = await resetChallenge(req.params.studyId, req.params.challengeId);
      return sendSuccess(res, data);
    },
  );

  return router;
};
