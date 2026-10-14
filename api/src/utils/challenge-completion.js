// 실제 경과는 서비스가 DB 값과 서버 시각으로 계산해 전달한다.
// 반환값은 서비스 내부 판정용이며 API 응답에 포함하지 않는다.
export const checkChallengeCompletion = (challenge, actualElapsedMilliseconds) => {
  if (challenge.status === "COMPLETED") {
    return {
      canComplete: false,
      isAlreadyCompleted: true,
      errorCode: null,
    };
  }

  if (challenge.status !== "RUNNING" && challenge.status !== "PAUSED") {
    return {
      canComplete: false,
      isAlreadyCompleted: false,
      errorCode: "INVALID_CHALLENGE_STATE",
    };
  }

  if (
    !Number.isFinite(actualElapsedMilliseconds) ||
    actualElapsedMilliseconds < 0
  ) {
    throw new TypeError("실제 경과는 서버에서 계산한 0 이상의 숫자여야 합니다.");
  }

  const goalMilliseconds = challenge.goalMinutes * 60000;

  if (actualElapsedMilliseconds >= goalMilliseconds) {
    return {
      canComplete: true,
      isAlreadyCompleted: false,
      errorCode: null,
    };
  }

  return {
    canComplete: false,
    isAlreadyCompleted: false,
    errorCode: "CHALLENGE_NOT_FINISHED",
  };
};
