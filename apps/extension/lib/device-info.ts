// FR-09: turns the raw page snapshot (device-env.ts) into a validated DeviceInfo. Pure and unit-tested.

import { type DeviceInfo, deviceInfoSchema } from '@qatch/shared';
import { URL_MAX_CHARS } from '@qatch/shared/config';
import { z } from 'zod';

const brandSchema = z.object({ brand: z.string(), version: z.string() });

/**
 * Any JS number, including NaN/Infinity (which z.number() rejects in Zod 4). Odd page values are clamped by
 * toDeviceInfo instead of discarding the whole snapshot.
 */
const anyNumber = z.custom<number>((value) => typeof value === 'number', 'Expected a number');

/** Loose on purpose: values come from the page environment; normalization clamps them. */
export const rawDeviceEnvSchema = z.object({
  userAgent: z.string(),
  uaData: z
    .object({
      brands: z.array(brandSchema).optional(),
      fullVersionList: z.array(brandSchema).optional(),
      platform: z.string().optional(),
      platformVersion: z.string().optional(),
      mobile: z.boolean().optional(),
    })
    .optional(),
  viewport: z.object({ w: anyNumber, h: anyNumber }),
  screen: z.object({ w: anyNumber, h: anyNumber }),
  dpr: anyNumber,
  language: z.string(),
  timeZone: z.string(),
  url: z.string(),
  connection: z
    .object({
      effectiveType: z.string().optional(),
      downlink: anyNumber.optional(),
      rtt: anyNumber.optional(),
    })
    .optional(),
});
export type RawDeviceEnv = z.infer<typeof rawDeviceEnvSchema>;
type Brand = z.infer<typeof brandSchema>;

const UNKNOWN = 'Unknown';

/** GREASE entries such as "Not_A Brand" / "Not)A;Brand" are deliberately meaningless. */
const isGrease = (brand: string) => /not.?a.?brand/i.test(brand);

const BRAND_NAMES: Record<string, string> = {
  'Google Chrome': 'Chrome',
  'Microsoft Edge': 'Edge',
};

function browserFromBrands(brands: Brand[] | undefined): DeviceInfo['browser'] | undefined {
  const real = (brands ?? []).filter((b) => !isGrease(b.brand));
  // "Chromium" is listed by every Chromium browser; prefer the specific product brand.
  const pick = real.find((b) => b.brand !== 'Chromium') ?? real[0];
  if (!pick) return undefined;
  return { name: BRAND_NAMES[pick.brand] ?? pick.brand, version: pick.version };
}

function browserFromUserAgent(ua: string): DeviceInfo['browser'] {
  const patterns: [string, RegExp][] = [
    ['Edge', /Edg\/([\d.]+)/],
    ['Opera', /OPR\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
  ];
  for (const [name, pattern] of patterns) {
    const version = pattern.exec(ua)?.[1];
    if (version) return { name, version };
  }
  return { name: UNKNOWN, version: '' };
}

export function detectBrowser(env: RawDeviceEnv): DeviceInfo['browser'] {
  return (
    browserFromBrands(env.uaData?.fullVersionList) ??
    browserFromBrands(env.uaData?.brands) ??
    browserFromUserAgent(env.userAgent)
  );
}

const PLATFORM_NAMES: Record<string, string> = { 'Chrome OS': 'ChromeOS' };

function windowsVersion(platformVersion: string): string | undefined {
  // userAgentData reports the Windows platform version: >= 13 is Windows 11, 1-10 is Windows 10.
  const major = Number.parseInt(platformVersion.split('.')[0] ?? '', 10);
  if (Number.isNaN(major)) return undefined;
  if (major >= 13) return '11';
  if (major >= 1) return '10';
  return undefined;
}

function osFromUserAgent(ua: string): DeviceInfo['os'] {
  // UA strings are frozen (Windows 11 says "NT 10.0", macOS says 10_15_7), so only the name is reliable.
  if (ua.includes('Windows')) return { name: 'Windows' };
  if (ua.includes('CrOS')) return { name: 'ChromeOS' };
  if (ua.includes('Android')) return { name: 'Android' };
  if (ua.includes('Macintosh') || ua.includes('Mac OS X')) return { name: 'macOS' };
  if (ua.includes('Linux')) return { name: 'Linux' };
  return { name: UNKNOWN };
}

export function detectOs(env: RawDeviceEnv): DeviceInfo['os'] {
  const platform = env.uaData?.platform;
  if (!platform) return osFromUserAgent(env.userAgent);

  const name = PLATFORM_NAMES[platform] ?? platform;
  const raw = env.uaData?.platformVersion;
  if (!raw) return { name };
  const version = name === 'Windows' ? windowsVersion(raw) : raw;
  return version ? { name, version } : { name };
}

const clampText = (value: string, max: number) => value.slice(0, max);
const clampPixels = (value: number) =>
  Number.isFinite(value) ? Math.min(100_000, Math.max(0, Math.round(value))) : 0;
const nonNegative = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;

/** Normalizes and validates a raw snapshot. Throws if the snapshot is not even shaped like one. */
export function toDeviceInfo(raw: unknown, now: number): DeviceInfo {
  const env = rawDeviceEnvSchema.parse(raw);
  const browser = detectBrowser(env);
  const os = detectOs(env);

  const connection = env.connection && {
    effectiveType: env.connection.effectiveType?.slice(0, 16),
    downlink: nonNegative(env.connection.downlink),
    rtt: nonNegative(env.connection.rtt),
  };

  return deviceInfoSchema.parse({
    userAgent: clampText(env.userAgent, 1_024),
    browser: { name: clampText(browser.name, 256), version: clampText(browser.version, 256) },
    os: os.version
      ? { name: clampText(os.name, 256), version: clampText(os.version, 256) }
      : { name: clampText(os.name, 256) },
    viewport: { w: clampPixels(env.viewport.w), h: clampPixels(env.viewport.h) },
    screen: { w: clampPixels(env.screen.w), h: clampPixels(env.screen.h) },
    dpr: Number.isFinite(env.dpr) && env.dpr > 0 ? Math.min(env.dpr, 16) : 1,
    language: clampText(env.language, 64),
    timeZone: clampText(env.timeZone, 64),
    // Local only for now; redacted before upload (PLAN P2-1).
    url: clampText(env.url, URL_MAX_CHARS),
    connection,
    capturedAt: new Date(now).toISOString(),
  });
}

/**
 * Best-effort collection: device info enriches a capture but must never block it. Any failure is logged
 * and yields `undefined`.
 */
export async function collectDeviceInfo(
  read: () => Promise<unknown>,
  now: () => number,
  logError: (error: unknown) => void,
): Promise<DeviceInfo | undefined> {
  try {
    return toDeviceInfo(await read(), now());
  } catch (error) {
    logError(error);
    return undefined;
  }
}
