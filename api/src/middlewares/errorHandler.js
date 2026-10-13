import { createApiError, isApiError } from "../utils/apiError.js";

// 이 세 파서 요청 오류는 400 VALIDATION_ERROR로 통일한다.
// 파서의 유형·원래 상태가 모두 일치할 때만 변환한다.
const requestErrorStatuses = new Map([
  ["charset.unsupported", 415],
  ["encoding.unsupported", 415],
  ["entity.too.large", 413],
]);

// Express가 오류 미들웨어로 인식하려면 인자 4개를 유지해야 한다.
export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let apiError;
  if (isApiError(error)) {
    apiError = error;
  } else if (
    (error instanceof SyntaxError &&
      error.type === "entity.parse.failed" &&
      error.status === 400) ||
    (requestErrorStatuses.has(error?.type) &&
      requestErrorStatuses.get(error.type) === error.status)
  ) {
    // 요청 본문·인코딩 값·파서 오류 원문을 반환하지 않는다.
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
