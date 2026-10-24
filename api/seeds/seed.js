// 선택한 DB의 5개 업무 테이블 전체를 교체한다. 실행 전 대상·백업·migration을 확인하고 API 쓰기를 중지한다.
// 데이터 검사와 삽입 결과 확인은 실행에 포함한다. migration 이력은 변경하지 않는다.
import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";
import { createSeedClient, getSeedTarget, validateSeedTargets } from "./database.js";
import { buildSeedData, checkTestSeedData, validateSeedRows, validateStoredTestData } from "./testData.js";
import { buildDemoSeedData, checkDemoSeedPreflight, validateDemoSeedData } from "./demoData.js";

// 기존 시드와 동일한 공통 비밀번호 해시. 원문·해시는 출력하지 않는다.
const PASSWORD_HASH = "$2b$10$JW5N1NGCkICxI.wuvzx4GerzHvq5nOJ7zAKa0JnU4QFh/5SHgsxpK";
const models = { studies: "study", routines: "routine", histories: "routineHistory", challenges: "challenge", reactions: "reaction" };

export const parseSeedOptions = (args) => {
  const dataArgs = args.filter((arg) => arg.startsWith("--data="));
  const targetArgs = args.filter((arg) => arg.startsWith("--target="));
  if (dataArgs.length > 1 || targetArgs.length > 1
    || args.some((arg) => !["--data=test", "--data=demo", "--target=local", "--target=neon"].includes(arg))) {
    throw new Error("시드 종류 또는 대상 인자 오류");
  }
  return { type: dataArgs[0]?.slice("--data=".length) ?? "test", targetArgs };
};

const validate = (type, data) => type === "demo" ? validateDemoSeedData(data) : validateSeedRows(data, data.anchorTime);
const normalize = (rows, keys) => rows.map((row) => JSON.stringify(Object.fromEntries(
  [...keys].sort().map((key) => [key, row[key]]),
))).sort();

// 결과 확인도 같은 트랜잭션 안에서 수행해 불일치하면 삭제·삽입을 함께 롤백한다.
export const replaceSeedData = async (prisma, type) => {
  assert(["test", "demo"].includes(type), "시드 종류 오류");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE "Study", "Routine", "RoutineHistory", "Challenge", "Reaction" IN ACCESS EXCLUSIVE MODE`;
    const data = type === "demo" ? buildDemoSeedData(new Date()) : buildSeedData(new Date());
    validate(type, data);
    await tx.routineHistory.deleteMany();
    await tx.reaction.deleteMany();
    await tx.challenge.deleteMany();
    await tx.routine.deleteMany();
    await tx.study.deleteMany();
    for (const [key, model] of Object.entries(models)) {
      const rows = key === "studies" ? data[key].map((row) => ({ ...row, passwordHash: PASSWORD_HASH })) : data[key];
      const result = await tx[model].createMany({ data: rows });
      assert.equal(result.count, rows.length, model + " 삽입 수량 불일치");
    }
    const actual = { anchorTime: data.anchorTime, today: data.today };
    for (const [key, model] of Object.entries(models)) {
      // 구성에 포함된 필드만 조회해 DB 기본값과 비밀번호를 비교·출력하지 않는다.
      const keys = Object.keys(data[key][0]);
      actual[key] = await tx[model].findMany({ select: Object.fromEntries(keys.map((field) => [field, true])) });
      assert.deepEqual(normalize(actual[key], keys), normalize(data[key], keys), model + " 저장 결과 불일치");
    }
    validate(type, actual);
    if (type === "test") await validateStoredTestData(tx, actual);
    return data;
  }, { maxWait: 10_000, timeout: 60_000 });
};

const main = async () => {
  let prisma;
  let target;
  let committed = false;
  let step = "실행 인자·대상 설정 확인";
  try {
    const { type, targetArgs } = parseSeedOptions(process.argv.slice(2));
    try { loadEnvFile(new URL("../.env", import.meta.url)); } catch (error) {
      if (error.code !== "ENOENT") throw new Error("환경변수 로드 실패");
    }
    target = getSeedTarget(targetArgs, process.env);
    step = "DB 연결 전 데이터·대상 규칙 검사";
    validateSeedTargets();
    if (type === "demo") checkDemoSeedPreflight();
    else checkTestSeedData();
    step = "DB 연결·migration 필드 확인";
    prisma = await createSeedClient(target);
    const columns = await prisma.$queryRaw`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name = 'Study' AND column_name IN ('nickname', 'name', 'introduction')) OR (table_name = 'Routine' AND column_name = 'name'))`;
    assert(columns.length === 4 && columns.every((column) => column.data_type === "text"), "TEXT migration 미적용");
    if (type === "demo") {
      await prisma.study.findMany({ take: 1, select: {
        backgroundColor: true, textColor: true, patternKey: true, patternColor: true,
      } });
      await prisma.routine.findMany({ take: 1, select: { position: true, stickerColor: true } });
    }
    console.log(target.label + " DB의 5개 업무 테이블 전체를 " + (type === "demo" ? "시연용" : "테스트용") + " 데이터로 교체합니다.");
    step = "전체 교체·저장 결과 검사 트랜잭션";
    const data = await replaceSeedData(prisma, type);
    committed = true;
    console.log(target.label + " 시드 교체·저장 결과 검사 완료. 한국 날짜: " + data.today);
    console.table(Object.fromEntries(Object.entries(models).map(([key, model]) => [model, data[key].length])));
    console.table(data.studies.map(({ id, nickname, name, points }) => ({ id, nickname, name, points })));
    console.log("기존 공통 비밀번호를 사용합니다. API·화면 동작은 별도로 확인해주세요.");
  } catch {
    console.error("시드 실패: " + (target?.label ?? "대상 설정") + " / " + step);
    console.error("선택한 LOCAL_DATABASE_URL 또는 NEON_DATABASE_URL·Prisma Client·migration 상태를 확인해주세요.");
    console.error(committed ? "교체 트랜잭션은 완료됐습니다. DB 상태를 확인해주세요."
      : "트랜잭션 실패 시 삭제·삽입은 함께 롤백됩니다. 연결 오류로 결과가 불명확하면 DB 상태를 확인해주세요.");
    process.exitCode = 1;
  } finally {
    if (prisma) {
      try { await prisma.$disconnect(); } catch {
        console.error("시드 DB 연결 종료 실패. DB 상태를 확인해주세요.");
        process.exitCode = 1;
      }
    }
  }
};

// import로 데이터·트랜잭션 로직을 검사할 때 DB 실행을 시작하지 않는다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
