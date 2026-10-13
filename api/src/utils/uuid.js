// DB의 UUID 형식을 검사한다. 특정 버전의 UUID로 제한하지 않는다.
export const isValidUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
