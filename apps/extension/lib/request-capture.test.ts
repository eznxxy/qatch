import { describe, expect, it, vi } from 'vitest';

import { requestCaptureStart } from './request-capture';

const SESSION_ID = '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b';

describe('requestCaptureStart', () => {
  it('sends capture/start with the mode and returns a valid reply', async () => {
    const send = vi.fn(() => Promise.resolve<unknown>({ ok: true, sessionId: SESSION_ID }));
    await expect(requestCaptureStart('region', send)).resolves.toEqual({
      ok: true,
      sessionId: SESSION_ID,
    });
    expect(send).toHaveBeenCalledWith({ t: 'capture/start', mode: 'region' });
  });

  it('passes worker error codes through', async () => {
    const send = () => Promise.resolve<unknown>({ ok: false, error: 'unsupported-page' });
    await expect(requestCaptureStart('visible', send)).resolves.toEqual({
      ok: false,
      error: 'unsupported-page',
    });
  });

  it.each([
    ['no reply (worker had no listener)', () => Promise.resolve<unknown>(undefined)],
    ['malformed reply', () => Promise.resolve<unknown>({ ok: 'yes' })],
    ['rejected send (worker unavailable)', () => Promise.reject(new Error('Receiving end'))],
  ])('maps %s to internal', async (_name, send) => {
    await expect(requestCaptureStart('visible', send)).resolves.toEqual({
      ok: false,
      error: 'internal',
    });
  });
});
