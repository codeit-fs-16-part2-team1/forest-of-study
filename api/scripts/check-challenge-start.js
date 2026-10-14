import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";
import { getCurrentChallenge, startChallenge } from "../src/services/challenge.js";

// 로컬 DB의 서비스 검증용이다. HTTP·비밀번호 미들웨어 검증을 대신하지 않는다.
// 비밀번호는 실행 중 생성해 해시만 저장하고 출력하지 않는다.
let studyId;
let step = "테스트 스터디 준비";

try {
  const passwordHash = await bcrypt.hash(randomBytes(12).toString("base64url"), 12);
  const study = await prisma.study.create({
    data: {
      nickname: "집중검증",
      name: "집중 서비스 검증",
      introduction: "검증 스크립트가 생성하고 종료 시 삭제하는 임시 스터디입니다.",
      passwordHash,
    },
    select: { id: true },
  });
  studyId = study.id;

  step = "집중 없는 상태 조회";
  const initial = await getCurrentChallenge(studyId);
  assert.equal(initial.challenge, null);
  assert.equal(initial.goalMinutes, 10);
  assert.equal(initial.points, 0);

  step = "두 시작 요청 중 한 건만 성공";
  // 모든 요청 종료 후 다음 검사·정리를 진행한다.
  const starts = await Promise.allSettled([
    startChallenge(studyId, 10),
    startChallenge(studyId, 10),
  ]);
  const successes = starts.filter((result) => result.status === "fulfilled");
  const failures = starts.filter((result) => result.status === "rejected");
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].reason.code, "CHALLENGE_CONFLICT");
  assert.equal(failures[0].reason.statusCode, 409);

  const started = successes[0].value;
  assert.equal(started.challenge.status, "RUNNING");
  assert.equal(started.challenge.elapsedMilliseconds, 0);
  assert.equal(started.challenge.awardedPoints, 0);
  assert.equal(started.points, 0);
  assert.equal(started.settlement, null);

  step = "현재 집중·DB 저장 결과 확인";
  const current = await getCurrentChallenge(studyId);
  assert.equal(current.challenge.id, started.challenge.id);
  assert.equal(current.goalMinutes, 10);
  assert.equal(current.points, 0);
  assert.equal(await prisma.challenge.count({ where: { studyId } }), 1);
  const stored = await prisma.challenge.findUniqueOrThrow({
    where: { id: started.challenge.id },
  });
  assert.equal(stored.elapsedMilliseconds, 0);
  assert.equal(stored.awardedPoints, 0);

  console.log("집중 서비스 검사 성공: 초기 조회·단일 시작·충돌 거절·현재 조회·무지급");
} catch {
  // DB 오류·접속 정보·스택을 출력하지 않는다.
  console.error(`집중 서비스 검사 실패: ${step}`);
  process.exitCode = 1;
} finally {
  if (studyId !== undefined) {
    try {
      // 이 실행에서 만든 스터디만 삭제한다. FK Cascade로 임시 집중도 정리된다.
      await prisma.study.delete({ where: { id: studyId } });
      console.log("임시 스터디·집중 데이터 정리 완료");
    } catch {
      console.error(`임시 데이터 정리 실패. 스터디 ID: ${studyId}`);
      process.exitCode = 1;
    }
  }
  await prisma.$disconnect();
}
