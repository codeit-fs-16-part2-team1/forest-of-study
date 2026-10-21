import assert from "node:assert/strict";
import { validateCreateStudy, validateUpdateStudy, validateStudyListQuery, validateStudyIdParams } from "../src/schemas/study.js";
import { validateCreateRoutine, validateRoutineCheck, validateRoutineBatch } from "../src/schemas/routine.js";
import { validateStudyPassword, validatePasswordVerificationBody } from "../src/schemas/studyPassword.js";
import { assertLocalSeedDatabase } from "../seedData.js";

// 스키마와 주소 판정만 검사한다. 환경변수·DB·서버를 사용하지 않는다.
let step = "비밀번호 원문·공백 거절";
const body = {
  nickname: "개발자", name: "검증 스터디", introduction: "DB 없는 입력 검사",
  password: "Forest123!", passwordConfirm: "Forest123!",
};

try {
  for (const value of ["abcd", "a".repeat(20), body.password]) {
    const result = validateStudyPassword(value);
    assert.equal(result.success, true);
    assert.equal(result.data, value);
  }
  for (const value of [
    " Forest123!", "Forest123! ", "For est\t123!\n", "a b c d", " abcd", "abcd ",
    "abcd\n", "abcd\r", "abcd\u2028", "abcd\u2029",
    "abc", "a".repeat(21), " \t\n ", "abcd?", 1234, null,
  ]) {
    assert.equal(validateStudyPassword(value).success, false);
    assert.equal(validatePasswordVerificationBody({ password: value }).success, false);
    assert.equal(validateCreateStudy({ ...body, password: value }).success, false);
    assert.equal(validateCreateStudy({ ...body, passwordConfirm: value }).success, false);
  }
  assert.equal(validatePasswordVerificationBody({}).success, true);
  assert.equal(validatePasswordVerificationBody({ password: body.password, extra: true }).success, false);
  const mismatched = validateCreateStudy({ ...body, passwordConfirm: "Forest456!" });
  assert.equal(mismatched.success, false);
  assert.equal(mismatched.error.issues.some((issue) => issue.path[0] === "passwordConfirm"), true);

  step = "스터디 그래핌 경계와 저장할 값";
  const family = "👨‍👩‍👧‍👦";
  for (const [field, maximum] of [["nickname", 10], ["name", 15], ["introduction", 100]]) {
    const value = family.repeat(maximum);
    const result = validateCreateStudy({ ...body, [field]: ` ${value} ` });
    assert.equal(result.success, true);
    assert.equal(result.data[field], value);
    assert.equal(validateCreateStudy({ ...body, [field]: value + family }).success, false);
    assert.equal(validateCreateStudy({ ...body, [field]: " \t" }).success, false);
  }
  assert.equal(validateCreateStudy(body).data.backgroundKey, "green");
  assert.equal(validateCreateStudy({ ...body, backgroundKey: "unknown" }).success, false);
  assert.equal(validateCreateStudy({ ...body, points: 100 }).success, false);

  step = "기존 배경과 사용자 지정 색상 조합";
  for (const backgroundKey of ["green", "yellow", "blue", "pink", "image1", "image2", "image3", "image4"]) {
    const created = validateCreateStudy({ ...body, backgroundKey });
    assert.equal(created.success, true);
    assert.equal(created.data.backgroundColor, null);
    assert.equal(created.data.textColor, null);
    assert.equal(created.data.patternKey, null);
    assert.equal(created.data.patternColor, null);
    assert.deepEqual(validateUpdateStudy({ backgroundKey }).data, {
      backgroundKey, backgroundColor: null, textColor: null, patternKey: null, patternColor: null,
    });
  }
  const custom = { backgroundKey: "custom", backgroundColor: "#3A8F72" };
  assert.equal(validateCreateStudy({ ...body, ...custom }).data.backgroundColor, "#3a8f72");
  assert.deepEqual(validateUpdateStudy(custom).data, { ...custom, backgroundColor: "#3a8f72" });
  assert.deepEqual(validateUpdateStudy({ name: "새 이름" }).data, { name: "새 이름" });
  for (const color of [undefined, null, "", "#abc", "#12345678", "rgb(1, 2, 3)", "red", " #123456", "#123456\n", 123456]) {
    assert.equal(validateCreateStudy({ ...body, backgroundKey: "custom", backgroundColor: color }).success, false);
    assert.equal(validateUpdateStudy({ backgroundKey: "custom", backgroundColor: color }).success, false);
  }
  assert.equal(validateCreateStudy({ ...body, backgroundKey: "green", backgroundColor: "#123456" }).success, false);
  assert.equal(validateUpdateStudy({ backgroundKey: "pink", backgroundColor: "#123456" }).success, false);
  assert.equal(validateUpdateStudy({ backgroundColor: "#123456" }).success, false);
  assert.equal(validateUpdateStudy({ backgroundColor: null }).success, false);

  step = "사용자 지정 배경의 공통 글자색·자동 대비 복귀";
  assert.equal(validateCreateStudy({ ...body, ...custom, textColor: "#ABCDEF" }).data.textColor, "#abcdef");
  assert.equal(validateCreateStudy({ ...body, ...custom }).data.textColor, null);
  assert.deepEqual(validateUpdateStudy({ textColor: "#ABCDEF" }).data, { textColor: "#abcdef" });
  assert.deepEqual(validateUpdateStudy({ textColor: null }).data, { textColor: null });
  assert.deepEqual(validateUpdateStudy({ ...custom, textColor: null }).data, {
    backgroundKey: "custom", backgroundColor: "#3a8f72", textColor: null,
  });
  for (const textColor of ["", "#abc", "#12345678", "rgb(1,2,3)", "red", " #123456", "#123456\n", 123456]) {
    assert.equal(validateCreateStudy({ ...body, ...custom, textColor }).success, false);
    assert.equal(validateUpdateStudy({ textColor }).success, false);
  }
  for (const backgroundKey of ["green", "image1"]) {
    assert.equal(validateCreateStudy({ ...body, backgroundKey, textColor: "#123456" }).success, false);
    assert.equal(validateUpdateStudy({ backgroundKey, textColor: "#123456" }).success, false);
  }
  assert.equal(validateCreateStudy({ ...body, textColor: "#123456" }).success, false);

  step = "점·줄·물결 패턴과 두 색상 조합";
  for (const patternKey of ["dots", "stripes", "waves"]) {
    const pattern = { patternKey, patternColor: "#FF52DC" };
    const created = validateCreateStudy({ ...body, ...custom, ...pattern });
    assert.equal(created.success, true);
    assert.equal(created.data.patternKey, patternKey);
    assert.equal(created.data.patternColor, "#ff52dc");
    assert.deepEqual(validateUpdateStudy(pattern).data, { patternKey, patternColor: "#ff52dc" });
    assert.equal(validateCreateStudy({ ...body, ...pattern }).success, false);
    assert.equal(validateUpdateStudy({ backgroundKey: "green", ...pattern }).success, false);
  }
  assert.deepEqual(validateUpdateStudy({ patternKey: null, patternColor: null }).data, {
    patternKey: null, patternColor: null,
  });
  for (const pattern of [
    { patternKey: "dots" }, { patternColor: "#123456" },
    { patternKey: "dots", patternColor: null }, { patternKey: null, patternColor: "#123456" },
    { patternKey: "unknown", patternColor: "#123456" },
    { patternKey: "dots", patternColor: "#abc" },
    { patternKey: "dots", patternColor: "#123456\n" },
    { patternKey: ["dots"], patternColor: "#123456" },
  ]) {
    assert.equal(validateCreateStudy({ ...body, ...custom, ...pattern }).success, false);
    assert.equal(validateUpdateStudy(pattern).success, false);
  }
  assert.equal(validateUpdateStudy({ patternKey: null }).success, false);
  assert.equal(validateUpdateStudy({ patternColor: null }).success, false);

  step = "목록 기본값·정규화·미등록 쿼리";
  assert.deepEqual(validateStudyListQuery({}).data, { keyword: "", offset: 0, limit: 6, sort: "latest" });
  assert.equal(validateStudyListQuery({ keyword: " e\u0301 " }).data.keyword, "é");
  assert.equal(validateStudyListQuery({ keyword: " %_ " }).data.keyword, "%_");
  for (const query of [
    { limti: "10" }, { keyword: ["a", "b"] }, { offset: "-1" },
    { offset: "1.5" }, { limit: "0" }, { limit: "7" }, { limit: "10" }, { limit: ["6", "10"] }, { sort: "random" },
  ]) assert.equal(validateStudyListQuery(query).success, false);
  for (const limit of ["1", "6"]) {
    assert.equal(validateStudyListQuery({ limit }).success, true);
    assert.equal(validateStudyListQuery({ limit }).data.limit, Number(limit));
  }
  assert.equal(validateStudyIdParams({ studyId: "11111111-1111-4111-8111-111111111111" }).success, true);
  assert.equal(validateStudyIdParams({ studyId: "invalid" }).success, false);

  step = "습관 입력과 날짜";
  assert.equal(validateCreateRoutine({ name: ` ${family.repeat(20)} ` }).data.name, family.repeat(20));
  for (const value of [family.repeat(21), " \t", 1234]) {
    assert.equal(validateCreateRoutine({ name: value }).success, false);
  }
  assert.equal(validateCreateRoutine({ name: "독서", extra: true }).success, false);
  assert.equal(validateRoutineCheck({ recordDate: "2028-02-29", completed: false }).success, true);
  for (const value of [
    { recordDate: "2026-02-29", completed: true },
    { recordDate: "2026-10-15", completed: "true" },
    { recordDate: "2026-10-15", completed: true, extra: 1 },
  ]) assert.equal(validateRoutineCheck(value).success, false);

  step = "습관 일괄 저장 입력·중복 대상·그래핌 경계";
  const routineId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const anotherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const emptyBatch = { creates: [], updates: [], endIds: [] };
  const batch = validateRoutineBatch({
    creates: [{ name: ` ${family.repeat(20)} ` }],
    updates: [{ routineId: routineId.toUpperCase(), name: " 독서 " }],
    endIds: [anotherId],
  });
  assert.equal(batch.success, true);
  assert.equal(batch.data.creates[0].name, family.repeat(20));
  assert.deepEqual(batch.data.updates[0], { routineId, name: "독서" });
  assert.equal(validateRoutineBatch({ ...emptyBatch, endIds: [routineId] }).success, true);
  assert.equal(validateRoutineBatch({
    ...emptyBatch, creates: Array.from({ length: 18 }, () => ({ name: "독서" })),
  }).success, true);
  for (const invalidBatch of [
    { ...emptyBatch, creates: [{ name: family.repeat(21) }] },
    { ...emptyBatch, creates: [{ name: " \t" }] },
    { ...emptyBatch, creates: Array.from({ length: 19 }, () => ({ name: "독서" })) },
    { ...emptyBatch, creates: [{ name: "독서", routineId }] },
    { ...emptyBatch, updates: [{ routineId: "invalid", name: "독서" }] },
    { ...emptyBatch, updates: [{ routineId, name: family.repeat(21) }] },
    { ...emptyBatch, endIds: [routineId, routineId.toUpperCase()] },
    { ...emptyBatch, updates: [{ routineId, name: "독서" }], endIds: [routineId] },
    { ...emptyBatch, updates: [{ routineId, name: "독서" }, { routineId, name: "운동" }] },
    { ...emptyBatch, extra: true },
    { creates: [], updates: [] },
  ]) assert.equal(validateRoutineBatch(invalidBatch).success, false);

  step = "로컬 주소 허용·외부 주소와 접속 우회 거절";
  for (const url of [
    "postgresql://localhost:5435/forest-of-study",
    "postgresql://127.0.0.1:5435/forest-of-study?schema=public",
  ]) assert.doesNotThrow(() => assertLocalSeedDatabase(url));
  for (const url of [
    "postgresql://example.neon.tech:5435/forest-of-study",
    "postgresql://127.0.0.1:5432/forest-of-study",
    "postgresql://127.0.0.1:5435/other",
    "postgresql://127.0.0.1:5435/forest-of-study?host=example.neon.tech",
    "postgresql://127.0.0.1:5435/forest-of-study?hostaddr=203.0.113.1",
    "postgresql://127.0.0.1:5435/forest-of-study?schema=other",
  ]) assert.throws(() => assertLocalSeedDatabase(url));

  console.log("API 입력 검사 성공: 비밀번호 원문·공백 거절·그래핌 경계·엄격한 쿼리·습관 날짜·로컬 주소 제한. DB 연결 없음");
} catch {
  console.error(`API 입력 검사 실패: ${step}`);
  process.exitCode = 1;
}
