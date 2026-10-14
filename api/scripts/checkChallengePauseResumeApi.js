import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import bcrypt from "bcrypt";
import { assertLocalSeedDatabase } from "../seed-data.js";

// 로컬 DB와 실제 라우터를 임시 서버에서 검사한다. app.js 연결은 api.http로 확인한다.
// --preflight: DB 연결 없이 주소 검사. --wait-goal: 실제 10분 목표 경계도 검사.
// 이번 실행에서 만든 스터디만 정리하고 seed는 유지한다.
let prisma;
let server;
let step = "인자·로컬 DB 주소 확인";
const fixtureIds = [];

try {
  const args = process.argv.slice(2);
  assert.equal(args.length <= 1 && args.every((arg) => ["--preflight", "--wait-goal"].includes(arg)), true);
  const { databaseUrl } = await import("../src/config/env.js");
  // Prisma와 이를 가져오는 서비스·라우터는 주소 검사 후에만 불러온다.
  assertLocalSeedDatabase(databaseUrl);
  for (const rejected of [
    "postgresql://example.neon.tech:5435/forest-of-study",
    "postgresql://127.0.0.1:5432/forest-of-study",
    "postgresql://127.0.0.1:5435/other-database",
    "postgresql://127.0.0.1:5435/forest-of-study?host=example.neon.tech",
    "postgresql://127.0.0.1:5435/forest-of-study?schema=other",
  ]) assert.throws(() => assertLocalSeedDatabase(rejected));

  if (args.includes("--preflight")) {
    console.log("정지·재개 사전 확인 성공: 로컬 주소 허용·외부 주소 거절. DB 연결·변경 없음");
  } else {
    step = "검증 모듈 준비";
    ({ prisma } = await import("../src/lib/prisma.js"));
    const [startModule, changeModule, completeModule, completeServiceModule, passwordModule, errorModule] = await Promise.all([
      import("../src/routes/challenge.js"),
      import("../src/routes/challengePauseResume.js"),
      import("../src/routes/challenge-complete.js"),
      import("../src/services/challenge-complete.js"),
      import("../src/middlewares/verifyStudyPassword.js"),
      import("../src/middlewares/errorHandler.js"),
    ]);
    const password = randomBytes(8).toString("hex");
    const wrongPassword = (password[0] === "a" ? "b" : "a") + password.slice(1);
    const passwordHash = await bcrypt.hash(password, 12);

    step = "임시 스터디 준비";
    for (let index = 0; index < 2; index += 1) {
      const study = await prisma.study.create({
        data: {
          nickname: "정지검증", name: `정지 재개 검증 ${index + 1}`,
          introduction: "검증 종료 시 삭제하는 임시 스터디입니다.", passwordHash,
        },
        select: { id: true },
      });
      fixtureIds.push(study.id);
    }
    const [studyId, otherStudyId] = fixtureIds;
    const originalStudy = await prisma.study.findUniqueOrThrow({ where: { id: studyId } });

    step = "로컬 검증 서버 시작";
    const app = express();
    app.use(express.json());
    const dependencies = { verifyStudyPassword: passwordModule.verifyStudyPassword };
    const prefix = "/api/studies/:studyId/challenges";
    app.use(prefix, startModule.createChallengeRouter(dependencies));
    app.use(prefix, changeModule.createChallengePauseResumeRouter(dependencies));
    app.use(prefix, completeModule.createCompleteChallengeRouter({
      ...dependencies, completeChallenge: completeServiceModule.createCompleteChallengeService(),
    }));
    app.use(errorModule.errorHandler);
    await new Promise((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", resolve);
      server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/studies`;
    const request = async ({ id = studyId, path = "", method = "POST", body, rawBody, header = password }) => {
      const headers = { Accept: "application/json" };
      if (header !== null) headers["X-Study-Password"] = header;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (rawBody !== undefined) headers["Content-Type"] = "text/plain";
      const response = await fetch(`${baseUrl}/${id}/challenges${path}`, {
        method, headers,
        body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
        redirect: "error", signal: AbortSignal.timeout(10000),
      });
      const text = await response.text();
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal([password, wrongPassword, passwordHash].some((value) => text.includes(value)), false);
      assert.equal(/"(?:password|passwordConfirm|passwordHash)"\s*:/.test(text), false);
      return { status: response.status, body: JSON.parse(text) };
    };
    const expectError = (response, status, code) => {
      assert.equal(response.status, status);
      assert.deepEqual(Object.keys(response.body), ["error"]);
      assert.deepEqual(Object.keys(response.body.error).sort(), ["code", "details", "message"]);
      assert.equal(response.body.error.code, code);
      assert.equal(response.body.error.details, null);
      assert.equal(typeof response.body.error.message, "string");
    };

    step = "새 집중 시작 201";
    const started = await request({ body: { goalMinutes: 10 } });
    assert.equal(started.status, 201);
    const challengeId = started.body.data.challenge.id;
    const change = (action, options = {}) => request({ path: `/${challengeId}/${action}`, ...options });
    const readChallenge = () => prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
    const before = await readChallenge();
    const expectChange = (response, status) => {
      assert.equal(response.status, 200);
      assert.deepEqual(Object.keys(response.body), ["data"]);
      assert.deepEqual(Object.keys(response.body.data).sort(), ["challenge", "points", "settlement"]);
      assert.deepEqual(Object.keys(response.body.data.challenge).sort(), Object.keys(started.body.data.challenge).sort());
      assert.equal(response.body.data.challenge.id, challengeId);
      assert.equal(response.body.data.challenge.studyId, studyId);
      assert.equal(response.body.data.challenge.status, status);
      assert.equal(response.body.data.challenge.goalMinutes, 10);
      assert.equal(response.body.data.challenge.awardedPoints, 0);
      assert.equal(response.body.data.challenge.createdAt, started.body.data.challenge.createdAt);
      assert.equal(response.body.data.points, 0);
      assert.equal(response.body.data.settlement, null);
    };

    step = "인증·UUID·소속·본문 오류와 DB 불변";
    for (const action of ["pause", "resume"]) {
      expectError(await change(action, { header: null }), 401, "VERIFICATION_REQUIRED");
      expectError(await change(action, { header: wrongPassword }), 401, "PASSWORD_MISMATCH");
      expectError(await change(action, { header: "bad password" }), 400, "VALIDATION_ERROR");
      expectError(await change(action, { id: "invalid-id" }), 400, "VALIDATION_ERROR");
      expectError(await request({ path: `/invalid-id/${action}` }), 400, "VALIDATION_ERROR");
      expectError(await change(action, { id: randomUUID() }), 404, "STUDY_NOT_FOUND");
      expectError(await request({ path: `/${randomUUID()}/${action}` }), 404, "CHALLENGE_NOT_FOUND");
      expectError(await change(action, { id: otherStudyId }), 404, "CHALLENGE_NOT_FOUND");
      expectError(await change(action, { body: {} }), 400, "VALIDATION_ERROR");
      expectError(await change(action, { rawBody: "unexpected body" }), 400, "VALIDATION_ERROR");
    }
    expectError(await change("resume"), 409, "INVALID_CHALLENGE_STATE");
    assert.deepEqual(await readChallenge(), before);

    step = "동시 정지 두 요청 200·밀리초 경과 보존";
    await delay(1100);
    const pauses = await Promise.allSettled([change("pause"), change("pause")]);
    assert.equal(pauses.every((result) => result.status === "fulfilled"), true);
    const pauseResponses = pauses.map((result) => result.value);
    for (const response of pauseResponses) expectChange(response, "PAUSED");
    const paused = await readChallenge();
    assert.equal(paused.status, "PAUSED");
    assert.equal(paused.lastStartedAt, null);
    assert.equal(paused.elapsedMilliseconds >= 1000, true);
    assert.equal(paused.elapsedMilliseconds < 600000, true);
    assert.equal(pauseResponses[0].body.data.challenge.elapsedMilliseconds, paused.elapsedMilliseconds);
    assert.equal(pauseResponses[1].body.data.challenge.elapsedMilliseconds, paused.elapsedMilliseconds);
    const firstPause = [...pauseResponses].sort((a, b) =>
      Date.parse(a.body.data.challenge.serverTime) - Date.parse(b.body.data.challenge.serverTime))[0];
    assert.equal(paused.elapsedMilliseconds, before.elapsedMilliseconds + Math.max(
      0, Date.parse(firstPause.body.data.challenge.serverTime) - before.lastStartedAt.getTime(),
    ));
    assert.equal(firstPause.body.data.challenge.elapsedSeconds, Math.floor(paused.elapsedMilliseconds / 1000));
    assert.equal(firstPause.body.data.challenge.remainingSeconds, Math.ceil((600000 - paused.elapsedMilliseconds) / 1000));
    assert.equal(firstPause.body.data.challenge.endsAt, null);

    step = "정지 중 대기·조회·정지 재요청은 경과 불변";
    await delay(1100);
    const pausedCurrent = await request({ path: "/current", method: "GET" });
    assert.equal(pausedCurrent.status, 200);
    assert.equal(pausedCurrent.body.data.challenge.elapsedMilliseconds, paused.elapsedMilliseconds);
    assert.equal(pausedCurrent.body.data.challenge.elapsedSeconds, Math.floor(paused.elapsedMilliseconds / 1000));
    expectChange(await change("pause"), "PAUSED");
    expectError(await request({ body: {} }), 409, "CHALLENGE_CONFLICT");
    assert.deepEqual(await readChallenge(), paused);

    step = "동시 재개 200·409·시작 시각 덮어쓰기 방지";
    const resumes = await Promise.allSettled([change("resume"), change("resume")]);
    assert.equal(resumes.every((result) => result.status === "fulfilled"), true);
    const resumeResponses = resumes.map((result) => result.value);
    assert.deepEqual(resumeResponses.map((response) => response.status).sort(), [200, 409]);
    const resumedResponse = resumeResponses.find((response) => response.status === 200);
    expectChange(resumedResponse, "RUNNING");
    expectError(resumeResponses.find((response) => response.status === 409), 409, "INVALID_CHALLENGE_STATE");
    const resumed = await readChallenge();
    assert.equal(resumed.elapsedMilliseconds, paused.elapsedMilliseconds);
    assert.equal(resumed.lastStartedAt.toISOString(), resumedResponse.body.data.challenge.serverTime);
    assert.equal(resumed.lastStartedAt.toISOString(), resumedResponse.body.data.challenge.lastStartedAt);
    expectError(await change("resume"), 409, "INVALID_CHALLENGE_STATE");
    assert.deepEqual(await readChallenge(), resumed);

    step = "재개 이후 실행 시간만 누적·집중 ID와 총점 유지";
    await delay(1100);
    const runningCurrent = await request({ path: "/current", method: "GET" });
    assert.equal(runningCurrent.status, 200);
    assert.equal(runningCurrent.body.data.challenge.id, challengeId);
    assert.equal(runningCurrent.body.data.challenge.elapsedMilliseconds, paused.elapsedMilliseconds);
    const expectedElapsed = paused.elapsedMilliseconds + Math.max(
      0, Date.parse(runningCurrent.body.data.serverTime) - resumed.lastStartedAt.getTime(),
    );
    assert.equal(runningCurrent.body.data.challenge.elapsedSeconds, Math.floor(expectedElapsed / 1000));
    assert.equal(runningCurrent.body.data.challenge.remainingSeconds, Math.ceil((600000 - expectedElapsed) / 1000));
    assert.deepEqual(await readChallenge(), resumed);
    assert.equal(await prisma.challenge.count({ where: { studyId } }), 1);
    assert.deepEqual(await prisma.study.findUniqueOrThrow({ where: { id: studyId } }), originalStudy);

    step = "RESET 이력의 정지·재개 거절";
    const reset = await prisma.challenge.create({
      data: { studyId: otherStudyId, goalMinutes: 10, status: "RESET" },
    });
    for (const action of ["pause", "resume"]) {
      expectError(await request({ id: otherStudyId, path: `/${reset.id}/${action}` }), 409, "INVALID_CHALLENGE_STATE");
    }
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: reset.id } }), reset);

    if (args.includes("--wait-goal")) {
      step = "실제 목표 시간 대기";
      const deadline = resumed.lastStartedAt.getTime() + 600000 - resumed.elapsedMilliseconds;
      while (Date.now() < deadline + 100) {
        const remaining = deadline + 100 - Date.now();
        console.log(`정지·재개 목표 경계 검증 대기: 약 ${Math.ceil(remaining / 60000)}분 남음`);
        await delay(Math.max(1, Math.min(remaining, 30000)));
      }
      step = "목표 도달 RUNNING의 정지 거절·DB 불변";
      const reached = await request({ path: "/current", method: "GET" });
      assert.equal(reached.status, 200);
      assert.equal(reached.body.data.challenge.remainingSeconds, 0);
      expectError(await change("pause"), 409, "CHALLENGE_FINISHED");
      assert.deepEqual(await readChallenge(), resumed);

      step = "실제로 목표를 채운 PAUSED의 재개 거절·정지 재요청 유지";
      // 실제로 목표를 채웠음을 확인한 뒤 PAUSED 상태만 준비한다. 시간을 앞당기지 않는다.
      const reachedElapsed = Math.min(600000, resumed.elapsedMilliseconds + Math.max(
        0, Date.parse(reached.body.data.serverTime) - resumed.lastStartedAt.getTime(),
      ));
      assert.equal(reachedElapsed, 600000);
      const reachedPaused = await prisma.challenge.update({
        where: { id: challengeId },
        data: { status: "PAUSED", elapsedMilliseconds: reachedElapsed, lastStartedAt: null },
      });
      expectError(await change("resume"), 409, "CHALLENGE_FINISHED");
      expectChange(await change("pause"), "PAUSED");
      assert.deepEqual(await readChallenge(), reachedPaused);
      assert.deepEqual(await prisma.study.findUniqueOrThrow({ where: { id: studyId } }), originalStudy);

      step = "실제 완료 후 정지·재개 거절·기존 지급량 보존";
      const completed = await change("complete");
      assert.equal(completed.status, 200);
      assert.equal(completed.body.data.challenge.status, "COMPLETED");
      assert.equal(completed.body.data.points, 4);
      const completedRow = await readChallenge();
      const completedStudy = await prisma.study.findUniqueOrThrow({ where: { id: studyId } });
      for (const action of ["pause", "resume"]) {
        expectError(await change(action), 409, "INVALID_CHALLENGE_STATE");
      }
      assert.deepEqual(await readChallenge(), completedRow);
      assert.deepEqual(await prisma.study.findUniqueOrThrow({ where: { id: studyId } }), completedStudy);
      console.log("목표 경계 검증 성공: 실제 10분·RUNNING 정지409·PAUSED 재개409·완료 후 조작409");
    }
    console.log("정지·재개 API 검증 성공: 같은 행·밀리초 보존·정지 시간 제외·재요청·동시 요청·무지급·인증·입력·소속");
  }
} catch {
  console.error(`정지·재개 API 검증 실패: ${step}. 로컬 DB 주소·migration·의존성을 확인해주세요.`);
  process.exitCode = 1;
} finally {
  if (server !== undefined) {
    await new Promise((resolve) => {
      server.close((error) => {
        if (error) {
          console.error("검증 서버 종료 실패");
          process.exitCode = 1;
        }
        resolve();
      });
      server.closeIdleConnections();
    });
  }
  if (prisma !== undefined) {
    for (const id of fixtureIds) {
      try {
        await prisma.study.delete({ where: { id } });
      } catch {
        console.error(`임시 데이터 정리 실패. 스터디 ID: ${id}`);
        process.exitCode = 1;
      }
    }
    if (fixtureIds.length > 0 && process.exitCode !== 1) {
      console.log("이번 검증의 임시 스터디·집중 정리 완료");
    }
    try {
      await prisma.$disconnect();
    } catch {
      console.error("검증 DB 연결 종료 실패");
      process.exitCode = 1;
    }
  }
}
