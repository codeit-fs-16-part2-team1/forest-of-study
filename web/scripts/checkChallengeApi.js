import assert from "node:assert/strict";
import { createChallengeApi } from "../src/api/challengeApi.js";

// 모의 클라이언트만 사용한다. 서버·DB·환경변수에 접근하지 않는다.
const calls = [];
const payload = Object.freeze({
  challenge: null,
  points: 310,
  goalMinutes: 10,
  serverTime: "2026-10-16T01:00:00.000Z",
});
const client = {
  defaults: { headers: { common: { Accept: "application/json" } } },
  get: async (url, config) => {
    calls.push({ method: "GET", url, config });
    return { data: { data: payload } };
  },
  post: async (url, body, config) => {
    calls.push({ method: "POST", url, body, config });
    return { data: { data: payload } };
  },
};

const api = createChallengeApi(client);
const params = Object.freeze({
  studyId: "11111111-1111-4111-8111-111111111111",
  challengeId: "22222222-2222-4222-8222-222222222222",
  // 전송 전 trim하지 않는지 확인하기 위한 모의 입력이다.
  password: " fixture value ",
});
const prefix = `/studies/${params.studyId}/challenges`;

assert.equal(await api.getCurrentChallenge(params), payload);
assert.equal(await api.startChallenge({ ...params, goalMinutes: 25 }), payload);
for (const method of ["pause", "resume", "reset", "complete"]) {
  assert.equal(await api[`${method}Challenge`](params), payload);
}

assert.equal(calls.length, 6);
assert.equal(calls[0].method, "GET");
assert.equal(calls[0].url, `${prefix}/current`);
assert.equal(calls[1].method, "POST");
assert.equal(calls[1].url, prefix);
assert.deepEqual(calls[1].body, { goalMinutes: 25 });
for (const [index, action] of ["pause", "resume", "reset", "complete"].entries()) {
  const call = calls[index + 2];
  assert.equal(call.method, "POST");
  assert.equal(call.url, `${prefix}/${params.challengeId}/${action}`);
  assert.equal(call.body, undefined);
}
for (const call of calls) {
  assert.deepEqual(call.config, { headers: { "X-Study-Password": params.password } });
}

await api.getCurrentChallenge({ ...params, password: "other-fixture" });
assert.equal(calls[0].config.headers["X-Study-Password"], params.password);
assert.equal(calls.at(-1).config.headers["X-Study-Password"], "other-fixture");
assert.deepEqual(client.defaults.headers.common, { Accept: "application/json" });

// 실패를 성공값으로 바꾸거나 변경 요청을 자동 재시도하지 않는다.
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
    post: async () => {
      requestCount += 1;
      throw expectedError;
    },
  });

  await assert.rejects(failingApi.completeChallenge(params), (error) => error === expectedError);
  assert.equal(requestCount, 1);
}

console.log("집중 API 모의 검사 성공: 경로·보호 헤더·본문·응답·오류 전달·자동 재시도 없음");
