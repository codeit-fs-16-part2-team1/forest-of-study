import { z } from "zod";
import { uuidSchema } from "../utils/uuid.js";
import { countGraphemes } from "../utils/string.js";
import { studyPasswordSchema } from "./studyPassword.js";

const createTextSchema = (maxLength) => z.string().trim().refine((value) => {
  const length = countGraphemes(value);
  return length >= 1 && length <= maxLength;
});

const createStudySchema = z.strictObject({
  nickname: createTextSchema(10),
  name: createTextSchema(15),
  introduction: createTextSchema(100),
  backgroundKey: z.enum([
    "green", "yellow", "blue", "pink", "image1", "image2", "image3", "image4",
  ]).default("green"),
  password: studyPasswordSchema,
  passwordConfirm: studyPasswordSchema,
}).refine((data) => data.password === data.passwordConfirm, {
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

const studyIdParamsSchema = z.strictObject({ studyId: uuidSchema });

export const validateCreateStudy = (body) => createStudySchema.safeParse(body);
export const validateStudyListQuery = (query) => studyListQuerySchema.safeParse(query);
export const validateStudyIdParams = (params) => studyIdParamsSchema.safeParse(params);
