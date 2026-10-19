import assert from "node:assert/strict";
import { isValidStudyPassword } from "../src/utils/studyPassword.js";

// 형식 검사만 실행한다. 서버·DB·환경변수에는 접근하지 않는다.
for (const value of ["abcd", "AB12", "a!@#", "!@#$%^&*", "A".repeat(20)]) {
  assert.equal(isValidStudyPassword(value), true);
}
for (const value of [
  undefined, null, 1234, {}, [], "", "abc", "A".repeat(21),
  " abcd", "abcd ", "ab cd", "ab\tcd", "abcd\n", "ab\rcd",
  "ab\u00a0cd", "ab\u3000cd", "ab\u200bcd", "한글비번", "abcd🙂",
  "abcd_", "abcd-", "abcd.",
]) {
  assert.equal(isValidStudyPassword(value), false);
}

console.log("비밀번호 형식 검사 성공: 4~20자·허용 문자·공백/줄바꿈/붙여넣기 원문 거절");
