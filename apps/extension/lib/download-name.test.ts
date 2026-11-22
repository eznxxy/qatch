import { describe, expect, it } from 'vitest';

import { screenshotFileName } from './download-name';

describe('screenshotFileName', () => {
  const at = new Date(2026, 10, 18, 9, 14, 7).getTime(); // local time

  it('uses the host and a local timestamp', () => {
    expect(screenshotFileName('https://shop.example.com/checkout?x=1', at)).toBe(
      'qatch-shop.example.com-20261118-091407.png',
    );
  });

  it('falls back to "page" for unusable URLs', () => {
    expect(screenshotFileName('not a url', at)).toBe('qatch-page-20261118-091407.png');
  });
});
