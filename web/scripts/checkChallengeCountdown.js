import assert from "node:assert/strict";
import { calculateChallengeRemainingSeconds } from "../src/utils/challengeCountdown.js";

const running = Object.freeze({
  status: "RUNNING",
  remainingSeconds: 600,
  serverTime: "2026-10-16T01:00:00.000Z",
  endsAt: "2026-10-16T01:10:00.000Z",
});

assert.equal(calculateChallengeRemainingSeconds(running), 600);
assert.equal(calculateChallengeRemainingSeconds(running, 250), 600);
assert.equal(calculateChallengeRemainingSeconds(running, 1250), 599);
// 콜백이 늦게 실행돼도 실제로 흐른 시간을 한 번에 반영한다.
assert.equal(calculateChallengeRemainingSeconds(running, 12500), 588);
assert.equal(calculateChallengeRemainingSeconds(running, 600000), 0);
assert.equal(calculateChallengeRemainingSeconds(running, 700000), 0);
assert.equal(calculateChallengeRemainingSeconds(running, -1000), 600);

const paused = { ...running, status: "PAUSED", remainingSeconds: 522, endsAt: null };
assert.equal(calculateChallengeRemainingSeconds(paused, 120000), 522);
assert.equal(calculateChallengeRemainingSeconds({ ...paused, remainingSeconds: 0 }), 0);
assert.equal(calculateChallengeRemainingSeconds({ ...paused, remainingSeconds: NaN }), null);
assert.equal(calculateChallengeRemainingSeconds({ status: "COMPLETED" }), 0);
assert.equal(calculateChallengeRemainingSeconds(null), null);
assert.equal(calculateChallengeRemainingSeconds({ status: "RESET" }), null);
assert.equal(calculateChallengeRemainingSeconds({ ...running, serverTime: "invalid" }), null);
assert.equal(calculateChallengeRemainingSeconds({ ...running, endsAt: null }), null);
assert.equal(calculateChallengeRemainingSeconds(running, NaN), null);
assert.equal(running.status, "RUNNING");
assert.equal(running.remainingSeconds, 600);

console.log("집중 시간 계산 검사 성공: 올림·지연 반영·정지 유지·0초 제한·잘못된 시각 처리");
