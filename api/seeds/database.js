import assert from "node:assert/strict";

// 로컬 Compose 주소만 허용하고 URL·비밀번호를 오류에 포함하지 않는다.
// 접속 대상을 바꾸는 query도 거절하며 localhost는 IPv4 loopback으로 고정한다.
export const assertLocalSeedDatabase = (databaseUrl) => {
  const message = "시드는 로컬 DB 전용입니다. localhost/127.0.0.1:5435, DB 이름 forest-of-study를 사용해주세요.";
  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error(message); }
  const params = [...url.searchParams];
  if (!["postgres:", "postgresql:"].includes(url.protocol)
      || !["localhost", "127.0.0.1"].includes(url.hostname)
      || url.port !== "5435" || url.pathname !== "/forest-of-study" || url.hash
      || params.some(([key, value]) => key !== "schema" || value !== "public")
      || params.length > 1) {
    throw new Error(message);
  }
  // 호출하는 스크립트는 이 반환값으로만 Prisma adapter를 생성한다.
  url.hostname = "127.0.0.1";
  url.search = ""; // public은 기본 스키마이므로 드라이버에 query를 전달하지 않는다.
  return url.toString();
};

// Neon 전용 명령만 외부 DB를 허용한다. 로컬 검사를 완화하거나 DATABASE_URL로 대체하지 않는다.
export const assertNeonSeedDatabase = (databaseUrl) => {
  const message = "Neon 시드는 NEON_DATABASE_URL의 Neon 주소와 sslmode=require 또는 검증용 SSL 설정이 필요합니다.";
  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error(message); }
  const params = [...url.searchParams];
  const allowed = {
    schema: (value) => value === "public",
    sslmode: (value) => ["require", "verify-ca", "verify-full"].includes(value),
    channel_binding: (value) => ["require", "prefer"].includes(value),
    connect_timeout: (value) => /^[1-9]\d*$/.test(value),
  };
  if (!["postgres:", "postgresql:"].includes(url.protocol)
      || !url.hostname.endsWith(".neon.tech")
      || (url.port !== "" && url.port !== "5432")
      || !/^\/[^/]+$/.test(url.pathname) || url.hash
      || !allowed.sslmode(url.searchParams.get("sslmode"))
      || new Set(params.map(([key]) => key)).size !== params.length
      || params.some(([key, value]) => !Object.hasOwn(allowed, key) || !allowed[key](value))) {
    throw new Error(message);
  }
  // SSL·channel binding을 유지하고 Prisma의 public 지정만 드라이버에서 제외한다.
  url.searchParams.delete("schema");
  return url.toString();
};

export const getSeedTarget = (args, environment) => {
  const targetArgs = args.filter((arg) => arg.startsWith("--target="));
  const name = targetArgs.length === 0 ? "local" : targetArgs[0].slice("--target=".length);
  if (targetArgs.length > 1 || !["local", "neon"].includes(name)
      || args.some((arg) => arg !== `--target=${name}`)) {
    throw new Error("시드 대상은 --target=local 또는 --target=neon만 허용합니다.");
  }
  const envName = name === "local" ? "LOCAL_DATABASE_URL" : "NEON_DATABASE_URL";
  if (typeof environment[envName] !== "string" || environment[envName].length === 0) {
    throw new Error(`${envName} 설정이 필요합니다.`);
  }
  return {
    name, label: name === "local" ? "로컬" : "Neon", envName,
    connectionString: name === "local" ? assertLocalSeedDatabase(environment[envName])
      : assertNeonSeedDatabase(environment[envName]),
  };
};

// 외부 연결 없이 대상 주소 검증의 허용·거절 규칙을 확인한다.
export const validateSeedTargets = () => {
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
};

export const createSeedClient = async (target) => {
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("@prisma/client"), import("@prisma/adapter-pg"),
  ]);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: target.connectionString }), log: [] });
};
