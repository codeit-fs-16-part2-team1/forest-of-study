import express from "express";
import { getWeeklyRoutineHistories } from "../services/routineHistoryService.js";
import { getWeekDates } from "../utils/date.js";
import { uuidSchema } from "../utils/uuid.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";

const routineHistoryRouter = express.Router({ mergeParams: true });

// API-ST-06은 비밀번호 없이 조회하는 공개 API다.
routineHistoryRouter.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const { studyId } = req.params;
  if (!uuidSchema.safeParse(studyId).success) {
    throw createApiError("VALIDATION_ERROR");
  }

  const queryKeys = Object.keys(req.query);
  if (
    queryKeys.length !== 1 ||
    queryKeys[0] !== "weekStart" ||
    typeof req.query.weekStart !== "string"
  ) {
    throw createApiError("VALIDATION_ERROR");
  }

  const weekDates = getWeekDates(req.query.weekStart);
  if (!weekDates) {
    throw createApiError("VALIDATION_ERROR");
  }

  const result = await getWeeklyRoutineHistories({ studyId, weekDates });
  return sendSuccess(res, result);
});

export default routineHistoryRouter;
