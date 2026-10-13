import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";
import studyPasswordRouter from "../src/routes/studyPassword.js";
import { verifyStudyPassword } from "../src/middlewares/verifyStudyPassword.js";
import { errorHandler } from "../src/middlewares/errorHandler.js";
import { sendSuccess } from "../src/utils/apiResponse.js";

// 로컬 DB 검증용이다. app.js를 실행하거나 운영 라우트를 추가하지 않는다.
// 비밀번호는 실행 중 생성하고 출력하지 않는다. 기존 스터디는 수정하지 않는다.
let studyId;
let server;
let step = "임시 스터디 생성";

try {
  const password = randomBytes(8).toString("hex");
  const wrongPassword = (password[0] === "a" ? "b" : "a") + password.slice(1);
  const passwordHash = await bcrypt.hash(password, 12);
  const secretValues = [password, wrongPassword, passwordHash];
  const study = await prisma.study.create({
    data: {
      nickname: "인증검증",
      name: "비밀번호 검증",
      introduction: "검증 종료 시 삭제하는 임시 스터디입니다.",
      passwordHash,
    },
    select: { id: true },
  });
  studyId = study.id;

  step = "로컬 검증 서버 시작";
  let protectedCalls = 0;
  const app = express();
  app.use(express.json());
  app.use("/api/studies/:studyId/password-verifications", studyPasswordRouter);
  // 검증 서버 안에서만 사용하는 경로다. 실제 습관·집중 API 검증은 별도로 한다.
  app.get("/api/studies/:studyId/__password-check", verifyStudyPassword, (req, res) => {
    protectedCalls += 1;
    return sendSuccess(res, { verified: true });
  });
  app.use(errorHandler);
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/studies`;

  const request = async (path, options, statusCode, errorCode) => {
    const response = await fetch(baseUrl + path, {
      ...options,
      signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    assert.equal(response.status, statusCode);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(secretValues.some((value) => text.includes(value)), false);
    const body = JSON.parse(text);
    if (errorCode === undefined) {
      assert.deepEqual(body, { data: { verified: true } });
    } else {
      assert.deepEqual(Object.keys(body), ["error"]);
      assert.deepEqual(Object.keys(body.error).sort(), ["code", "details", "message"]);
      assert.equal(body.error.code, errorCode);
      assert.equal(typeof body.error.message, "string");
      assert.equal(body.error.details, null);
    }
  };
  const postPassword = (id, body, statusCode, errorCode) => request(
    `/${id}/password-verifications`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    statusCode,
    errorCode,
  );
  const protectedRequest = (value, statusCode, errorCode) => request(
    `/${studyId}/__password-check`,
    { headers: value === undefined ? {} : { "X-Study-Password": value } },
    statusCode,
    errorCode,
  );

  step = "API-AU-01 정상·오답·누락";
  await postPassword(studyId, { password }, 200);
  await postPassword(studyId, { password: wrongPassword }, 401, "PASSWORD_MISMATCH");
  await postPassword(studyId, {}, 401, "VERIFICATION_REQUIRED");
  await request(`/${studyId}/password-verifications`, { method: "POST" }, 401, "VERIFICATION_REQUIRED");

  step = "본문 형식·공백·길이·추가 필드 거절";
  for (const invalid of ["abc", "a".repeat(21), ` ${password}`, `${password} `, "abcd efgh", 1234, null]) {
    await postPassword(studyId, { password: invalid }, 400, "VALIDATION_ERROR");
  }
  await postPassword(studyId, { password, extra: true }, 400, "VALIDATION_ERROR");
  await postPassword("invalid-id", { password }, 400, "VALIDATION_ERROR");
  await postPassword(randomUUID(), { password }, 404, "STUDY_NOT_FOUND");

  step = "진입 확인 이후에도 헤더 누락·오답 거절";
  await protectedRequest(undefined, 401, "VERIFICATION_REQUIRED");
  await protectedRequest(wrongPassword, 401, "PASSWORD_MISMATCH");
  await protectedRequest("abcd efgh", 400, "VALIDATION_ERROR");
  assert.equal(protectedCalls, 0);
  await protectedRequest(password, 200);
  assert.equal(protectedCalls, 1);

  step = "보호 요청마다 DB 해시 재검증";
  // 임시 스터디의 해시만 바꿔 캐시 없이 재검증되는지 확인한다. 비밀번호 변경 API가 아니다.
  const replacementPassword = randomBytes(10).toString("hex");
  const replacementHash = await bcrypt.hash(replacementPassword, 12);
  secretValues.push(replacementPassword, replacementHash);
  await prisma.study.update({
    where: { id: studyId },
    data: { passwordHash: replacementHash },
  });
  await protectedRequest(password, 401, "PASSWORD_MISMATCH");
  assert.equal(protectedCalls, 1);
  await protectedRequest(replacementPassword, 200);
  assert.equal(protectedCalls, 2);

  console.log("비밀번호 검증 성공: 진입 확인·입력 거절·404·헤더 보호·매 요청 재검증·응답 비밀값 제외");
} catch {
  console.error(`비밀번호 검증 실패: ${step}`);
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
      console.log("임시 스터디 정리 완료");
    } catch {
      console.error(`임시 스터디 정리 실패. 스터디 ID: ${studyId}`);
      process.exitCode = 1;
    }
  }
  await prisma.$disconnect();
}
