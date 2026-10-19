// 응답은 그대로 보존하고, 화면에 필요한 값만 만든다. 포인트는 항상 서버 총점이다.
export const buildChallengeSessionSnapshot = (data, receivedAt) => ({
  challenge: data.challenge?.status === "RESET" ? null : data.challenge,
  goalMinutes: data.goalMinutes ?? data.challenge?.goalMinutes ?? 10,
  points: data.points,
  receivedAt,
  settlement: data.settlement ?? null,
});
