import { createApiError } from "../utils/apiError.js";

// 쿼리 입력이 없는 API에서만 사용한다. 목록·주간 조회는 각 스키마로 검사한다.
export const rejectQuery = (req, res, next) => {
  if (Object.keys(req.query).length > 0) {
    return next(createApiError("VALIDATION_ERROR"));
  }
  next();
};
