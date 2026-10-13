import express from "express";
import { getWeeklyRoutineHistories } from "../services/routineHistoryService.js";
import { getWeekDates } from "../utils/date.js";
import {
  routineErrorMessages,
  sendRoutineError,
  handleRoutineError,
} from "../utils/routineError.js";

const routineHistoryRouter = express.Router({ mergeParams: true });
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

// API-ST-06은 비밀번호 없이 조회하는 공개 API다.
routineHistoryRouter.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const { studyId } = req.params;
  if (!uuidPattern.test(studyId)) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidStudyId,
    );
  }

  const queryKeys = Object.keys(req.query);
  if (
    queryKeys.length !== 1 ||
    queryKeys[0] !== "weekStart" ||
    typeof req.query.weekStart !== "string"
  ) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidWeekQuery,
    );
  }

  const weekDates = getWeekDates(req.query.weekStart);
  if (!weekDates) {
    return sendRoutineError(
      res,
      "VALIDATION_ERROR",
      routineErrorMessages.invalidWeekStart,
    );
  }

  try {
    const result = await getWeeklyRoutineHistories({ studyId, weekDates });
    return res.status(200).json({ data: result });
  } catch (error) {
    return handleRoutineError(res, error);
  }
});

export default routineHistoryRouter;
