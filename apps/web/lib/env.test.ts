import { describe, expect, it } from 'vitest';

import { parseServerEnv } from './env';

describe('parseServerEnv', () => {
  it.each([
    'postgres://qatch:qatch@localhost:5432/qatch',
    'postgresql://user:pw@db.example.com:5432/app?sslmode=require',
  ])('accepts %s', (url) => {
    expect(parseServerEnv({ DATABASE_URL: url })).toEqual({ DATABASE_URL: url });
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
  });

  it.each(['not a url', 'mysql://localhost/db', 'https://example.com'])('rejects %s', (url) => {
    expect(() => parseServerEnv({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
  });

  it('strips unknown variables', () => {
    const env = parseServerEnv({ DATABASE_URL: 'postgres://localhost/qatch', OTHER: 'x' });
    expect(env).toEqual({ DATABASE_URL: 'postgres://localhost/qatch' });
  });
});
