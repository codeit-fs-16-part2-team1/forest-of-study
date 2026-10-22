import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";
import { countGraphemes } from "../utils/string.js";
import { studyPasswordSchema } from "./studyPassword.js";

const createTextSchema = (maxLength) => z.string().trim().refine((value) => {
  const length = countGraphemes(value);
  return length >= 1 && length <= maxLength;
});

const backgroundKeySchema = z.enum([
  "green", "yellow", "blue", "pink", "image1", "image2", "image3", "image4", "custom",
]);

const hexColorSchema = z.string().length(7).regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase()).nullable();

// 첫 3종은 저장 키를 유지하고 프론트에서 씨앗·잔물결·소프트 체크로 표시한다.
const patternKeySchema = z.enum(["dots", "waves", "stripes", "leaves", "paper"]).nullable();

const checkBackgroundCombination = (data, context) => {
  if (data.backgroundKey === "custom" && data.backgroundColor == null) {
    context.addIssue({ code: "custom", path: ["backgroundColor"], message: "" });
  } else if (data.backgroundKey === undefined && data.backgroundColor !== undefined) {
    // PATCH의 색상 변경은 키와 함께 전달해 의도한 배경 종류를 명시한다.
    context.addIssue({ code: "custom", path: ["backgroundKey"], message: "" });
  } else if (data.backgroundKey !== "custom" && data.backgroundColor != null) {
    context.addIssue({ code: "custom", path: ["backgroundColor"], message: "" });
  }

  if (data.backgroundKey !== undefined && data.backgroundKey !== "custom" && data.textColor != null) {
    context.addIssue({ code: "custom", path: ["textColor"], message: "" });
  }

  // PATCH는 패턴과 무늬색을 함께 변경한다. 둘 다 null이면 패턴을 제거한다.
  const hasPatternField = data.patternKey !== undefined || data.patternColor !== undefined;
  if (hasPatternField && ((data.patternKey == null) !== (data.patternColor == null)
    || data.patternKey === undefined || data.patternColor === undefined)) {
    context.addIssue({ code: "custom", path: ["patternKey"], message: "" });
  }
  if (data.backgroundKey !== undefined && data.backgroundKey !== "custom"
    && (data.patternKey != null || data.patternColor != null)) {
    context.addIssue({ code: "custom", path: ["patternKey"], message: "" });
  }
};

const createStudySchema = z.strictObject({
  nickname: createTextSchema(10),
  name: createTextSchema(15),
  introduction: createTextSchema(100),
  backgroundKey: backgroundKeySchema.default("green"),
  backgroundColor: hexColorSchema.default(null),
  textColor: hexColorSchema.default(null),
  patternKey: patternKeySchema.default(null),
  patternColor: hexColorSchema.default(null),
  password: studyPasswordSchema,
  passwordConfirm: studyPasswordSchema,
}).superRefine(checkBackgroundCombination).refine((data) => data.password === data.passwordConfirm, {
  path: ["passwordConfirm"],
  message: "",
});

const studyListQuerySchema = z.strictObject({
  keyword: z.string().trim().normalize("NFC").default(""),
  offset: z.string().regex(/^\d+$/).default("0")
    .transform(Number).pipe(z.number().int().min(0)),
  limit: z.string().regex(/^\d+$/).default("6")
    .transform(Number).pipe(z.number().int().min(1).max(6)),
  sort: z.enum(["latest", "oldest", "points_desc", "points_asc"]).default("latest"),
});

// UUID 검사 → 소문자 통일·중복 제거 → 서로 다른 ID 최대 10개 검사
const studyBatchQuerySchema = z.object({
  ids: z.string()
    .transform((value) => value.split(","))
    .pipe(z.array(uuidSchema).min(1))
    .transform((ids) => [
      ...new Set(ids.map((id) => id.toLowerCase())),
    ])
    .pipe(z.array(uuidSchema).max(10)),
}).strict();

const studyIdParamsSchema = z.strictObject({ studyId: uuidSchema });

const updateStudySchema = z.strictObject({
  nickname: createTextSchema(10).optional(),
  name: createTextSchema(15).optional(),
  introduction: createTextSchema(100).optional(),
  backgroundKey: backgroundKeySchema.optional(),
  backgroundColor: hexColorSchema.optional(),
  textColor: hexColorSchema.optional(),
  patternKey: patternKeySchema.optional(),
  patternColor: hexColorSchema.optional(),
}).superRefine(checkBackgroundCombination)
  .refine((data) => Object.values(data).some((value) => value !== undefined))
  .transform((data) => data.backgroundKey !== undefined && data.backgroundKey !== "custom"
    ? { ...data, backgroundColor: null, textColor: null, patternKey: null, patternColor: null }
    : data);

export const validateCreateStudy = (body) => createStudySchema.safeParse(body);
export const validateUpdateStudy = (body) => updateStudySchema.safeParse(body);
export const validateStudyListQuery = (query) => studyListQuerySchema.safeParse(query);
export const validateStudyBatchQuery = (query) => studyBatchQuerySchema.safeParse(query);
export const validateStudyIdParams = (params) => studyIdParamsSchema.safeParse(params);
