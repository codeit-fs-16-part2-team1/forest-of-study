import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createApiError } from "../utils/apiError.js";

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

export const getStudies = async (query) => {
  const { offset, limit, sort, keyword } = query;

  // 같은 정렬 값은 id 오름차순으로 순서를 고정한다.
  const orderByMap = {
    latest: Prisma.sql`"createdAt" DESC, "id" ASC`,
    oldest: Prisma.sql`"createdAt" ASC, "id" ASC`,
    points_desc: Prisma.sql`"points" DESC, "id" ASC`,
    points_asc: Prisma.sql`"points" ASC, "id" ASC`,
  };

  // strpos로 %와 _도 일반 문자로 검색한다.
  const where = keyword === ""
    ? Prisma.empty
    : Prisma.sql`
        WHERE
          strpos(
            lower(normalize("name", NFC)),
            lower(normalize(${keyword}::text, NFC))
          ) > 0
          OR strpos(
            lower(normalize("nickname", NFC)),
            lower(normalize(${keyword}::text, NFC))
          ) > 0
          OR strpos(
            lower(normalize("introduction", NFC)),
            lower(normalize(${keyword}::text, NFC))
          ) > 0
      `;

  const [studies, counts] = await prisma.$transaction([
    prisma.$queryRaw`
      SELECT
        "id",
        "nickname",
        "name",
        "introduction",
        "backgroundKey",
        "points",
        "createdAt",
        "updatedAt"
      FROM "Study"
      ${where}
      ORDER BY ${orderByMap[sort]}
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::integer AS "total"
      FROM "Study"
      ${where}
    `,
  ], {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  }); // 목록과 전체 개수는 같은 스냅샷에서 조회한다.

  const total = counts[0].total;

  return {
    studies,
    pagination: {
      offset,
      limit,
      total,
      hasMore: offset + studies.length < total,
    },
  };
};

export const createStudy = async (data) => {
  const {
    nickname,
    name,
    introduction,
    backgroundKey,
    password,
  } = data;

  // 라우트 스키마에서 trim한 저장값을 그대로 비교한다. 검색용 정규화는 적용하지 않는다.
  const where = { nickname, name };
  const existing = await prisma.study.findFirst({ where, select: { id: true } });
  if (existing !== null) {
    throw createApiError("STUDY_CONFLICT");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await prisma.study.create({
      data: { nickname, name, introduction, backgroundKey, passwordHash },
      select: studySelect,
    });
  } catch (error) {
    // 동시 요청은 사전 조회를 함께 통과할 수 있다. 최종 보장은 DB 복합 UNIQUE다.
    if (error?.code === "P2002") {
      const conflict = await prisma.study.findFirst({ where, select: { id: true } });
      if (conflict !== null) throw createApiError("STUDY_CONFLICT");
    }
    throw error;
  }
};

export const getStudy = async (studyId) => {
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

  return { ...study, reactions };
};
