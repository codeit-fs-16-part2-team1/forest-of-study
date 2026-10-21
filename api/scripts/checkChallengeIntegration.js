import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcrypt";
import { assertLocalDatabase } from "./localDatabase.js";
import { uuidSchema } from "../src/utils/uuid.js";

// 별도 터미널에서 실행한 app.js와 같은 로컬 DB를 사용한다.
// DB 일치 확인용 임시 스터디 외에는 생성 API로 만들고, 이번 실행의 데이터만 삭제한다.
// --preflight는 주소 검사만 수행하며 서버·DB에 연결하지 않는다.
// --complete를 붙이면 실제 10분 후 완료·상세 총점·재요청·목표 복원도 확인한다.
const fixtureKey = randomBytes(6).toString("hex");
let prisma;
let probeStudyId;
let studyId;
let createdStudyId;
let step = "로컬 서버 포트 확인";
const marker = `집중 통합 검증 ${randomUUID()}`;

const runChecks = async () => {
  const args = process.argv.slice(2);
  const completeMode = args.includes("--complete");
  assert.equal(args.filter((arg) => arg === "--complete").length <= 1, true);
  assert.equal(args.filter((arg) => arg === "--preflight").length <= 1, true);
  const portArgs = args.filter((arg) => arg !== "--complete" && arg !== "--preflight");
  assert.equal(portArgs.length <= 1, true);
  const portInput = portArgs[0] ?? "3000";
  assert.match(portInput, /^\d+$/);
  const port = Number(portInput);
  assert.equal(Number.isInteger(port) && port >= 1 && port <= 65535, true);
  step = "로컬 DB 주소 확인";
  await assertLocalDatabase();
  if (args.includes("--preflight")) {
    console.log("통합 검증 사전 확인 성공: DB·서버 연결과 데이터 변경 없음");
    return;
  }
  ({ prisma } = await import("../src/lib/prisma.js"));
  const goalMinutes = completeMode ? 10 : 25;
  const goalMilliseconds = goalMinutes * 60000;
  const baseUrl = `http://127.0.0.1:${port}/api/studies`;
  const password = randomBytes(8).toString("hex");
  const wrongPassword = (password[0] === "a" ? "b" : "a") + password.slice(1);
  const spacedPassword = password.slice(0, 4) + " \t\n" + password.slice(4);
  const secrets = [password, wrongPassword, spacedPassword];

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
    assert.equal(challenge.goalMinutes, goalMinutes);
    assert.equal(challenge.elapsedMilliseconds, 0);
    assert.equal(challenge.awardedPoints, 0);
    const startedAt = Date.parse(challenge.lastStartedAt);
    const serverTime = Date.parse(challenge.serverTime);
    assert.equal(Number.isFinite(startedAt) && Number.isFinite(serverTime), true);
    const elapsed = Math.min(goalMilliseconds, Math.max(0, serverTime - startedAt));
    assert.equal(challenge.elapsedSeconds, Math.floor(elapsed / 1000));
    assert.equal(challenge.remainingSeconds, Math.ceil((goalMilliseconds - elapsed) / 1000));
    assert.equal(challenge.endsAt, new Date(serverTime + goalMilliseconds - elapsed).toISOString());
    assert.equal(Number.isFinite(Date.parse(challenge.createdAt)), true);
  };

  step = "변경 요청 전 서버와 로컬 DB 일치 확인";
  const probeHash = await bcrypt.hash(password, 12);
  secrets.push(probeHash);
  const probeStudy = await prisma.study.create({
    data: { nickname: "DB확인", name: "확인" + fixtureKey, introduction: marker, passwordHash: probeHash },
    select: { id: true },
  });
  probeStudyId = probeStudy.id;
  // 로컬 DB에 만든 임시 대상을 서버의 공개 GET으로 읽는다. 일치 전에는 POST하지 않는다.
  const probeResponse = await request({ path: "/" + probeStudyId });
  assert.equal(probeResponse.status, 200);
  assert.equal(probeResponse.body.data.id, probeStudyId);
  assert.equal(probeResponse.body.data.introduction, marker);
  await prisma.study.delete({ where: { id: probeStudyId } });
  probeStudyId = undefined;

  step = "스터디 생성의 공백 포함 비밀번호 거절";
  for (const input of [
    { password: spacedPassword, passwordConfirm: password },
    { password, passwordConfirm: spacedPassword },
  ]) {
    expectError(await request({ method: "POST", body: {
      nickname: "집중검증", name: "검증" + fixtureKey, introduction: marker, ...input,
    } }), 400, "VALIDATION_ERROR");
  }

  step = "API-ST-02 실제 스터디 생성 201";
  const created = await request({
    method: "POST",
    body: {
      nickname: "집중검증",
      name: "검증" + fixtureKey,
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
    "backgroundColor", "backgroundKey", "createdAt", "id", "introduction", "name", "nickname", "points", "textColor", "updatedAt",
  ].sort());
  assert.equal(created.body.data.points, 0);

  step = "API-ST-03 생성한 스터디 상세 200";
  const detail = await request({ path: `/${studyId}` });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.id, studyId);
  assert.equal(detail.body.data.points, 0);
  assert.deepEqual(detail.body.data.reactions, []);

  step = "목록 기본값·검색·지원하지 않는 쿼리";
  const listed = await request({ path: "?keyword=" + encodeURIComponent(marker) });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.some((study) => study.id === studyId), true);
  assert.equal(listed.body.pagination.offset, 0);
  assert.equal(listed.body.pagination.limit, 6);
  expectError(await request({ path: "?limit=7" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "?limti=10" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "/" + studyId + "?extra=1" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "?extra=1", method: "POST", body: {} }), 400, "VALIDATION_ERROR");
  expectError(await request({
    path: "/" + studyId + "/password-verifications?extra=1", method: "POST",
    body: { password }, protectedRequest: true,
  }), 400, "VALIDATION_ERROR");

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
    expectError(await focusRequest({ ...options, header: "bad?password" }), 400, "VALIDATION_ERROR");
    expectError(await focusRequest({ ...options, id: "invalid-id" }), 400, "VALIDATION_ERROR");
    expectError(await focusRequest({ ...options, id: randomUUID() }), 404, "STUDY_NOT_FOUND");
  }

  step = "집중 API의 미등록 쿼리 거절";
  expectError(await focusRequest({ path: "/current?extra=1" }), 400, "VALIDATION_ERROR");
  expectError(await focusRequest({ path: "?extra=1", method: "POST", body: {} }), 400, "VALIDATION_ERROR");
  for (const action of ["pause", "resume", "reset", "complete"]) {
    expectError(await focusRequest({
      path: "/" + randomUUID() + "/" + action + "?extra=1", method: "POST",
    }), 400, "VALIDATION_ERROR");
  }

  step = "습관 생성·오늘 목록·체크·주간 기록 연결";
  const routinePath = "/" + studyId + "/routines";
  const createdRoutine = await request({
    path: routinePath, method: "POST", body: { name: " 독서 " },
    header: password, protectedRequest: true,
  });
  assert.equal(createdRoutine.status, 201);
  assert.equal(createdRoutine.body.data.name, "독서");
  const routineId = createdRoutine.body.data.id;
  const today = await request({ path: routinePath, header: password, protectedRequest: true });
  assert.equal(today.status, 200);
  assert.equal(today.body.data.routines.some((routine) => routine.id === routineId), true);
  const recordDate = today.body.data.recordDate;
  const checked = await request({
    path: routinePath + "/" + routineId + "/check", method: "PUT",
    body: { recordDate, completed: true }, header: password, protectedRequest: true,
  });
  assert.equal(checked.status, 200);
  assert.deepEqual(checked.body.data, { routineId, recordDate, completed: true });
  const weekly = await request({ path: "/" + studyId + "/routine-histories?weekStart=" + recordDate });
  assert.equal(weekly.status, 200);
  const weeklyRoutine = weekly.body.data.routines.find((routine) => routine.id === routineId);
  assert.notEqual(weeklyRoutine, undefined);
  assert.equal(weeklyRoutine.cells.find((cell) => cell.recordDate === recordDate).completed, true);
  expectError(await request({
    path: routinePath, method: "POST", body: { name: "   " }, header: password, protectedRequest: true,
  }), 400, "VALIDATION_ERROR");
  expectError(await request({
    path: routinePath + "?extra=1", header: password, protectedRequest: true,
  }), 400, "VALIDATION_ERROR");

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
  // 완료 검증 모드에서는 목표를 생략해 기본 10분 적용도 확인한다.
  const startBody = completeMode ? {} : { goalMinutes };
  const results = await Promise.allSettled([
    focusRequest({ method: "POST", body: startBody }),
    focusRequest({ method: "POST", body: startBody }),
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
    assert.equal(current.body.data.goalMinutes, goalMinutes);
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
  console.log("스터디·습관·집중 통합 검증 성공: 생성·목록·상세·공백 거절·쿼리 거절·체크·주간 기록·동시 시작·DB 불변");

  if (completeMode) {
    const challengeId = before.id;
    const complete = (options = {}) => focusRequest({
      path: `/${challengeId}/complete`, method: "POST", ...options,
    });
    const expectCompleted = (response) => {
      assert.equal(response.status, 200);
      assert.deepEqual(Object.keys(response.body), ["data"]);
      assert.deepEqual(Object.keys(response.body.data).sort(), ["challenge", "points", "settlement"]);
      const challenge = response.body.data.challenge;
      assert.deepEqual(Object.keys(challenge).sort(), Object.keys(started.body.data.challenge).sort());
      assert.equal(challenge.id, challengeId);
      assert.equal(challenge.studyId, studyId);
      assert.equal(challenge.status, "COMPLETED");
      assert.equal(challenge.goalMinutes, 10);
      assert.equal(challenge.elapsedMilliseconds, 600000);
      assert.equal(challenge.elapsedSeconds, 600);
      assert.equal(challenge.remainingSeconds, 0);
      assert.equal(challenge.lastStartedAt, null);
      assert.equal(challenge.endsAt, null);
      assert.equal(challenge.awardedPoints, 4);
      assert.equal(challenge.createdAt, started.body.data.challenge.createdAt);
      assert.equal(response.body.data.points, 4);
    };

    step = "API-FC-06 실제 서버 인증·본문·목표 미달 거절";
    expectError(await complete({ header: null }), 401, "VERIFICATION_REQUIRED");
    expectError(await complete({ header: wrongPassword }), 401, "PASSWORD_MISMATCH");
    expectError(await complete({ body: {} }), 400, "VALIDATION_ERROR");
    expectError(await complete(), 409, "CHALLENGE_NOT_FINISHED");
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } }), before);

    step = "실제 10분 목표 시간 대기";
    // DB 시각·누적 경과는 바꾸지 않는다. 응답의 시작 시각부터 실제로 기다린다.
    const deadline = Date.parse(started.body.data.challenge.lastStartedAt) + goalMilliseconds;
    while (Date.now() < deadline + 100) {
      const remaining = deadline + 100 - Date.now();
      console.log(`실제 서버 완료 검증 대기: 약 ${Math.ceil(remaining / 60000)}분 남음`);
      await delay(Math.max(1, Math.min(remaining, 30000)));
    }

    step = "목표 도달 조회 200·완료 전 무지급·새 시작 409";
    const reached = await focusRequest({ path: "/current" });
    assert.equal(reached.status, 200);
    expectChallenge(reached.body.data.challenge);
    assert.equal(reached.body.data.challenge.id, challengeId);
    assert.equal(reached.body.data.challenge.remainingSeconds, 0);
    assert.equal(reached.body.data.points, 0);
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } }), before);
    const unpaidDetail = await request({ path: `/${studyId}` });
    assert.equal(unpaidDetail.status, 200);
    assert.equal(unpaidDetail.body.data.points, 0);
    expectError(await focusRequest({ method: "POST", body: {} }), 409, "CHALLENGE_CONFLICT");

    step = "API-FC-06 동시 완료 200·한 번만 4P 지급";
    const completionResults = await Promise.allSettled([complete(), complete()]);
    assert.equal(completionResults.every((result) => result.status === "fulfilled"), true);
    const completions = completionResults.map((result) => result.value);
    for (const response of completions) {
      expectCompleted(response);
      const award = response.body.data.settlement.awardedPoints;
      assert.equal(award === 0 || award === 4, true);
      assert.deepEqual(response.body.data.settlement, {
        challengeId,
        elapsedPoints: award === 0 ? 0 : 1,
        goalPoints: award === 0 ? 0 : 3,
        awardedPoints: award,
      });
    }
    assert.deepEqual(completions.map((response) => response.body.data.settlement.awardedPoints).sort(), [0, 4]);

    step = "API-ST-03 완료 직후 상세 총점 4P";
    const paidDetail = await request({ path: `/${studyId}` });
    assert.equal(paidDetail.status, 200);
    assert.equal(paidDetail.body.data.id, studyId);
    assert.equal(paidDetail.body.data.points, 4);
    const completedRow = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
    assert.equal(completedRow.status, "COMPLETED");
    assert.equal(completedRow.awardedPoints, 4);

    step = "완료 재요청 200·신규 0P·상세 총점과 DB 불변";
    const repeated = await complete();
    expectCompleted(repeated);
    assert.deepEqual(repeated.body.data.settlement, {
      challengeId, elapsedPoints: 0, goalPoints: 0, awardedPoints: 0,
    });
    const repeatedDetail = await request({ path: `/${studyId}` });
    assert.equal(repeatedDetail.status, 200);
    assert.equal(repeatedDetail.body.data.points, 4);
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } }), completedRow);
    const sum = await prisma.challenge.aggregate({ where: { studyId }, _sum: { awardedPoints: true } });
    const paidStudy = await prisma.study.findUniqueOrThrow({ where: { id: studyId }, select: { points: true } });
    assert.equal(paidStudy.points, 4);
    assert.equal(sum._sum.awardedPoints, paidStudy.points);

    step = "API-FC-01 완료 후 목표 복원·새 시작 201";
    const restored = await focusRequest({ path: "/current" });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.challenge, null);
    assert.equal(restored.body.data.goalMinutes, 10);
    assert.equal(restored.body.data.points, 4);
    const restarted = await focusRequest({ method: "POST", body: {} });
    assert.equal(restarted.status, 201);
    expectChallenge(restarted.body.data.challenge);
    assert.notEqual(restarted.body.data.challenge.id, challengeId);
    assert.equal(restarted.body.data.points, 4);
    assert.equal(restarted.body.data.settlement, null);
    assert.equal(await prisma.challenge.count({ where: { studyId } }), 2);
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } }), completedRow);
    console.log("실제 서버 완료 통합 검증 성공: 실제 10분·완료4P·상세4P·동시/반복 지급 방지·목표 복원·새 시작");
  }
};

