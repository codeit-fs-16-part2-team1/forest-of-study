const errorResponses = {
  VALIDATION_ERROR: {
    status: 400,
    message: "요청 내용을 확인해주세요.",
  },
  STUDY_NOT_FOUND: {
    status: 404,
    message: "스터디를 찾을 수 없습니다.",
  },
  ROUTINE_NOT_FOUND: {
    status: 404,
    message: "습관을 찾을 수 없습니다.",
  },
  ROUTINE_ENDED: {
    status: 409,
    message: "종료된 습관은 변경할 수 없습니다.",
  },
  DATE_CHANGED: {
    status: 409,
    message: "날짜가 변경되었습니다. 오늘 목록을 다시 조회해주세요.",
  },
  ROUTINE_HISTORY_NOT_FOUND: {
    status: 409,
    message: "오늘 기록이 없어 체크를 해제할 수 없습니다.",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
  },
};

export const routineErrorMessages = {
  invalidStudyId: "스터디 ID 형식이 올바르지 않습니다.",
  invalidRoutineId: "습관 ID 형식이 올바르지 않습니다.",
  invalidCheckBody: "recordDate와 completed만 보내고 completed는 true 또는 false로 입력해주세요.",
  invalidRecordDate: "recordDate는 실제 존재하는 날짜를 YYYY-MM-DD 형식으로 입력해주세요.",
  outsideRoutinePeriod: "습관 사용 기간에 해당하는 날짜만 변경할 수 있습니다.",
  unsupportedQuery: "요청 주소에 추가한 조회 조건을 제거해주세요.",
  invalidBody: "습관 이름(name)만 문자열로 보내주세요.",
  invalidName: "습관 이름은 앞뒤 공백을 제외하고 1~20글자로 입력해주세요.",
  routineLimit: "종료되지 않은 습관은 스터디당 최대 18개까지 만들 수 있습니다.",
};

// 서비스에서 의도적으로 발생시킨 오류만 사용자 안내에 사용한다.
export class RoutineServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RoutineServiceError";
    this.code = code;
  }
}

export const sendRoutineError = (res, code, message) => {
  const knownCode = Object.hasOwn(errorResponses, code) ? code : "INTERNAL_ERROR";
  const response = errorResponses[knownCode];

  return res.status(response.status).json({
    error: {
      code: knownCode,
      // 내부 오류 원문에는 DB 접속 정보 등이 포함될 수 있다.
      message:
        knownCode === "INTERNAL_ERROR"
          ? response.message
          : message || response.message,
      details: null,
    },
  });
};

export const handleRoutineError = (res, error) => {
  if (error instanceof RoutineServiceError) {
    return sendRoutineError(res, error.code, error.message);
  }

  return sendRoutineError(res, "INTERNAL_ERROR");
};
