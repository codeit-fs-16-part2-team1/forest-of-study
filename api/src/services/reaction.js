import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createApiError } from "../utils/apiError.js";
import { normalizeEmoji } from "../utils/emoji.js";

// 등록·상세·다건 조회가 같은 기준을 사용한다. 기존 피부색 행도 브라우저별로 한 번만 센다.
// $transaction([...])에서도 사용할 수 있도록 PrismaPromise를 그대로 반환한다.
export const getTopReactionsForStudies = (studyIds, db = prisma) => {
  const where = studyIds.length === 0
    ? Prisma.sql`FALSE`
    : Prisma.sql`"studyId" IN (${Prisma.join(studyIds.map((id) => Prisma.sql`${id}::uuid`))})`;

  return db.$queryRaw`
    WITH normalized AS (
      SELECT
        "studyId", "browserId",
        regexp_replace("emoji", '[🏻🏼🏽🏾🏿]', '', 'g') AS "emoji", "createdAt"
      FROM "Reaction"
      WHERE ${where}
    ), browser_reactions AS (
      SELECT "studyId", "browserId", "emoji", MIN("createdAt") AS "firstAt"
      FROM normalized
      GROUP BY "studyId", "browserId", "emoji"
    ), ranked AS (
      SELECT
        "studyId", "emoji", COUNT(*)::integer AS "count",
        ROW_NUMBER() OVER (
          PARTITION BY "studyId"
          ORDER BY COUNT(*) DESC, MIN("firstAt") ASC, "emoji" COLLATE "C" ASC
        ) AS "rank"
      FROM browser_reactions
      GROUP BY "studyId", "emoji"
    )
    SELECT "studyId", "emoji", "count"
    FROM ranked
    WHERE "rank" <= 3
    ORDER BY "studyId", "rank"
  `;
};

export const getTopReactions = async (studyId, db = prisma) => {
  const reactions = await getTopReactionsForStudies([studyId], db);
  // 단건 공개 응답에는 내부 분류용 studyId를 포함하지 않는다.
  return reactions.map(({ emoji, count }) => ({ emoji, count }));
};

export const createReaction = async ({ studyId, browserId, emoji }) => {
  const normalizedEmoji = normalizeEmoji(emoji);
  const key = { studyId, browserId, emoji: normalizedEmoji };
  try {
    return await prisma.$transaction(async (tx) => {
      // 같은 스터디의 등록을 직렬화하고 존재 확인·등록·집계 중 삭제를 막는다.
      const studies = await tx.$queryRaw`
        SELECT "id" FROM "Study" WHERE "id" = ${studyId}::uuid FOR UPDATE
      `;
      if (studies.length === 0) throw createApiError("STUDY_NOT_FOUND");

      // 아직 변환하지 않은 기존 행도 중복 검사에 포함한다. 기존 행은 변경하지 않는다.
      const existing = await tx.reaction.findMany({
        where: { studyId, browserId }, select: { emoji: true },
      });
      if (existing.some((row) => normalizeEmoji(row.emoji) === normalizedEmoji)) {
        throw createApiError("REACTION_POLICY_CONFLICT");
      }
      await tx.reaction.create({ data: key });
      const reactions = await getTopReactions(studyId, tx);
      return { reactions };
    }, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    // DB에 직접 쓰는 경합이 있어도 복합 PK로 최종 보장한다. 실패한 tx 밖에서 확인한다.
    if (error?.code === "P2002") {
      const conflict = await prisma.reaction.findUnique({
        where: { studyId_browserId_emoji: key }, select: { studyId: true },
      });
      if (conflict !== null) throw createApiError("REACTION_POLICY_CONFLICT");
    }
    throw error;
  }
};
