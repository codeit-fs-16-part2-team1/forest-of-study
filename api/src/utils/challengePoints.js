// 검증된 목표 시간으로 최초 완료 지급량을 계산한다. DB 저장과 완료 검증은 서비스에서 처리한다.
export const calculateChallengePoints = (goalMinutes) => {
  const elapsedPoints = Math.floor(goalMinutes / 10);
  const goalPoints = 3;

  return {
    elapsedPoints,
    goalPoints,
    awardedPoints: elapsedPoints + goalPoints,
  };
};
