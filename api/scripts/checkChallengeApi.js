import { assertLocalDatabase } from "./localDatabase.js";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import bcrypt from "bcrypt";

// 실제 집중 라우터·인증을 임시 서버에서 검사한다. app.js 배포 연결 검증은 별도다.
// 로컬 DB에 이 실행에서 만든 스터디만 사용하며 마지막에 정리한다.
const fixtureKey = randomBytes(6).toString("hex");
let prisma;
let studyId;
let server;
let step = "검증 인자 확인";

const runChecks = async () => {
  const args = process.argv.slice(2);
  assert.equal(args.length <= 1 && args.every((arg) => arg === "--preflight"), true);
  step = "로컬 DB 주소 확인";
  await assertLocalDatabase();
  if (args.includes("--preflight")) {
    console.log("로컬 DB 주소 사전 확인 성공: DB 연결·변경 없음");
    return;
  }
  step = "검증 모듈 준비";
  ({ prisma } = await import("../src/lib/prisma.js"));
  const { createChallengeRouter } = await import("../src/routes/challenge.js");
  const { verifyStudyPassword } = await import("../src/middlewares/verifyStudyPassword.js");
  const { errorHandler } = await import("../src/middlewares/errorHandler.js");
  step = "임시 스터디 생성";
  const password = randomBytes(8).toString("hex");
  const wrongPassword = (password[0] === "a" ? "b" : "a") + password.slice(1);
  const passwordHash = await bcrypt.hash(password, 12);
  const study = await prisma.study.create({
    data: {
      nickname: "집중검증",
      name: "검증" + fixtureKey,
      introduction: "검증 종료 시 삭제하는 임시 스터디입니다.",
      passwordHash,
    },
    select: { id: true },
  });
  studyId = study.id;

  step = "로컬 검증 서버 시작";
  const app = express();
  app.use(express.json());
  app.use("/api/studies/:studyId/challenges", createChallengeRouter({ verifyStudyPassword }));
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
      redirect: "error", signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal([password, wrongPassword, passwordHash].some((value) => text.includes(value)), false);
    return { status: response.status, body: JSON.parse(text) };
  };
  const expectError = (response, status, code) => {
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(response.body), ["error"]);
    assert.equal(response.body.error.code, code);
    assert.equal(typeof response.body.error.message, "string");
    assert.equal(response.body.error.details, null);
  };

  step = "조회·시작의 인증 실패와 미생성 확인";
  expectError(await request({ path: "/current", header: null }), 401, "VERIFICATION_REQUIRED");
  expectError(await request({ method: "POST", body: {}, header: wrongPassword }), 401, "PASSWORD_MISMATCH");
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 0);

  step = "UUID·없는 스터디·목표 입력 거절";
  expectError(await request({ id: "invalid-id", path: "/current" }), 400, "VALIDATION_ERROR");
  expectError(await request({ id: randomUUID(), path: "/current" }), 404, "STUDY_NOT_FOUND");
  expectError(await request({ method: "POST", body: { goalMinutes: 9 } }), 400, "VALIDATION_ERROR");
  expectError(await request({ method: "POST", body: { goalMinutes: 10, points: 100 } }), 400, "VALIDATION_ERROR");
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 0);

  step = "쿼리 입력·공백 포함 헤더 거절";
  expectError(await request({ path: "/current?extra=1" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "?extra=1", method: "POST", body: {} }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "/current", header: password.slice(0, 4) + " " + password.slice(4) }), 400, "VALIDATION_ERROR");

  step = "API-FC-01 이력 없는 초기 조회";
  const initial = await request({ path: "/current" });
  assert.equal(initial.status, 200);
  assert.equal(initial.body.data.challenge, null);
  assert.equal(initial.body.data.goalMinutes, 10);
  assert.equal(initial.body.data.points, 0);

  step = "API-FC-02 시작 201";
  const started = await request({ method: "POST", body: { goalMinutes: 25 } });
  assert.equal(started.status, 201);
  const challenge = started.body.data.challenge;
  assert.equal(challenge.studyId, studyId);
  assert.equal(challenge.status, "RUNNING");
  assert.equal(challenge.goalMinutes, 25);
  assert.equal(challenge.elapsedMilliseconds, 0);
  assert.equal(challenge.awardedPoints, 0);
  assert.equal(started.body.data.points, 0);
  assert.equal(started.body.data.settlement, null);

  step = "API-FC-01 동일 집중 조회 200·RUNNING 재시작 409";
  const current = await request({ path: "/current" });
  assert.equal(current.status, 200);
  assert.equal(current.body.data.challenge.id, challenge.id);
  assert.equal(current.body.data.goalMinutes, 25);
  expectError(await request({ method: "POST", body: {} }), 409, "CHALLENGE_CONFLICT");
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 1);

  step = "PAUSED에서도 새 시작 차단";
  // 임시 상태를 준비한다. 일시정지·초기화 API 자체를 검증하는 것은 아니다.
  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { status: "PAUSED", elapsedMilliseconds: 90000, lastStartedAt: null },
  });
  const paused = await request({ path: "/current" });
  assert.equal(paused.status, 200);
  assert.equal(paused.body.data.challenge.status, "PAUSED");
  assert.equal(paused.body.data.challenge.remainingSeconds, 1410);
  assert.equal(paused.body.data.challenge.endsAt, null);
  expectError(await request({ method: "POST", body: {} }), 409, "CHALLENGE_CONFLICT");

  step = "RESET 이력의 목표 복원·기본 목표로 새 행 시작";
  await prisma.challenge.update({ where: { id: challenge.id }, data: { status: "RESET" } });
  const reset = await request({ path: "/current" });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.data.challenge, null);
  assert.equal(reset.body.data.goalMinutes, 25);
  assert.equal(reset.body.data.points, 0);
  const restarted = await request({ method: "POST", body: {} });
  assert.equal(restarted.status, 201);
  assert.notEqual(restarted.body.data.challenge.id, challenge.id);
  assert.equal(restarted.body.data.challenge.goalMinutes, 10);
  assert.equal(restarted.body.data.challenge.elapsedMilliseconds, 0);
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 2);
  const storedStudy = await prisma.study.findUniqueOrThrow({ where: { id: studyId }, select: { points: true } });
  assert.equal(storedStudy.points, 0);

  console.log("집중 API 검증 성공: 인증·입력·시작201·조회200·활성충돌409·목표복원·새행생성");
};

try {
  await runChecks();
} catch {
  console.error(`집중 API 검증 실패: ${step}`);
  if (step === "로컬 DB 주소 확인") console.error("로컬 DB 전용 검증입니다. 주소·포트·DB 이름을 확인해주세요. Neon은 허용하지 않습니다.");
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
  if (studyId !== undefined) {
    try {
      await prisma.study.delete({ where: { id: studyId } });
      console.log("임시 스터디·집중 정리 완료");
    } catch {
      console.error(`임시 데이터 정리 실패. 스터디 ID: ${studyId}`);
      process.exitCode = 1;
    }
  }
  if (prisma !== undefined) {
    try {
      await prisma.$disconnect();
    } catch {
      console.error("검증 DB 연결 종료 실패");
      process.exitCode = 1;
    }
  }
}
