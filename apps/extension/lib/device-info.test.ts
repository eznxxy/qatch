import { deviceInfoSchema } from '@qatch/shared';
import { URL_MAX_CHARS } from '@qatch/shared/config';
import { describe, expect, it, vi } from 'vitest';

import {
  collectDeviceInfo,
  detectBrowser,
  detectOs,
  type RawDeviceEnv,
  toDeviceInfo,
} from './device-info';

const WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const NOW = Date.parse('2026-11-18T10:00:00.000Z');

function env(overrides: Partial<RawDeviceEnv> = {}): RawDeviceEnv {
  return {
    userAgent: WIN_UA,
    uaData: {
      brands: [
        { brand: 'Google Chrome', version: '131' },
        { brand: 'Chromium', version: '131' },
        { brand: 'Not_A Brand', version: '24' },
      ],
      fullVersionList: [
        { brand: 'Not_A Brand', version: '24.0.0.0' },
        { brand: 'Chromium', version: '131.0.6778.86' },
        { brand: 'Google Chrome', version: '131.0.6778.86' },
      ],
      platform: 'Windows',
      platformVersion: '15.0.0',
      mobile: false,
    },
    viewport: { w: 1280, h: 720 },
    screen: { w: 1920, h: 1080 },
    dpr: 1.5,
    language: 'en-US',
    timeZone: 'Europe/Berlin',
    url: 'https://app.example.com/page',
    connection: { effectiveType: '4g', downlink: 10, rtt: 50 },
    ...overrides,
  };
}

describe('detectBrowser', () => {
  it('prefers the product brand with its full version, ignoring GREASE and Chromium', () => {
    expect(detectBrowser(env())).toEqual({ name: 'Chrome', version: '131.0.6778.86' });
  });

  it('maps Edge and keeps other brands as-is', () => {
    const edge = env({
      uaData: { fullVersionList: [{ brand: 'Microsoft Edge', version: '131.0.2903.70' }] },
    });
    expect(detectBrowser(edge)).toEqual({ name: 'Edge', version: '131.0.2903.70' });
    const brave = env({ uaData: { brands: [{ brand: 'Brave', version: '131' }] } });
    expect(detectBrowser(brave)).toEqual({ name: 'Brave', version: '131' });
  });

  it('falls back to Chromium when it is the only real brand', () => {
    const chromium = env({
      uaData: {
        brands: [
          { brand: 'Not)A;Brand', version: '99' },
          { brand: 'Chromium', version: '131' },
        ],
      },
    });
    expect(detectBrowser(chromium)).toEqual({ name: 'Chromium', version: '131' });
  });

  it.each([
    [WIN_UA, { name: 'Chrome', version: '131.0.0.0' }],
    [`${WIN_UA} Edg/131.0.2903.70`, { name: 'Edge', version: '131.0.2903.70' }],
    [`${WIN_UA} OPR/115.0.0.0`, { name: 'Opera', version: '115.0.0.0' }],
    ['curl/8.0', { name: 'Unknown', version: '' }],
  ])('parses the UA string without userAgentData: %s', (userAgent, expected) => {
    expect(detectBrowser(env({ userAgent, uaData: undefined }))).toEqual(expected);
  });
});

describe('detectOs', () => {
  it.each([
    ['Windows', '15.0.0', { name: 'Windows', version: '11' }],
    ['Windows', '13.0.0', { name: 'Windows', version: '11' }],
    ['Windows', '10.0.0', { name: 'Windows', version: '10' }],
    ['Windows', '0.3.0', { name: 'Windows' }],
    ['macOS', '14.5.0', { name: 'macOS', version: '14.5.0' }],
    ['Chrome OS', '16002.44.0', { name: 'ChromeOS', version: '16002.44.0' }],
    ['Linux', '', { name: 'Linux' }],
    ['Android', '14.0.0', { name: 'Android', version: '14.0.0' }],
  ])('maps %s %s', (platform, platformVersion, expected) => {
    expect(detectOs(env({ uaData: { platform, platformVersion } }))).toEqual(expected);
  });

  it.each([
    [WIN_UA, 'Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131', 'macOS'],
    ['Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/131', 'ChromeOS'],
    ['Mozilla/5.0 (Linux; Android 10; K) Chrome/131 Mobile', 'Android'],
    ['Mozilla/5.0 (X11; Linux x86_64) Chrome/131', 'Linux'],
    ['curl/8.0', 'Unknown'],
  ])('uses only the OS name from the frozen UA string: %s', (userAgent, name) => {
    expect(detectOs(env({ userAgent, uaData: undefined }))).toEqual({ name });
  });
});

describe('toDeviceInfo', () => {
  it('builds a valid DeviceInfo', () => {
    const info = toDeviceInfo(env(), NOW);
    expect(info).toEqual({
      userAgent: WIN_UA,
      browser: { name: 'Chrome', version: '131.0.6778.86' },
      os: { name: 'Windows', version: '11' },
      viewport: { w: 1280, h: 720 },
      screen: { w: 1920, h: 1080 },
      dpr: 1.5,
      language: 'en-US',
      timeZone: 'Europe/Berlin',
      url: 'https://app.example.com/page',
      connection: { effectiveType: '4g', downlink: 10, rtt: 50 },
      capturedAt: '2026-11-18T10:00:00.000Z',
    });
    expect(deviceInfoSchema.safeParse(info).success).toBe(true);
  });

  it('clamps out-of-range values instead of failing', () => {
    const info = toDeviceInfo(
      env({
        userAgent: 'u'.repeat(5_000),
        viewport: { w: 1280.6, h: -5 },
        screen: { w: Number.NaN, h: 1e9 },
        dpr: 0,
        language: 'l'.repeat(100),
        url: `https://a.example/${'x'.repeat(URL_MAX_CHARS)}`,
        connection: { effectiveType: '4g', downlink: -1, rtt: Number.POSITIVE_INFINITY },
      }),
      NOW,
    );
    expect(info.userAgent).toHaveLength(1_024);
    expect(info.viewport).toEqual({ w: 1281, h: 0 });
    expect(info.screen).toEqual({ w: 0, h: 100_000 });
    expect(info.dpr).toBe(1);
    expect(info.language).toHaveLength(64);
    expect(info.url).toHaveLength(URL_MAX_CHARS);
    expect(info.connection).toEqual({ effectiveType: '4g' });
  });

  it('omits connection when the page has none', () => {
    expect(toDeviceInfo(env({ connection: undefined }), NOW).connection).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['a string', 'device'],
    ['missing fields', { userAgent: 'x' }],
  ])('throws on a malformed snapshot: %s', (_name, raw) => {
    expect(() => toDeviceInfo(raw, NOW)).toThrow();
  });
});

describe('collectDeviceInfo', () => {
  it('returns device info on success', async () => {
    const info = await collectDeviceInfo(
      () => Promise.resolve(env()),
      () => NOW,
      vi.fn(),
    );
    expect(info?.browser.name).toBe('Chrome');
  });

  it.each([
    ['the injection fails', () => Promise.reject(new Error('Cannot access contents of the page'))],
    ['the snapshot is malformed', () => Promise.resolve({ nope: true })],
  ])('returns undefined and logs when %s', async (_name, read) => {
    const logError = vi.fn();
    await expect(collectDeviceInfo(read, () => NOW, logError)).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledOnce();
  });
});
