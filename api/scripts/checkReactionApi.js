import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import bcrypt from "bcrypt";
import { assertLocalDatabase } from "./localDatabase.js";

// 로컬 DB·실제 스터디/응원 라우터 검증. --preflight는 주소 검사만 한다.
// 정렬과 기존 데이터 호환 검사용 행은 이번 실행의 임시 스터디에만 직접 만든다.
// 임시 데이터 외 기존 스터디·시드는 수정하지 않는다. 별도 서버 실행은 필요 없다.
const fixtureKey = randomBytes(6).toString("hex");
const marker = "응원 API 검증 " + randomUUID();
const fixtureIds = [];
let prisma;
let server;
let step = "검증 인자 확인";

const runChecks = async () => {
  const args = process.argv.slice(2);
  assert.equal(args.length <= 1 && args.every((arg) => arg === "--preflight"), true);
  step = "로컬 DB 주소 확인";
  await assertLocalDatabase();
  if (args.includes("--preflight")) {
    console.log("응원 API 사전 확인 성공: 로컬 주소 허용. DB·서버 연결과 데이터 변경 없음");
    return;
  }
  step = "검증 모듈 준비";
  ({ prisma } = await import("../src/lib/prisma.js"));
  const { default: studyRouter } = await import("../src/routes/study.js");
  const { errorHandler } = await import("../src/middlewares/errorHandler.js");
  const password = randomBytes(8).toString("hex");
  const passwordHash = await bcrypt.hash(password, 12);

  step = "이번 실행의 임시 스터디 준비";
  for (let index = 0; index < 4; index += 1) {
    const study = await prisma.study.create({
      data: { nickname: "응원검증", name: "검증" + fixtureKey + (index + 1), introduction: marker, passwordHash },
      select: { id: true },
    });
    fixtureIds.push(study.id);
  }
  const [studyId, otherStudyId, sortStudyId, legacyStudyId] = fixtureIds;
  const browserId = randomUUID();
  const secondBrowserId = randomUUID();
  const legacyBrowserId = randomUUID();
  step = "로컬 검증 서버 시작";
  const app = express();
  app.use(express.json());
  app.use("/api/studies", studyRouter);
  app.use(errorHandler);
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  const baseUrl = "http://127.0.0.1:" + server.address().port + "/api/studies";
  const request = async ({ id = studyId, method = "GET", path = "", body } = {}) => {
    // 공개 API이므로 비밀번호 헤더를 보내지 않는다.
    const response = await fetch(baseUrl + "/" + id + path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    assert.equal([password, passwordHash].some((value) => text.includes(value)), false);
    assert.equal(/"(?:password|passwordConfirm|passwordHash|browserId|studyId)"\s*:/.test(text), false);
    if (response.status >= 400) assert.equal(response.headers.get("cache-control"), "no-store");
    return { status: response.status, body: JSON.parse(text) };
  };
  const add = (emoji, browser = browserId, id = studyId) => request({
    id, method: "POST", path: "/reactions", body: { browserId: browser, emoji },
  });
  const expectSummary = (reactions) => {
    assert.equal(Array.isArray(reactions), true);
    for (const row of reactions) {
      assert.deepEqual(Object.keys(row).sort(), ["count", "emoji"]);
      assert.equal(typeof row.emoji, "string");
      assert.equal(Number.isInteger(row.count) && row.count > 0, true);
    }
  };
  const expectAdded = (response, expected) => {
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body), ["data"]);
    assert.deepEqual(Object.keys(response.body.data), ["reactions"]);
    expectSummary(response.body.data.reactions);
    if (expected !== undefined) assert.deepEqual(response.body.data.reactions, expected);
    return response.body.data.reactions;
  };
  const detailReactions = async (id = studyId) => {
    const detail = await request({ id });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.id, id);
    expectSummary(detail.body.data.reactions);
    return detail.body.data.reactions;
  };
  const batchReactions = async (id = studyId) => {
    const response = await request({ id: "batch", path: "?ids=" + encodeURIComponent(id) });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, id);
    const reactions = response.body.data[0].reactions;
    expectSummary(reactions);
    assert.equal(reactions.length <= 3, true);
    return reactions;
  };
  const expectError = (response, status, code) => {
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(response.body), ["error"]);
    assert.deepEqual(Object.keys(response.body.error).sort(), ["code", "details", "message"]);
    assert.equal(response.body.error.code, code);
    assert.equal(response.body.error.details, null);
    assert.equal(typeof response.body.error.message, "string");
  };
  const snapshot = async () => prisma.$transaction([
    prisma.study.findMany({
      where: { id: { in: fixtureIds } }, orderBy: { id: "asc" },
      select: { id: true, nickname: true, name: true, introduction: true, backgroundKey: true, points: true, updatedAt: true },
    }),
    prisma.reaction.findMany({
      where: { studyId: { in: fixtureIds } },
      orderBy: [{ studyId: "asc" }, { browserId: "asc" }, { emoji: "asc" }],
    }),
  ], { isolationLevel: "RepeatableRead" });

  step = "빈 응원·잘못된 입력 거절과 DB 불변";
  assert.deepEqual(await detailReactions(), []);
  const original = await snapshot();
  for (const body of [
    undefined, {}, [], { browserId }, { emoji: "🔥" },
    { browserId: "invalid", emoji: "🔥" }, { browserId, emoji: 123 },
    { browserId, emoji: "🔥", extra: true },
  ]) expectError(await request({ method: "POST", path: "/reactions", body }), 400, "VALIDATION_ERROR");
  for (const emoji of ["", "abc", "🔥🔥", " 🔥", "🔥\n", "🏽"]) {
    expectError(await add(emoji), 400, "INVALID_EMOJI");
  }
  expectError(await add("🔥", browserId, "invalid-id"), 400, "VALIDATION_ERROR");
  expectError(await add("🔥", browserId, randomUUID()), 404, "STUDY_NOT_FOUND");
  expectError(await request({ method: "POST", path: "/reactions?extra=1", body: { browserId, emoji: "🔥" } }), 400, "VALIDATION_ERROR");
  assert.deepEqual(await snapshot(), original);

  step = "피부색 기본 키 저장·같은 브라우저 반복 409";
  expectAdded(await add("👍🏽"), [{ emoji: "👍", count: 1 }]);
  const stored = await prisma.reaction.findMany({ where: { studyId } });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].browserId, browserId);
  assert.equal(stored[0].emoji, "👍");
  const beforeRepeated = await snapshot();
  for (const emoji of ["👍", "👍🏻", "👍🏿"]) expectError(await add(emoji), 409, "REACTION_POLICY_CONFLICT");
  assert.deepEqual(await snapshot(), beforeRepeated);
  assert.deepEqual(await detailReactions(), [{ emoji: "👍", count: 1 }]);

  step = "같은 기본 이모지 동시 요청은 200 한 번·409 한 번";
  const attempts = await Promise.allSettled([
    add("👍🏾", secondBrowserId), add("👍🏻", secondBrowserId),
  ]);
  assert.equal(attempts.every((result) => result.status === "fulfilled"), true);
  const responses = attempts.map((result) => result.value);
  assert.deepEqual(responses.map((result) => result.status).sort((a, b) => a - b), [200, 409]);
  expectAdded(responses.find((result) => result.status === 200), [{ emoji: "👍", count: 2 }]);
  expectError(responses.find((result) => result.status === 409), 409, "REACTION_POLICY_CONFLICT");
  assert.equal(await prisma.reaction.count({ where: { studyId, emoji: "👍" } }), 2);
  console.log("[성공] 공개 등록 200·기본 키 저장·피부색/동시 중복 409·실패 시 DB 불변");

  step = "다른 이모지·다른 스터디 허용·종류 수 제한 없음";
  expectAdded(await add("🔥"), [{ emoji: "👍", count: 2 }, { emoji: "🔥", count: 1 }]);
  expectAdded(await add("👍🏿", browserId, otherStudyId), [{ emoji: "👍", count: 1 }]);
  for (const emoji of ["👩🏽‍💻", "🇰🇷", "1️⃣", "🌱"]) expectAdded(await add(emoji));
  assert.equal(await prisma.reaction.count({ where: { studyId, browserId } }), 6);
  const afterAdditions = await snapshot();
  const sixReactions = await detailReactions();
  assert.equal(sixReactions.length, 6);
  assert.deepEqual(await batchReactions(), sixReactions.slice(0, 3));
  assert.deepEqual(await snapshot(), afterAdditions);
  assert.equal(afterAdditions[0].every((row) => row.points === 0), true);

  step = "DB 복합 PK도 동일 키 직접 삽입을 거절";
  await assert.rejects(
    prisma.reaction.create({ data: { studyId, browserId, emoji: "👍" } }),
    (error) => error?.code === "P2002",
  );
  assert.deepEqual(await snapshot(), afterAdditions);

  step = "8종 전체 반환·나머지 5종·다건 상위3 유지";
  let eightReactions;
  for (const emoji of ["👏", "💪"]) eightReactions = expectAdded(await add(emoji));
  assert.equal(eightReactions.length, 8);
  assert.equal(eightReactions.slice(3).length, 5);
  assert.deepEqual(await detailReactions(), eightReactions);
  assert.deepEqual(await batchReactions(), eightReactions.slice(0, 3));

  // 정렬 동률은 시계 속도에 의존하지 않도록 임시 행의 createdAt을 명시한다.
  const earlier = new Date("2026-10-12T00:00:00.000Z");
  const later = new Date("2026-10-12T00:01:00.000Z");
  const seedReaction = (emoji, createdAt, browser = randomUUID()) => ({
    studyId: sortStudyId, browserId: browser, emoji, createdAt,
  });
  step = "0·1·2종 응답과 최초 시각 정렬";
  assert.deepEqual(await detailReactions(sortStudyId), []);
  await prisma.reaction.create({ data: seedReaction("🔥", later) });
  assert.deepEqual(await detailReactions(sortStudyId), [{ emoji: "🔥", count: 1 }]);
  await prisma.reaction.create({ data: seedReaction("🌱", earlier) });
  assert.deepEqual(await detailReactions(sortStudyId), [{ emoji: "🌱", count: 1 }, { emoji: "🔥", count: 1 }]);
  step = "전체 집계의 개수 내림·최초 시각 오름·C collation 동률";
  await prisma.reaction.createMany({ data: [
    seedReaction("🔥", later),
    seedReaction("👏", earlier), seedReaction("👏", later),
    seedReaction("💪", earlier), seedReaction("💪", later),
  ] });
  assert.deepEqual(await detailReactions(sortStudyId), [
    { emoji: "👏", count: 2 }, { emoji: "💪", count: 2 }, { emoji: "🔥", count: 2 },
    { emoji: "🌱", count: 1 },
  ]);
  const sortedResponse = expectAdded(await add("🌱", randomUUID(), sortStudyId), [
    { emoji: "🌱", count: 2 }, { emoji: "👏", count: 2 }, { emoji: "💪", count: 2 },
    { emoji: "🔥", count: 2 },
  ]);
  assert.deepEqual(await detailReactions(sortStudyId), sortedResponse);
  assert.deepEqual(await batchReactions(sortStudyId), sortedResponse.slice(0, 3));
  console.log("[성공] 0~8종 전체 집계·나머지5종·다른 스터디 분리·다건 상위3·등록/상세 정렬 일치");

  step = "둘러보기 목록의 상위3·빈 응원·페이지네이션";
  const expectedListReactions = new Map([
    [studyId, eightReactions.slice(0, 3)],
    [otherStudyId, [{ emoji: "👍", count: 1 }]],
    [sortStudyId, sortedResponse.slice(0, 3)],
    [legacyStudyId, []],
  ]);
  const listedIds = [];
  for (const offset of [0, 2, 4]) {
    const query = new URLSearchParams({ keyword: marker, limit: "2", offset: String(offset) });
    const response = await request({ id: "", path: "?" + query });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), ["data", "pagination"]);
    assert.deepEqual(response.body.pagination, {
      offset, limit: 2, total: 4, hasMore: offset < 2,
    });
    assert.equal(response.body.data.length, offset < 4 ? 2 : 0);
    for (const study of response.body.data) {
      assert.equal(expectedListReactions.has(study.id), true);
      expectSummary(study.reactions);
      assert.deepEqual(study.reactions, expectedListReactions.get(study.id));
      listedIds.push(study.id);
    }
  }
  assert.deepEqual([...listedIds].sort(), [...fixtureIds].sort());
  console.log("[성공] 둘러보기 목록 상위3·스터디별 집계 분리·응원 없는 카드·더보기·빈 페이지");

  step = "기존 피부색 행의 중복 검사·브라우저별 통합 집계·원본 보존";
  await prisma.reaction.createMany({ data: [
    { studyId: legacyStudyId, browserId: legacyBrowserId, emoji: "👍🏻", createdAt: earlier },
    { studyId: legacyStudyId, browserId: legacyBrowserId, emoji: "👍🏽", createdAt: later },
    { studyId: legacyStudyId, browserId: randomUUID(), emoji: "👍🏿", createdAt: later },
  ] });
  const beforeLegacy = await snapshot();
  assert.deepEqual(await detailReactions(legacyStudyId), [{ emoji: "👍", count: 2 }]);
  expectError(await add("👍", legacyBrowserId, legacyStudyId), 409, "REACTION_POLICY_CONFLICT");
  expectError(await add("👍🏿", legacyBrowserId, legacyStudyId), 409, "REACTION_POLICY_CONFLICT");
  assert.deepEqual(await snapshot(), beforeLegacy);
  expectAdded(await add("👍🏾", randomUUID(), legacyStudyId), [{ emoji: "👍", count: 3 }]);
  const unchangedLegacy = await prisma.reaction.findMany({
    where: { studyId: legacyStudyId, browserId: legacyBrowserId }, orderBy: { emoji: "asc" },
  });
  assert.deepEqual(unchangedLegacy.map((row) => row.emoji), ["👍🏻", "👍🏽"]);
  assert.equal(await prisma.reaction.count({ where: { studyId: legacyStudyId } }), 4);
  console.log("응원 API 검증 성공: 등록200·중복/동시409·입력400·대상404·기본 키 저장·집계·기존 행 보존");
};

try {
  await runChecks();
} catch {
  console.error("응원 API 검증 실패: " + step);
  if (step === "로컬 DB 주소 확인") {
    console.error("로컬 DB 전용입니다. localhost/127.0.0.1:5435의 forest-of-study만 허용하며 Neon은 차단합니다.");
  }
  process.exitCode = 1;
} finally {
  if (server !== undefined) {
    await new Promise((resolve) => {
      server.close((error) => {
        if (error) { console.error("검증 서버 종료 실패"); process.exitCode = 1; }
        resolve();
      });
      server.closeIdleConnections();
    });
  }
  if (prisma !== undefined) {
    if (fixtureIds.length > 0) {
      try {
        const deleted = await prisma.study.deleteMany({
          where: { id: { in: fixtureIds }, introduction: marker },
        });
        assert.equal(deleted.count, fixtureIds.length);
        console.log("이번 실행의 임시 스터디·응원 정리 완료");
      } catch {
        console.error("임시 데이터 정리 실패. 스터디 ID: " + fixtureIds.join(", "));
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
