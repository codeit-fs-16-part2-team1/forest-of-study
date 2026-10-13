import express from "express";
import {
  validateChallengeStudyId,
  validateStartChallenge,
} from "../schemas/challenge.js";
import {
  getCurrentChallenge,
  startChallenge,
} from "../services/challenge.js";

// verifyStudyPassword(req, res, next): studyId의 비밀번호를 bcrypt 검증한다.
// createApiError(code): 계약의 statusCode·message·details를 가진 Error를 반환한다.
export const createChallengeRouter = ({
  verifyStudyPassword,
  createApiError,
}) => {
  if (
    typeof verifyStudyPassword !== "function" ||
    typeof createApiError !== "function"
  ) {
    throw new TypeError("집중 라우터에 공통 비밀번호 검증과 오류 생성 함수를 연결해주세요.");
  }

  const challengeRouter = express.Router({ mergeParams: true });

  challengeRouter.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const validateStudyId = (req, res, next) => {
    const result = validateChallengeStudyId(req.params.studyId);

    if (!result.success) {
      return next(createApiError("VALIDATION_ERROR"));
    }

    res.locals.studyId = result.data;
    next();
  };

  challengeRouter.get(
    "/current",
    validateStudyId,
    verifyStudyPassword,
    async (req, res) => {
      const data = await getCurrentChallenge(res.locals.studyId);
      res.status(200).json({ data });
    },
  );

  challengeRouter.post(
    "/",
    validateStudyId,
    verifyStudyPassword,
    async (req, res) => {
      const result = validateStartChallenge(req.body);

      if (!result.success) {
        throw createApiError("VALIDATION_ERROR");
      }

      const data = await startChallenge(
        res.locals.studyId,
        result.data.goalMinutes,
      );
      res.status(201).json({ data });
    },
  );

  challengeRouter.use((error, req, res, next) => {
    if (error?.name === "ChallengeServiceError") {
      return next(createApiError(error.code));
    }

    next(error);
  });

  return challengeRouter;
};

