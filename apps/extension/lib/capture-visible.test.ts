import { DEFAULT_REPORT_DETAILS, type DeviceInfo } from '@qatch/shared';
import { SCREENSHOT_MAX_BYTES } from '@qatch/shared/config';
import { describe, expect, it, vi } from 'vitest';

import type { CaptureSession } from './capture-session';
import { createVisibleCaptureHandler, type VisibleCaptureDeps } from './capture-visible';
import type { ScreenshotDraft } from './draft';

const DRAFT_ID = '9d2b7c1e-4f3a-4b8c-a1d2-e3f4a5b6c7d8';
const PNG = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
const DEVICE: DeviceInfo = {
  userAgent: 'UA',
  browser: { name: 'Chrome', version: '131.0.0.0' },
  os: { name: 'Windows', version: '11' },
  viewport: { w: 1280, h: 720 },
  screen: { w: 1920, h: 1080 },
  dpr: 1,
  language: 'en-US',
  timeZone: 'UTC',
  url: 'https://example.com/',
  capturedAt: '2026-11-18T10:00:00.000Z',
};

const session: CaptureSession = {
  id: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b',
  tabId: 7,
  windowId: 3,
  mode: 'visible',
  page: { url: 'https://example.com/', title: 'Example' },
  startedAt: 500,
};

function makeDeps(overrides: Partial<VisibleCaptureDeps> = {}) {
  // Each override becomes the mock's implementation, so every dependency stays a typed vi.fn.
  return {
    captureVisibleTab: vi.fn(
      overrides.captureVisibleTab ??
        ((_windowId: number) => Promise.resolve('data:image/png;base64,iVBORw==')),
    ),
    dataUrlToBlob: vi.fn(overrides.dataUrlToBlob ?? ((_url: string) => Promise.resolve(PNG))),
    collectDevice: vi.fn(
      overrides.collectDevice ??
        ((_s: CaptureSession) => Promise.resolve<DeviceInfo | undefined>(DEVICE)),
    ),
    saveDraft: vi.fn(overrides.saveDraft ?? ((_draft: ScreenshotDraft) => Promise.resolve())),
    openEditor: vi.fn(
      overrides.openEditor ?? ((_id: string, _s: CaptureSession) => Promise.resolve()),
    ),
    newId: overrides.newId ?? (() => DRAFT_ID),
    now: overrides.now ?? (() => 1_000),
  } satisfies VisibleCaptureDeps;
}

describe('createVisibleCaptureHandler', () => {
  it('captures the session window, saves a draft, then opens the editor', async () => {
    const order: string[] = [];
    const deps = makeDeps();
    deps.saveDraft.mockImplementation(() => {
      order.push('save');
      return Promise.resolve();
    });
    deps.openEditor.mockImplementation(() => {
      order.push('open');
      return Promise.resolve();
    });

    await createVisibleCaptureHandler(deps)(session);

    expect(deps.captureVisibleTab).toHaveBeenCalledWith(3);
    expect(deps.saveDraft).toHaveBeenCalledWith({
      id: DRAFT_ID,
      kind: 'screenshot',
      mode: 'visible',
      createdAt: 1_000,
      page: session.page,
      image: PNG,
      device: DEVICE,
      details: DEFAULT_REPORT_DETAILS,
      annotations: [],
    });
    expect(deps.collectDevice).toHaveBeenCalledWith(session);
    expect(deps.openEditor).toHaveBeenCalledWith(DRAFT_ID, session);
    expect(order).toEqual(['save', 'open']);
  });

  it('takes the screenshot before injecting the device probe', async () => {
    const order: string[] = [];
    const deps = makeDeps();
    deps.captureVisibleTab.mockImplementation(() => {
      order.push('screenshot');
      return Promise.resolve('data:image/png;base64,iVBORw==');
    });
    deps.collectDevice.mockImplementation(() => {
      order.push('device');
      return Promise.resolve(DEVICE);
    });
    await createVisibleCaptureHandler(deps)(session);
    expect(order).toEqual(['screenshot', 'device']);
  });

  it('still saves the screenshot when device info is unavailable', async () => {
    const deps = makeDeps({ collectDevice: () => Promise.resolve(undefined) });
    await createVisibleCaptureHandler(deps)(session);
    const saved = deps.saveDraft.mock.calls[0]?.[0];
    expect(saved?.image).toBe(PNG);
    expect(saved).not.toHaveProperty('device');
    expect(deps.openEditor).toHaveBeenCalled();
  });

  it.each([
    ['a non-PNG image', new Blob(['x'], { type: 'image/jpeg' }), /Unexpected screenshot type/],
    ['an empty image', new Blob([], { type: 'image/png' }), /Empty screenshot/],
    [
      'an oversized image',
      new Blob([new Uint8Array(SCREENSHOT_MAX_BYTES + 1)], { type: 'image/png' }),
      /over/,
    ],
  ])('rejects %s and saves nothing', async (_name, blob, error) => {
    const deps = makeDeps({ dataUrlToBlob: () => Promise.resolve(blob) });
    await expect(createVisibleCaptureHandler(deps)(session)).rejects.toThrow(error);
    expect(deps.saveDraft).not.toHaveBeenCalled();
    expect(deps.openEditor).not.toHaveBeenCalled();
  });

  it('does not open the editor if saving fails', async () => {
    const deps = makeDeps({ saveDraft: () => Promise.reject(new Error('quota')) });
    await expect(createVisibleCaptureHandler(deps)(session)).rejects.toThrow('quota');
    expect(deps.openEditor).not.toHaveBeenCalled();
  });
});
