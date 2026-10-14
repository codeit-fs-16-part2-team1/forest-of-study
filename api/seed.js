// 로컬 개발 DB의 5개 테이블을 매번 삭제하고 다시 만든다.
// 실행 전 API 서버를 중지한다. migration은 이 스크립트에서 실행하지 않는다.
import { assertLocalSeedDatabase, buildSeedData, EXPECTED_COUNTS,
  STUDY_CASES, studyId, validateSeedRows } from "./seed-data.js";

// 승인된 로컬 개발용 공통 비밀번호의 bcrypt(cost 10) 해시다.
// 원문은 저장하지 않고 실행 시 비밀번호 입력·환경변수 설정·해시 생성을 생략한다.
const SEED_PASSWORD_HASH = "$2b$10$JW5N1NGCkICxI.wuvzx4GerzHvq5nOJ7zAKa0JnU4QFh/5SHgsxpK";

let prisma;
let step = "로컬 DB 주소 확인";

try {
  const { databaseUrl } = await import("./src/config/env.js");
  const localUrl = assertLocalSeedDatabase(databaseUrl);
  // URL 검증 후에만 드라이버를 가져오고, 검증된 주소로 독립 Client를 만든다.
  // lib/prisma.js의 캐시된 설정이나 PGHOST 환경변수로 목적지가 바뀌지 않게 한다.
  step = "Prisma Client 준비";
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("@prisma/client"), import("@prisma/adapter-pg"),
  ]);
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: localUrl }), log: [] });

  step = "TEXT migration 적용 여부 확인";
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'Study' AND column_name IN ('nickname', 'name', 'introduction'))
        OR (table_name = 'Routine' AND column_name = 'name'))
  `;
  if (columns.length !== 4 || columns.some((column) => column.data_type !== "text")) {
    throw new Error("TEXT migration 미적용");
  }

  let data;
  step = "전체 삭제·시드 삽입 트랜잭션";
  await prisma.$transaction(async (tx) => {
    // 동시 쓰기로 초기화 도중 데이터가 섞이지 않게 한다. _prisma_migrations는 건드리지 않는다.
    await tx.$executeRaw`LOCK TABLE "Study", "Routine", "RoutineHistory", "Challenge", "Reaction" IN ACCESS EXCLUSIVE MODE`;
    // 잠금 대기가 자정을 넘었어도 이 시점의 한국 날짜로 전체 데이터를 구성한다.
    data = buildSeedData(new Date());
    validateSeedRows(data, data.anchorTime);
    for (const study of data.studies) study.passwordHash = SEED_PASSWORD_HASH;

    // 기존 데이터와 일치하는지 조회하거나 비교하지 않는다. 매번 전부 재생성한다.
    await tx.routineHistory.deleteMany();
    await tx.reaction.deleteMany();
    await tx.challenge.deleteMany();
    await tx.routine.deleteMany();
    await tx.study.deleteMany();

    const inserted = [
      ["Study", await tx.study.createMany({ data: data.studies })],
      ["Routine", await tx.routine.createMany({ data: data.routines })],
      ["RoutineHistory", await tx.routineHistory.createMany({ data: data.histories })],
      ["Challenge", await tx.challenge.createMany({ data: data.challenges })],
      ["Reaction", await tx.reaction.createMany({ data: data.reactions })],
    ];
    for (const [model, result] of inserted) {
      if (result.count !== EXPECTED_COUNTS[model]) throw new Error("삽입 수량 오류");
    }
  }, { maxWait: 10_000, timeout: 30_000 });

  console.log("로컬 DB 초기화·시드 삽입 완료 (158행). 기존 5개 테이블 데이터는 교체되었습니다.");
  console.log(`한국 날짜: ${data.today}, 주간 조회 시작일: ${data.weekStart}`);
  console.log(`기준 시각(UTC): ${data.anchorTime.toISOString()}`);
  console.table(Object.entries(EXPECTED_COUNTS).map(([table, rows]) => ({ table, rows })));
  console.table(STUDY_CASES.map(([caseId, purpose, , , , , points], i) => ({
    case: caseId, studyId: studyId(i + 1), purpose, backgroundKey: data.studies[i].backgroundKey, points,
  })));
  console.table(data.routines.filter((row) => row.studyId === studyId(2)).map((row) => ({
    routineId: row.id, name: row.name, startsOn: row.startsOn.toISOString().slice(0, 10),
    endsOn: row.endsOn?.toISOString().slice(0, 10) ?? null,
  })));
  console.table(data.challenges.map((row) => ({ challengeId: row.id, studyId: row.studyId,
    status: row.status, goalMinutes: row.goalMinutes, awardedPoints: row.awardedPoints,
  })));
  console.log("모든 스터디에 공통 개발용 비밀번호의 고정 bcrypt 해시를 적용했습니다. 비밀번호 입력은 필요하지 않습니다.");
  console.log("RUNNING은 계속 진행합니다. 시드 직후, API 조작 전에 node scripts/check-seed.js로 확인하세요.");
} catch {
  // DB 오류 원문·URL·비밀번호·해시를 출력하지 않는다.
  console.error(`시드 실패: ${step}. 로컬 DATABASE_URL, 의존성 및 migration을 확인해주세요.`);
  console.error("삭제·삽입 트랜잭션이 실패했다면 변경은 함께 롤백됩니다.");
  process.exitCode = 1;
} finally {
  if (prisma) {
    try { await prisma.$disconnect(); } catch {
      console.error("시드 DB 연결 종료에 실패했습니다. 삽입 결과는 읽기 전용 확인 스크립트로 확인해주세요.");
      process.exitCode = 1;
    }
  }
}
