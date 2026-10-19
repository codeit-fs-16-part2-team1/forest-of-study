// ADR-066: 공백을 지우거나 trim하지 않고 원문을 검사한다.
export const isValidStudyPassword = (value) =>
  typeof value === "string"
  && !/\s/u.test(value)
  && /^[A-Za-z0-9!@#$%^&*]{4,20}$/u.test(value);

// ADR-058: 최종 문구 확정 전 사용하는 안내다. 입력 원문은 문구에 포함하지 않는다.
export const studyPasswordMessages = {
  invalid: "비밀번호는 공백 없이 영문·숫자·!@#$%^&*로 4~20자 입력해주세요.",
  unexpectedResponse: "비밀번호 확인 결과를 확인하지 못했습니다. 다시 시도해주세요.",
};
