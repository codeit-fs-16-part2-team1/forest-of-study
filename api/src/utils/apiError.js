// HTTP·code는 API.md 9절 기준이다. 안내 문구는 ADR-058에 따른 임시 문구다.
const errorDefinitions = Object.freeze({
  VALIDATION_ERROR: { statusCode: 400, message: "요청 내용을 확인해주세요." },
  PASSWORD_CONFIRM_MISMATCH: {
    statusCode: 400,
    message: "비밀번호 확인이 일치하지 않습니다.",
  },
  INVALID_BACKGROUND: { statusCode: 400, message: "선택할 수 없는 배경입니다." },
  INVALID_EMOJI: { statusCode: 400, message: "사용할 수 없는 이모지입니다." },
  PASSWORD_MISMATCH: { statusCode: 401, message: "비밀번호가 일치하지 않습니다." },
  VERIFICATION_REQUIRED: { statusCode: 401, message: "비밀번호를 입력해주세요." },
  STUDY_NOT_FOUND: { statusCode: 404, message: "스터디를 찾을 수 없습니다." },
  ROUTINE_NOT_FOUND: { statusCode: 404, message: "습관을 찾을 수 없습니다." },
  CHALLENGE_NOT_FOUND: { statusCode: 404, message: "집중 기록을 찾을 수 없습니다." },
  CHALLENGE_CONFLICT: { statusCode: 409, message: "진행 중이거나 일시정지된 집중이 있습니다." },
  INVALID_CHALLENGE_STATE: { statusCode: 409, message: "현재 집중 상태에서는 요청을 처리할 수 없습니다." },
  CHALLENGE_NOT_FINISHED: { statusCode: 409, message: "아직 목표 시간에 도달하지 않았습니다." },
  CHALLENGE_FINISHED: { statusCode: 409, message: "목표 시간에 도달했습니다. 집중을 완료해주세요." },
  ROUTINE_ENDED: { statusCode: 409, message: "종료된 습관은 변경할 수 없습니다." },
  DATE_CHANGED: { statusCode: 409, message: "날짜가 변경되었습니다. 오늘의 습관을 다시 조회해주세요." },
  REACTION_POLICY_CONFLICT: { statusCode: 409, message: "이미 추가한 응원입니다." },
  INTERNAL_ERROR: { statusCode: 500, message: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." },
});

const apiErrors = new WeakSet();

export const createApiError = (code) => {
  // 정의하지 않은 코드는 프로그래밍 오류로 처리한다. 요청값을 문구에 넣지 않는다.
  if (!Object.hasOwn(errorDefinitions, code)) {
    throw new TypeError("API 계약에 정의된 오류 코드를 사용해주세요.");
  }

  const definition = errorDefinitions[code];
  const error = new Error(definition.message);
  error.name = "ApiError";
  error.code = code;
  error.statusCode = definition.statusCode;
  error.details = null;
  apiErrors.add(error);

  return Object.freeze(error);
};

// code·statusCode가 있다는 이유만으로 외부 라이브러리의 오류를 공개하지 않는다.
export const isApiError = (error) => apiErrors.has(error);
