import { drizzle } from 'drizzle-orm/bun-sql';
import * as schema from './schema';

// Bun auto-loads .env. Defaults to the local docker-compose Postgres so the
// package works out of the box in development.
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://poker:poker@localhost:5432/poker';

// The Drizzle instance, backed by Bun's built-in SQL driver. Exported for
// Better Auth's adapter; game code should use the repositories instead.
export const db = drizzle(DATABASE_URL, { schema });

export type Database = typeof db;
