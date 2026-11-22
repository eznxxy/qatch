// FR-03: region select. popup -> worker injects the content script and starts the overlay -> the user drags
// -> the content script removes the overlay and sends `region/selected` -> the worker captures the visible
// tab, crops it at native resolution and opens the editor.

import type { DeviceInfo, Msg, MsgOf, RegionRect, RegionResult } from '@qatch/shared';

import type { CaptureSession } from './capture-session';
import type { CaptureHandler } from './capture-start';
import type { ScreenshotDraft } from './draft';
import { buildScreenshotDraft } from './screenshot-draft';

export interface RegionStartDeps {
  injectContentScript: (tabId: number) => Promise<void>;
  sendToTab: (tabId: number, msg: Msg) => Promise<unknown>;
}

/** `capture/start` for region: shows the overlay and resolves at once (it does not wait for the drag). */
export function createRegionStartHandler(deps: RegionStartDeps): CaptureHandler {
  return async (session) => {
    await deps.injectContentScript(session.tabId);
    await deps.sendToTab(session.tabId, { t: 'region/start', sessionId: session.id });
  };
}

export interface RegionSessionDeps {
  loadSession: () => Promise<CaptureSession | undefined>;
  clearSession: () => Promise<void>;
}

/**
 * The stored session, only if it is the region capture this message is about, from the tab that started it.
 * Anything else (stale overlay, another tab, a finished capture) is ignored.
 */
async function claimRegionSession(
  sessionId: string,
  senderTabId: number,
  deps: RegionSessionDeps,
): Promise<CaptureSession | undefined> {
  const session = await deps.loadSession();
  if (session?.mode !== 'region' || session.id !== sessionId || session.tabId !== senderTabId) {
    return undefined;
  }
  // One answer per session: clear before the slow part so a repeated message cannot capture twice.
  await deps.clearSession();
  return session;
}

export interface RegionSelectedDeps extends RegionSessionDeps {
  /** captureVisibleTab captures whatever tab is active, so the source tab must still be the active one. */
  isTabActive: (tabId: number) => Promise<boolean>;
  captureVisibleTab: (windowId: number) => Promise<string>;
  dataUrlToBlob: (dataUrl: string) => Promise<Blob>;
  cropPng: (image: Blob, rect: RegionRect) => Promise<Blob>;
  /** Best effort (FR-09): resolves `undefined` rather than rejecting. */
  collectDevice: (session: CaptureSession) => Promise<DeviceInfo | undefined>;
  saveDraft: (draft: ScreenshotDraft) => Promise<void>;
  openEditor: (draftId: string, session: CaptureSession) => Promise<void>;
  newId: () => string;
  now: () => number;
  logError: (error: unknown) => void;
}

/** Handles `region/selected` from our content script. Never throws. */
export async function handleRegionSelected(
  msg: MsgOf<'region/selected'>,
  senderTabId: number,
  deps: RegionSelectedDeps,
): Promise<RegionResult> {
  try {
    const session = await claimRegionSession(msg.sessionId, senderTabId, deps);
    if (!session) return { ok: false };
    if (!(await deps.isTabActive(session.tabId))) return { ok: false };

    const screenshot = await deps.dataUrlToBlob(await deps.captureVisibleTab(session.windowId));
    const image = await deps.cropPng(screenshot, msg.rect);
    const device = await deps.collectDevice(session);

    const draft = buildScreenshotDraft({
      id: deps.newId(),
      mode: 'region',
      createdAt: deps.now(),
      session,
      image,
      device,
    });
    await deps.saveDraft(draft);
    await deps.openEditor(draft.id, session);
    return { ok: true };
  } catch (error) {
    deps.logError(error);
    return { ok: false };
  }
}

/** Handles `region/cancelled` (Esc, tab hidden): forgets the session. Never throws. */
export async function handleRegionCancelled(
  msg: MsgOf<'region/cancelled'>,
  senderTabId: number,
  deps: RegionSessionDeps & { logError: (error: unknown) => void },
): Promise<void> {
  try {
    await claimRegionSession(msg.sessionId, senderTabId, deps);
  } catch (error) {
    deps.logError(error);
  }
}
