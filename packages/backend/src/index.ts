import path from 'node:path';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { SqliteStore } from './db/database.js';
import { Repository } from './db/repositories.js';
import { seedDatabase } from './db/seed.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

async function bootstrap() {
  const port = Number(process.env.PORT) || 4000;
  const dbPath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data/unterb2b.sqlite');

  const store = await SqliteStore.open(dbPath);
  seedDatabase(store);
  const repo = new Repository(store);
  const app = createApp(repo);

  app.listen(port, () => {
    console.log(`Unter b2b API listening on http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start Unter b2b API:', err);
  process.exit(1);
});
