import 'server-only';

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getServerEnv } from '@/lib/env';

import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

// One pool per server process. In dev, Next.js hot reload re-evaluates modules, so the instance is kept on
// globalThis to avoid leaking connections.
const globalForDb = globalThis as unknown as { qatchDb?: Database };

/** Lazily connects on first use so builds and tests that never touch the DB need no DATABASE_URL. */
export function getDb(): Database {
  if (!globalForDb.qatchDb) {
    const sql = postgres(getServerEnv().DATABASE_URL, { max: 10 });
    globalForDb.qatchDb = drizzle(sql, { schema });
  }
  return globalForDb.qatchDb;
}
