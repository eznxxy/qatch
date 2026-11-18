import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  type ConsoleEntry,
  consoleEntriesSchema,
  consoleEntrySchema,
  type DeviceInfo,
  deviceInfoSchema,
  headersSchema,
  type NetworkEntry,
  networkEntriesSchema,
  networkEntrySchema,
} from './capture';
import {
  BODY_MAX_BYTES,
  CONSOLE_MAX_ENTRIES,
  CONSOLE_MESSAGE_MAX_CHARS,
  HEADERS_MAX_COUNT,
  NETWORK_MAX_ENTRIES,
  URL_MAX_CHARS,
} from './config';

const consoleEntry: ConsoleEntry = {
  ts: 12.5,
  level: 'error',
  message: 'TypeError: x is undefined',
  stack: 'at foo (app.js:1:1)',
  source: 'onerror',
};

const networkEntry: NetworkEntry = {
  id: 'req-1',
  ts: 100,
  durationMs: 42,
  method: 'POST',
  url: 'https://api.example.com/items?token=[REDACTED]',
  status: 500,
  statusText: 'Internal Server Error',
  initiator: 'fetch',
  requestHeaders: { 'content-type': 'application/json', authorization: '[REDACTED]' },
  responseHeaders: { 'content-type': 'application/json' },
  requestBody: '{"name":"x"}',
  responseBody: '{"error":"boom"}',
};

const deviceInfo: DeviceInfo = {
  userAgent: 'Mozilla/5.0',
  browser: { name: 'Chrome', version: '131.0.0.0' },
  os: { name: 'Windows', version: '11' },
  viewport: { w: 1280, h: 720 },
  screen: { w: 1920, h: 1080 },
  dpr: 1.5,
  language: 'en-US',
  timeZone: 'Europe/Berlin',
  url: 'https://app.example.com/page',
  connection: { effectiveType: '4g', downlink: 10, rtt: 50 },
  capturedAt: '2026-11-18T10:00:00.000Z',
};

describe('consoleEntrySchema', () => {
  it('accepts a valid entry and minimal entry', () => {
    expect(consoleEntrySchema.parse(consoleEntry)).toEqual(consoleEntry);
    expect(consoleEntrySchema.parse({ ts: 0, level: 'log', message: '' })).toBeTruthy();
  });

  it('strips unknown keys', () => {
    const parsed = consoleEntrySchema.parse({ ...consoleEntry, html: '<img onerror=x>' });
    expect(parsed).not.toHaveProperty('html');
  });

  it.each([
    ['negative ts', { ts: -1 }],
    ['non-finite ts', { ts: Number.POSITIVE_INFINITY }],
    ['unknown level', { level: 'trace' }],
    ['unknown source', { source: 'eval' }],
    ['oversized message', { message: 'x'.repeat(CONSOLE_MESSAGE_MAX_CHARS + 1) }],
  ])('rejects %s', (_name, patch) => {
    expect(consoleEntrySchema.safeParse({ ...consoleEntry, ...patch }).success).toBe(false);
  });

  it('caps the number of entries', () => {
    const at = (n: number) => Array.from({ length: n }, () => consoleEntry);
    expect(consoleEntriesSchema.safeParse(at(CONSOLE_MAX_ENTRIES)).success).toBe(true);
    expect(consoleEntriesSchema.safeParse(at(CONSOLE_MAX_ENTRIES + 1)).success).toBe(false);
  });
});

describe('networkEntrySchema', () => {
  it('accepts a valid entry, including status 0 for failed requests', () => {
    expect(networkEntrySchema.parse(networkEntry)).toEqual(networkEntry);
    expect(
      networkEntrySchema.safeParse({ ...networkEntry, status: 0, error: 'Failed to fetch' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['fractional status', { status: 200.5 }],
    ['negative status', { status: -1 }],
    ['unknown initiator', { initiator: 'websocket' }],
    ['empty url', { url: '' }],
    ['oversized url', { url: `https://a.example/${'x'.repeat(URL_MAX_CHARS)}` }],
    ['empty method', { method: '' }],
  ])('rejects %s', (_name, patch) => {
    expect(networkEntrySchema.safeParse({ ...networkEntry, ...patch }).success).toBe(false);
  });

  it('measures the body cap in UTF-8 bytes, not characters', () => {
    const ascii = 'a'.repeat(BODY_MAX_BYTES);
    expect(networkEntrySchema.safeParse({ ...networkEntry, responseBody: ascii }).success).toBe(
      true,
    );
    // 'é' is 2 bytes in UTF-8: half as many characters already hit the cap.
    const multibyte = 'é'.repeat(BODY_MAX_BYTES / 2 + 1);
    expect(networkEntrySchema.safeParse({ ...networkEntry, requestBody: multibyte }).success).toBe(
      false,
    );
  });

  it('caps header count and the number of entries', () => {
    const headers = Object.fromEntries(
      Array.from({ length: HEADERS_MAX_COUNT + 1 }, (_, i) => [`x-h${i}`, 'v']),
    );
    expect(headersSchema.safeParse(headers).success).toBe(false);

    const at = (n: number) => Array.from({ length: n }, () => networkEntry);
    expect(networkEntriesSchema.safeParse(at(NETWORK_MAX_ENTRIES)).success).toBe(true);
    expect(networkEntriesSchema.safeParse(at(NETWORK_MAX_ENTRIES + 1)).success).toBe(false);
  });
});

describe('deviceInfoSchema', () => {
  it('accepts a valid device, with and without optional fields', () => {
    expect(deviceInfoSchema.parse(deviceInfo)).toEqual(deviceInfo);
    const { connection: _c, ...withoutConnection } = deviceInfo;
    expect(
      deviceInfoSchema.safeParse({ ...withoutConnection, os: { name: 'Linux' } }).success,
    ).toBe(true);
  });

  it.each([
    ['non-ISO capturedAt', { capturedAt: 'yesterday' }],
    ['zero dpr', { dpr: 0 }],
    ['fractional viewport', { viewport: { w: 10.5, h: 10 } }],
  ])('rejects %s', (_name, patch) => {
    expect(deviceInfoSchema.safeParse({ ...deviceInfo, ...patch }).success).toBe(false);
  });
});

describe('inferred types match API_AND_DATA §2', () => {
  it('has the documented shapes', () => {
    expectTypeOf<ConsoleEntry['level']>().toEqualTypeOf<
      'log' | 'info' | 'warn' | 'error' | 'debug'
    >();
    expectTypeOf<NetworkEntry['initiator']>().toEqualTypeOf<'fetch' | 'xhr'>();
    expectTypeOf<NetworkEntry['requestHeaders']>().toEqualTypeOf<Record<string, string>>();
    expectTypeOf<DeviceInfo['os']['version']>().toEqualTypeOf<string | undefined>();
  });
});
