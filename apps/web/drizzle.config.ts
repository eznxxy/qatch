import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

import { parseServerEnv } from './lib/env';

// drizzle-kit does not read Next.js env files, so load them the same way Next does for local development.
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
  dbCredentials: { url: parseServerEnv(process.env).DATABASE_URL },
  strict: true,
  verbose: true,
});
