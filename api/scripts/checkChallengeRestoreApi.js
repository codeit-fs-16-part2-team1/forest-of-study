import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import bcrypt from "bcrypt";
import { uuidSchema } from "../src/utils/uuid.js";
import { assertLocalDatabase } from "./localDatabase.js";

// ISS-019: 로컬 DB와 실제 인증·집중 라우터를 임시 HTTP 서버에서 검사한다.
// --preflight: 주소 검사만 한다. --complete: 실제 10분 경과 후 완료·재요청까지 확인한다.
// 서버와 라우터를 다시 만들어 독립 HTTP 요청을 보낸다. 프로세스·브라우저 재시작 검사는 아니다.
// 경과·시작 시각을 DB로 조작하지 않는다. 이번 실행에서 만든 스터디만 정리한다.
const fixtureKey = randomBytes(6).toString("hex");
const marker = "집중 복원 검증 " + randomUUID();
const challengeFields = [
  "awardedPoints", "createdAt", "elapsedMilliseconds", "elapsedSeconds", "endsAt",
  "goalMinutes", "id", "lastStartedAt", "remainingSeconds", "serverTime", "status", "studyId",
].sort();
let prisma;
let server;
let studyId;
let step = "검증 인자 확인";

const closeServer = async () => {
  if (server === undefined) return;
  const closingServer = server;
  await new Promise((resolve, reject) => {
    closingServer.close((error) => error ? reject(error) : resolve());
    closingServer.closeIdleConnections();
  });
  server = undefined;
};

