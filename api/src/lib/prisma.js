import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseUrl } from '../config/env.js';

const adapter = new PrismaPg({ connectionString: databaseUrl });

// 각 기능은 이 인스턴스를 import하여 사용한다. 요청마다 Client를 만들지 않는다.
export const prisma = new PrismaClient({ adapter, log: [] });
