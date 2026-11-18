import { URL_MAX_CHARS } from '@qatch/shared/config';
import { describe, expect, it, vi } from 'vitest';

import { type CaptureSession, captureSessionSchema } from './capture-session';
import { type ActiveTab, type CaptureStartDeps, handleCaptureStart } from './capture-start';

const SESSION_ID = '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b';
const WEB_TAB: ActiveTab = { id: 7, windowId: 3, url: 'https://example.com/', title: 'Example' };

function makeDeps(overrides: Partial<CaptureStartDeps> = {}) {
  // Each override becomes the mock's implementation, so every dependency stays a typed vi.fn.
  return {
    getActiveTab: vi.fn(
      overrides.getActiveTab ?? (() => Promise.resolve<ActiveTab | undefined>(WEB_TAB)),
    ),
    saveSession: vi.fn(overrides.saveSession ?? ((_session: CaptureSession) => Promise.resolve())),
    handlers: overrides.handlers ?? { visible: vi.fn(() => Promise.resolve()) },
    now: overrides.now ?? (() => 1_000),
    newId: overrides.newId ?? (() => SESSION_ID),
    logError: vi.fn(overrides.logError ?? (() => undefined)),
  } satisfies CaptureStartDeps;
}

describe('handleCaptureStart', () => {
  it('saves the session, runs the mode handler and returns the session id', async () => {
    const deps = makeDeps();
    await expect(handleCaptureStart('visible', deps)).resolves.toEqual({
      ok: true,
      sessionId: SESSION_ID,
    });
    const session = {
      id: SESSION_ID,
      tabId: 7,
      windowId: 3,
      mode: 'visible',
      page: { url: 'https://example.com/', title: 'Example' },
      startedAt: 1_000,
    };
    expect(deps.saveSession).toHaveBeenCalledWith(session);
    expect(deps.handlers.visible).toHaveBeenCalledWith(session);
  });

  it('clamps an oversized URL and title, and defaults a missing title', async () => {
    const longUrl = `https://example.com/${'x'.repeat(URL_MAX_CHARS)}`;
    const deps = makeDeps({
      getActiveTab: () => Promise.resolve({ ...WEB_TAB, url: longUrl, title: 't'.repeat(5_000) }),
    });
    await handleCaptureStart('visible', deps);
    const saved = deps.saveSession.mock.calls[0]?.[0];
    expect(saved?.page.url).toHaveLength(URL_MAX_CHARS);
    expect(saved?.page.title).toHaveLength(1_024);
    expect(captureSessionSchema.safeParse(saved).success).toBe(true);

    const untitled = makeDeps({
      getActiveTab: () => Promise.resolve({ ...WEB_TAB, title: undefined }),
    });
    await handleCaptureStart('visible', untitled);
    expect(untitled.saveSession.mock.calls[0]?.[0].page.title).toBe('');
  });

  it('saves the session before the handler runs (worker may die mid-capture)', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      saveSession: () => {
        order.push('save');
        return Promise.resolve();
      },
      handlers: {
        visible: () => {
          order.push('handler');
          return Promise.resolve();
        },
      },
    });
    await handleCaptureStart('visible', deps);
    expect(order).toEqual(['save', 'handler']);
  });

  it('answers not-implemented for modes without a handler, without touching tabs', async () => {
    const deps = makeDeps();
    await expect(handleCaptureStart('record', deps)).resolves.toEqual({
      ok: false,
      error: 'not-implemented',
    });
    expect(deps.getActiveTab).not.toHaveBeenCalled();
  });

  it('answers no-active-tab', async () => {
    const deps = makeDeps({ getActiveTab: () => Promise.resolve(undefined) });
    await expect(handleCaptureStart('visible', deps)).resolves.toEqual({
      ok: false,
      error: 'no-active-tab',
    });
  });

  it.each([undefined, 'chrome://settings', 'https://chromewebstore.google.com/'])(
    'answers unsupported-page for %s and saves nothing',
    async (url) => {
      const deps = makeDeps({ getActiveTab: () => Promise.resolve({ ...WEB_TAB, url }) });
      await expect(handleCaptureStart('visible', deps)).resolves.toEqual({
        ok: false,
        error: 'unsupported-page',
      });
      expect(deps.saveSession).not.toHaveBeenCalled();
    },
  );

  it('maps any failure to internal and logs it', async () => {
    const boom = new Error('storage quota');
    const deps = makeDeps({ saveSession: () => Promise.reject(boom) });
    await expect(handleCaptureStart('visible', deps)).resolves.toEqual({
      ok: false,
      error: 'internal',
    });
    expect(deps.logError).toHaveBeenCalledWith(boom);
  });
});
