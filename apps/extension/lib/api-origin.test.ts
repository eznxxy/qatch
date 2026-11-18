import { describe, expect, it } from 'vitest';

import { DEV_DEFAULT_API_ORIGIN, resolveApiOrigin, toHostPermission } from './api-origin';

describe('resolveApiOrigin', () => {
  it('uses the configured value, trimmed', () => {
    expect(resolveApiOrigin('  https://api.example.com ', 'production')).toBe(
      'https://api.example.com',
    );
  });

  it('falls back to localhost in development', () => {
    expect(resolveApiOrigin(undefined, 'development')).toBe(DEV_DEFAULT_API_ORIGIN);
    expect(resolveApiOrigin('   ', 'development')).toBe(DEV_DEFAULT_API_ORIGIN);
  });

  it('requires a value for production builds', () => {
    expect(() => resolveApiOrigin(undefined, 'production')).toThrow(/WXT_API_ORIGIN is required/);
    expect(() => resolveApiOrigin('', 'staging')).toThrow(/WXT_API_ORIGIN is required/);
  });
});

describe('toHostPermission', () => {
  it.each([
    ['https://api.example.com', 'https://api.example.com/*'],
    ['https://api.example.com/', 'https://api.example.com/*'],
    ['https://api.example.com:8443', 'https://api.example.com:8443/*'],
    ['https://API.Example.com', 'https://api.example.com/*'],
    ['http://localhost:3000', 'http://localhost:3000/*'],
    ['http://127.0.0.1:3000', 'http://127.0.0.1:3000/*'],
  ])('accepts %s', (origin, expected) => {
    expect(toHostPermission(origin)).toBe(expected);
  });

  it.each([
    ['not a url', /Invalid API origin/],
    ['https://*.example.com', /wildcards/],
    ['*://api.example.com', /Invalid API origin|wildcards/],
    ['http://api.example.com', /must use https/],
    ['ftp://api.example.com', /must use https/],
    ['https://user:pass@api.example.com', /credentials/],
    ['https://api.example.com/v1', /path, query or hash/],
    ['https://api.example.com/?x=1', /path, query or hash/],
    ['https://api.example.com/#x', /path, query or hash/],
  ])('rejects %s', (origin, error) => {
    expect(() => toHostPermission(origin)).toThrow(error);
  });
});
