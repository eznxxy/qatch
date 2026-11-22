import type { DeviceInfo } from '@qatch/shared';
import { describe, expect, it } from 'vitest';

import { deviceRows, formatLocalDateTime } from './device-rows';

const DEVICE: DeviceInfo = {
  userAgent: 'UA',
  browser: { name: 'Chrome', version: '142.0.1' },
  os: { name: 'Windows', version: '11' },
  viewport: { w: 1440, h: 812 },
  screen: { w: 2560, h: 1440 },
  dpr: 1.5,
  language: 'en-US',
  timeZone: 'Europe/Berlin',
  url: 'https://shop.example.com/checkout',
  connection: { effectiveType: '4g', downlink: 10, rtt: 50 },
  capturedAt: '2026-11-18T09:14:07.000Z',
};

describe('deviceRows', () => {
  it('formats every field in display order', () => {
    expect(deviceRows(DEVICE)).toEqual([
      { label: 'Browser', value: 'Chrome 142.0.1' },
      { label: 'OS', value: 'Windows 11' },
      { label: 'Viewport', value: '1440 × 812' },
      { label: 'Screen', value: '2560 × 1440 @ 1.5x' },
      { label: 'Language', value: 'en-US' },
      { label: 'Time zone', value: 'Europe/Berlin' },
      { label: 'Connection', value: '4g, 10 Mbps, 50 ms RTT' },
      { label: 'Page URL', value: 'https://shop.example.com/checkout' },
      { label: 'Captured', value: formatLocalDateTime(DEVICE.capturedAt) },
    ]);
  });

  it('leaves out unknown optional fields', () => {
    const rows = deviceRows({ ...DEVICE, os: { name: 'Linux' }, connection: undefined });
    expect(rows.find((r) => r.label === 'OS')?.value).toBe('Linux');
    expect(rows.some((r) => r.label === 'Connection')).toBe(false);
    expect(deviceRows({ ...DEVICE, connection: {} }).some((r) => r.label === 'Connection')).toBe(
      false,
    );
  });
});

describe('formatLocalDateTime', () => {
  it('formats in local time as YYYY-MM-DD HH:MM:SS', () => {
    const iso = '2026-11-18T09:14:07.000Z';
    const d = new Date(iso);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
      2,
      '0',
    )}:07`;
    expect(formatLocalDateTime(iso)).toBe(expected);
  });

  it('returns the input when it is not a date', () => {
    expect(formatLocalDateTime('soon')).toBe('soon');
  });
});
