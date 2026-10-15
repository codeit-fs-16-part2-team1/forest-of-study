// DB의 누적 경과에 현재 실행 구간만 더한다. 조회나 계산으로 DB를 수정하지 않는다.
export const calculateElapsedMilliseconds = (challenge, serverTime = new Date()) => {
  if (challenge.status !== "RUNNING") {
    return challenge.elapsedMilliseconds;
  }

  const currentRunMilliseconds = Math.max(
    0,
    serverTime.getTime() - challenge.lastStartedAt.getTime(),
  );

  return Math.min(
    challenge.goalMinutes * 60000,
    challenge.elapsedMilliseconds + currentRunMilliseconds,
  );
};

export const calculateChallengeTime = (challenge, serverTime = new Date()) => {
  const actualElapsedMilliseconds = calculateElapsedMilliseconds(
    challenge,
    serverTime,
  );
  const remainingMilliseconds = Math.max(
    0,
    challenge.goalMinutes * 60000 - actualElapsedMilliseconds,
  );

  return {
    elapsedSeconds: Math.floor(actualElapsedMilliseconds / 1000),
    remainingSeconds: Math.ceil(remainingMilliseconds / 1000),
    serverTime: serverTime.toISOString(),
    endsAt:
      challenge.status === "RUNNING"
        ? new Date(serverTime.getTime() + remainingMilliseconds).toISOString()
        : null,
  };
};
