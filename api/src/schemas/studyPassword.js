import { z } from "zod";

// ADR-062: 문자열의 모든 공백을 제거한 뒤 검사한다. 타입은 자동 변환하지 않는다.
export const studyPasswordSchema = z
  .string()
  .transform((value) => value.replace(/\s/gu, ""))
  .pipe(z.string().min(4).max(20).regex(/^[A-Za-z0-9!@#$%^&*]+$/));

const passwordVerificationBodySchema = z.strictObject({
  // 누락은 서비스에서 VERIFICATION_REQUIRED로 구분한다.
  password: studyPasswordSchema.optional(),
});

export const validateStudyPassword = (password) =>
  studyPasswordSchema.safeParse(password);

export const validatePasswordVerificationBody = (body) =>
  passwordVerificationBodySchema.safeParse(body);