try {
  await runChecks();
} catch {
  console.error(`집중 통합 검증 실패: ${step}`);
  if (studyId === undefined && createdStudyId !== undefined) {
    console.error(`생성된 스터디의 DB 일치를 확인하지 못했습니다. 정리 필요 여부를 확인해주세요. ID: ${createdStudyId}`);
  }
  if (step === "로컬 DB 주소 확인") console.error("로컬 DB 전용 검증입니다. Neon은 허용하지 않습니다.");
  process.exitCode = 1;
} finally {
  if (probeStudyId !== undefined) {
    try {
      await prisma.study.delete({ where: { id: probeStudyId } });
    } catch {
      console.error(`DB 확인용 임시 스터디 정리 실패. ID: ${probeStudyId}`);
      process.exitCode = 1;
    }
  }
  if (studyId !== undefined) {
    try {
      const deleted = await prisma.study.deleteMany({ where: { id: studyId, introduction: marker } });
      assert.equal(deleted.count, 1);
      assert.equal(await prisma.challenge.count({ where: { studyId } }), 0);
      console.log("이번 실행의 임시 스터디·습관·집중 정리 완료");
    } catch {
      console.error(`임시 데이터 정리 실패. 스터디 ID: ${studyId}`);
      process.exitCode = 1;
    }
  }
  if (prisma !== undefined) {
    try {
      await prisma.$disconnect();
    } catch {
      console.error("검증 스크립트의 DB 연결 종료 실패");
      process.exitCode = 1;
    }
  }
}
