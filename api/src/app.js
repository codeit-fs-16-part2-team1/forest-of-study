import express from "express";
import { prisma } from "./lib/prisma.js";
import studyRouter from "./routes/study.js";
import routineRouter from "./routes/routine.js";
import routineHistoryRouter from "./routes/routineHistory.js";
import { createChallengeRouter } from "./routes/challenge.js";
import { createChallengePauseResumeRouter } from "./routes/challengePauseResume.js";
import { createChallengeResetRouter } from "./routes/challengeReset.js";
import { createCompleteChallengeRouter } from "./routes/challengeComplete.js";
import { createCompleteChallengeService } from "./services/challengeComplete.js";
import studyPasswordRouter from "./routes/studyPassword.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { verifyStudyPassword } from "./middlewares/verifyStudyPassword.js";
import cors from "cors";

const app = express();

app.use(cors({origin: process.env.CORS_ORIGIN}));

const port = Number(process.env.PORT ?? 3000);

app.disable("x-powered-by");
app.use(express.json());

app.get("/", (req, res) => {
  res.send("공부의 숲 서버가 살아 있어요");
});

app.use("/api/studies", studyRouter);
app.use("/api/studies/:studyId/routines", routineRouter);
app.use("/api/studies/:studyId/routine-histories", routineHistoryRouter);
app.use("/api/studies/:studyId/password-verifications", studyPasswordRouter);

const challengeRouter = createChallengeRouter({ verifyStudyPassword });
app.use("/api/studies/:studyId/challenges", challengeRouter);

const challengePauseResumeRouter = createChallengePauseResumeRouter({ verifyStudyPassword });
app.use("/api/studies/:studyId/challenges", challengePauseResumeRouter);

const challengeResetRouter = createChallengeResetRouter({ verifyStudyPassword });
app.use("/api/studies/:studyId/challenges", challengeResetRouter);

const completeChallenge = createCompleteChallengeService();
const completeChallengeRouter = createCompleteChallengeRouter({
  verifyStudyPassword,
  completeChallenge,
});
app.use("/api/studies/:studyId/challenges", completeChallengeRouter);

// 기능 라우터는 이 오류 미들웨어보다 앞에 등록한다.
app.use(errorHandler);

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid port");
  }

  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  const server = app.listen(port, () => {
    console.log(`서버가 ${port}번 포트에서 기다리고 있어요.`);
  });

  server.on("error", async (error) => {
    console.error(
      "서버를 시작하지 못했습니다. PORT와 포트 사용 여부를 확인해주세요.",
      error?.code ?? "",
      error?.stack ?? error?.message,
    );
    await prisma.$disconnect();
    process.exitCode = 1;
  });

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.close(async () => {
      await prisma.$disconnect();
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  // DB 오류 메시지에 접속 URL이나 해시가 포함되어도 로그에는 남기지 않는다.
  const errorLog = String(error?.stack ?? error?.message ?? "알 수 없는 오류")
    .replace(/postgres(?:ql)?:\/\/[^\s<>]+/gi, "[DB URL 숨김]")
    .replace(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, "[비밀번호 해시 숨김]");
  console.error(
    "서버를 시작하지 못했습니다. PORT와 DB 연결 설정을 확인해주세요.",
    error?.code ?? error?.errorCode ?? "",
    errorLog,
  );
  await prisma.$disconnect();
  process.exitCode = 1;
}
