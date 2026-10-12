import { prisma } from '../src/lib/prisma.js';

const models = ['Study', 'Routine', 'RoutineHistory', 'Challenge', 'Reaction'];
const challengeColumns = [
  'id', 'studyId', 'goalMinutes', 'status', 'elapsedMilliseconds',
  'lastStartedAt', 'awardedPoints', 'createdAt',
];
const foreignKeys = [
  ['Routine_studyId_fkey', 'Routine', 'Study'],
  ['RoutineHistory_routineId_fkey', 'RoutineHistory', 'Routine'],
  ['Challenge_studyId_fkey', 'Challenge', 'Study'],
  ['Reaction_studyId_fkey', 'Reaction', 'Study'],
];
const checks = [
  'Study_points_nonnegative', 'Routine_period', 'Routine_name_nonempty',
  'Challenge_goal_range', 'Challenge_elapsed_range',
  'Challenge_running_time', 'Challenge_award_state',
];

let step = 'PostgreSQL 연결';

try {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  step = '5개 모델·Challenge 8개 컬럼';
  const columns = await prisma.$queryRaw`
    SELECT table_name::text AS table_name, column_name::text AS column_name,
           data_type::text AS data_type, is_nullable::text AS is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Study', 'Routine', 'RoutineHistory', 'Challenge', 'Reaction')
    ORDER BY table_name, ordinal_position
  `;
  const tables = new Set(columns.map((column) => column.table_name));
  const actualChallenge = columns
    .filter((column) => column.table_name === 'Challenge')
    .map((column) => column.column_name);
  if (models.some((model) => !tables.has(model))
      || actualChallenge.length !== challengeColumns.length
      || challengeColumns.some((column) => !actualChallenge.includes(column))) {
    throw new Error('Schema mismatch');
  }

  step = '4개 Cascade FK·7개 CHECK';
  const constraints = await prisma.$queryRaw`
    SELECT c.conname::text AS name, c.contype::text AS type,
           t.relname::text AS table_name, parent.relname::text AS parent_table,
           c.confdeltype::text AS delete_action, c.convalidated AS validated,
           pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_class parent ON parent.oid = c.confrelid
    WHERE n.nspname = 'public'
      AND t.relname IN ('Study', 'Routine', 'RoutineHistory', 'Challenge', 'Reaction')
    ORDER BY t.relname, c.conname
  `;
  const actualForeignKeys = constraints.filter((constraint) => constraint.type === 'f');
  if (actualForeignKeys.length !== foreignKeys.length
      || foreignKeys.some(([name, table, parent]) => !actualForeignKeys.some(
        (constraint) => constraint.name === name
          && constraint.table_name === table && constraint.parent_table === parent
          && constraint.delete_action === 'c' && constraint.validated,
      ))) {
    throw new Error('Foreign key mismatch');
  }
  const actualChecks = constraints.filter((constraint) => constraint.type === 'c');
  if (actualChecks.length !== checks.length
      || checks.some((name) => !actualChecks.some(
        (constraint) => constraint.name === name && constraint.validated,
      ))) {
    throw new Error('Check constraint mismatch');
  }

  step = '활성 집중 부분 UNIQUE';
  const indexes = await prisma.$queryRaw`
    SELECT t.relname::text AS table_name, idx.relname::text AS name,
           i.indisunique AS is_unique, i.indisvalid AS is_valid,
           pg_get_expr(i.indpred, i.indrelid) AS predicate,
           pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE n.nspname = 'public'
      AND t.relname IN ('Study', 'Routine', 'RoutineHistory', 'Challenge', 'Reaction')
    ORDER BY t.relname, idx.relname
  `;
  const active = indexes.find((index) => index.name === 'Challenge_one_active_per_study');
  if (!active || active.table_name !== 'Challenge' || !active.is_unique || !active.is_valid
      || !active.definition.includes('("studyId")')
      || !active.predicate?.includes('RUNNING') || !active.predicate.includes('PAUSED')) {
    throw new Error('Active challenge index mismatch');
  }

  step = 'Prisma Client의 5개 모델 조회';
  const counts = await Promise.all([
    prisma.study.count(), prisma.routine.count(), prisma.routineHistory.count(),
    prisma.challenge.count(), prisma.reaction.count(),
  ]);

  console.log('DB 연결·모델 조회·제약 등록 확인 성공');
  console.table(models.map((model, index) => ({ model, rows: counts[index] })));
  console.table(columns.filter((column) => column.table_name === 'Challenge'));
  console.table(constraints.map(({ table_name, name, definition }) => ({
    table: table_name, name, definition,
  })));
  console.table(indexes.map(({ table_name, name, definition }) => ({
    table: table_name, name, definition,
  })));
  console.log('출력된 제약·인덱스 정의를 docs/DB.md 7절과 대조해주세요.');
  console.log('이 검사는 읽기 전용이며 제약 거절·Cascade 삭제 동작은 별도 확인이 필요합니다.');
} catch {
  // 연결 오류에는 URL·접속 정보가 포함될 수 있으므로 원문을 출력하지 않는다.
  console.error(`DB 확인 실패: ${step}. 연결 설정과 migration 상태를 확인해주세요.`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
