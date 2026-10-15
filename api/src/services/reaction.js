import { prisma } from "../lib/prisma.js";
import { createApiError } from "../utils/apiError.js";
import { normalizeEmoji } from "../utils/emoji.js";

// 등록·상세의 공통 집계. 기존 행도 기본 이모지·브라우저 단위로 묶어 센다.
export const getTopReactions = (studyId, db = prisma) => db.$queryRaw`
  WITH normalized AS (
    SELECT "browserId", regexp_replace("emoji", '[🏻🏼🏽🏾🏿]', '', 'g') AS "emoji", "createdAt"
    FROM "Reaction"
    WHERE "studyId" = ${studyId}::uuid
  ), browser_reactions AS (
    SELECT "browserId", "emoji", MIN("createdAt") AS "firstAt"
    FROM normalized
    GROUP BY "browserId", "emoji"
  )
  SELECT "emoji", COUNT(*)::integer AS "count"
  FROM browser_reactions
  GROUP BY "emoji"
  ORDER BY COUNT(*) DESC, MIN("firstAt") ASC, "emoji" COLLATE "C" ASC
  LIMIT 3
`;

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
