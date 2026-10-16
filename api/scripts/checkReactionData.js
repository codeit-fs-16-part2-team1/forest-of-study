import assert from "node:assert/strict";
import { normalizeEmoji } from "../src/utils/emoji.js";

// 현재 설정된 DB를 READ ONLY 트랜잭션으로 조회한다. Neon에서도 행을 변경하지 않는다.
// 접속 URL·비밀값은 출력하지 않는다. 미변환·충돌이 있으면 별도 전환 계획이 필요하다.
let prisma;
let step = "검사 인자 확인";
try {
  assert.equal(process.argv.slice(2).length, 0);
  step = "DB 검사 준비";
  ({ prisma } = await import("../src/lib/prisma.js"));
  step = "기존 Reaction 읽기 전용 검사";
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.reaction.findMany({
      select: { studyId: true, browserId: true, emoji: true, createdAt: true },
      orderBy: [{ studyId: "asc" }, { browserId: "asc" }, { emoji: "asc" }],
    });
  }, { isolationLevel: "RepeatableRead" });
  const groups = new Map();
  const unnormalized = [];
  let emptyNormalizedRows = 0;
  for (const row of rows) {
    const normalized = normalizeEmoji(row.emoji);
    if (normalized === "") emptyNormalizedRows += 1;
    if (normalized !== row.emoji) unnormalized.push({ ...row, normalized });
    const key = JSON.stringify([row.studyId, row.browserId, normalized]);
    const group = groups.get(key) ?? { studyId: row.studyId, browserId: row.browserId, emoji: normalized, rows: [] };
    group.rows.push({ emoji: row.emoji, createdAt: row.createdAt });
    groups.set(key, group);
  }
  const collisions = [...groups.values()].filter((group) => group.rows.length > 1);
  console.log(JSON.stringify({
    totalRows: rows.length,
    skinToneRows: unnormalized.length,
    normalizedCollisionGroups: collisions.length,
    emptyNormalizedRows,
  }, null, 2));
  if (unnormalized.length > 0) {
    console.log("기본 이모지로 변환이 필요한 행 예시(최대10개):");
    console.log(JSON.stringify(unnormalized.slice(0, 10), null, 2));
  }
  if (collisions.length > 0) {
    console.log("정규화하면 복합 PK가 겹치는 조합 예시(최대10개):");
    console.log(JSON.stringify(collisions.slice(0, 10), null, 2));
  }
  if (unnormalized.length > 0 || collisions.length > 0 || emptyNormalizedRows > 0) {
    console.error("조회 완료·기존 데이터 전환 검토 필요. 데이터는 변경하지 않았습니다.");
    process.exitCode = 1;
  } else {
    console.log("응원 데이터 검사 성공: 피부색 미변환·정규화 키 충돌 없음. 데이터 변경 없음");
  }
} catch {
  console.error("응원 데이터 검사 실패: " + step);
  process.exitCode = 1;
} finally {
  if (prisma !== undefined) {
    try {
      await prisma.$disconnect();
    } catch {
      console.error("검사 DB 연결 종료 실패");
      process.exitCode = 1;
    }
  }
}
