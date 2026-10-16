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
    // 에러 객체·요청 전체를 출력하지 않고, 메시지에 섞인 민감값도 가린다.
    let errorLog = String(error?.stack ?? error?.message ?? "알 수 없는 오류")
      .replace(/postgres(?:ql)?:\/\/[^\s"'`<>]+/gi, "[DB URL 숨김]")
      .replace(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, "[비밀번호 해시 숨김]");
    for (const value of [
      req.get("X-Study-Password"), req.body?.password, req.body?.passwordConfirm,
    ]) {
      if (typeof value === "string" && value.length > 0) {
        errorLog = errorLog.replaceAll(value, "[비밀번호 숨김]");
      }
    }
    console.error(
      `[${req.method} ${req.path}]`,
      error?.code ?? error?.errorCode ?? "",
      errorLog,
    );
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
