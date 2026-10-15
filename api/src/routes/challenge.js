import { rejectQuery } from "../middlewares/rejectQuery.js";
import express from "express";
import {
  validateChallengeStudyId,
  validateStartChallenge,
} from "../schemas/challenge.js";
import {
  getCurrentChallenge,
  startChallenge,
} from "../services/challenge.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";

// verifyStudyPassword(req, res, next): studyId의 비밀번호를 bcrypt 검증한다.
export const createChallengeRouter = ({ verifyStudyPassword }) => {
  if (typeof verifyStudyPassword !== "function") {
    throw new TypeError("집중 라우터에 공통 비밀번호 검증 함수를 연결해주세요.");
  }

  const challengeRouter = express.Router({ mergeParams: true });

  challengeRouter.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  challengeRouter.use(rejectQuery);

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
      return sendSuccess(res, data);
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
      return sendSuccess(res, data, 201);
    },
  );

  return challengeRouter;
};

