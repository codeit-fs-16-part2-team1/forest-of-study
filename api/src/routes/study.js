import express from "express";
import { z } from "zod";
import { validateCreateStudy, validateStudyListQuery, validateStudyBatchQuery, validateStudyIdParams } from "../schemas/study.js";
import { createStudy, getStudies, getStudy, deleteStudy } from "../services/study.js";
import { validatePasswordVerificationBody } from "../schemas/studyPassword.js";
import { createApiError } from "../utils/apiError.js";
import { sendSuccess, sendPaginatedSuccess } from "../utils/apiResponse.js";
import { rejectQuery } from "../middlewares/rejectQuery.js";
import { uuidSchema } from "../utils/uuid.js";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

const studyRouter = express.Router();

//조회 응답에 사용되는 공개필드. prisma조회에서 select: studySelect로 조회. 
const studySelect = {
  id: true,
  nickname: true,
  name: true,
  introduction: true,
  backgroundKey: true,
  points: true,
  createdAt: true,
  updatedAt: true,
};



//object()객체 안의 필드가 uuid 형식인지 검사 
const studyIdParamsSchema = z.object({
  studyId: uuidSchema,
});


//스터디목록 조회 요청 -> 쿼리검사 단계 
studyRouter.get("/", async (req, res) => {
  const result = validateStudyListQuery(req.query);
  if (!result.success) throw createApiError("VALIDATION_ERROR");
  const { studies, pagination } = await getStudies(result.data);
  return sendPaginatedSuccess(res, studies, pagination);
});

studyRouter.post("/", rejectQuery, async (req, res) => {
  const result = validateCreateStudy(req.body);
  if (!result.success) {
    const issues = result.error.issues;
    let code = "VALIDATION_ERROR";
    if (issues.every((issue) => issue.code === "custom" && issue.path[0] === "passwordConfirm")) {
      code = "PASSWORD_CONFIRM_MISMATCH";
    } else if (issues.every((issue) => issue.code === "invalid_value" && issue.path[0] === "backgroundKey")) {
      code = "INVALID_BACKGROUND";
    }
    throw createApiError(code);
  }
  const study = await createStudy(result.data);
  return sendSuccess(res, study, 201);
});


// /batch가 스터디 ID로 해석되지 않도록 상세 라우트보다 먼저 등록합니다.
studyRouter.get("/batch", async (req, res) => {
  const result = validateStudyBatchQuery(req.query);

  if (!result.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  const { ids } = result.data;
  const sqlIds = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));

  // 스터디와 응원을 각각 한 번씩 조회하고 같은 DB 스냅샷을 사용합니다.
  const [studies, reactions] = await prisma.$transaction([
    prisma.study.findMany({
      where: { id: { in: ids } },
      select: studySelect,
    }),
    prisma.$queryRaw`
      WITH ranked AS (
        SELECT
          "studyId",
          "emoji",
          COUNT(*)::integer AS "count",
          ROW_NUMBER() OVER (
            PARTITION BY "studyId"
            ORDER BY COUNT(*) DESC, MIN("createdAt") ASC, "emoji" COLLATE "C" ASC
          ) AS "rank"
        FROM "Reaction"
        WHERE "studyId" IN (${sqlIds})
        GROUP BY "studyId", "emoji"
      )
      SELECT "studyId", "emoji", "count"
      FROM ranked
      WHERE "rank" <= 3
      ORDER BY "studyId", "rank"
    `,
  ], {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });

  const reactionsByStudy = new Map();
  for (const { studyId, emoji, count } of reactions) {
    if (!reactionsByStudy.has(studyId)) {
      reactionsByStudy.set(studyId, []);
    }
    reactionsByStudy.get(studyId).push({ emoji, count });
  }

  const studiesById = new Map(studies.map((study) => [study.id, study]));
  const data = ids
    .filter((id) => studiesById.has(id))
    .map((id) => ({
      ...studiesById.get(id),
      reactions: reactionsByStudy.get(id) ?? [],
    }));

  return res.status(200).json({ data });
});

//상세조회 요청에서 스터디 ID 검사 
studyRouter.get("/:studyId", rejectQuery, async (req, res) => {
  const result = studyIdParamsSchema.safeParse(req.params);
  //URL에 담긴 studyId가 uuid 형식인지 검사. safeParse()로 검사실패 시 false 반환

  if (!result.success) {
    throw createApiError("VALIDATION_ERROR");
  }
  //검사 실패 시 공통오류 반환. 검사 성공시 result.data에 studyId를 담음.
  const { studyId } = result.data;

  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: studySelect,
  });

  if (!study) {
    throw createApiError("STUDY_NOT_FOUND");
  }

  // 개수 내림차순 → 최초 반응 시각 → 이모지 값 순으로 상위 3종.
  // studyId는 바인딩된 매개변수로 전달됩니다.
  const reactions = await prisma.$queryRaw`
    SELECT
      "emoji",
      COUNT(*)::integer AS "count"
    FROM "Reaction"
    WHERE "studyId" = ${studyId}::uuid
    GROUP BY "emoji"
    ORDER BY
      COUNT(*) DESC,
      MIN("createdAt") ASC,
      "emoji" COLLATE "C" ASC
    LIMIT 3
  `;

  return res.status(200).json({
    data: {
      ...study,
      reactions,
    },
  });
});

// 삭제는 보호 요청 헤더 대신 삭제 모달의 본문 비밀번호를 검증한다.
studyRouter.delete("/:studyId", rejectQuery, async (req, res) => {
  const paramsResult = validateStudyIdParams(req.params);
  if (!paramsResult.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  if (req.body === undefined) {
    throw createApiError("VERIFICATION_REQUIRED");
  }

  const bodyResult = validatePasswordVerificationBody(req.body);
  if (!bodyResult.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  await deleteStudy(paramsResult.data.studyId, bodyResult.data.password);
  return res.status(204).end();
});

export default studyRouter;
