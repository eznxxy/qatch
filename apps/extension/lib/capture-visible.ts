// FR-01: visible-tab screenshot -> draft in IndexedDB -> editor.

import type { DeviceInfo } from '@qatch/shared';

import type { CaptureSession } from './capture-session';
import type { CaptureHandler } from './capture-start';
import type { ScreenshotDraft } from './draft';
import { buildScreenshotDraft } from './screenshot-draft';

export interface VisibleCaptureDeps {
  /** PNG data URL of the visible area of the window's active tab (chrome.tabs.captureVisibleTab). */
  captureVisibleTab: (windowId: number) => Promise<string>;
  dataUrlToBlob: (dataUrl: string) => Promise<Blob>;
  /** Best effort (FR-09): resolves `undefined` rather than rejecting. */
  collectDevice: (session: CaptureSession) => Promise<DeviceInfo | undefined>;
  saveDraft: (draft: ScreenshotDraft) => Promise<void>;
  openEditor: (draftId: string, session: CaptureSession) => Promise<void>;
  newId: () => string;
  now: () => number;
}

export function createVisibleCaptureHandler(deps: VisibleCaptureDeps): CaptureHandler {
  return async (session) => {
    // Screenshot first, so it shows exactly what the user saw when they clicked.
    const dataUrl = await deps.captureVisibleTab(session.windowId);
    const image = await deps.dataUrlToBlob(dataUrl);
    const device = await deps.collectDevice(session);

    const draft = buildScreenshotDraft({
      id: deps.newId(),
      mode: 'visible',
      createdAt: deps.now(),
      session,
      image,
      device,
    });
    // Persist before opening the editor: the editor reads the draft from IndexedDB, never from memory.
    await deps.saveDraft(draft);
    await deps.openEditor(draft.id, session);
  };
}
