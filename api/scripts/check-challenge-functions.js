import assert from "node:assert/strict";
import { validateStartChallenge, validateChallengeStudyId } from "../src/schemas/challenge.js";
import { calculateChallengeTime } from "../src/utils/challenge-time.js";
import { buildChallengeResponse } from "../src/utils/challenge-response.js";

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

console.log("집중 입력·시간 경계·정지 시간·응답 필드 검사 성공");
