import assert from "node:assert/strict";
import { createChallengeApi } from "../src/api/challengeApi.js";

// 공통 API 모듈의 반환 형태를 흉내 낸다. 서버·DB·환경변수에는 접근하지 않는다.
const calls = [];
const payload = Object.freeze({
  challenge: null,
  points: 310,
  goalMinutes: 10,
  serverTime: "2026-10-16T01:00:00.000Z",
});
const sharedRequests = Object.fromEntries(
  ["getCurrent", "start", "pause", "resume", "reset", "complete"].map((action) => [
    action,
    async (...args) => {
      calls.push({ action, args });
      return { data: payload };
    },
  ]),
);
const api = createChallengeApi(sharedRequests);
const params = Object.freeze({
  studyId: "11111111-1111-4111-8111-111111111111",
  challengeId: "22222222-2222-4222-8222-222222222222",
  // 전달받은 원문을 임의로 바꾸지 않는지 확인하는 모의 입력이다.
  password: " fixture value ",
});

assert.equal(await api.getCurrentChallenge(params), payload);
assert.equal(await api.startChallenge({ ...params, goalMinutes: 25 }), payload);
for (const action of ["pause", "resume", "reset", "complete"]) {
  assert.equal(await api[action + "Challenge"](params), payload);
}
assert.deepEqual(calls, [
  { action: "getCurrent", args: [params.studyId, params.password] },
  { action: "start", args: [params.studyId, 25, params.password] },
  ...["pause", "resume", "reset", "complete"].map((action) => ({
    action,
    args: [params.studyId, params.challengeId, params.password],
  })),
]);

await api.getCurrentChallenge({ ...params, password: "other-fixture" });
assert.equal(calls[0].args[1], params.password);
assert.equal(calls.at(-1).args[1], "other-fixture");

// 실패는 훅에서 처리하도록 전달한다. 어댑터가 변경 요청을 재시도하지 않는다.
for (const [status, code] of [
  [401, "PASSWORD_MISMATCH"],
  [409, "CHALLENGE_NOT_FINISHED"],
  [500, "INTERNAL_ERROR"],
]) {
  let requestCount = 0;
  const expectedError = Object.assign(new Error("모의 요청 실패"), {
    response: { status, data: { error: { code } } },
  });
  const failingApi = createChallengeApi({
    complete: async () => {
      requestCount += 1;
      throw expectedError;
    },
  });
  await assert.rejects(failingApi.completeChallenge(params), (error) => error === expectedError);
  assert.equal(requestCount, 1);
}

console.log("집중 API 어댑터 검사 성공: 공통 메서드 인자·응답·오류 전달·자동 재시도 없음");
