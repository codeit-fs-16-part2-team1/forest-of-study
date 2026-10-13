// DB 제약을 만족하는 Challenge와 기준 서버 시각(Date)을 받아 표시용 시간을 계산한다.
export const calculateChallengeTime = (challenge, serverTime = new Date()) => {
  const goalMilliseconds = challenge.goalMinutes * 60000;
  const serverMilliseconds = serverTime.getTime();
  let actualElapsedMilliseconds = challenge.elapsedMilliseconds;

  if (challenge.status === "RUNNING") {
    const currentRunMilliseconds = Math.max(
      0,
      serverMilliseconds - challenge.lastStartedAt.getTime(),
    );

    actualElapsedMilliseconds = Math.min(
      goalMilliseconds,
      actualElapsedMilliseconds + currentRunMilliseconds,
    );
  }

  const remainingMilliseconds = Math.max(
    0,
    goalMilliseconds - actualElapsedMilliseconds,
  );

  return {
    elapsedSeconds: Math.floor(actualElapsedMilliseconds / 1000),
    remainingSeconds: Math.ceil(remainingMilliseconds / 1000),
    serverTime: serverTime.toISOString(),
    endsAt:
      challenge.status === "RUNNING"
        ? new Date(serverMilliseconds + remainingMilliseconds).toISOString()
        : null,
  };
};
