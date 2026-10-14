// 읽기 전용 확인. 시드 직후 API 조작 전에 실행한다.
// --target=local(기본값) 또는 --target=neon으로 DB 한 곳을 선택한다.
// --preflight: DB에 연결하지 않고 대상 주소와 한국 날짜 경계만 확인한다.
import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { assertLocalSeedDatabase, assertNeonSeedDatabase, challengeId, dateString, EXPECTED_COUNTS, getSeedTarget,
  getKoreanDate, koreanInstant, routineId, SEED_BACKGROUND_KEYS, shiftDate, STUDY_CASES, studyId,
  validateSeedRows } from "../seed-data.js";

let prisma;
let target;
let step = "환경변수·대상 DB 주소 확인";

try {
  try { loadEnvFile(new URL("../.env", import.meta.url)); } catch (error) {
    if (error.code !== "ENOENT") throw new Error("환경변수 파일 로드 실패");
  }
  target = getSeedTarget(process.argv.slice(2), process.env, { allowPreflight: true });

  step = "외부 DB·접속 우회 주소 거절 확인";
  // 모두 가상 주소이며 연결하지 않는다. 비밀값 없이 허용·거절 규칙만 검사한다.
  for (const rejected of [
    "postgresql://example.neon.tech:5435/forest-of-study",
    "postgresql://127.0.0.1:5432/forest-of-study",
    "postgresql://127.0.0.1:5435/other-database",
    "postgresql://127.0.0.1:5435/forest-of-study?host=example.neon.tech",
    "postgresql://127.0.0.1:5435/forest-of-study?hostaddr=203.0.113.1",
    "postgresql://127.0.0.1:5435/forest-of-study?schema=other",
    "postgresql://127.0.0.1:5435/forest-of-study?schema=public&schema=public",
    "not-a-database-url",
  ]) assert.throws(() => assertLocalSeedDatabase(rejected));
  assert.equal(new URL(assertLocalSeedDatabase("postgresql://localhost:5435/forest-of-study?schema=public")).hostname,
    "127.0.0.1");

  const neonExample = "postgresql://ep-seed-example.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&schema=public";
  assert.throws(() => assertLocalSeedDatabase(neonExample));
  assert.throws(() => assertNeonSeedDatabase("postgresql://127.0.0.1:5435/forest-of-study?sslmode=require"));
  assert.throws(() => assertNeonSeedDatabase("postgresql://example.com/neondb?sslmode=require"));
  assert.throws(() => assertNeonSeedDatabase(neonExample.replace("sslmode=require", "sslmode=disable")));
  assert.throws(() => assertNeonSeedDatabase(`${neonExample}&host=127.0.0.1`));
  assert.throws(() => assertNeonSeedDatabase(`${neonExample}&sslmode=disable`));
  const checkedNeon = new URL(assertNeonSeedDatabase(neonExample));
  assert.equal(checkedNeon.searchParams.get("sslmode"), "require");
  assert.equal(checkedNeon.searchParams.get("channel_binding"), "require");
  assert.equal(checkedNeon.searchParams.has("schema"), false);
  const exampleEnv = { LOCAL_DATABASE_URL: "postgresql://localhost:5435/forest-of-study", NEON_DATABASE_URL: neonExample };
  assert.equal(getSeedTarget([], exampleEnv).name, "local");
  assert.equal(getSeedTarget(["--target=neon"], exampleEnv).name, "neon");
  assert.equal(getSeedTarget([], { LOCAL_DATABASE_URL: exampleEnv.LOCAL_DATABASE_URL }).name, "local");
  assert.equal(getSeedTarget(["--target=neon"], { NEON_DATABASE_URL: neonExample }).name, "neon");
  assert.throws(() => getSeedTarget([], { LOCAL_DATABASE_URL: neonExample }));
  assert.throws(() => getSeedTarget(["--target=neon"], { NEON_DATABASE_URL: exampleEnv.LOCAL_DATABASE_URL }));
  assert.throws(() => getSeedTarget(["--target=neon"], { DATABASE_URL: neonExample }));
  assert.throws(() => getSeedTarget([], { DATABASE_URL: exampleEnv.LOCAL_DATABASE_URL }));
  assert.throws(() => getSeedTarget(["--target=local", "--target=neon"], exampleEnv));
  assert.throws(() => getSeedTarget(["--target=other"], exampleEnv));

  step = "한국 날짜 경계 확인";
  const boundaries = [
    ["한국 자정 직전", "2026-10-12T14:59:59.999Z", "2026-10-12"],
    ["한국 자정", "2026-10-12T15:00:00.000Z", "2026-10-13"],
    ["UTC 자정 직전", "2026-10-12T23:59:59.999Z", "2026-10-13"],
    ["UTC 자정", "2026-10-13T00:00:00.000Z", "2026-10-13"],
    ["일요일 마지막", "2026-10-11T14:59:59.999Z", "2026-10-11"],
    ["월요일 시작", "2026-10-11T15:00:00.000Z", "2026-10-12"],
    ["월말 마지막", "2026-10-31T14:59:59.999Z", "2026-10-31"],
    ["다음 달 시작", "2026-10-31T15:00:00.000Z", "2026-11-01"],
    ["연말 마지막", "2026-12-31T14:59:59.999Z", "2026-12-31"],
    ["다음 해 시작", "2026-12-31T15:00:00.000Z", "2027-01-01"],
    ["윤년 2월 29일", "2028-02-28T15:00:00.000Z", "2028-02-29"],
    ["윤년 3월 시작", "2028-02-29T15:00:00.000Z", "2028-03-01"],
    ["평년 3월 시작", "2026-02-28T15:00:00.000Z", "2026-03-01"],
  ];
  for (const [, utc, expected] of boundaries) assert.equal(getKoreanDate(new Date(utc)), expected);
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDate("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftDate("2028-02-29", 1), "2028-03-01");
  console.log(`확인 대상: ${target.label} (${target.envName}). 로컬·Neon 교차 지정은 거절합니다.`);
  console.table(boundaries.map(([caseName, utc, koreanDate]) => ({ case: caseName, utc, koreanDate })));

  if (target.preflight) {
    console.log("사전 확인 완료. DB 연결·조회·변경은 하지 않았습니다.");
  } else {
    const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
      import("@prisma/client"), import("@prisma/adapter-pg"),
    ]);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.connectionString }), log: [] });
    step = "시드 행·관계·기간·총점 확인";
    await prisma.$transaction(async (tx) => {
      // 여러 조회가 같은 스냅샷을 보도록 하고 SQL 쓰기도 금지한다.
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const studies = await tx.study.findMany({ select: {
        id: true, nickname: true, name: true, introduction: true, backgroundKey: true,
        points: true, createdAt: true, updatedAt: true,
      } });
      const routines = await tx.routine.findMany();
      const histories = await tx.routineHistory.findMany();
      const challenges = await tx.challenge.findMany();
      const reactions = await tx.reaction.findMany();
      const rows = { studies, routines, histories, challenges, reactions };
      validateSeedRows(rows, new Date());
      step = "배경 8종 분포 확인";
      const backgroundCounts = SEED_BACKGROUND_KEYS.map((backgroundKey) => ({
        backgroundKey, count: studies.filter((row) => row.backgroundKey === backgroundKey).length,
      }));
      for (const { count } of backgroundCounts) assert(count >= 1 && count <= 2);
      console.table(backgroundCounts);
      step = "스터디별 시드 구성 확인";
      for (let s = 1; s <= 13; s += 1) {
        const [, , routineCount, historyCount, challengeCount, reactionCount, points] = STUDY_CASES[s - 1];
        const ownedRoutines = routines.filter((r) => r.studyId === studyId(s));
        const ids = new Set(ownedRoutines.map((r) => r.id));
        assert.equal(ownedRoutines.length, routineCount);
        assert.equal(histories.filter((h) => ids.has(h.routineId)).length, historyCount);
        assert.equal(challenges.filter((c) => c.studyId === studyId(s)).length, challengeCount);
        assert.equal(reactions.filter((r) => r.studyId === studyId(s)).length, reactionCount);
        assert.equal(studies.find((r) => r.id === studyId(s))?.points, points);
      }
      assert.equal(routines.filter((r) => r.endsOn === null).length, 43);
      assert.equal(routines.filter((r) => r.studyId === studyId(3) && r.endsOn === null).length, 18);
      assert.equal(routines.filter((r) => r.studyId === studyId(4) && r.endsOn === null).length, 17);
      for (const [status, count] of [["COMPLETED", 9], ["RUNNING", 2], ["PAUSED", 2], ["RESET", 3]]) {
        assert.equal(challenges.filter((c) => c.status === status).length, count);
      }

      step = "저장된 한국 자정·UTC 자정 기록 확인";
      // S01 생성 시각이 이번 시드의 기준 시각이다. 확인일이 달라져도 새 날짜로 재해석하지 않는다.
      const today = getKoreanDate(studies.find((r) => r.id === studyId(1)).createdAt);
      const yesterday = shiftDate(today, -1);
      const twoDaysAgo = shiftDate(today, -2);
      const historyAt = (r, date) => histories.find((h) => h.routineId === routineId(2, r) && dateString(h.recordDate) === date);
      for (const [r, date, time] of [[1, twoDaysAgo, "23:59:59.999"], [1, yesterday, "00:00:00.000"],
        [2, yesterday, "08:59:59.999"], [4, yesterday, "09:00:00.000"]]) {
        assert.equal(historyAt(r, date)?.createdAt.getTime(), koreanInstant(date, time).getTime());
      }
      assert.equal(historyAt(2, today)?.completed, false); // 명시적 체크 해제 행
      assert(!historyAt(3, today)); // 유효 날짜지만 미기록, 조회 시 false
      const previousCheck = histories.find((h) => h.routineId === routineId(3, 6)
        && dateString(h.recordDate) === yesterday);
      assert.equal(previousCheck?.completed, true);
      assert(!histories.some((h) => h.routineId === routineId(3, 6) && dateString(h.recordDate) === today));
      const sameDay = routines.find((r) => r.id === routineId(2, 6));
      assert.equal(dateString(sameDay.startsOn), today);
      assert.equal(dateString(sameDay.endsOn), today);
      assert.equal(historyAt(6, today)?.completed, true);
      const weekStart = shiftDate(today, -6);
      const visible = routines.filter((r) => r.studyId === studyId(2)
        && dateString(r.startsOn) <= today && (r.endsOn === null || dateString(r.endsOn) >= weekStart));
      assert.equal(visible.length, 7);
      assert(!visible.some((r) => r.id === routineId(2, 7)));
      assert(visible.some((r) => r.id === routineId(2, 8)));

      step = "자정을 지난 집중 구성 확인";
      const crossing = challenges.find((c) => c.id === challengeId(6, 2));
      const midnight = koreanInstant(today).getTime();
      const elapsedAt = (at) => Math.min(crossing.goalMinutes * 60_000,
        crossing.elapsedMilliseconds + Math.max(0, at - crossing.lastStartedAt.getTime()));
      assert.equal(getKoreanDate(crossing.lastStartedAt), yesterday);
      assert.equal(elapsedAt(midnight - 1), 180 * 60_000 - 1);
      assert.equal(elapsedAt(midnight), 180 * 60_000);
      assert.equal(elapsedAt(midnight + 86_400_000), 180 * 60_000);
      assert.equal(crossing.status, "RUNNING");
      assert.equal(crossing.awardedPoints, 0);
      assert.equal(challenges.find((c) => c.id === challengeId(7, 2)).elapsedMilliseconds, 7 * 60_000);

      step = "응원 상위 3종 정렬 확인";
      // DB의 COUNT·MIN·C collation을 실제로 확인한다. 이모지 값은 모두 다르다.
      const top = await tx.$queryRaw`
        SELECT "studyId"::text AS "studyId", "emoji", COUNT(*)::int AS "count"
        FROM "Reaction" WHERE "studyId" IN (${studyId(11)}::uuid, ${studyId(12)}::uuid)
        GROUP BY "studyId", "emoji"
        ORDER BY "studyId", COUNT(*) DESC, MIN("createdAt") ASC, "emoji" COLLATE "C" ASC
      `;
      assert.deepEqual(top.filter((r) => r.studyId === studyId(11)).slice(0, 3).map((r) => [r.emoji, r.count]),
        [["🔥", 5], ["👏", 4], ["💪", 3]]);
      assert.deepEqual(top.filter((r) => r.studyId === studyId(12)).slice(0, 3).map((r) => [r.emoji, r.count]),
        [["🌱", 2], ["👏", 2], ["💪", 2]]);
      console.log(`시드 한국 날짜: ${today}, weekStart: ${weekStart}`);
    }, { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 30_000 });
    console.table(Object.entries(EXPECTED_COUNTS).map(([table, rows]) => ({ table, rows })));
    console.log(`${target.label} 시드 구성·DB 조회·한국 날짜 경계 확인 완료. API의 날짜 계산·자정 전후 요청·완료 지급 동작은 별도 검증이 필요합니다.`);
  }
} catch {
  console.error(`시드 확인 실패: ${target?.label ?? "대상 설정"} / ${step}. LOCAL_DATABASE_URL 또는 NEON_DATABASE_URL·migration을 확인하고, 전체 확인은 시드 직후 API 조작 전에 실행해주세요.`);
  // URL·비밀번호·DB 오류 원문·해시를 출력하지 않는다.
  process.exitCode = 1;
} finally {
  if (prisma) {
    try { await prisma.$disconnect(); } catch {
      console.error("확인용 DB 연결 종료에 실패했습니다.");
      process.exitCode = 1;
    }
  }
}
