import express from "express";
import { validateCompleteChallenge } from "../schemas/challenge-complete.js";

// verifyStudyPassword는 X-Study-Password를 검증하는 Express 미들웨어다.
export const createCompleteChallengeRouter = ({
  verifyStudyPassword,
  createApiError,
  completeChallenge,
}) => {
  if (
    [verifyStudyPassword, createApiError, completeChallenge].some(
      (dependency) => typeof dependency !== "function",
    )
  ) {
    throw new TypeError("완료 라우트에 비밀번호 검증·공통 오류·완료 서비스를 연결해주세요.");
  }

  const router = express.Router({ mergeParams: true });

  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  router.post(
    "/:challengeId/complete",
    (req, res, next) => {
      const result = validateCompleteChallenge({
        studyId: req.params.studyId,
        challengeId: req.params.challengeId,
        body: req.body,
      });
      // JSON 파서가 읽지 않는 본문도 거절한다. 빈 {} 역시 본문이므로 허용하지 않는다.
      const hasBody =
        Number(req.get("Content-Length") ?? 0) > 0 ||
        req.get("Transfer-Encoding") !== undefined;

      if (!result.success || hasBody) {
        return next(createApiError("VALIDATION_ERROR"));
      }

      next();
    },
    verifyStudyPassword,
    async (req, res) => {
      const data = await completeChallenge(
        req.params.studyId,
        req.params.challengeId,
      );
      res.status(200).json({ data });
    },
  );

  return router;
};
