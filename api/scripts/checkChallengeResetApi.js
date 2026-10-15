import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import bcrypt from "bcrypt";
import { assertLocalSeedDatabase } from "../seedData.js";

// 실제 초기화·시작·정지·조회 라우터를 임시 서버에서 검사한다. app.js 연결은 별도 확인한다.
// --preflight는 DB 연결 없이 주소 제한만 확인한다. 이번 실행에서 만든 스터디만 정리한다.
// 과거 완료와 13·17분 PAUSED는 저장 이력 검사용 데이터다. 실제 완료·시간 경과 검증을 대신하지 않는다.
let prisma;
let server;
let step = "인자·로컬 DB 주소 확인";
const fixtureIds = [];

try {
  const args = process.argv.slice(2);
  assert.equal(args.length <= 1 && args.every((arg) => arg === "--preflight"), true);
  const { databaseUrl } = await import("../src/config/env.js");
  assertLocalSeedDatabase(databaseUrl);
  for (const rejected of [
    "postgresql://example.neon.tech:5435/forest-of-study",
    "postgresql://127.0.0.1:5432/forest-of-study",
    "postgresql://127.0.0.1:5435/other-database",
    "postgresql://127.0.0.1:5435/forest-of-study?host=example.neon.tech",
    "postgresql://127.0.0.1:5435/forest-of-study?schema=other",
  ]) assert.throws(() => assertLocalSeedDatabase(rejected));

  if (args.includes("--preflight")) {
    console.log("초기화 사전 확인 성공: 로컬 주소 허용·외부 주소 거절. DB 연결·변경 없음");
  } else {
    // Prisma를 가져오는 서비스·라우터도 주소 검사 후에만 불러온다.
    step = "검증 모듈 준비";
    ({ prisma } = await import("../src/lib/prisma.js"));
    const [startModule, pauseModule, resetModule, completeModule, completeServiceModule, passwordModule, errorModule] = await Promise.all([
      import("../src/routes/challenge.js"),
      import("../src/routes/challengePauseResume.js"),
      import("../src/routes/challengeReset.js"),
      import("../src/routes/challengeComplete.js"),
      import("../src/services/challengeComplete.js"),
      import("../src/middlewares/verifyStudyPassword.js"),
      import("../src/middlewares/errorHandler.js"),
    ]);
    const password = randomBytes(8).toString("hex");
    const wrongPassword = (password[0] === "a" ? "b" : "a") + password.slice(1);
    const passwordHash = await bcrypt.hash(password, 12);

    step = "검증용 스터디와 과거 지급 이력 준비";
    for (let index = 0; index < 2; index += 1) {
      const study = await prisma.study.create({
        data: {
          nickname: "초기화검증", name: `초기화 검증 ${index + 1}`,
          introduction: "검증 종료 시 삭제하는 임시 스터디입니다.", passwordHash,
          createdAt: new Date(Date.now() - 2 * 86400000),
        },
        select: { id: true },
      });
      fixtureIds.push(study.id);
    }
    const [studyId, otherStudyId] = fixtureIds;
    // 이미 지급된 이력을 준비해 초기화가 기존 총점을 0으로 지우지 않는지 확인한다.
    const [historicalCompleted] = await prisma.$transaction([
      prisma.challenge.create({
        data: {
          studyId, goalMinutes: 10, status: "COMPLETED",
          elapsedMilliseconds: 600000, awardedPoints: 4,
          createdAt: new Date(Date.now() - 86400000),
        },
      }),
      prisma.study.update({ where: { id: studyId }, data: { points: 4 } }),
    ]);
    const originalStudy = await prisma.study.findUniqueOrThrow({ where: { id: studyId } });

    step = "로컬 검증 서버 시작";
    const app = express();
    app.use(express.json());
    const dependencies = { verifyStudyPassword: passwordModule.verifyStudyPassword };
    const prefix = "/api/studies/:studyId/challenges";
    app.use(prefix, startModule.createChallengeRouter(dependencies));
    app.use(prefix, pauseModule.createChallengePauseResumeRouter(dependencies));
    app.use(prefix, resetModule.createChallengeResetRouter(dependencies));
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
    const reset = (challengeId, options = {}) => request({ path: `/${challengeId}/reset`, ...options });
    const expectError = (response, status, code) => {
      assert.equal(response.status, status);
      assert.deepEqual(Object.keys(response.body), ["error"]);
      assert.deepEqual(Object.keys(response.body.error).sort(), ["code", "details", "message"]);
      assert.equal(response.body.error.code, code);
      assert.equal(response.body.error.details, null);
      assert.equal(typeof response.body.error.message, "string");
    };
    const expectReset = (response, previous, points) => {
      assert.equal(response.status, 200);
      assert.deepEqual(Object.keys(response.body), ["data"]);
      assert.deepEqual(Object.keys(response.body.data).sort(), ["challenge", "points", "settlement"]);
      const challenge = response.body.data.challenge;
      assert.deepEqual(Object.keys(challenge).sort(), [
        "awardedPoints", "createdAt", "elapsedMilliseconds", "elapsedSeconds", "endsAt",
        "goalMinutes", "id", "lastStartedAt", "remainingSeconds", "serverTime", "status", "studyId",
      ].sort());
      assert.equal(challenge.id, previous.id);
      assert.equal(challenge.studyId, previous.studyId);
      assert.equal(challenge.status, "RESET");
      assert.equal(challenge.goalMinutes, previous.goalMinutes);
      assert.equal(challenge.elapsedMilliseconds, previous.elapsedMilliseconds);
      assert.equal(challenge.elapsedSeconds, Math.floor(previous.elapsedMilliseconds / 1000));
      assert.equal(challenge.remainingSeconds, Math.ceil((previous.goalMinutes * 60000 - previous.elapsedMilliseconds) / 1000));
      assert.equal(challenge.createdAt, previous.createdAt.toISOString());
      assert.equal(challenge.lastStartedAt, null);
      assert.equal(challenge.endsAt, null);
      assert.equal(challenge.awardedPoints, 0);
      assert.equal(response.body.data.points, points);
      assert.equal(response.body.data.settlement, null);
    };

    step = "새 집중 시작 201·RUNNING 초기화 거절 409";
    const started = await request({ body: { goalMinutes: 25 } });
    assert.equal(started.status, 201);
    const challengeId = started.body.data.challenge.id;
    const running = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
    expectError(await reset(challengeId), 409, "INVALID_CHALLENGE_STATE");

    step = "인증·UUID·소속·본문 오류와 DB 불변";
    expectError(await reset(challengeId, { header: null }), 401, "VERIFICATION_REQUIRED");
    expectError(await reset(challengeId, { header: wrongPassword }), 401, "PASSWORD_MISMATCH");
    expectError(await reset(challengeId, { header: "bad password" }), 400, "VALIDATION_ERROR");
    expectError(await reset(challengeId, { id: "invalid-id" }), 400, "VALIDATION_ERROR");
    expectError(await reset("invalid-id"), 400, "VALIDATION_ERROR");
    expectError(await reset(challengeId, { id: randomUUID() }), 404, "STUDY_NOT_FOUND");
    expectError(await reset(randomUUID()), 404, "CHALLENGE_NOT_FOUND");
    expectError(await reset(challengeId, { id: otherStudyId }), 404, "CHALLENGE_NOT_FOUND");
    expectError(await reset(challengeId, { body: {} }), 400, "VALIDATION_ERROR");
    expectError(await reset(challengeId, { rawBody: "unexpected body" }), 400, "VALIDATION_ERROR");
    expectError(await reset(historicalCompleted.id), 409, "INVALID_CHALLENGE_STATE");
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } }), running);
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: historicalCompleted.id } }), historicalCompleted);
    assert.deepEqual(await prisma.study.findUniqueOrThrow({ where: { id: studyId } }), originalStudy);

    step = "실제 일시정지 후 동시 초기화 200·이력 보존";
    await delay(1100);
    const pausedResponse = await request({ path: `/${challengeId}/pause` });
    assert.equal(pausedResponse.status, 200);
    const paused = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
    assert.equal(paused.status, "PAUSED");
    assert.equal(paused.elapsedMilliseconds > 0, true);
    const resets = await Promise.allSettled([reset(challengeId), reset(challengeId)]);
    assert.equal(resets.every((result) => result.status === "fulfilled"), true);
    for (const result of resets) expectReset(result.value, paused, 4);
    const resetRow = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
    assert.deepEqual(resetRow, { ...paused, status: "RESET" });
    assert.equal(await prisma.challenge.count({ where: { studyId } }), 2);
    assert.equal(await prisma.challenge.count({ where: { studyId, status: { in: ["RUNNING", "PAUSED"] } } }), 0);
    assert.deepEqual(await prisma.study.findUniqueOrThrow({ where: { id: studyId } }), originalStudy);
    expectReset(await reset(challengeId), paused, 4);
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } }), resetRow);

    step = "현재 조회의 목표 복원·RESET 후 조작 거절";
    const current = await request({ path: "/current", method: "GET" });
    assert.equal(current.status, 200);
    assert.equal(current.body.data.challenge, null);
    assert.equal(current.body.data.goalMinutes, 25);
    assert.equal(current.body.data.points, 4);
    for (const action of ["pause", "resume", "complete"]) {
      expectError(await request({ path: `/${challengeId}/${action}` }), 409, "INVALID_CHALLENGE_STATE");
    }
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } }), resetRow);

    step = "다음 시작은 새 행·경과 0·이전 RESET 재요청의 영향 없음";
    const restarted = await request({ body: { goalMinutes: 35 } });
    assert.equal(restarted.status, 201);
    const next = restarted.body.data.challenge;
    assert.notEqual(next.id, challengeId);
    assert.equal(next.status, "RUNNING");
    assert.equal(next.goalMinutes, 35);
    assert.equal(next.elapsedMilliseconds, 0);
    assert.equal(next.elapsedSeconds, 0);
    assert.equal(next.awardedPoints, 0);
    assert.equal(restarted.body.data.points, 4);
    assert.equal(restarted.body.data.settlement, null);
    const nextRow = await prisma.challenge.findUniqueOrThrow({ where: { id: next.id } });
    expectReset(await reset(challengeId), paused, 4);
    assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: next.id } }), nextRow);
    const nextCurrent = await request({ path: "/current", method: "GET" });
    assert.equal(nextCurrent.status, 200);
    assert.equal(nextCurrent.body.data.challenge.id, next.id);
    const nextPausedResponse = await request({ path: `/${next.id}/pause` });
    assert.equal(nextPausedResponse.status, 200);
    const nextPaused = await prisma.challenge.findUniqueOrThrow({ where: { id: next.id } });
    expectReset(await reset(next.id), nextPaused, 4);
    const latest = await request({ path: "/current", method: "GET" });
    assert.equal(latest.status, 200);
    assert.equal(latest.body.data.challenge, null);
    assert.equal(latest.body.data.goalMinutes, 35);
    assert.equal(latest.body.data.points, 4);
    const total = await prisma.challenge.aggregate({ where: { studyId }, _sum: { awardedPoints: true } });
    assert.equal(total._sum.awardedPoints, 4);
    assert.deepEqual(await prisma.study.findUniqueOrThrow({ where: { id: studyId } }), originalStudy);

    step = "13·17분 PAUSED 이력의 초기화는 합계 0P";
    // 과거 PAUSED 저장 상태를 준비한다. 실제 시간 경과나 완료 API를 검증하는 단계는 아니다.
    for (const [index, minutes, goalMinutes] of [[0, 13, 25], [1, 17, 30]]) {
      const history = await prisma.challenge.create({
        data: {
          studyId: otherStudyId, goalMinutes, status: "PAUSED", elapsedMilliseconds: minutes * 60000,
          createdAt: new Date(Date.now() - (index === 0 ? 35 : 20) * 60000),
        },
      });
      expectReset(await reset(history.id, { id: otherStudyId }), history, 0);
      assert.deepEqual(await prisma.challenge.findUniqueOrThrow({ where: { id: history.id } }), { ...history, status: "RESET" });
      const restored = await request({ id: otherStudyId, path: "/current", method: "GET" });
      assert.equal(restored.status, 200);
      assert.equal(restored.body.data.challenge, null);
      assert.equal(restored.body.data.goalMinutes, goalMinutes);
      assert.equal(restored.body.data.points, 0);
    }
    const unpaidTotal = await prisma.challenge.aggregate({ where: { studyId: otherStudyId }, _sum: { awardedPoints: true } });
    const unpaidStudy = await prisma.study.findUniqueOrThrow({ where: { id: otherStudyId }, select: { points: true } });
    assert.equal(unpaidStudy.points, 0);
    assert.equal(unpaidTotal._sum.awardedPoints, 0);
    console.log("초기화 API 검증 성공: PAUSED만 허용·동시/반복200·이력 보존·목표 복원·새 행·총점 보존·13/17분 이력 무지급");
  }
} catch {
  console.error(`초기화 API 검증 실패: ${step}. 로컬 DB 주소·migration·의존성을 확인해주세요.`);
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
