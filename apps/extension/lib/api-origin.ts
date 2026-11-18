// Turns the configured backend origin into the extension's single host permission (ARCHITECTURE §6, ADR 12).
// Pure and dependency-free: it runs inside wxt.config.ts at build time.

export const DEV_DEFAULT_API_ORIGIN = 'http://localhost:3000';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Picks the API origin for a build. Development falls back to the local Next.js server; any other mode
 * must set `WXT_API_ORIGIN` explicitly so a release can never silently point at localhost.
 */
export function resolveApiOrigin(value: string | undefined, mode: string): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  if (mode === 'development') return DEV_DEFAULT_API_ORIGIN;
  throw new Error(
    `WXT_API_ORIGIN is required for "${mode}" builds (e.g. https://api.example.com). ` +
      'Set it in apps/extension/.env (see .env.example).',
  );
}

/**
 * Validates a bare origin and returns its match pattern, e.g. `https://api.example.com/*`.
 * Rejects wildcards, paths, credentials, and plain HTTP except for loopback hosts.
 */
export function toHostPermission(origin: string): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(`Invalid API origin: "${origin}"`);
  }

  if (origin.includes('*')) {
    throw new Error(`API origin must not contain wildcards: "${origin}"`);
  }
  const isLoopbackHttp = url.protocol === 'http:' && LOCAL_HOSTNAMES.has(url.hostname);
  if (url.protocol !== 'https:' && !isLoopbackHttp) {
    throw new Error(`API origin must use https (http is allowed only for localhost): "${origin}"`);
  }
  if (url.username || url.password) {
    throw new Error(`API origin must not contain credentials: "${origin}"`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`API origin must not have a path, query or hash: "${origin}"`);
  }

  return `${url.origin}/*`;
}
