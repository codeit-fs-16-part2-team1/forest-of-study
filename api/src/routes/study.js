import express from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { uuidSchema } from "../utils/uuid.js";
import { createApiError } from "../utils/apiError.js";
import { Prisma } from "@prisma/client";

const studyRouter = express.Router();

//조회 응답에 사용되는 공개필드. prisma조회에서 select: studySelect로 조회. 
const studySelect = {
  id: true,
  nickname: true,
  name: true,
  introduction: true,
  backgroundKey: true,
  points: true,
  createdAt: true,
  updatedAt: true,
};



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

//비밀번호는 4~20자, 영문 대소문자, 숫자, 특수문자만 허용.
// 비밀번호 원문을 검사하며 공백을 제거하지 않습니다.
const passwordSchema = z.string()
  .min(4)
  .max(20)
  .regex(/^[A-Za-z0-9!@#$%^&*]+$/);


 const backgroundSchema = z.enum([
  "green",
  "yellow",
  "blue",
  "pink",
  "image1",
  "image2",
  "image3",
  "image4",
]).default("green"); 

const createStudySchema = z.object({
  nickname: createTextSchema(10),
  name: createTextSchema(15),
  introduction: createTextSchema(100),
  backgroundKey: backgroundSchema,
  password: passwordSchema,
  passwordConfirm: passwordSchema,
})
  .strict()
  .refine(
    (data) => data.password === data.passwordConfirm,
    { path: ["passwordConfirm"], message: "" }
  );


//스터디목록 조회 
const studyListQuerySchema = z.object({

  //검색 시 앞뒤공백 제거, NFC정규화, 기본값은 빈 문자열. 
  keyword: z.string()
  .trim()
  .normalize("NFC")
  .default(""),

  //건너뛰는 스터디목록 개수.   
  //offset을 문자열로 받지만, 숫자로 변환 후, 0 이상의 정수인지 검사합니다. 기본값은 0입니다.  
  offset: z.string()
    .regex(/^\d+$/)
    .default("0")
    .transform(Number)
    .pipe(z.number().int().min(0)),

  //한번에 보여줄 스터디 수.    
  //limit을 문자열로 받지만, 숫자로 변환 후, 1 이상의 정수인지 검사합니다. 기본값은 6입니다.  
  limit: z.string()
    .regex(/^\d+$/)
    .default("6")
    .transform(Number)
    .pipe(z.number().int().min(1)),

  //정렬 기준.    
  sort: z.enum([
    "latest",
    "oldest",
    "points_desc",
    "points_asc",
  ]).default("latest"),
}).strict();

// 상한은 중복 제거 전 입력 개수에 적용합니다. UUID는 대소문자를 통일합니다.
const studyBatchQuerySchema = z.object({
  ids: z.string()
    .transform((value) => value.split(",")) //쉼표로 구분된 문자열을 배열로 변환
    .pipe(z.array(uuidSchema).min(1).max(10)) //변환된 배열이 1~10개인지, uuid 형식인지 검사
    .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]), //중복제거 후 uuid의 영문자를 소문자로 통일
}).strict(); //ids 이외의 쿼리필드 거절 

//object()객체 안의 필드가 uuid 형식인지 검사 
const studyIdParamsSchema = z.object({
  studyId: uuidSchema,
});


