import { loadEnvFile } from 'node:process';

// 로컬 파일이 없어도 배포 환경에서 지정한 환경변수로 실행할 수 있다.
try {
  loadEnvFile(new URL('../../.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw new Error('로컬 환경변수 파일을 불러오지 못했습니다.');
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 환경변수를 설정해주세요.');
}

export const databaseUrl = process.env.DATABASE_URL;
