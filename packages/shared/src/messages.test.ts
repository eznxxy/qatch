import { describe, expect, expectTypeOf, it } from 'vitest';

import { captureStartResultSchema, type Msg, type MsgOf, msgSchema } from './messages';

describe('captureStartResultSchema', () => {
  it('accepts success and each error', () => {
    const ok = { ok: true, sessionId: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b' };
    expect(captureStartResultSchema.parse(ok)).toEqual(ok);
    for (const error of ['unsupported-page', 'no-active-tab', 'not-implemented', 'internal']) {
      expect(captureStartResultSchema.parse({ ok: false, error })).toEqual({ ok: false, error });
    }
  });

  it.each([
    ['undefined (no listener replied)', undefined],
    ['unknown error code', { ok: false, error: 'boom' }],
    ['success without session id', { ok: true }],
    ['error message instead of code', { ok: false, message: 'x' }],
  ])('rejects %s', (_name, value) => {
    expect(captureStartResultSchema.safeParse(value).success).toBe(false);
  });
});

describe('msgSchema', () => {
  it.each<Msg>([
    { t: 'capture/start', mode: 'region' },
    { t: 'capture/stop' },
    { t: 'page/console', entry: { ts: 1, level: 'warn', message: 'careful' } },
    {
      t: 'page/network',
      entry: {
        id: '1',
        ts: 1,
        durationMs: 2,
        method: 'GET',
        url: 'https://a.example/',
        status: 200,
        initiator: 'xhr',
        requestHeaders: {},
        responseHeaders: {},
      },
    },
    { t: 'region/start', sessionId: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b' },
    {
      t: 'region/selected',
      sessionId: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b',
      rect: { x: 0, y: 10, w: 100, h: 50, dpr: 2 },
    },
    { t: 'region/cancelled', sessionId: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b' },
    { t: 'draft/ready', draftId: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b' },
  ])('accepts $t', (msg) => {
    expect(msgSchema.parse(msg)).toEqual(msg);
  });

  it.each([
    ['unknown type', { t: 'capture/delete' }],
    ['missing type', { mode: 'visible' }],
    ['unknown capture mode', { t: 'capture/start', mode: 'webcam' }],
    [
      'zero-size region',
      {
        t: 'region/selected',
        sessionId: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b',
        rect: { x: 0, y: 0, w: 0, h: 10, dpr: 1 },
      },
    ],
    [
      'region without session',
      { t: 'region/selected', rect: { x: 0, y: 0, w: 10, h: 10, dpr: 1 } },
    ],
    [
      'huge region',
      {
        t: 'region/selected',
        sessionId: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b',
        rect: { x: 0, y: 0, w: 1e9, h: 10, dpr: 1 },
      },
    ],
    ['non-uuid draft id', { t: 'draft/ready', draftId: '../../etc/passwd' }],
    ['non-object', 'capture/start'],
    ['null', null],
  ])('rejects %s', (_name, value) => {
    expect(msgSchema.safeParse(value).success).toBe(false);
  });

  it('narrows by type', () => {
    expectTypeOf<MsgOf<'capture/start'>>().toEqualTypeOf<{
      t: 'capture/start';
      mode: 'visible' | 'full' | 'region' | 'record';
    }>();
  });
});
