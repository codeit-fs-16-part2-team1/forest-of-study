import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";
import { uuidSchema } from "../src/utils/uuid.js";

// 별도 터미널에서 실행한 app.js와 같은 로컬 DB를 사용한다.
// 스터디는 생성 API로 만들고, 이번 실행에서 만든 데이터만 마지막에 삭제한다.
// 완료·지급 검증은 ISS-018에서 실제 목표 시간이 지난 뒤 진행한다.
let studyId;
let createdStudyId;
let step = "로컬 서버 포트 확인";
const marker = `집중 통합 검증 ${randomUUID()}`;

try {
  const portInput = process.argv[2] ?? "3000";
  assert.match(portInput, /^\d+$/);
  const port = Number(portInput);
  assert.equal(Number.isInteger(port) && port >= 1 && port <= 65535, true);
  const baseUrl = `http://127.0.0.1:${port}/api/studies`;
  const password = randomBytes(8).toString("hex");
  const wrongPassword = (password[0] === "a" ? "b" : "a") + password.slice(1);
  const secrets = [password, wrongPassword];

  const request = async ({ path = "", method = "GET", body, header, protectedRequest = false }) => {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (header !== undefined && header !== null) headers["X-Study-Password"] = header;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    assert.equal(secrets.some((secret) => text.includes(secret)), false);
    assert.equal(/"(?:password|passwordConfirm|passwordHash)"\s*:/.test(text), false);
    if (protectedRequest || response.status >= 400) {
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    return { status: response.status, body: JSON.parse(text) };
  };

  const expectError = (response, status, code) => {
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(response.body), ["error"]);
    assert.deepEqual(Object.keys(response.body.error).sort(), ["code", "details", "message"]);
    assert.equal(response.body.error.code, code);
    assert.equal(typeof response.body.error.message, "string");
    assert.equal(response.body.error.details, null);
  };

  const focusRequest = ({ id = studyId, path = "", header = password, ...options } = {}) =>
    request({ ...options, path: `/${id}/challenges${path}`, header, protectedRequest: true });

  const expectChallenge = (challenge) => {
    assert.deepEqual(Object.keys(challenge).sort(), [
      "awardedPoints", "createdAt", "elapsedMilliseconds", "elapsedSeconds",
      "endsAt", "goalMinutes", "id", "lastStartedAt", "remainingSeconds",
      "serverTime", "status", "studyId",
    ].sort());
    assert.equal(uuidSchema.safeParse(challenge.id).success, true);
    assert.equal(challenge.studyId, studyId);
    assert.equal(challenge.status, "RUNNING");
    assert.equal(challenge.goalMinutes, 25);
    assert.equal(challenge.elapsedMilliseconds, 0);
    assert.equal(challenge.awardedPoints, 0);
    const startedAt = Date.parse(challenge.lastStartedAt);
    const serverTime = Date.parse(challenge.serverTime);
    assert.equal(Number.isFinite(startedAt) && Number.isFinite(serverTime), true);
    const elapsed = Math.min(25 * 60000, Math.max(0, serverTime - startedAt));
    assert.equal(challenge.elapsedSeconds, Math.floor(elapsed / 1000));
    assert.equal(challenge.remainingSeconds, Math.ceil((25 * 60000 - elapsed) / 1000));
    assert.equal(challenge.endsAt, new Date(serverTime + 25 * 60000 - elapsed).toISOString());
    assert.equal(Number.isFinite(Date.parse(challenge.createdAt)), true);
  };

  step = "API-ST-02 실제 스터디 생성 201";
  const created = await request({
    method: "POST",
    body: {
      nickname: "집중검증",
      name: "집중 통합 검증",
      introduction: marker,
      password,
      passwordConfirm: password,
    },
  });
  if (uuidSchema.safeParse(created.body?.data?.id).success) {
    createdStudyId = created.body.data.id;
  }
  assert.equal(created.status, 201);
  assert.notEqual(createdStudyId, undefined);

  step = "서버와 검증 스크립트의 DB 일치·정리 대상 확인";
  const ownedStudy = await prisma.study.findUnique({ where: { id: createdStudyId } });
  assert.notEqual(ownedStudy, null);
  assert.equal(ownedStudy.introduction, marker);
  assert.equal(await bcrypt.compare(password, ownedStudy.passwordHash), true);
  studyId = ownedStudy.id;
  secrets.push(ownedStudy.passwordHash);
  assert.equal(ownedStudy.points, 0);
  assert.deepEqual(Object.keys(created.body), ["data"]);
  assert.deepEqual(Object.keys(created.body.data).sort(), [
    "backgroundKey", "createdAt", "id", "introduction", "name", "nickname", "points", "updatedAt",
  ].sort());
  assert.equal(created.body.data.points, 0);

  step = "API-ST-03 생성한 스터디 상세 200";
  const detail = await request({ path: `/${studyId}` });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.id, studyId);
  assert.equal(detail.body.data.points, 0);
  assert.deepEqual(detail.body.data.reactions, []);

  step = "API-AU-01 진입 인증 200·보호 요청의 헤더 재검증";
  const verified = await request({
    path: `/${studyId}/password-verifications`, method: "POST",
    body: { password }, protectedRequest: true,
  });
  assert.equal(verified.status, 200);
  assert.deepEqual(verified.body, { data: { verified: true } });
  // 진입 인증 성공으로 후속 요청의 비밀번호 검증이 생략되면 안 된다.
  for (const options of [{ path: "/current" }, { method: "POST", body: {} }]) {
    expectError(await focusRequest({ ...options, header: null }), 401, "VERIFICATION_REQUIRED");
    expectError(await focusRequest({ ...options, header: wrongPassword }), 401, "PASSWORD_MISMATCH");
    expectError(await focusRequest({ ...options, header: "bad password" }), 400, "VALIDATION_ERROR");
    expectError(await focusRequest({ ...options, id: "invalid-id" }), 400, "VALIDATION_ERROR");
    expectError(await focusRequest({ ...options, id: randomUUID() }), 404, "STUDY_NOT_FOUND");
  }

  step = "API-FC-02 잘못된 목표·추가 필드 거절 400";
  for (const body of [
    { goalMinutes: 9 }, { goalMinutes: 181 }, { goalMinutes: 10.5 },
    { goalMinutes: "25" }, { goalMinutes: null },
    { goalMinutes: 25, points: 100 }, [],
  ]) {
    expectError(await focusRequest({ method: "POST", body }), 400, "VALIDATION_ERROR");
  }
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 0);

  step = "API-FC-01 이력 없는 조회 200·기본 목표 10분";
  const initial = await focusRequest({ path: "/current" });
  assert.equal(initial.status, 200);
  assert.deepEqual(Object.keys(initial.body.data).sort(), ["challenge", "goalMinutes", "points", "serverTime"]);
  assert.equal(initial.body.data.challenge, null);
  assert.equal(initial.body.data.goalMinutes, 10);
  assert.equal(initial.body.data.points, 0);
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 0);

  step = "API-FC-02 동시 시작 요청 201 한 번·409 한 번";
  const results = await Promise.allSettled([
    focusRequest({ method: "POST", body: { goalMinutes: 25 } }),
    focusRequest({ method: "POST", body: { goalMinutes: 25 } }),
  ]);
  assert.equal(results.every((result) => result.status === "fulfilled"), true);
  const responses = results.map((result) => result.value);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const started = responses.find((response) => response.status === 201);
  expectError(responses.find((response) => response.status === 409), 409, "CHALLENGE_CONFLICT");
  assert.deepEqual(Object.keys(started.body.data).sort(), ["challenge", "points", "settlement"]);
  expectChallenge(started.body.data.challenge);
  assert.equal(started.body.data.points, 0);
  assert.equal(started.body.data.settlement, null);
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 1);

  step = "API-FC-01 반복 조회 200·서버 시간 계산·DB 불변";
  const before = await prisma.challenge.findUniqueOrThrow({ where: { id: started.body.data.challenge.id } });
  await delay(1100);
  for (let index = 0; index < 2; index += 1) {
    const current = await focusRequest({ path: "/current" });
    assert.equal(current.status, 200);
    expectChallenge(current.body.data.challenge);
    assert.equal(current.body.data.challenge.id, before.id);
    assert.equal(current.body.data.challenge.serverTime, current.body.data.serverTime);
    assert.equal(current.body.data.goalMinutes, 25);
    assert.equal(current.body.data.points, 0);
  }
  const after = await prisma.challenge.findUniqueOrThrow({ where: { id: before.id } });
  assert.deepEqual(after, before);

  step = "활성 집중 재시작 409·상세 포인트 무지급 확인";
  expectError(await focusRequest({ method: "POST", body: {} }), 409, "CHALLENGE_CONFLICT");
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 1);
  const finalDetail = await request({ path: `/${studyId}` });
  assert.equal(finalDetail.status, 200);
  assert.equal(finalDetail.body.data.points, 0);
  const finalStudy = await prisma.study.findUniqueOrThrow({ where: { id: studyId }, select: { points: true } });
  assert.equal(finalStudy.points, 0);
  console.log("집중 통합 검증 성공: 실제 서버·스터디 생성·인증·동시 시작201/409·조회200·DB 불변·무지급");
} catch {
  console.error(`집중 통합 검증 실패: ${step}`);
  if (studyId === undefined && createdStudyId !== undefined) {
    console.error(`생성된 스터디의 DB 일치를 확인하지 못했습니다. 정리 필요 여부를 확인해주세요. ID: ${createdStudyId}`);
  }
  process.exitCode = 1;
} finally {
  if (studyId !== undefined) {
    try {
      const deleted = await prisma.study.deleteMany({ where: { id: studyId, introduction: marker } });
      assert.equal(deleted.count, 1);
      assert.equal(await prisma.challenge.count({ where: { studyId } }), 0);
      console.log("이번 실행의 임시 스터디·집중 정리 완료");
    } catch {
      console.error(`임시 데이터 정리 실패. 스터디 ID: ${studyId}`);
      process.exitCode = 1;
    }
  }
  try {
    await prisma.$disconnect();
  } catch {
    console.error("검증 스크립트의 DB 연결 종료 실패");
    process.exitCode = 1;
  }
}
