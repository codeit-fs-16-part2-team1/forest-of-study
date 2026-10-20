import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getKoreanDate } from "../utils/date.js";
import { createApiError } from "../utils/apiError.js";
import { getTodayRoutines } from "./routineService.js";

const MAX_ACTIVE_ROUTINES = 18;

export const saveRoutineBatch = async ({ studyId, creates, updates, endIds }) =>
  prisma.$transaction(async (tx) => {
    // 생성·체크와 같은 Study → Routine 순서로 잠근다.
    const studies = await tx.$queryRaw`
      SELECT "id" FROM "Study" WHERE "id" = ${studyId}::uuid FOR UPDATE
    `;
    if (studies.length === 0) throw createApiError("STUDY_NOT_FOUND");

    const targetIds = [...updates.map((routine) => routine.routineId), ...endIds];
    const targets = targetIds.length === 0 ? [] : await tx.$queryRaw`
      SELECT "id", "startsOn", "endsOn" FROM "Routine"
      WHERE "studyId" = ${studyId}::uuid
        AND "id" IN (${Prisma.join(targetIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY "id" FOR UPDATE
    `;
    if (targets.length !== targetIds.length) {
      throw createApiError("ROUTINE_NOT_FOUND");
    }

    const byId = new Map(targets.map((routine) => [routine.id, routine]));
    for (const routine of updates) {
      if (byId.get(routine.routineId).endsOn !== null) {
        throw createApiError("ROUTINE_ENDED");
      }
    }

    // 잠금 대기 뒤의 한국 날짜를 생성·종료·응답에 동일하게 사용한다.
    const now = new Date();
    const today = new Date(`${getKoreanDate(now)}T00:00:00.000Z`);
    if (targets.some((routine) => routine.endsOn === null && routine.startsOn > today)) {
      throw createApiError("VALIDATION_ERROR");
    }
    const activeEndIds = endIds.filter((id) => byId.get(id).endsOn === null);
    const activeCount = await tx.routine.count({ where: { studyId, endsOn: null } });
    if (activeCount - activeEndIds.length + creates.length > MAX_ACTIVE_ROUTINES) {
      throw createApiError("VALIDATION_ERROR");
    }

    // 종료는 이력을 보존한다. 재종료 시 최초 종료일을 덮어쓰지 않는다.
    if (activeEndIds.length > 0) {
      await tx.routine.updateMany({
        where: { studyId, id: { in: activeEndIds }, endsOn: null },
        data: { endsOn: today },
      });
    }
    // 항목마다 이름이 다르므로 개별 update를 같은 트랜잭션에서 실행한다.
    for (const { routineId, name } of updates) {
      await tx.routine.update({
        where: { id: routineId, studyId, endsOn: null },
        data: { name },
      });
    }
    if (creates.length > 0) {
      await tx.routine.createMany({
        data: creates.map(({ name }) => ({ studyId, name, startsOn: today })),
      });
    }

    // 응답용 조회까지 tx를 사용하므로 조회 실패 시 변경도 롤백된다.
    return getTodayRoutines({ studyId, client: tx, now });
  });
