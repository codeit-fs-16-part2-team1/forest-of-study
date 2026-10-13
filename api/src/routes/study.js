import express from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

const studyRouter = express.Router();

// 비밀번호에서 모든 공백을 제거할 때 사용합니다.
const removeWhitespace = (value) => value.replace(/\s/gu, "");

// 이모지도 그래핌 하나당 한 글자로 셉니다.
const segmenter = new Intl.Segmenter("ko", {
  granularity: "grapheme",
});

const countGraphemes = (value) =>
  [...segmenter.segment(value)].length;

// 앞뒤 공백 제거 후 빈 값과 최대 길이를 검사합니다.
const createTextSchema = (maxLength) =>
  z.string()
    .trim()
    .refine((value) => countGraphemes(value) >= 1)
    .refine((value) => countGraphemes(value) <= maxLength);

//비밀번호는 공백 제거 후 4~20자, 영문 대소문자, 숫자, 특수문자만 허용.
//removeWhitespace를 먼저 적용하여 공백을 전부 제거.
const passwordSchema = z.string()
  .transform(removeWhitespace)
  .pipe(
    z.string()
      .min(4)
      .max(20)
      .regex(/^[A-Za-z0-9!@#$%^&*]+$/)
  );

 const backgroundSchema = z.enum([
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "sky",
  "purple",
  "white",
]).default("green"); 

const createStudySchema = z.object({
  nickname: createTextSchema(10),
  name: createTextSchema(15),
  introduction: createTextSchema(100),
  backgroundKey: backgroundSchema,
  password: passwordSchema,
  passwordConfirm: z.string().transform(removeWhitespace),
})
  .strict()
  .refine(
    (data) => data.password === data.passwordConfirm,
    { path: ["passwordConfirm"], message: "" }
  );


studyRouter.post("/", async (req, res) => {
  const result = createStudySchema.safeParse(req.body);

  if (!result.success) {
    const issues = result.error.issues;

    let code = "VALIDATION_ERROR";

    if (
      issues.every(
        (issue) =>
          issue.code === "custom" &&
          issue.path[0] === "passwordConfirm"
      )
    ) {
      code = "PASSWORD_CONFIRM_MISMATCH";
    } else if (
      issues.every(
        (issue) =>
          issue.code === "invalid_value" &&
          issue.path[0] === "backgroundKey"
      )
    ) {
      code = "INVALID_BACKGROUND";
    }

    return res.status(400).json({
      error: {
        code,
        message: "",
        details: null,
      },
    });
  }
  //유효성검증 코드 - .refine()검사 실패 시 code:"custom" path:["passwordConfirm"]로 issues에 담김.

  const {
    nickname,
    name,
    introduction,
    backgroundKey,
    password,
  } = result.data;

  // 다음 단계: 비밀번호 해시 생성 → DB 저장 → 201 응답
});

export default studyRouter;