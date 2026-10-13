import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

// 검증용 DB에서 사람이 실행한다. 매번 새 스터디 3개와 검증 데이터를 추가한다.
const toDate = (value) => new Date(`${value}T00:00:00.000Z`);
const routineData = (name, startsOn, endsOn, order, checks = []) => ({
  name,
  startsOn: toDate(startsOn),
  endsOn: endsOn === null ? null : toDate(endsOn),
  createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, order)),
  history: {
    create: checks.map(([recordDate, completed]) => ({
      recordDate: toDate(recordDate),
      completed,
    })),
  },
});

try {
  // 비밀번호 원문과 해시는 출력하지 않는다.
  const passwordHash = await bcrypt.hash(randomUUID(), 10);
  const studyData = (name) => ({
    nickname: "테스트",
    name,
    introduction: "API-ST-06 주간 기록 검증용",
    passwordHash,
  });
  const result = await prisma.$transaction(async (tx) => {
    const study = await tx.study.create({
      data: {
        ...studyData("주간 기록 검증"),
        routines: {
          create: [
            routineData("책 읽기", "2026-10-13", "2026-10-15", 1, [
              ["2026-10-13", true],
              ["2026-10-14", false],
              ["2026-10-15", true],
            ]),
            routineData("월요일 종료", "2026-10-05", "2026-10-12", 2, [
              ["2026-10-12", true],
            ]),
            routineData("일요일 시작과 종료", "2026-10-18", "2026-10-18", 3, [
              ["2026-10-18", true],
            ]),
            routineData("계속하는 습관", "2026-10-05", null, 4, [
              ["2026-10-12", false],
              ["2026-10-13", true],
            ]),
            routineData("조회 전 종료", "2026-10-01", "2026-10-11", 5),
            routineData("조회 후 시작", "2026-10-19", "2026-10-20", 6),
            routineData("같은 이름", "2026-10-12", "2026-10-18", 7),
            routineData("같은 이름", "2026-10-12", "2026-10-18", 7),
            routineData("월말 경계", "2026-09-30", "2026-10-02", 8, [
              ["2026-10-01", true],
            ]),
            routineData("연말 경계", "2026-12-31", "2027-01-02", 9, [
              ["2027-01-01", true],
            ]),
            routineData("윤년 경계", "2024-02-28", "2024-03-01", 10, [
              ["2024-02-29", true],
            ]),
          ],
        },
      },
      select: {
        id: true,
        routines: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, name: true },
        },
      },
    });
    const emptyStudy = await tx.study.create({
      data: studyData("빈 주간 기록 검증"),
      select: { id: true },
    });
    const otherStudy = await tx.study.create({
      data: {
        ...studyData("다른 스터디 검증"),
        routines: {
          create: routineData("다른 스터디의 습관", "2026-10-12", null, 1, [
            ["2026-10-13", true],
          ]),
        },
      },
      select: { id: true },
    });
    return { study, emptyStudy, otherStudy };
  });

  console.log("routine-history.http의 변수에 아래 ID를 복사하세요.");
  console.log(`@studyId = ${result.study.id}`);
  console.log(`@emptyStudyId = ${result.emptyStudy.id}`);
  console.log(`@otherStudyId = ${result.otherStudy.id}`);
  console.log("전체 준비 습관의 생성일·ID 정렬 순서:");
  console.table(result.study.routines);
  console.log("주간 기록 검증 데이터 준비 완료. API 요청은 실행하지 않았습니다.");
} catch {
  console.error("검증 데이터 준비 실패: 의존성, DB 연결 설정과 migration 적용 여부를 확인해주세요.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
