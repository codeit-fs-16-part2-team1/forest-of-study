import { z } from "zod";

// 비밀번호는 원문으로 검사한다. trim·공백 제거·타입 변환을 적용하지 않는다.
export const studyPasswordSchema = z
  .string()
  .min(4)
  .max(20)
  .regex(/^[A-Za-z0-9!@#$%^&*]+$/);

const passwordVerificationBodySchema = z.strictObject({
  // 누락은 서비스에서 VERIFICATION_REQUIRED로 구분한다.
  password: studyPasswordSchema.optional(),
});

export const validateStudyPassword = (password) =>
  studyPasswordSchema.safeParse(password);

export const validatePasswordVerificationBody = (body) =>
  passwordVerificationBodySchema.safeParse(body);