const runChecks = async () => {
  const args = process.argv.slice(2);
  assert.equal(args.length <= 1 && args.every((arg) => ["--preflight", "--complete"].includes(arg)), true);
  const completeMode = args.includes("--complete");
  step = "로컬 DB 주소 확인";
  await assertLocalDatabase();
  if (args.includes("--preflight")) {
    console.log("복원 검증 사전 확인 성공: 로컬 주소 허용. DB·서버 연결과 데이터 변경 없음");
    return;
  }

  step = "검증 모듈 준비";
  // Prisma를 직접 또는 간접 참조하는 모듈은 로컬 주소 검사 후에만 가져온다.
  ({ prisma } = await import("../src/lib/prisma.js"));
  const [startModule, changeModule, completeModule, serviceModule, entryModule, passwordModule, errorModule] = await Promise.all([
    import("../src/routes/challenge.js"),
    import("../src/routes/challengePauseResume.js"),
    import("../src/routes/challengeComplete.js"),
    import("../src/services/challengeComplete.js"),
    import("../src/routes/studyPassword.js"),
    import("../src/middlewares/verifyStudyPassword.js"),
    import("../src/middlewares/errorHandler.js"),
  ]);
  const password = randomBytes(8).toString("hex");
  const wrongPassword = (password[0] === "a" ? "b" : "a") + password.slice(1);
  const spacedPassword = password.slice(0, 4) + " " + password.slice(4);
  const passwordHash = await bcrypt.hash(password, 12);
  const secrets = [password, wrongPassword, spacedPassword, passwordHash];
  const goalMinutes = 10;
  const goalMilliseconds = 600000;

  step = "이번 실행의 임시 스터디 생성";
  const study = await prisma.study.create({
    data: { nickname: "복원검증", name: "검증" + fixtureKey, introduction: marker, passwordHash },
    select: { id: true },
  });
  studyId = study.id;
  let baseUrl;
  const startServer = async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/studies/:studyId/password-verifications", entryModule.default);
    const dependencies = { verifyStudyPassword: passwordModule.verifyStudyPassword };
    const prefix = "/api/studies/:studyId/challenges";
    app.use(prefix, startModule.createChallengeRouter(dependencies));
    app.use(prefix, changeModule.createChallengePauseResumeRouter(dependencies));
    app.use(prefix, completeModule.createCompleteChallengeRouter({
      ...dependencies, completeChallenge: serviceModule.createCompleteChallengeService(),
    }));
    app.use(errorModule.errorHandler);
    await new Promise((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", resolve);
      server.once("error", reject);
    });
    baseUrl = "http://127.0.0.1:" + server.address().port + "/api/studies/" + studyId;
  };
  const request = async ({ path, method = "GET", header = null, body }) => {
    const headers = { Accept: "application/json", Connection: "close" };
    if (header !== null) headers["X-Study-Password"] = header;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(baseUrl + path, {
      method, headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(secrets.some((value) => text.includes(value)), false);
    assert.equal(/"(?:password|passwordConfirm|passwordHash)"\s*:/.test(text), false);
    return { status: response.status, body: JSON.parse(text) };
  };
  const focus = (options = {}) => request({
    ...options, path: "/challenges" + (options.path ?? "/current"),
    header: options.header === undefined ? password : options.header,
  });
  const expectError = (response, status, code) => {
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(response.body), ["error"]);
    assert.deepEqual(Object.keys(response.body.error).sort(), ["code", "details", "message"]);
    assert.equal(response.body.error.code, code);
    assert.equal(response.body.error.details, null);
    assert.equal(typeof response.body.error.message, "string");
  };
  const verifyEntry = async () => {
    const response = await request({ path: "/password-verifications", method: "POST", body: { password } });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { data: { verified: true } });
  };
  const readState = async () => {
    const [storedStudy, challenges] = await prisma.$transaction([
      prisma.study.findUniqueOrThrow({
        where: { id: studyId }, select: { id: true, points: true, updatedAt: true },
      }),
      prisma.challenge.findMany({ where: { studyId }, orderBy: { id: "asc" } }),
    ], { isolationLevel: "RepeatableRead" });
    return { study: storedStudy, challenges };
  };
  const expectChallenge = (actual, stored) => {
    assert.deepEqual(Object.keys(actual).sort(), challengeFields);
    for (const key of ["id", "studyId", "goalMinutes", "status", "elapsedMilliseconds", "awardedPoints"]) {
      assert.equal(actual[key], stored[key]);
    }
    assert.equal(actual.createdAt, stored.createdAt.toISOString());
    assert.equal(actual.lastStartedAt, stored.lastStartedAt?.toISOString() ?? null);
    const serverMilliseconds = Date.parse(actual.serverTime);
    assert.equal(Number.isFinite(serverMilliseconds), true);
    const elapsed = stored.status === "RUNNING"
      ? Math.min(goalMilliseconds, stored.elapsedMilliseconds + Math.max(0, serverMilliseconds - stored.lastStartedAt.getTime()))
      : stored.elapsedMilliseconds;
    assert.equal(actual.elapsedSeconds, Math.floor(elapsed / 1000));
    assert.equal(actual.remainingSeconds, Math.ceil((goalMilliseconds - elapsed) / 1000));
    assert.equal(actual.endsAt, stored.status === "RUNNING"
      ? new Date(serverMilliseconds + goalMilliseconds - elapsed).toISOString() : null);
  };
  const current = async (state) => {
    const response = await focus();
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body), ["data"]);
    const data = response.body.data;
    assert.deepEqual(Object.keys(data).sort(), ["challenge", "goalMinutes", "points", "serverTime"]);
    assert.equal(data.points, state.study.points);
    assert.equal(data.goalMinutes, goalMinutes);
    assert.equal(Number.isFinite(Date.parse(data.serverTime)), true);
    const active = state.challenges.find((row) => ["RUNNING", "PAUSED"].includes(row.status));
    if (active === undefined) {
      assert.equal(data.challenge, null);
    } else {
      expectChallenge(data.challenge, active);
      assert.equal(data.challenge.serverTime, data.serverTime);
    }
    return data;
  };
  const expectAuthRejected = async () => {
    const before = await readState();
    await verifyEntry();
    expectError(await focus({ header: null }), 401, "VERIFICATION_REQUIRED");
    expectError(await focus({ header: wrongPassword }), 401, "PASSWORD_MISMATCH");
    expectError(await focus({ header: spacedPassword }), 400, "VALIDATION_ERROR");
    expectError(await request({ path: "/password-verifications", method: "POST", body: {} }), 401, "VERIFICATION_REQUIRED");
    expectError(await request({ path: "/password-verifications", method: "POST", body: { password: wrongPassword } }), 401, "PASSWORD_MISMATCH");
    assert.deepEqual(await readState(), before);
  };

  step = "실제 진입 인증·헤더 재검증·초기 조회";
  await startServer();
  await expectAuthRejected();
  const initial = await readState();
  await current(initial);
  assert.deepEqual(await readState(), initial);

  step = "집중 시작 201";
  const started = await focus({ path: "", method: "POST", body: { goalMinutes } });
  assert.equal(started.status, 201);
  assert.deepEqual(Object.keys(started.body), ["data"]);
  assert.deepEqual(Object.keys(started.body.data).sort(), ["challenge", "points", "settlement"]);
  const challengeId = started.body.data.challenge.id;
  assert.equal(uuidSchema.safeParse(challengeId).success, true);
  const action = (name, options = {}) => focus({ path: "/" + challengeId + "/" + name, method: "POST", ...options });
  const running = await readState();
  assert.equal(running.challenges.length, 1);
  assert.equal(running.challenges[0].id, challengeId);
  assert.equal(running.challenges[0].status, "RUNNING");
  assert.equal(running.challenges[0].elapsedMilliseconds, 0);
  assert.equal(running.challenges[0].awardedPoints, 0);
  assert.equal(running.study.points, 0);
  expectChallenge(started.body.data.challenge, running.challenges[0]);
  assert.equal(started.body.data.points, 0);
  assert.equal(started.body.data.settlement, null);
  const firstCurrent = await current(running);

  step = "RUNNING 요청 공백·새 HTTP 서버·재인증 후 같은 ID 복원";
  await closeServer();
  await delay(1100);
  assert.deepEqual(await readState(), running);
  await startServer();
  await expectAuthRejected();
  const restoredRunning = await current(running);
  assert.equal(restoredRunning.challenge.elapsedSeconds >= firstCurrent.challenge.elapsedSeconds + 1, true);
  assert.equal(restoredRunning.challenge.remainingSeconds <= firstCurrent.challenge.remainingSeconds, true);
  assert.deepEqual(await readState(), running);
  console.log("[성공] RUNNING: 요청 공백·새 라우터·재인증 후 동일 ID 복원, 조회 전후 DB 불변");

  step = "실제 정지 요청 200";
  const pausedResponse = await action("pause");
  assert.equal(pausedResponse.status, 200);
  const pausedState = await readState();
  const pausedRow = pausedState.challenges[0];
  assert.equal(pausedState.challenges.length, 1);
  assert.equal(pausedState.study.points, 0);
  assert.equal(pausedRow.id, challengeId);
  assert.equal(pausedRow.awardedPoints, 0);
  assert.equal(pausedRow.status, "PAUSED");
  assert.equal(pausedRow.lastStartedAt, null);
  assert.equal(pausedRow.elapsedMilliseconds >= 1000 && pausedRow.elapsedMilliseconds < goalMilliseconds, true);
  expectChallenge(pausedResponse.body.data.challenge, pausedRow);
  assert.equal(pausedResponse.body.data.points, 0);
  assert.equal(pausedResponse.body.data.settlement, null);
  const pausedCurrent = await current(pausedState);

  step = "PAUSED 요청 공백·재인증 후 상태와 저장 경과 불변";
  await closeServer();
  await delay(1100);
  await startServer();
  await expectAuthRejected();
  const restoredPaused = await current(pausedState);
  assert.equal(restoredPaused.challenge.id, challengeId);
  assert.equal(restoredPaused.challenge.elapsedSeconds, pausedCurrent.challenge.elapsedSeconds);
  assert.equal(restoredPaused.challenge.remainingSeconds, pausedCurrent.challenge.remainingSeconds);
  assert.deepEqual(await readState(), pausedState);
  console.log("[성공] PAUSED: 재접속 후 경과·남은 시간·상태·총점 유지, 자동 재개 없음");

  step = "재개 200·정지 구간 제외·동일 ID 복원";
  const resumedResponse = await action("resume");
  assert.equal(resumedResponse.status, 200);
  const resumedState = await readState();
  const resumedRow = resumedState.challenges[0];
  assert.equal(resumedState.challenges.length, 1);
  assert.equal(resumedState.study.points, 0);
  assert.equal(resumedRow.id, challengeId);
  assert.equal(resumedRow.awardedPoints, 0);
  assert.equal(resumedRow.status, "RUNNING");
  assert.equal(resumedRow.elapsedMilliseconds, pausedRow.elapsedMilliseconds);
  assert.equal(resumedRow.lastStartedAt.getTime() > running.challenges[0].lastStartedAt.getTime(), true);
  expectChallenge(resumedResponse.body.data.challenge, resumedRow);
  assert.equal(resumedResponse.body.data.points, 0);
  assert.equal(resumedResponse.body.data.settlement, null);
  await closeServer();
  await delay(1100);
  await startServer();
  await verifyEntry();
  await current(resumedState);
  assert.deepEqual(await readState(), resumedState);
  console.log("[성공] 재개: 저장 경과를 유지하며 새 실행 구간만 합산, 독립 조회가 DB를 변경하지 않음");

  if (!completeMode) {
    console.log("복원 API 기본 검증 성공. 실제 목표 도달 후 무지급·완료·재요청은 --complete로 별도 확인하세요.");
    return;
  }

  step = "요청 없이 실제 10분 목표 경과 대기";
  await closeServer();
  console.log("실제 10분 목표를 기다립니다. 대기 중 HTTP 요청·집중 DB 변경·시간 보정 없음");
  while (true) {
    const remaining = goalMilliseconds - resumedRow.elapsedMilliseconds
      - Math.max(0, Date.now() - resumedRow.lastStartedAt.getTime());
    if (remaining <= 0) break;
    await delay(Math.max(1, Math.min(remaining, 30000)));
  }

  step = "목표 도달 후 재인증·조회만으로 완료/지급되지 않음";
  assert.deepEqual(await readState(), resumedState);
  await startServer();
  await expectAuthRejected();
  const reached = await current(resumedState);
  assert.equal(reached.challenge.remainingSeconds, 0);
  assert.equal(reached.challenge.elapsedSeconds, 600);
  assert.equal(reached.challenge.status, "RUNNING");
  assert.equal(reached.challenge.awardedPoints, 0);
  assert.equal(reached.points, 0);
  expectError(await focus({ path: "", method: "POST", body: { goalMinutes } }), 409, "CHALLENGE_CONFLICT");
  expectError(await action("complete", { header: null }), 401, "VERIFICATION_REQUIRED");
  expectError(await action("complete", { header: wrongPassword }), 401, "PASSWORD_MISMATCH");
  assert.deepEqual(await readState(), resumedState);
  console.log("[성공] 목표 도달 후 조회: RUNNING 유지·남은 시간 0·포인트 0, 완료 전 새 시작 409");

  step = "재접속 후 완료 200·4P 지급";
  const completed = await action("complete");
  assert.equal(completed.status, 200);
  const completedState = await readState();
  assert.equal(completedState.challenges.length, 1);
  const completedRow = completedState.challenges[0];
  assert.equal(completedRow.id, challengeId);
  assert.equal(completedRow.status, "COMPLETED");
  assert.equal(completedRow.elapsedMilliseconds, goalMilliseconds);
  assert.equal(completedRow.lastStartedAt, null);
  assert.equal(completedRow.awardedPoints, 4);
  assert.equal(completedState.study.points, 4);
  expectChallenge(completed.body.data.challenge, completedRow);
  assert.equal(completed.body.data.points, 4);
  assert.deepEqual(completed.body.data.settlement, {
    challengeId, elapsedPoints: 1, goalPoints: 3, awardedPoints: 4,
  });

  step = "독립 완료 재요청 200·신규 0P·완료 후 현재 조회";
  await closeServer();
  await startServer();
  await verifyEntry();
  const repeated = await action("complete");
  assert.equal(repeated.status, 200);
  expectChallenge(repeated.body.data.challenge, completedRow);
  assert.equal(repeated.body.data.points, 4);
  assert.deepEqual(repeated.body.data.settlement, {
    challengeId, elapsedPoints: 0, goalPoints: 0, awardedPoints: 0,
  });
  await current(completedState);
  assert.deepEqual(await readState(), completedState);
  console.log("복원 API 전체 검증 성공: 실제 10분·재접속 무지급 조회·완료 4P·재요청 0P·총점/기록 보존");
};

try {
  await runChecks();
} catch {
  // Assertion·DB 오류 원문에는 임시 비밀번호나 접속 정보가 포함될 수 있어 출력하지 않는다.
  console.error("복원 API 검증 실패: " + step);
  if (step === "로컬 DB 주소 확인") {
    console.error("로컬 DB 전용입니다. localhost/127.0.0.1:5435의 forest-of-study만 허용하며 Neon은 차단합니다.");
  }
  process.exitCode = 1;
} finally {
  try {
    await closeServer();
  } catch {
    console.error("검증 서버 종료 실패");
    process.exitCode = 1;
  }
  if (prisma !== undefined) {
    if (studyId !== undefined) {
      try {
        const deleted = await prisma.study.deleteMany({ where: { id: studyId, introduction: marker } });
        assert.equal(deleted.count, 1);
        console.log("이번 실행의 임시 스터디·집중 정리 완료");
      } catch {
        console.error("임시 데이터 정리 실패. 스터디 ID: " + studyId);
        process.exitCode = 1;
      }
    }
    try {
      await prisma.$disconnect();
    } catch {
      console.error("검증 DB 연결 종료 실패");
      process.exitCode = 1;
    }
  }
}
