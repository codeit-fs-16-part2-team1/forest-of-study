import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createApiError } from "../utils/apiError.js";
import { getTopReactions, getTopReactionsForStudies } from "./reaction.js";
import { checkStudyPassword } from "./studyPassword.js";

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

// ids는 라우트 스키마에서 UUID 검사·소문자 통일·중복 제거·최대 10개 검사를 마친 값이다.
export const getStudiesByIds = async (ids) => {
  // 스터디와 상위 응원을 각각 한 번씩, 같은 DB 스냅샷에서 조회한다.
  const [studies, reactions] = await prisma.$transaction([
    prisma.study.findMany({
      where: { id: { in: ids } },
      select: studySelect,
    }),
    getTopReactionsForStudies(ids),
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
  // DB의 IN 조회 순서에 의존하지 않고, 없는 ID를 제외한 입력 순서로 구성한다.
  return ids
    .filter((id) => studiesById.has(id))
    .map((id) => ({
      ...studiesById.get(id),
      reactions: reactionsByStudy.get(id) ?? [],
    }));
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

export const deleteStudy = async (studyId, password) => {
  await checkStudyPassword(studyId, password);

  try {
    // DB의 Cascade FK가 습관·습관 기록·집중·응원을 함께 삭제한다.
    await prisma.study.delete({ where: { id: studyId } });
  } catch (error) {
    // 비밀번호 확인 직후 다른 요청이 삭제한 경우에도 계약상 404를 반환한다.
    if (error?.code === "P2025") {
      throw createApiError("STUDY_NOT_FOUND");
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

  const reactions = await getTopReactions(studyId);

  return { ...study, reactions };
};
