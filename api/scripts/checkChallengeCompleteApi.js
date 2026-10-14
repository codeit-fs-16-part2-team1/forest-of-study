import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";
import { createChallengeRouter } from "../src/routes/challenge.js";
import { createCompleteChallengeRouter } from "../src/routes/challenge-complete.js";
import { createCompleteChallengeService } from "../src/services/challenge-complete.js";
import { calculateChallengePoints } from "../src/utils/challenge-points.js";
import { verifyStudyPassword } from "../src/middlewares/verifyStudyPassword.js";
import { errorHandler } from "../src/middlewares/errorHandler.js";

// 로컬 DB·실제 라우터·인증을 검증한다. app.js 서버와 스터디 상세 API 검증은 별도다.
// 기본 10분을 실제로 기다린다. 인자로 20·25·180분을 선택할 수 있다.
// 시간·목표 도달 조건을 우회하지 않으며 운영 라우트에 테스트 기능을 추가하지 않는다.
const goalMinutes = Number(process.argv[2] ?? 10);
const awards = new Map([[10, 4], [20, 5], [25, 5], [180, 21]]);
const fixtureIds = [];
let server;
let step = "지급량과 검증 목표 확인";

try {
  assert.equal(awards.has(goalMinutes), true);
  for (const [goal, points] of awards) {
    assert.equal(calculateChallengePoints(goal).awardedPoints, points);
  }
  const expectedAward = awards.get(goalMinutes);

  step = "임시 스터디 생성";
  const password = randomBytes(8).toString("hex");
  const wrongPassword = (password[0] === "a" ? "b" : "a") + password.slice(1);
  const passwordHash = await bcrypt.hash(password, 12);
  for (let index = 0; index < 2; index += 1) {
    const study = await prisma.study.create({
      data: {
        nickname: "완료검증",
        name: `집중 완료 검증 ${index + 1}`,
        introduction: "검증 종료 시 삭제하는 임시 스터디입니다.",
        passwordHash,
      },
      select: { id: true },
    });
    fixtureIds.push(study.id);
  }
  const [studyId, otherStudyId] = fixtureIds;

  step = "로컬 검증 서버 시작";
  const app = express();
  app.use(express.json());
  app.use("/api/studies/:studyId/challenges", createChallengeRouter({ verifyStudyPassword }));
  app.use("/api/studies/:studyId/challenges", createCompleteChallengeRouter({
    verifyStudyPassword,
    completeChallenge: createCompleteChallengeService(),
  }));
  app.use(errorHandler);
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/studies`;
  const request = async ({ id = studyId, path = "", method = "GET", body, header = password }) => {
    const headers = {};
    if (header !== null) headers["X-Study-Password"] = header;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${baseUrl}/${id}/challenges${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal([password, wrongPassword, passwordHash].some((value) => text.includes(value)), false);
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

  step = "집중 시작 201";
  const started = await request({ method: "POST", body: { goalMinutes } });
  assert.equal(started.status, 201);
  const challengeId = started.body.data.challenge.id;
  const completionPath = `/${challengeId}/complete`;
  const complete = (options = {}) => request({ path: completionPath, method: "POST", ...options });

  step = "완료 인증·UUID·소속·본문·조기 요청 거절";
  expectError(await complete({ header: null }), 401, "VERIFICATION_REQUIRED");
  expectError(await complete({ header: wrongPassword }), 401, "PASSWORD_MISMATCH");
  expectError(await request({ path: "/invalid-id/complete", method: "POST" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: `/${randomUUID()}/complete`, method: "POST" }), 404, "CHALLENGE_NOT_FOUND");
  expectError(await complete({ id: otherStudyId }), 404, "CHALLENGE_NOT_FOUND");
  expectError(await complete({ body: { awardedPoints: 100 } }), 400, "VALIDATION_ERROR");
  expectError(await complete(), 409, "CHALLENGE_NOT_FINISHED");
  const before = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  assert.equal(before.status, "RUNNING");
  assert.equal(before.awardedPoints, 0);

  step = "RESET 완료 요청 거절";
  // 두 번째 임시 스터디에 테스트 이력을 준비한다. 실제 초기화 API 검증은 아니다.
  const reset = await prisma.challenge.create({
    data: { studyId: otherStudyId, goalMinutes: 10, status: "RESET" },
    select: { id: true },
  });
  expectError(await request({ id: otherStudyId, path: `/${reset.id}/complete`, method: "POST" }), 409, "INVALID_CHALLENGE_STATE");

  step = "실제 목표 시간 대기";
  const deadline = new Date(started.body.data.challenge.lastStartedAt).getTime() + goalMinutes * 60000;
  while (Date.now() < deadline + 100) {
    const remaining = deadline + 100 - Date.now();
    console.log(`목표 완료 대기: 약 ${Math.ceil(remaining / 60000)}분 남음`);
    await delay(Math.max(1, Math.min(remaining, 30000)));
  }

  step = "조회만으로 완료·지급되지 않음";
  const reached = await request({ path: "/current" });
  assert.equal(reached.status, 200);
  assert.equal(reached.body.data.challenge.status, "RUNNING");
  assert.equal(reached.body.data.challenge.remainingSeconds, 0);
  assert.equal(reached.body.data.points, 0);
  expectError(await request({ method: "POST", body: {} }), 409, "CHALLENGE_CONFLICT");

  step = "지급 실패 시 완료 상태·지급량 롤백";
  // 이 임시 스터디에만 정수 상한을 넣어 총점 증가를 실패시킨다.
  // 시간을 바꾸지 않으며, 실패 검증 후 정상 총점 0으로 복원한다.
  await prisma.study.update({ where: { id: studyId }, data: { points: 2147483647 } });
  expectError(await complete(), 500, "INTERNAL_ERROR");
  const rolledBack = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  assert.equal(rolledBack.status, "RUNNING");
  assert.equal(rolledBack.elapsedMilliseconds, 0);
  assert.equal(rolledBack.awardedPoints, 0);
  assert.notEqual(rolledBack.lastStartedAt, null);
  const failedStudy = await prisma.study.findUniqueOrThrow({ where: { id: studyId }, select: { points: true } });
  assert.equal(failedStudy.points, 2147483647);
  await prisma.study.update({ where: { id: studyId }, data: { points: 0 } });

  step = "동시 완료 두 요청에서 한 번만 지급";
  const completions = await Promise.allSettled([complete(), complete()]);
  assert.equal(completions.every((result) => result.status === "fulfilled"), true);
  const results = completions.map((result) => result.value);
  assert.deepEqual(results.map((result) => result.body.data.settlement.awardedPoints).sort((a, b) => a - b), [0, expectedAward]);
  for (const result of results) {
    assert.equal(result.status, 200);
    assert.equal(result.body.data.challenge.status, "COMPLETED");
    assert.equal(result.body.data.challenge.elapsedMilliseconds, goalMinutes * 60000);
    assert.equal(result.body.data.challenge.lastStartedAt, null);
    assert.equal(result.body.data.challenge.awardedPoints, expectedAward);
    assert.equal(result.body.data.points, expectedAward);
    const settlement = result.body.data.settlement;
    assert.equal(settlement.challengeId, challengeId);
    assert.equal(settlement.goalPoints, settlement.awardedPoints === 0 ? 0 : 3);
    assert.equal(settlement.elapsedPoints, settlement.awardedPoints === 0 ? 0 : expectedAward - 3);
  }

  step = "완료 재요청 0P·총점과 지급 합계 일치";
  const repeated = await complete();
  assert.equal(repeated.status, 200);
  assert.deepEqual(repeated.body.data.settlement, { challengeId, elapsedPoints: 0, goalPoints: 0, awardedPoints: 0 });
  assert.equal(repeated.body.data.challenge.awardedPoints, expectedAward);
  const total = await prisma.challenge.aggregate({ where: { studyId }, _sum: { awardedPoints: true } });
  const storedStudy = await prisma.study.findUniqueOrThrow({ where: { id: studyId }, select: { points: true } });
  assert.equal(storedStudy.points, expectedAward);
  assert.equal(storedStudy.points, total._sum.awardedPoints);

  step = "완료 이후 현재 조회·목표 복원·새 시작";
  const finished = await request({ path: "/current" });
  assert.equal(finished.status, 200);
  assert.equal(finished.body.data.challenge, null);
  assert.equal(finished.body.data.goalMinutes, goalMinutes);
  assert.equal(finished.body.data.points, expectedAward);
  const restarted = await request({ method: "POST", body: { goalMinutes } });
  assert.equal(restarted.status, 201);
  assert.notEqual(restarted.body.data.challenge.id, challengeId);
  assert.equal(restarted.body.data.challenge.awardedPoints, 0);
  assert.equal(restarted.body.data.points, expectedAward);

  console.log(`집중 완료 API 검증 성공: 실제 ${goalMinutes}분·${expectedAward}P·재요청0P·롤백·합계·목표복원`);
} catch {
  console.error(`집중 완료 API 검증 실패: ${step}`);
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
  for (const id of fixtureIds) {
    try {
      await prisma.study.delete({ where: { id } });
    } catch {
      console.error(`임시 데이터 정리 실패. 스터디 ID: ${id}`);
      process.exitCode = 1;
    }
  }
  if (fixtureIds.length > 0 && process.exitCode !== 1) {
    console.log("임시 스터디·집중 정리 완료");
  }
  try {
    await prisma.$disconnect();
  } catch {
    console.error("DB 연결 종료 실패");
    process.exitCode = 1;
  }
}
