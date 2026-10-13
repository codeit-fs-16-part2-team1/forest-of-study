import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { getKoreanDate } from "../utils/date.js";
import {
  RoutineServiceError,
  routineErrorMessages,
} from "../utils/routineError.js";

const MAX_ACTIVE_ROUTINES = 18;
const TEST_STUDY_ID = "11111111-1111-4111-8111-111111111111";

const routineSelect = {
  id: true,
  studyId: true,
  name: true,
  startsOn: true,
  endsOn: true,
};

const toRoutine = (routine) => {
  return {
    id: routine.id,
    studyId: routine.studyId,
    name: routine.name,
    startsOn: routine.startsOn.toISOString().slice(0, 10),
    endsOn: routine.endsOn?.toISOString().slice(0, 10) ?? null,
  };
};

export const createRoutine = async ({ studyId, name }) => {
  return prisma.$transaction(async (tx) => {
    // 같은 스터디의 생성 요청을 순서대로 처리해 count → create 경합을 막는다.
    const studies = await tx.$queryRaw`
      SELECT "id" FROM "Study" WHERE "id" = ${studyId}::uuid FOR UPDATE
    `;
    if (studies.length === 0) {
      throw new RoutineServiceError("STUDY_NOT_FOUND");
    }

    const count = await tx.routine.count({
      where: { studyId, endsOn: null },
    });
    if (count >= MAX_ACTIVE_ROUTINES) {
      throw new RoutineServiceError(
        "VALIDATION_ERROR",
        routineErrorMessages.routineLimit,
      );
    }

    // 잠금 대기 중 자정을 넘었을 수 있으므로 저장 직전에 오늘 날짜를 정한다.
    const recordDate = getKoreanDate(new Date());
    const routine = await tx.routine.create({
      data: {
        studyId,
        name,
        startsOn: new Date(`${recordDate}T00:00:00.000Z`),
      },
      select: routineSelect,
    });
    return toRoutine(routine);
  });
};

export const getTodayRoutines = async ({ studyId }) => {
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true },
  });
  if (!study) {
    throw new RoutineServiceError("STUDY_NOT_FOUND");
  }

  const now = new Date();
  const recordDate = getKoreanDate(now);
  const today = new Date(`${recordDate}T00:00:00.000Z`);
  const routines = await prisma.routine.findMany({
    where: { studyId, endsOn: null, startsOn: { lte: today } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      ...routineSelect,
      history: {
        where: { recordDate: today },
        select: { completed: true },
      },
    },
  });

  return {
    recordDate,
    serverTime: now.toISOString(),
    routines: routines.map((routine) => ({
      ...toRoutine(routine),
      completed: routine.history[0]?.completed ?? false,
    })),
  };
};

// 개발용 스크립트 전용이다. HTTP 요청에서는 호출하지 않는다.
// 실제 스터디 API 연동 후에는 준비한 고정 ID 대신 생성 응답의 ID를 사용한다.
export const prepareRoutineTestStudy = async () => {
  try {
    const existing = await prisma.study.findUnique({
      where: { id: TEST_STUDY_ID },
      select: { id: true },
    });
    if (existing) return existing;

    // 서버의 생성·조회 API는 bcrypt 없이도 로드된다. 준비 스크립트에만 필요하다.
    const { default: bcrypt } = await import("bcrypt");
    const passwordHash = await bcrypt.hash(randomUUID(), 10);
    return await prisma.study.upsert({
      where: { id: TEST_STUDY_ID },
      update: {},
      create: {
        id: TEST_STUDY_ID,
        nickname: "테스트",
        name: "습관 테스트",
        introduction: "습관 생성·조회 확인용 스터디",
        passwordHash,
      },
      select: { id: true },
    });
  } finally {
    await prisma.$disconnect();
  }
};
