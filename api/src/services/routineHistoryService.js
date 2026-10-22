import { prisma } from "../lib/prisma.js";
import { createApiError } from "../utils/apiError.js";

export const getWeeklyRoutineHistories = async ({ studyId, weekDates }) => {
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true },
  });
  if (!study) {
    throw createApiError("STUDY_NOT_FOUND");
  }

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const firstDate = new Date(`${weekStart}T00:00:00.000Z`);
  const lastDate = new Date(`${weekEnd}T00:00:00.000Z`);
  const routines = await prisma.routine.findMany({
    where: {
      studyId,
      startsOn: { lte: lastDate },
      OR: [{ endsOn: null }, { endsOn: { gte: firstDate } }],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      stickerColor: true,
      position: true,
      startsOn: true,
      endsOn: true,
      history: {
        where: { recordDate: { gte: firstDate, lte: lastDate } },
        select: { recordDate: true, completed: true },
      },
    },
  });

  return {
    weekStart,
    routines: routines.sort((a, b) => {
      if (a.endsOn === null && b.endsOn !== null) return -1;
      if (a.endsOn !== null && b.endsOn === null) return 1;
      // 동률은 위 조회의 createdAt → id 순서를 유지한다.
      return a.endsOn === null ? a.position - b.position : b.endsOn - a.endsOn;
    }).map((routine) => {
      const startsOn = routine.startsOn.toISOString().slice(0, 10);
      const endsOn = routine.endsOn?.toISOString().slice(0, 10) ?? null;
      const historyByDate = new Map(
        routine.history.map((history) => [
          history.recordDate.toISOString().slice(0, 10),
          history.completed,
        ]),
      );

      return {
        id: routine.id,
        name: routine.name,
        stickerColor: routine.stickerColor,
        cells: weekDates.map((recordDate) => {
          const isWithinPeriod =
            startsOn <= recordDate && (endsOn === null || recordDate <= endsOn);
          return {
            recordDate,
            completed: isWithinPeriod
              ? (historyByDate.get(recordDate) ?? false)
              : null,
          };
        }),
      };
    }),
  };
};
