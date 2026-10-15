import assert from "node:assert/strict";
import { checkChallengeCompletion } from "../src/utils/challengeCompletion.js";
import {
  calculateElapsedMilliseconds,
  calculateChallengeTime,
} from "../src/utils/challengeTime.js";
import { calculateChallengePoints } from "../src/utils/challengePoints.js";

// 고정 시각으로 계산 규칙만 검사한다. 환경변수·DB·서버를 사용하지 않는다.
// 실제 API의 중복 지급 방지·트랜잭션 롤백은 checkChallengeCompleteApi.js에서 검증한다.
const startedAt = new Date("2026-10-15T14:59:00.000Z");
let step = "목표 도달 경계";

const createChallenge = (overrides = {}) => ({
  goalMinutes: 10,
  status: "RUNNING",
  elapsedMilliseconds: 0,
  lastStartedAt: new Date(startedAt),
  awardedPoints: 0,
  ...overrides,
});

const inspectChallenge = (challenge, serverTime) => {
  const before = structuredClone(challenge);
  const elapsed = calculateElapsedMilliseconds(challenge, serverTime);
  const time = calculateChallengeTime(challenge, serverTime);
  const completion = checkChallengeCompletion(challenge, elapsed);
  assert.deepEqual(challenge, before, "계산으로 입력 데이터를 변경하면 안 됩니다.");
  return { elapsed, time, completion };
};

try {
  for (const goalMinutes of [10, 20, 25, 180]) {
    const goalMilliseconds = goalMinutes * 60000;
    const challenge = createChallenge({ goalMinutes });
    for (const offset of [-1, 0, 1]) {
      step = `${goalMinutes}분 목표 ${offset}ms 경계`;
      const serverTime = new Date(startedAt.getTime() + goalMilliseconds + offset);
      const result = inspectChallenge(challenge, serverTime);
      const reached = offset >= 0;
      assert.equal(result.elapsed, reached ? goalMilliseconds : goalMilliseconds - 1);
      assert.equal(result.time.elapsedSeconds, reached ? goalMinutes * 60 : goalMinutes * 60 - 1);
      assert.equal(result.time.remainingSeconds, reached ? 0 : 1);
      assert.equal(result.time.serverTime, serverTime.toISOString());
      assert.deepEqual(result.completion, {
        canComplete: reached,
        isAlreadyCompleted: false,
        errorCode: reached ? null : "CHALLENGE_NOT_FINISHED",
      });
    }
  }

  step = "누적 경과와 현재 실행 구간 합산";
  const resumed = createChallenge({ elapsedMilliseconds: 123456 });
  const cumulative = inspectChallenge(resumed, new Date(startedAt.getTime() + 234567));
  assert.equal(cumulative.elapsed, 358023);
  assert.equal(cumulative.time.elapsedSeconds, 358);
  assert.equal(cumulative.time.remainingSeconds, 242);
  assert.equal(cumulative.time.endsAt, new Date(startedAt.getTime() + 476544).toISOString());
  assert.equal(cumulative.completion.errorCode, "CHALLENGE_NOT_FINISHED");
  for (const offset of [-1, 0]) {
    const result = inspectChallenge(resumed, new Date(startedAt.getTime() + 476544 + offset));
    assert.equal(result.elapsed, 600000 + offset);
    assert.equal(result.completion.canComplete, offset === 0);
  }

  step = "시작 시각보다 이른 서버 시각";
  const earlier = inspectChallenge(resumed, new Date(startedAt.getTime() - 1000));
  assert.equal(earlier.elapsed, 123456);
  assert.equal(earlier.completion.errorCode, "CHALLENGE_NOT_FINISHED");

  step = "한국 시각 자정을 지나도 경과 유지";
  const afterMidnight = inspectChallenge(createChallenge(), new Date("2026-10-15T15:01:00.000Z"));
  assert.equal(afterMidnight.elapsed, 120000);
  assert.equal(afterMidnight.time.remainingSeconds, 480);
  assert.equal(afterMidnight.completion.errorCode, "CHALLENGE_NOT_FINISHED");

  step = "PAUSED는 대기 시간과 관계없이 저장된 경과로 판정";
  const muchLater = new Date(startedAt.getTime() + 86400000);
  for (const elapsedMilliseconds of [599999, 600000]) {
    const paused = createChallenge({
      status: "PAUSED",
      elapsedMilliseconds,
      lastStartedAt: null,
    });
    const result = inspectChallenge(paused, muchLater);
    assert.equal(result.elapsed, elapsedMilliseconds);
    assert.equal(result.time.endsAt, null);
    assert.deepEqual(result.completion, {
      canComplete: elapsedMilliseconds === 600000,
      isAlreadyCompleted: false,
      errorCode: elapsedMilliseconds === 600000 ? null : "CHALLENGE_NOT_FINISHED",
    });
  }

  step = "RESET 완료 거절";
  const reset = inspectChallenge(createChallenge({ status: "RESET", lastStartedAt: null }), muchLater);
  assert.deepEqual(reset.completion, {
    canComplete: false,
    isAlreadyCompleted: false,
    errorCode: "INVALID_CHALLENGE_STATE",
  });

  step = "COMPLETED 재요청 판정과 기존 지급량 보존";
  const completed = createChallenge({
    status: "COMPLETED",
    elapsedMilliseconds: 600000,
    lastStartedAt: null,
    awardedPoints: 4,
  });
  const repeated = inspectChallenge(completed, muchLater);
  assert.deepEqual(repeated.completion, {
    canComplete: false,
    isAlreadyCompleted: true,
    errorCode: null,
  });
  assert.equal(completed.awardedPoints, 4);

  step = "최초 완료 지급량";
  for (const [goalMinutes, elapsedPoints, awardedPoints] of [
    [10, 1, 4],
    [20, 2, 5],
    [25, 2, 5],
    [180, 18, 21],
  ]) {
    assert.deepEqual(calculateChallengePoints(goalMinutes), {
      elapsedPoints,
      goalPoints: 3,
      awardedPoints,
    });
  }

  console.log("완료 규칙 검사 성공: 목표 ±1ms·누적 경과·PAUSED·RESET·완료 재요청 판정·지급량. DB 연결 없음");
} catch (error) {
  console.error(`완료 규칙 검사 실패: ${step}`);
  console.error(error);
  process.exitCode = 1;
}
