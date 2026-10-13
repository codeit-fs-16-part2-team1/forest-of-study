import { createApiError, isApiError } from "../utils/apiError.js";

// Express가 오류 미들웨어로 인식하려면 인자 4개를 유지해야 한다.
export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let apiError;
  if (isApiError(error)) {
    apiError = error;
  } else if (
    error instanceof SyntaxError &&
    error.type === "entity.parse.failed" &&
    error.status === 400
  ) {
    // 잘못된 JSON의 본문이나 파서 오류 원문을 반환하지 않는다.
    apiError = createApiError("VALIDATION_ERROR");
  } else {
    apiError = createApiError("INTERNAL_ERROR");
  }

  res.set("Cache-Control", "no-store");
  return res.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    },
  });
};
