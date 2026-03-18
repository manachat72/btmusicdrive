import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// When bundled by NCC (Vercel), the Prisma query engine binary ends up in a
// "client" subdirectory instead of next to the bundle.  Auto-detect it so
// Prisma can locate it at runtime.
if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const searchDirs = [
    path.join(__dirname, 'client'),
    path.join(process.cwd(), 'client'),
    __dirname,
    process.cwd(),
  ];
  for (const dir of searchDirs) {
    try {
      const files = fs.readdirSync(dir);
      const engine = files.find(
        (f) => f.includes('query_engine') && f.endsWith('.node'),
      );
      if (engine) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(dir, engine);
        break;
      }
    } catch {
      // directory doesn't exist – skip
    }
  }
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL as string,
});

export default prisma;
