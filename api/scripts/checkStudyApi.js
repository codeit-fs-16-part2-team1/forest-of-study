import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { uuidSchema } from "../src/utils/uuid.js";
import { assertLocalDatabase } from "./localDatabase.js";

// 로컬 DB·실제 스터디 라우터 검사. --preflight는 주소 확인만 하고 종료한다.
// 복합 UNIQUE·배경·글자색·패턴 5종 migration 적용 후 실행한다.
// 이 실행에서 만든 스터디만 삭제한다.
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
  const request = async ({ path = "", method = "GET", body: input, withPassword = false } = {}) => {
    const response = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
        ...(withPassword ? { "X-Study-Password": password } : {}),
      },
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
    "backgroundColor", "backgroundKey", "createdAt", "id", "introduction", "name", "nickname", "patternColor", "patternKey", "points", "textColor", "updatedAt",
  ]);
  assert.equal(created.body.data.points, 0);
  assert.equal(created.body.data.backgroundKey, "green");
  assert.equal(created.body.data.backgroundColor, null);
  assert.equal(created.body.data.textColor, null);
  assert.equal(created.body.data.patternKey, null);
  assert.equal(created.body.data.patternColor, null);
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

  step = "사용자 지정 배경 생성·상세·목록·다건 재조회";
  const custom = await create({
    ...body, nickname: "색상검증", backgroundKey: "custom", backgroundColor: "#3A8F72", textColor: "#ABCDEF",
    patternKey: "dots", patternColor: "#FF52DC",
  });
  assert.equal(custom.status, 201);
  const customId = custom.body.data.id;
  const expectColor = (study, key, color, textColor = "#abcdef") => {
    assert.equal(study.backgroundKey, key);
    assert.equal(study.backgroundColor, color);
    assert.equal(study.textColor, textColor);
  };
  const expectPattern = (study, key = "dots", color = "#ff52dc") => {
    assert.equal(study.patternKey, key);
    assert.equal(study.patternColor, color);
  };
  expectColor(custom.body.data, "custom", "#3a8f72");
  expectPattern(custom.body.data);
  const customDetail = await request({ path: "/" + customId });
  assert.equal(customDetail.status, 200);
  expectColor(customDetail.body.data, "custom", "#3a8f72");
  expectPattern(customDetail.body.data);
  const customList = await request({ path: "?keyword=" + encodeURIComponent(marker) });
  assert.equal(customList.status, 200);
  expectColor(customList.body.data.find(({ id }) => id === customId), "custom", "#3a8f72");
  expectPattern(customList.body.data.find(({ id }) => id === customId));
  const batch = await request({ path: "/batch?ids=" + customId });
  assert.equal(batch.status, 200);
  expectColor(batch.body.data[0], "custom", "#3a8f72");
  expectPattern(batch.body.data[0]);

  const patch = (changes) => request({
    path: "/" + customId, method: "PATCH", body: changes, withPassword: true,
  });
  step = "사용자 지정 배경 수정·미전달 유지·기본 배경 복귀";
  const renamed = await patch({ name: "색상" + fixtureKey });
  assert.equal(renamed.status, 200);
  expectColor(renamed.body.data, "custom", "#3a8f72");
  expectPattern(renamed.body.data);
  const recolored = await patch({ backgroundKey: "custom", backgroundColor: "#000000" });
  assert.equal(recolored.status, 200);
  expectColor(recolored.body.data, "custom", "#000000");
  expectPattern(recolored.body.data);
  const textChanged = await patch({ textColor: "#F0AB12" });
  assert.equal(textChanged.status, 200);
  expectColor(textChanged.body.data, "custom", "#000000", "#f0ab12");
  const automatic = await patch({ textColor: null });
  assert.equal(automatic.status, 200);
  expectColor(automatic.body.data, "custom", "#000000", null);
  const restored = await patch({ textColor: "#ABCDEF" });
  assert.equal(restored.status, 200);
  expectColor(restored.body.data, "custom", "#000000");

  step = "패턴 5종 수정·재조회·없음 복귀·다시 선택·잘못된 조합 거절";
  for (const patternKey of ["stripes", "waves", "leaves", "paper"]) {
    const changed = await patch({ patternKey, patternColor: "#F0AB12" });
    assert.equal(changed.status, 200);
    expectColor(changed.body.data, "custom", "#000000");
    expectPattern(changed.body.data, patternKey, "#f0ab12");
    const detail = await request({ path: "/" + customId });
    assert.equal(detail.status, 200);
    expectPattern(detail.body.data, patternKey, "#f0ab12");
  }
  const removed = await patch({ patternKey: null, patternColor: null });
  assert.equal(removed.status, 200);
  expectPattern(removed.body.data, null, null);
  const patternRestored = await patch({ patternKey: "dots", patternColor: "#FF52DC" });
  assert.equal(patternRestored.status, 200);
  expectPattern(patternRestored.body.data);
  for (const changes of [
    { patternKey: "dots" }, { patternColor: "#123456" },
    { patternKey: "dots", patternColor: null }, { patternKey: null, patternColor: "#123456" },
    { patternKey: "unknown", patternColor: "#123456" },
    { patternKey: "dots", patternColor: "#123456\n" },
    { backgroundKey: "green", patternKey: "dots", patternColor: "#123456" },
  ]) expectError(await patch(changes), 400, "INVALID_BACKGROUND");
  expectError(await create({ ...body, patternKey: "dots", patternColor: "#123456" }), 400, "INVALID_BACKGROUND");
  expectError(await create({ ...body, backgroundKey: "custom", backgroundColor: "#123456", patternKey: "dots" }), 400, "INVALID_BACKGROUND");
  for (const textColor of ["#abc", "#123456\n", "red"]) {
    expectError(await patch({ textColor }), 400, "VALIDATION_ERROR");
    expectError(await create({ ...body, backgroundKey: "custom", backgroundColor: "#123456", textColor }), 400, "VALIDATION_ERROR");
  }
  expectError(await patch({ backgroundKey: "green", textColor: "#ffffff" }), 400, "VALIDATION_ERROR");
  expectError(await create({ ...body, textColor: "#ffffff" }), 400, "VALIDATION_ERROR");
  for (const changes of [
    { backgroundKey: "custom" },
    { backgroundKey: "custom", backgroundColor: "#abc" },
    { backgroundKey: "custom", backgroundColor: null },
    { backgroundKey: "green", backgroundColor: "#ffffff" },
    { backgroundColor: "#ffffff" },
  ]) expectError(await patch(changes), 400, "INVALID_BACKGROUND");
  for (const changes of [
    { backgroundKey: "custom" },
    { backgroundKey: "custom", backgroundColor: "rgb(1,2,3)" },
    { backgroundKey: "blue", backgroundColor: "#ffffff" },
  ]) expectError(await create({ ...body, ...changes }), 400, "INVALID_BACKGROUND");
  expectColor(await prisma.study.findUniqueOrThrow({ where: { id: customId } }), "custom", "#000000");

  step = "DB의 잘못된 배경 조합 직접 저장 거절";
  for (const data of [
    { patternKey: null }, { patternColor: null },
    { patternKey: "unknown" }, { patternColor: "#FF52DC" },
    { patternColor: "#123456\n" },
  ]) await assert.rejects(prisma.study.update({ where: { id: customId }, data }));
  expectPattern(await prisma.study.findUniqueOrThrow({ where: { id: customId } }));
  await assert.rejects(prisma.study.update({ where: { id: customId }, data: { backgroundColor: null } }));
  await assert.rejects(prisma.study.update({ where: { id: customId }, data: { textColor: "#ABCDEF" } }));
  await assert.rejects(prisma.study.update({ where: { id: customId }, data: { textColor: "#abc" } }));
  await assert.rejects(prisma.study.update({ where: { id: customId }, data: { textColor: "#123456\n" } }));
  expectColor(await prisma.study.findUniqueOrThrow({ where: { id: customId } }), "custom", "#000000");
  const preset = await patch({ backgroundKey: "pink" });
  assert.equal(preset.status, 200);
  expectColor(preset.body.data, "pink", null, null);
  expectPattern(preset.body.data, null, null);
  expectColor((await request({ path: "/" + customId })).body.data, "pink", null, null);
  expectError(await patch({ textColor: "#123456" }), 400, "VALIDATION_ERROR");
  expectError(await patch({ patternKey: "dots", patternColor: "#123456" }), 400, "INVALID_BACKGROUND");
  await assert.rejects(prisma.study.update({
    where: { id: customId }, data: { patternKey: "dots", patternColor: "#123456" },
  }));
  await assert.rejects(prisma.study.update({ where: { id: customId }, data: { textColor: "#123456" } }));
  await assert.rejects(prisma.study.update({ where: { id: customId }, data: { backgroundColor: "#ffffff" } }));
  expectColor(await prisma.study.findUniqueOrThrow({ where: { id: customId } }), "pink", null, null);

  console.log("스터디 API 검증 성공: 기존 배경·사용자 색상·패턴 생성/수정·목록/다건 재조회·잘못된 조합400·DB CHECK·기존 중복/입력 검사");
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