//스터디목록 조회 요청 -> 쿼리검사 단계 
studyRouter.get("/", async (req, res) => {
  
  const result = studyListQuerySchema.safeParse(req.query);
  
 //검사 실패 시 400 응답. 검사 성공 시 result.data에 offset, limit, sort, keyword를 담음.
 if (!result.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  const { offset, limit, sort, keyword } = result.data;

  //최근순, 오래된순, 포인트 높은순, 포인트 낮은순 정렬 조건을 orderByMap에 정의.
  //생성시각, 포인트 같을 시 id 오름차순으로 정렬.
  const orderByMap = {
    latest: Prisma.sql`"createdAt" DESC, "id" ASC`,
    oldest: Prisma.sql`"createdAt" ASC, "id" ASC`,
    points_desc: Prisma.sql`"points" DESC, "id" ASC`,
    points_asc: Prisma.sql`"points" ASC, "id" ASC`,
  };


// 검색어가 빈 문자열인지 확인, 빈 문자열이면 검색조건 넣지 않고 전체목록 조회, 있으면 조건에 따라. 
  // strpos를 사용해 %와 _도 일반 글자로 검색합니다.
  const where = keyword === ""
    ? Prisma.empty
    : Prisma.sql`
        WHERE
          strpos(
            lower(normalize("name", NFC)),
            lower(normalize(${keyword}::text, NFC))
          ) > 0
          OR strpos(
            lower(normalize("nickname", NFC)),
            lower(normalize(${keyword}::text, NFC))
          ) > 0
          OR strpos(
            lower(normalize("introduction", NFC)),
            lower(normalize(${keyword}::text, NFC))
          ) > 0
      `;  // 검색어 시작 위치가 0보다 크면 검색어가 포함된 것으로 판단합니다.

  const [studies, counts] = await prisma.$transaction([
    prisma.$queryRaw`
      SELECT
        "id",
        "nickname",
        "name",
        "introduction",
        "backgroundKey",
        "points",
        "createdAt",
        "updatedAt"
      FROM "Study"
      ${where}
      ORDER BY ${orderByMap[sort]}
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::integer AS "total"
      FROM "Study"
      ${where}
    `,
  ], {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  }); //두 쿼리를 하나의 트랜잭션으로 묶어 일관된 결과를 보장합니다. isolationLevel: RepeatableRead로 설정하여 트랜잭션 내에서 동일한 쿼리 결과를 보장합니다.

  const total = counts[0].total;

  return res.status(200).json({
    data: studies,
    pagination: {
      offset,
      limit,
      total,
      hasMore: offset + studies.length < total,
    },
  });
});
 



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

    throw createApiError(code);
  }
  //유효성검증 코드 - .refine()검사 실패 시 code:"custom" path:["passwordConfirm"]로 issues에 담김.

  const {
    nickname,
    name,
    introduction,
    backgroundKey,
    password,
  } = result.data;

  
  const passwordHash = await bcrypt.hash(password, 10);
  //10:해시 계산비용을 정하는 값. passwordHarsh:DB에 저장할 해시값. 10이면 2^10번의 연산을 수행하여 해시를 생성.
  const study = await prisma.study.create({
    
    //data:DB에 저장할 데이터. 원문 비밀번호 확인값은 저장 x
    data: {
      nickname,
      name,
      introduction,
      backgroundKey,
      passwordHash,
    },
    //select:DB에서 가져올 데이터. passwordHash는 가져오지 않음.
    select:studySelect,
  });

  return res.status(201).json({
    data: study,
  });
});


// /batch가 스터디 ID로 해석되지 않도록 상세 라우트보다 먼저 등록합니다.
studyRouter.get("/batch", async (req, res) => {
  const result = studyBatchQuerySchema.safeParse(req.query);

  if (!result.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  const { ids } = result.data;
  const sqlIds = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));

  // 스터디와 응원을 각각 한 번씩 조회하고 같은 DB 스냅샷을 사용합니다.
  const [studies, reactions] = await prisma.$transaction([
    prisma.study.findMany({
      where: { id: { in: ids } },
      select: studySelect,
    }),
    prisma.$queryRaw`
      WITH ranked AS (
        SELECT
          "studyId",
          "emoji",
          COUNT(*)::integer AS "count",
          ROW_NUMBER() OVER (
            PARTITION BY "studyId"
            ORDER BY COUNT(*) DESC, MIN("createdAt") ASC, "emoji" COLLATE "C" ASC
          ) AS "rank"
        FROM "Reaction"
        WHERE "studyId" IN (${sqlIds})
        GROUP BY "studyId", "emoji"
      )
      SELECT "studyId", "emoji", "count"
      FROM ranked
      WHERE "rank" <= 3
      ORDER BY "studyId", "rank"
    `,
  ], {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });

  const reactionsByStudy = new Map();
  for (const { studyId, emoji, count } of reactions) {
    if (!reactionsByStudy.has(studyId)) {
      reactionsByStudy.set(studyId, []);
    }
    reactionsByStudy.get(studyId).push({ emoji, count });
  }

  const studiesById = new Map(studies.map((study) => [study.id, study]));
  const data = ids
    .filter((id) => studiesById.has(id))
    .map((id) => ({
      ...studiesById.get(id),
      reactions: reactionsByStudy.get(id) ?? [],
    }));

  return res.status(200).json({ data });
});

//상세조회 요청에서 스터디 ID 검사 
studyRouter.get("/:studyId", async (req, res) => {
  const result = studyIdParamsSchema.safeParse(req.params);
  //URL에 담긴 studyId가 uuid 형식인지 검사. safeParse()로 검사실패 시 false 반환

  if (!result.success) {
    throw createApiError("VALIDATION_ERROR");
  }
  //검사 실패 시 공통오류 반환. 검사 성공시 result.data에 studyId를 담음.
  const { studyId } = result.data;

  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: studySelect,
  });

  if (!study) {
    throw createApiError("STUDY_NOT_FOUND");
  }

  // 개수 내림차순 → 최초 반응 시각 → 이모지 값 순으로 상위 3종.
  // studyId는 바인딩된 매개변수로 전달됩니다.
  const reactions = await prisma.$queryRaw`
    SELECT
      "emoji",
      COUNT(*)::integer AS "count"
    FROM "Reaction"
    WHERE "studyId" = ${studyId}::uuid
    GROUP BY "emoji"
    ORDER BY
      COUNT(*) DESC,
      MIN("createdAt") ASC,
      "emoji" COLLATE "C" ASC
    LIMIT 3
  `;

  return res.status(200).json({
    data: {
      ...study,
      reactions,
    },
  });
});







export default studyRouter;
