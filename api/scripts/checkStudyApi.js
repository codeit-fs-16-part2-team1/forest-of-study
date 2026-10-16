import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { uuidSchema } from "../src/utils/uuid.js";
import { assertLocalDatabase } from "./localDatabase.js";

// 로컬 DB·실제 스터디 라우터 검사. --preflight는 주소 확인만 하고 종료한다.
// 복합 UNIQUE migration 적용 후 실행한다. 이 실행에서 만든 스터디만 삭제한다.
const fixtureKey = randomBytes(6).toString("hex");
const marker = `스터디 API 검증 ${randomUUID()}`;
const fixtureIds = new Set();
let prisma;
let server;
let step = "검증 인자 확인";

const runChecks = async () => {
  const args = process.argv.slice(2);
  assert.equal(args.length <= 1 && args.every((arg) => arg === "--preflight"), true);
  step = "로컬 DB 주소 확인";
  await assertLocalDatabase();
  if (args.includes("--preflight")) {
    console.log("스터디 API 사전 확인 성공: DB 연결·변경 없음");
    return;
  }

  step = "검증 모듈 준비";
  ({ prisma } = await import("../src/lib/prisma.js"));
  const { default: studyRouter } = await import("../src/routes/study.js");
  const { errorHandler } = await import("../src/middlewares/errorHandler.js");

  step = "스터디 복합 UNIQUE 적용 확인";
  const indexes = await prisma.$queryRaw`
    SELECT i.indisunique AS is_unique, i.indisvalid AS is_valid,
           pg_get_expr(i.indpred, i.indrelid) AS predicate,
           pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE n.nspname = 'public' AND t.relname = 'Study'
      AND idx.relname = 'Study_nickname_name_key'
  `;
  const index = indexes[0];
  assert.equal(index?.is_unique, true);
  assert.equal(index.is_valid, true);
  assert.equal(index.predicate, null);
  assert.equal(index.definition.replaceAll('"', '').includes('(nickname, name)'), true);

  step = "로컬 검증 서버 시작";
  const app = express();
  app.use(express.json());
  app.use("/api/studies", studyRouter);
  app.use(errorHandler);
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/studies`;
  const password = randomBytes(8).toString("hex");
  const secrets = [password];
  const body = {
    nickname: "생성검증", name: "검증" + fixtureKey, introduction: marker,
    password, passwordConfirm: password,
  };
  const request = async ({ path = "", method = "GET", body: input } = {}) => {
    const response = await fetch(baseUrl + path, {
      method,
      headers: input === undefined ? {} : { "Content-Type": "application/json" },
      body: input === undefined ? undefined : JSON.stringify(input),
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    const payload = JSON.parse(text);
    if (response.status === 201 && payload.data?.introduction === marker
        && uuidSchema.safeParse(payload.data.id).success) {
      fixtureIds.add(payload.data.id);
    }
    assert.equal(secrets.some((value) => text.includes(value)), false);
    assert.equal(/"(?:password|passwordConfirm|passwordHash)"\s*:/.test(text), false);
    if (response.status >= 400) assert.equal(response.headers.get("cache-control"), "no-store");
    return { status: response.status, body: payload };
  };
  const expectError = (response, status, code) => {
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(response.body), ["error"]);
    assert.deepEqual(Object.keys(response.body.error).sort(), ["code", "details", "message"]);
    assert.equal(response.body.error.code, code);
    assert.equal(typeof response.body.error.message, "string");
    assert.equal(response.body.error.details, null);
  };
  const create = (input) => request({ method: "POST", body: input });

  step = "공백 포함 비밀번호·확인값 거절과 미생성";
  for (const value of [` ${password}`, `${password} `, `${password}\n`, password.slice(0, 4) + " \t\n" + password.slice(4)]) {
    secrets.push(value);
    expectError(await create({ ...body, password: value }), 400, "VALIDATION_ERROR");
    expectError(await create({ ...body, passwordConfirm: value }), 400, "VALIDATION_ERROR");
  }
  expectError(await create({ ...body, passwordConfirm: "Other123!" }), 400, "PASSWORD_CONFIRM_MISMATCH");
  assert.equal(await prisma.study.count({ where: { introduction: marker } }), 0);

  step = "생성 201·공개 필드·상세 200";
  const created = await create(body);
  assert.equal(created.status, 201);
  const studyId = created.body.data.id;
  assert.deepEqual(Object.keys(created.body.data).sort(), [
    "backgroundKey", "createdAt", "id", "introduction", "name", "nickname", "points", "updatedAt",
  ]);
  assert.equal(created.body.data.points, 0);
  assert.equal(created.body.data.backgroundKey, "green");
  const detail = await request({ path: "/" + studyId });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.id, studyId);
  assert.deepEqual(detail.body.data.reactions, []);

  step = "동일 조합·trim 후 동일 조합 409";
  expectError(await create(body), 409, "STUDY_CONFLICT");
  expectError(await create({ ...body, nickname: ` ${body.nickname} `, name: ` ${body.name} ` }), 409, "STUDY_CONFLICT");
  assert.equal(await prisma.study.count({ where: { nickname: body.nickname, name: body.name } }), 1);

  step = "DB에 직접 중복 생성해도 UNIQUE 거절";
  const stored = await prisma.study.findUniqueOrThrow({ where: { id: studyId } });
  secrets.push(stored.passwordHash);
  const duplicate = prisma.study.create({
    data: {
      nickname: body.nickname, name: body.name, introduction: marker, passwordHash: stored.passwordHash,
    },
    select: { id: true },
  }).then((row) => {
    // 제약이 잘못돼 생성되더라도 이 실행의 데이터는 정리 대상에 포함한다.
    fixtureIds.add(row.id);
    return row;
  });
  await assert.rejects(duplicate, (error) => error?.code === "P2002");

  step = "닉네임만·이름만 같은 조합 허용";
  assert.equal((await create({ ...body, name: "다름" + fixtureKey })).status, 201);
  assert.equal((await create({ ...body, nickname: "다른검증" })).status, 201);

  step = "동시 같은 조합 생성은 201 한 번·409 한 번";
  const concurrentBody = { ...body, nickname: "동시검증" };
  const attempts = await Promise.allSettled([create(concurrentBody), create(concurrentBody)]);
  assert.equal(attempts.every((result) => result.status === "fulfilled"), true);
  const results = attempts.map((result) => result.value);
  assert.deepEqual(results.map((result) => result.status).sort((a, b) => a - b), [201, 409]);
  expectError(results.find((result) => result.status === 409), 409, "STUDY_CONFLICT");
  assert.equal(await prisma.study.count({ where: { nickname: concurrentBody.nickname, name: body.name } }), 1);

  step = "목록 1·6 허용과 7·미등록 쿼리 거절";
  for (const limit of [1, 6]) {
    const listed = await request({ path: `?limit=${limit}&keyword=${encodeURIComponent(marker)}` });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.pagination.limit, limit);
    assert.equal(listed.body.pagination.total, fixtureIds.size);
    assert.equal(listed.body.data.length <= limit, true);
  }
  expectError(await request({ path: "?limit=7" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "?limti=6" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "/" + studyId + "?extra=1" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "/invalid-id" }), 400, "VALIDATION_ERROR");
  expectError(await request({ path: "/" + randomUUID() }), 404, "STUDY_NOT_FOUND");

  console.log("스터디 API 검증 성공: 공백 거절·생성201·상세200·중복/동시409·DB UNIQUE·목록 최대6·비밀값 미노출");
};

try {
  await runChecks();
} catch {
  console.error(`스터디 API 검증 실패: ${step}`);
  if (step === "로컬 DB 주소 확인") console.error("로컬 DB 전용 검증입니다. Neon은 허용하지 않습니다.");
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
    if (fixtureIds.size > 0) {
      try {
        const deleted = await prisma.study.deleteMany({
          where: { id: { in: [...fixtureIds] }, introduction: marker },
        });
        assert.equal(deleted.count, fixtureIds.size);
        console.log("이번 실행의 임시 스터디 정리 완료");
      } catch {
        console.error(`임시 스터디 정리 실패. ID: ${[...fixtureIds].join(", ")}`);
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
