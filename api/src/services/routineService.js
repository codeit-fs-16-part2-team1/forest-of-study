import { prisma } from "../lib/prisma.js";
import { getKoreanDate } from "../utils/date.js";
import { createApiError } from "../utils/apiError.js";

const MAX_ACTIVE_ROUTINES = 18;

const routineSelect = {
  id: true,
  studyId: true,
  name: true,
  stickerColor: true,
  startsOn: true,
  endsOn: true,
};

const toRoutine = (routine) => {
  return {
    id: routine.id,
    studyId: routine.studyId,
    name: routine.name,
    stickerColor: routine.stickerColor,
    startsOn: routine.startsOn.toISOString().slice(0, 10),
    endsOn: routine.endsOn?.toISOString().slice(0, 10) ?? null,
  };
};

export const createRoutine = async ({ studyId, name, stickerColor }) => {
  return prisma.$transaction(async (tx) => {
    // 같은 스터디의 생성 요청을 순서대로 처리해 count → create 경합을 막는다.
    const studies = await tx.$queryRaw`
      SELECT "id" FROM "Study" WHERE "id" = ${studyId}::uuid FOR UPDATE
    `;
    if (studies.length === 0) {
      throw createApiError("STUDY_NOT_FOUND");
    }

    const count = await tx.routine.count({
      where: { studyId, endsOn: null },
    });
    if (count >= MAX_ACTIVE_ROUTINES) {
      throw createApiError("VALIDATION_ERROR");
    }

    // 잠금 대기 중 자정을 넘었을 수 있으므로 저장 직전에 오늘 날짜를 정한다.
    const recordDate = getKoreanDate(new Date());
    const last = await tx.routine.aggregate({
      where: { studyId, endsOn: null }, _max: { position: true },
    });
    const routine = await tx.routine.create({
      data: {
        studyId,
        name,
        stickerColor,
        position: (last._max.position ?? 0) + 1,
        startsOn: new Date(`${recordDate}T00:00:00.000Z`),
      },
      select: routineSelect,
    });
    return toRoutine(routine);
  });
};

export const getTodayRoutines = async ({ studyId, client = prisma, now = new Date() }) => {
  const study = await client.study.findUnique({
    where: { id: studyId },
    select: { id: true },
  });
  if (!study) {
    throw createApiError("STUDY_NOT_FOUND");
  }

  const recordDate = getKoreanDate(now);
  const today = new Date(`${recordDate}T00:00:00.000Z`);
  const routines = await client.routine.findMany({
    where: { studyId, endsOn: null, startsOn: { lte: today } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
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

export const setRoutineCheck = async ({
  studyId,
  routineId,
  recordDate,
  completed,
}) => {
  return prisma.$transaction(async (tx) => {
    // 생성·수정·종료와 동일하게 Study → Routine 순서로 잠근다.
    const studies = await tx.$queryRaw`
      SELECT "id" FROM "Study" WHERE "id" = ${studyId}::uuid FOR UPDATE
    `;
    if (studies.length === 0) {
      throw createApiError("STUDY_NOT_FOUND");
    }

    const routines = await tx.$queryRaw`
      SELECT "id", "startsOn", "endsOn" FROM "Routine"
      WHERE "id" = ${routineId}::uuid AND "studyId" = ${studyId}::uuid
      FOR UPDATE
    `;
    const routine = routines[0];
    if (!routine) {
      throw createApiError("ROUTINE_NOT_FOUND");
    }
    if (routine.endsOn !== null) {
      throw createApiError("ROUTINE_ENDED");
    }

    // 잠금 대기 중 자정을 넘었을 수 있으므로 두 잠금을 얻은 뒤 계산한다.
    const todayDate = getKoreanDate(new Date());
    if (recordDate !== todayDate) {
      throw createApiError("DATE_CHANGED");
    }
    const today = new Date(`${todayDate}T00:00:00.000Z`);
    if (routine.startsOn > today) {
      throw createApiError("VALIDATION_ERROR");
    }

    const where = { routineId_recordDate: { routineId, recordDate: today } };
    const select = { routineId: true, recordDate: true, completed: true };
    // 체크·해제 모두 기록이 없으면 생성하고 있으면 같은 행을 갱신한다.
    const history = await tx.routineHistory.upsert({
      where,
      create: { routineId, recordDate: today, completed },
      update: { completed },
      select,
    });

    return {
      routineId: history.routineId,
      recordDate: history.recordDate.toISOString().slice(0, 10),
      completed: history.completed,
    };
  });
};
