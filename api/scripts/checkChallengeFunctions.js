import assert from "node:assert/strict";
import { validateStartChallenge, validateChallengeStudyId } from "../src/schemas/challenge.js";
import { calculateChallengeTime } from "../src/utils/challengeTime.js";
import { buildChallengeResponse } from "../src/utils/challengeResponse.js";

const inputs = [
  [{}, true, 10],
  [{ goalMinutes: 10 }, true, 10],
  [{ goalMinutes: 180 }, true, 180],
  [{ goalMinutes: 9 }, false],
  [{ goalMinutes: 181 }, false],
  [{ goalMinutes: 10.5 }, false],
  [{ goalMinutes: "10" }, false],
  [{ goalMinutes: null }, false],
  [{ goalMinutes: 10, points: 100 }, false],
];

for (const [body, success, goalMinutes] of inputs) {
  const result = validateStartChallenge(body);
  assert.equal(result.success, success);
  if (success) assert.equal(result.data.goalMinutes, goalMinutes);
}

assert.equal(validateChallengeStudyId("11111111-1111-4111-8111-111111111111").success, true);
assert.equal(validateChallengeStudyId("invalid-id").success, false);

const startedAt = new Date("2026-10-13T00:00:00.000Z");
const challenge = {
  id: "11111111-1111-4111-8111-111111111111",
  studyId: "22222222-2222-4222-8222-222222222222",
  goalMinutes: 10,
  status: "RUNNING",
  elapsedMilliseconds: 0,
  lastStartedAt: startedAt,
  awardedPoints: 0,
  createdAt: startedAt,
  internalTestField: "response-exclusion-test",
};

const boundary = calculateChallengeTime(challenge, new Date(startedAt.getTime() + 599999));
assert.equal(boundary.elapsedSeconds, 599);
assert.equal(boundary.remainingSeconds, 1);
assert.equal(boundary.endsAt, "2026-10-13T00:10:00.000Z");

const exceeded = calculateChallengeTime(challenge, new Date(startedAt.getTime() + 660000));
assert.equal(exceeded.elapsedSeconds, 600);
assert.equal(exceeded.remainingSeconds, 0);

const paused = calculateChallengeTime(
  { ...challenge, status: "PAUSED", elapsedMilliseconds: 90000, lastStartedAt: null },
  new Date(startedAt.getTime() + 3600000),
);
assert.equal(paused.elapsedSeconds, 90);
assert.equal(paused.remainingSeconds, 510);
assert.equal(paused.endsAt, null);

const response = buildChallengeResponse(challenge, new Date(startedAt.getTime() + 1500));
assert.deepEqual(Object.keys(response).sort(), [
  "id", "studyId", "goalMinutes", "status", "elapsedMilliseconds", "lastStartedAt",
  "awardedPoints", "createdAt", "elapsedSeconds", "remainingSeconds", "serverTime", "endsAt",
].sort());
assert.equal(response.elapsedMilliseconds, 0);
assert.equal(response.elapsedSeconds, 1);
assert.equal(challenge.elapsedMilliseconds, 0);
assert.equal(buildChallengeResponse(null), null);

// 한국 자정은 집중의 경과나 상태를 초기화하지 않는다. 실제 대기 없는 계산 검사다.
const beforeMidnight = new Date("2026-10-15T23:59:59.500+09:00");
const afterMidnight = new Date("2026-10-16T00:00:00.500+09:00");
const acrossMidnight = {
  ...challenge,
  elapsedMilliseconds: 60000,
  lastStartedAt: beforeMidnight,
};
const originalAcrossMidnight = structuredClone(acrossMidnight);
const beforeDateChange = buildChallengeResponse(acrossMidnight, beforeMidnight);
const afterDateChange = buildChallengeResponse(acrossMidnight, afterMidnight);
assert.equal(beforeDateChange.elapsedSeconds, 60);
assert.equal(afterDateChange.elapsedSeconds, 61);
assert.equal(afterDateChange.remainingSeconds, 539);
assert.equal(afterDateChange.id, beforeDateChange.id);
assert.equal(afterDateChange.status, "RUNNING");
assert.equal(afterDateChange.endsAt, "2026-10-15T15:08:59.500Z");
assert.equal(afterDateChange.endsAt, beforeDateChange.endsAt);
assert.deepEqual(buildChallengeResponse(acrossMidnight, afterMidnight), afterDateChange);
assert.deepEqual(acrossMidnight, originalAcrossMidnight);

// 여러 번 조회한 결과를 저장 경과에 다시 가산하면 안 된다.
const afterRequestGap = buildChallengeResponse(
  acrossMidnight, new Date("2026-10-16T00:03:00.500+09:00"),
);
assert.equal(afterRequestGap.elapsedSeconds, 241);
assert.equal(afterRequestGap.remainingSeconds, 359);
assert.equal(afterRequestGap.endsAt, beforeDateChange.endsAt);
assert.deepEqual(acrossMidnight, originalAcrossMidnight);
const afterLongGap = buildChallengeResponse(
  acrossMidnight, new Date("2026-10-17T00:00:00.000+09:00"),
);
assert.equal(afterLongGap.elapsedSeconds, 600);
assert.equal(afterLongGap.remainingSeconds, 0);
assert.equal(afterLongGap.status, "RUNNING");
assert.equal(afterLongGap.awardedPoints, 0);
assert.deepEqual(acrossMidnight, originalAcrossMidnight);

const pausedAcrossMidnight = {
  ...acrossMidnight, status: "PAUSED", elapsedMilliseconds: 90000, lastStartedAt: null,
};
const originalPausedAcrossMidnight = structuredClone(pausedAcrossMidnight);
for (const time of [beforeMidnight, afterMidnight, new Date("2026-10-17T12:00:00+09:00")]) {
  const restored = buildChallengeResponse(pausedAcrossMidnight, time);
  assert.equal(restored.id, pausedAcrossMidnight.id);
  assert.equal(restored.status, "PAUSED");
  assert.equal(restored.elapsedSeconds, 90);
  assert.equal(restored.remainingSeconds, 510);
  assert.equal(restored.endsAt, null);
  assert.equal(restored.awardedPoints, 0);
}
assert.deepEqual(pausedAcrossMidnight, originalPausedAcrossMidnight);

console.log("집중 입력·시간 경계·정지 시간·자정/요청 공백 복원·원본 불변·응답 필드 검사 성공");
