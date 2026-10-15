import assert from "node:assert/strict";
import { validateCreateStudy, validateStudyListQuery, validateStudyIdParams } from "../src/schemas/study.js";
import { validateCreateRoutine, validateRoutineCheck } from "../src/schemas/routine.js";
import { validateStudyPassword, validatePasswordVerificationBody } from "../src/schemas/studyPassword.js";
import { assertLocalSeedDatabase } from "../seedData.js";

// 스키마와 주소 판정만 검사한다. 환경변수·DB·서버를 사용하지 않는다.
let step = "비밀번호 정리";
const body = {
  nickname: "개발자", name: "검증 스터디", introduction: "DB 없는 입력 검사",
  password: "Forest123!", passwordConfirm: "Forest123!",
};

try {
  for (const value of [" Forest123!", "Forest123! ", "For est\t123!\n"]) {
    const result = validateStudyPassword(value);
    assert.equal(result.success, true);
    assert.equal(result.data, body.password);
    const created = validateCreateStudy({ ...body, password: value });
    assert.equal(created.success, true);
    assert.equal(created.data.password, body.password);
    assert.equal(created.data.passwordConfirm, body.passwordConfirm);
  }
  for (const value of ["abc", "a".repeat(21), " \t\n ", "a b c", "abcd?", 1234, null]) {
    assert.equal(validateStudyPassword(value).success, false);
    assert.equal(validateCreateStudy({ ...body, password: value }).success, false);
  }
  assert.equal(validateStudyPassword("a b c d").data, "abcd");
  assert.equal(validateStudyPassword(" a" + "b".repeat(19) + " ").success, true);
  assert.equal(validatePasswordVerificationBody({}).success, true);
  assert.equal(validatePasswordVerificationBody({ password: " \t" }).success, false);
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

  step = "목록 기본값·정규화·미등록 쿼리";
  assert.deepEqual(validateStudyListQuery({}).data, { keyword: "", offset: 0, limit: 6, sort: "latest" });
  assert.equal(validateStudyListQuery({ keyword: " e\u0301 " }).data.keyword, "é");
  assert.equal(validateStudyListQuery({ keyword: " %_ " }).data.keyword, "%_");
  for (const query of [
    { limti: "10" }, { keyword: ["a", "b"] }, { offset: "-1" },
    { offset: "1.5" }, { limit: "0" }, { limit: ["6", "10"] }, { sort: "random" },
  ]) assert.equal(validateStudyListQuery(query).success, false);
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

  console.log("API 입력 검사 성공: 비밀번호 정리·그래핌 경계·엄격한 쿼리·습관 날짜·로컬 주소 제한. DB 연결 없음");
} catch {
  console.error(`API 입력 검사 실패: ${step}`);
  process.exitCode = 1;
}
