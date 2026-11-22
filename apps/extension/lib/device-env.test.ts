import { afterEach, describe, expect, it, vi } from 'vitest';

import { readDeviceEnv } from './device-env';
import { rawDeviceEnvSchema } from './device-info';

// readDeviceEnv runs inside the page; here the page globals are stubbed to prove it is self-contained and
// produces a snapshot the worker accepts.
function stubPage(navigatorExtras: Record<string, unknown>) {
  vi.stubGlobal('window', {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    screen: { width: 2560, height: 1440 },
  });
  vi.stubGlobal('location', { href: 'https://app.example.com/x' });
  vi.stubGlobal('navigator', { userAgent: 'UA', language: 'de-DE', ...navigatorExtras });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readDeviceEnv', () => {
  it('reads page values, including high-entropy UA data and connection', async () => {
    stubPage({
      userAgentData: {
        brands: [{ brand: 'Google Chrome', version: '131' }],
        platform: 'macOS',
        mobile: false,
        getHighEntropyValues: () =>
          Promise.resolve({
            platformVersion: '14.5.0',
            fullVersionList: [{ brand: 'Google Chrome', version: '131.0.1' }],
          }),
      },
      connection: { effectiveType: '4g', downlink: 10, rtt: 50 },
    });

    const raw = await readDeviceEnv();
    expect(rawDeviceEnvSchema.parse(raw)).toMatchObject({
      userAgent: 'UA',
      uaData: { platform: 'macOS', platformVersion: '14.5.0' },
      viewport: { w: 1280, h: 720 },
      screen: { w: 2560, h: 1440 },
      dpr: 2,
      language: 'de-DE',
      url: 'https://app.example.com/x',
      connection: { effectiveType: '4g' },
    });
  });

  it('still returns a snapshot when high-entropy values are refused or unavailable', async () => {
    stubPage({
      userAgentData: {
        brands: [],
        platform: 'Windows',
        getHighEntropyValues: () => Promise.reject(new Error('NotAllowedError')),
      },
    });
    const refused = rawDeviceEnvSchema.parse(await readDeviceEnv());
    expect(refused.uaData?.platformVersion).toBeUndefined();

    stubPage({});
    const plain = rawDeviceEnvSchema.parse(await readDeviceEnv());
    expect(plain.uaData).toBeUndefined();
    expect(plain.connection).toBeUndefined();
  });
});
