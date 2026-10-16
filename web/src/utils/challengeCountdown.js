// 서버 응답 이후 흐른 시간만 더한다. 브라우저의 날짜·시간 설정은 사용하지 않는다.
export const calculateChallengeRemainingSeconds = (
  challenge,
  elapsedMilliseconds = 0,
) => {
  if (!challenge) {
    return null;
  }

  if (challenge.status === "COMPLETED") {
    return 0;
  }

  if (challenge.status === "PAUSED") {
    return Number.isFinite(challenge.remainingSeconds)
      ? Math.max(0, Math.ceil(challenge.remainingSeconds))
      : null;
  }

  if (challenge.status !== "RUNNING") {
    return null;
  }

  const serverMilliseconds = typeof challenge.serverTime === "string"
    ? Date.parse(challenge.serverTime)
    : NaN;
  const endMilliseconds = typeof challenge.endsAt === "string"
    ? Date.parse(challenge.endsAt)
    : NaN;

  if (
    !Number.isFinite(serverMilliseconds) ||
    !Number.isFinite(endMilliseconds) ||
    !Number.isFinite(elapsedMilliseconds)
  ) {
    return null;
  }

  const remainingMilliseconds = endMilliseconds - serverMilliseconds
    - Math.max(0, elapsedMilliseconds);

  return Math.max(0, Math.ceil(remainingMilliseconds / 1000));
};
