import assert from "node:assert/strict";
import { buildChallengeSessionSnapshot } from "../src/utils/challengeSession.js";

// 서버 응답을 화면 상태로 옮기는 규칙만 검사한다. React·서버·DB는 실행하지 않는다.
const readyData = Object.freeze({ challenge: null, goalMinutes: 25, points: 0 });
assert.deepEqual(buildChallengeSessionSnapshot(readyData, 100), {
  challenge: null, goalMinutes: 25, points: 0, receivedAt: 100, settlement: null,
});

const resetChallenge = Object.freeze({ id: "reset-fixture", status: "RESET", goalMinutes: 25 });
const resetData = Object.freeze({ challenge: resetChallenge, points: 310, settlement: null });
const resetSnapshot = buildChallengeSessionSnapshot(resetData, 200);
assert.equal(resetSnapshot.challenge, null);
assert.equal(resetSnapshot.goalMinutes, 25);
assert.equal(resetSnapshot.points, 310);
assert.equal(resetData.challenge.status, "RESET");

const completedChallenge = Object.freeze({
  id: "completed-fixture", status: "COMPLETED", goalMinutes: 25, awardedPoints: 5,
});
// 완료 재요청의 신규 지급은 0이어도 기존 지급량과 서버 총점은 유지한다.
const repeatedCompletion = Object.freeze({
  challenge: completedChallenge, points: 315,
  settlement: Object.freeze({
    challengeId: completedChallenge.id, elapsedPoints: 0, goalPoints: 0, awardedPoints: 0,
  }),
});
const completedSnapshot = buildChallengeSessionSnapshot(repeatedCompletion, 300);
assert.equal(completedSnapshot.challenge, completedChallenge);
assert.equal(completedSnapshot.challenge.awardedPoints, 5);
assert.equal(completedSnapshot.points, 315);
assert.equal(completedSnapshot.settlement, repeatedCompletion.settlement);
assert.equal(completedSnapshot.receivedAt, 300);
assert.equal(Object.hasOwn(repeatedCompletion, "receivedAt"), false);
assert.equal(buildChallengeSessionSnapshot({ challenge: null, points: 0 }, 400).goalMinutes, 10);

console.log("집중 화면 상태 규칙 검사 성공: 목표 복원·RESET 대기 표시·서버 총점 보존·응답 변경 없음");
