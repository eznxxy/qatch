import type { DeviceInfo, Msg, MsgOf, RegionRect } from '@qatch/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  createRegionStartHandler,
  handleRegionCancelled,
  handleRegionSelected,
  type RegionSelectedDeps,
} from './capture-region';
import type { CaptureSession } from './capture-session';
import type { ScreenshotDraft } from './draft';

const DRAFT_ID = '9d2b7c1e-4f3a-4b8c-a1d2-e3f4a5b6c7d8';
const SESSION_ID = '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b';
const FULL = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' });
const CROPPED = new Blob([new Uint8Array([1, 2])], { type: 'image/png' });
const RECT: RegionRect = { x: 10, y: 20, w: 300, h: 150, dpr: 2 };

const session: CaptureSession = {
  id: SESSION_ID,
  tabId: 7,
  windowId: 3,
  mode: 'region',
  page: { url: 'https://example.com/', title: 'Example' },
  startedAt: 500,
};

const selected: MsgOf<'region/selected'> = {
  t: 'region/selected',
  sessionId: SESSION_ID,
  rect: RECT,
};

function makeDeps(overrides: Partial<RegionSelectedDeps> = {}) {
  return {
    loadSession: vi.fn(
      overrides.loadSession ?? (() => Promise.resolve<CaptureSession | undefined>(session)),
    ),
    clearSession: vi.fn(overrides.clearSession ?? (() => Promise.resolve())),
    isTabActive: vi.fn(overrides.isTabActive ?? ((_tabId: number) => Promise.resolve(true))),
    captureVisibleTab: vi.fn(
      overrides.captureVisibleTab ?? ((_w: number) => Promise.resolve('data:image/png;base64,x')),
    ),
    dataUrlToBlob: vi.fn(overrides.dataUrlToBlob ?? ((_u: string) => Promise.resolve(FULL))),
    cropPng: vi.fn(
      overrides.cropPng ?? ((_image: Blob, _rect: RegionRect) => Promise.resolve(CROPPED)),
    ),
    collectDevice: vi.fn(
      overrides.collectDevice ??
        ((_s: CaptureSession) => Promise.resolve<DeviceInfo | undefined>(undefined)),
    ),
    saveDraft: vi.fn(overrides.saveDraft ?? ((_d: ScreenshotDraft) => Promise.resolve())),
    openEditor: vi.fn(
      overrides.openEditor ?? ((_id: string, _s: CaptureSession) => Promise.resolve()),
    ),
    newId: overrides.newId ?? (() => DRAFT_ID),
    now: overrides.now ?? (() => 1_000),
    logError: vi.fn(overrides.logError ?? ((_e: unknown) => undefined)),
  } satisfies RegionSelectedDeps;
}

describe('createRegionStartHandler', () => {
  it('injects the content script, then starts the overlay for this session', async () => {
    const order: string[] = [];
    const injectContentScript = vi.fn((_tabId: number) => {
      order.push('inject');
      return Promise.resolve();
    });
    const sendToTab = vi.fn((_tabId: number, _msg: Msg) => {
      order.push('send');
      return Promise.resolve<unknown>(undefined);
    });

    await createRegionStartHandler({ injectContentScript, sendToTab })(session);

    expect(injectContentScript).toHaveBeenCalledWith(7);
    expect(sendToTab).toHaveBeenCalledWith(7, { t: 'region/start', sessionId: SESSION_ID });
    expect(order).toEqual(['inject', 'send']);
  });
});

describe('handleRegionSelected', () => {
  it('captures, crops to the selection, saves a region draft and opens the editor', async () => {
    const deps = makeDeps();
    await expect(handleRegionSelected(selected, 7, deps)).resolves.toEqual({ ok: true });

    expect(deps.clearSession).toHaveBeenCalled();
    expect(deps.captureVisibleTab).toHaveBeenCalledWith(3);
    expect(deps.cropPng).toHaveBeenCalledWith(FULL, RECT);
    expect(deps.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: DRAFT_ID, mode: 'region', image: CROPPED, page: session.page }),
    );
    expect(deps.openEditor).toHaveBeenCalledWith(DRAFT_ID, session);
  });

  it('clears the session before capturing, so a repeated message cannot capture twice', async () => {
    const order: string[] = [];
    const deps = makeDeps();
    deps.clearSession.mockImplementation(() => {
      order.push('clear');
      return Promise.resolve();
    });
    deps.captureVisibleTab.mockImplementation(() => {
      order.push('capture');
      return Promise.resolve('data:image/png;base64,x');
    });
    await handleRegionSelected(selected, 7, deps);
    expect(order).toEqual(['clear', 'capture']);
  });

  it.each<[string, Partial<RegionSelectedDeps>, number, string]>([
    ['no session', { loadSession: () => Promise.resolve(undefined) }, 7, SESSION_ID],
    [
      'a non-region session',
      { loadSession: () => Promise.resolve({ ...session, mode: 'visible' }) },
      7,
      SESSION_ID,
    ],
    ['another session id', {}, 7, '11111111-2222-4333-8444-555555555555'],
    ['another tab', {}, 8, SESSION_ID],
  ])('ignores the message when there is %s', async (_name, overrides, tabId, sessionId) => {
    const deps = makeDeps(overrides);
    await expect(handleRegionSelected({ ...selected, sessionId }, tabId, deps)).resolves.toEqual({
      ok: false,
    });
    expect(deps.clearSession).not.toHaveBeenCalled();
    expect(deps.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('does not capture when the user switched away from the tab', async () => {
    const deps = makeDeps({ isTabActive: () => Promise.resolve(false) });
    await expect(handleRegionSelected(selected, 7, deps)).resolves.toEqual({ ok: false });
    expect(deps.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('reports failure (and logs) when cropping fails, saving nothing', async () => {
    const deps = makeDeps({ cropPng: () => Promise.reject(new Error('outside')) });
    await expect(handleRegionSelected(selected, 7, deps)).resolves.toEqual({ ok: false });
    expect(deps.logError).toHaveBeenCalled();
    expect(deps.saveDraft).not.toHaveBeenCalled();
    expect(deps.openEditor).not.toHaveBeenCalled();
  });

  it('rejects an invalid cropped image', async () => {
    const deps = makeDeps({ cropPng: () => Promise.resolve(new Blob([], { type: 'image/png' })) });
    await expect(handleRegionSelected(selected, 7, deps)).resolves.toEqual({ ok: false });
    expect(deps.saveDraft).not.toHaveBeenCalled();
  });
});

describe('handleRegionCancelled', () => {
  const cancelled: MsgOf<'region/cancelled'> = { t: 'region/cancelled', sessionId: SESSION_ID };

  it('clears the matching session', async () => {
    const deps = makeDeps();
    await handleRegionCancelled(cancelled, 7, deps);
    expect(deps.clearSession).toHaveBeenCalled();
  });

  it('leaves other sessions alone', async () => {
    const deps = makeDeps();
    await handleRegionCancelled(cancelled, 8, deps);
    expect(deps.clearSession).not.toHaveBeenCalled();
  });
});
