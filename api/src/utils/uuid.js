import { z } from "zod";

// 객체 스키마와 단일 값 검사에 같은 UUID 검증 기준을 사용한다.
export const uuidSchema = z.uuid();

export const isValidUuid = (value) => uuidSchema.safeParse(value).success;
