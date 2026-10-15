import { calculateChallengeTime } from "./challengeTime.js";

export const buildChallengeResponse = (challenge, serverTime = new Date()) => {
  if (challenge === null) {
    return null;
  }

  const time = calculateChallengeTime(challenge, serverTime);

  // DB 객체를 펼치지 않고 API 계약에 있는 필드만 반환한다.
  return {
    id: challenge.id,
    studyId: challenge.studyId,
    goalMinutes: challenge.goalMinutes,
    status: challenge.status,
    elapsedMilliseconds: challenge.elapsedMilliseconds,
    lastStartedAt:
      challenge.lastStartedAt === null
        ? null
        : challenge.lastStartedAt.toISOString(),
    awardedPoints: challenge.awardedPoints,
    createdAt: challenge.createdAt.toISOString(),
    elapsedSeconds: time.elapsedSeconds,
    remainingSeconds: time.remainingSeconds,
    serverTime: time.serverTime,
    endsAt: time.endsAt,
  };
};
