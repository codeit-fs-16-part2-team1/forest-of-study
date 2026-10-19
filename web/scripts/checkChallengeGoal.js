import assert from "node:assert/strict";
import { isValidChallengeGoalMinutes, parseChallengeGoalMinutes } from "../src/utils/challengeGoal.js";

// 목표 입력의 경계값·잘못된 숫자 변환을 검사한다. 서버·DB에는 접근하지 않는다.
for (const minutes of [10, 25, 180]) {
  assert.equal(isValidChallengeGoalMinutes(minutes), true);
  assert.equal(parseChallengeGoalMinutes(String(minutes)), minutes);
}
for (const value of [undefined, null, "25", 0, 9, 181, 25.5, NaN, Infinity]) {
  assert.equal(isValidChallengeGoalMinutes(value), false);
}
for (const input of [undefined, null, 25, "", " ", "9", "181", "25.5", "1e2", "0x19", "25分", "25분", "+25", " 25", "25 ", "25\n", "２５"]) {
  assert.equal(parseChallengeGoalMinutes(input), null);
}

console.log("집중 목표 입력 검사 성공: 10~180분 정수·빈 값/소수/범위 밖 입력 거절");
