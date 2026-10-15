import { z } from "zod";

// ADR-066: 공백을 제거하거나 타입을 변환하지 않고 원문을 검사한다.
export const studyPasswordSchema = z
  .string()
  .min(4)
  .max(20)
  .regex(/^[A-Za-z0-9!@#$%^&*]+$/)
  // $는 마지막 줄바꿈 앞에도 일치하므로 공백은 별도로 거절한다.
  .refine((value) => !/\s/u.test(value));

const passwordVerificationBodySchema = z.strictObject({
  // 누락은 서비스에서 VERIFICATION_REQUIRED로 구분한다.
  password: studyPasswordSchema.optional(),
});

export const validateStudyPassword = (password) =>
  studyPasswordSchema.safeParse(password);

export const validatePasswordVerificationBody = (body) =>
  passwordVerificationBodySchema.safeParse(body);
