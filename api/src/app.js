import express from 'express';
import { prisma } from './lib/prisma.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.disable('x-powered-by');
app.use(express.json());

app.get('/', (req, res) => {
  res.send('공부의 숲 서버가 살아 있어요');
});

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port');
  }

  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  const server = app.listen(port, () => {
    console.log(`서버가 ${port}번 포트에서 기다리고 있어요.`);
  });

  server.on('error', async () => {
    console.error('서버를 시작하지 못했습니다. PORT와 포트 사용 여부를 확인해주세요.');
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

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  console.error('서버를 시작하지 못했습니다. PORT와 DB 연결 설정을 확인해주세요.');
  await prisma.$disconnect();
  process.exitCode = 1;
}
