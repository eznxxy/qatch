import { z } from 'zod';

// Server-only configuration. Every variable is documented in apps/web/.env.example.
// No defaults for secrets: a missing value fails fast with a readable message.
const serverEnvSchema = z.object({
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/, error: 'DATABASE_URL must be a postgres:// URL' })
    .describe('Postgres connection string'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Validates raw environment values; throws one error listing every invalid variable. */
export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment (see apps/web/.env.example):\n${details}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Lazily parsed so `next build` does not need runtime secrets for static pages. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
