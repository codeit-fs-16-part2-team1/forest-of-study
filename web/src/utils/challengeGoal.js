export const isValidChallengeGoalMinutes = (minutes) =>
  Number.isInteger(minutes) && minutes >= 10 && minutes <= 180;

// 빈 값·소수·지수 표기를 임의로 보정하지 않고 분 단위 정수 입력만 받는다.
export const parseChallengeGoalMinutes = (value) => {
  if (typeof value !== "string" || value.length === 0 || /[^0-9]/u.test(value)) {
    return null;
  }

  const minutes = Number(value);
  return isValidChallengeGoalMinutes(minutes) ? minutes : null;
};
