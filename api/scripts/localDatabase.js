import { assertLocalSeedDatabase } from "../seedData.js";

// Prisma와 이를 가져오는 모듈보다 먼저 호출한다. URL·비밀번호는 출력하지 않는다.
export const assertLocalDatabase = async () => {
  const { databaseUrl } = await import("../src/config/env.js");
  assertLocalSeedDatabase(databaseUrl);
};
