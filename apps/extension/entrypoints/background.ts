// Service worker: stateless and event-driven. It can be killed at any time, so required state lives in
// chrome.storage.session / IndexedDB, never only in memory.

import { msgSchema } from '@qatch/shared';
import { browser } from 'wxt/browser';

import type { EnabledCaptureMode } from '@/lib/capture-modes';
import {
  createRegionStartHandler,
  handleRegionCancelled,
  handleRegionSelected,
} from '@/lib/capture-region';
import type { CaptureSession } from '@/lib/capture-session';
import { type CaptureHandler, handleCaptureStart } from '@/lib/capture-start';
import { createVisibleCaptureHandler } from '@/lib/capture-visible';
import {
  captureVisibleTab,
  clearCaptureSession,
  dataUrlToBlob,
  getActiveTab,
  injectContentScript,
  isTabActive,
  loadCaptureSession,
  openEditor,
  readDeviceEnvInTab,
  saveCaptureSession,
  sendToTab,
} from '@/lib/chrome-api';
import { cropPng } from '@/lib/crop-png';
import { collectDeviceInfo } from '@/lib/device-info';
import { putDraft } from '@/lib/draft-store';
import { contentScriptTabId, isExtensionPageSender } from '@/lib/sender';

const newId = () => crypto.randomUUID();
const logError = (context: string) => (error: unknown) => {
  console.error(`[qatch] ${context}`, error);
};

const collectDevice = (session: CaptureSession) =>
  collectDeviceInfo(
    () => readDeviceEnvInTab(session.tabId),
    Date.now,
    logError('device info unavailable'),
  );
const saveDraft = (draft: Parameters<typeof putDraft>[0]) => putDraft(draft);

/** Exactly one handler per enabled mode (lib/capture-modes.ts); the type enforces it. */
const captureHandlers: Record<EnabledCaptureMode, CaptureHandler> = {
  visible: createVisibleCaptureHandler({
    captureVisibleTab,
    dataUrlToBlob,
    collectDevice,
    saveDraft,
    openEditor,
    newId,
    now: Date.now,
  }),
  region: createRegionStartHandler({ injectContentScript, sendToTab }),
};

const regionSession = { loadSession: loadCaptureSession, clearSession: clearCaptureSession };

export default defineBackground(() => {
  // Registered synchronously at startup so a worker woken by a message still receives it.
  browser.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    const parsed = msgSchema.safeParse(raw);
    if (!parsed.success) return false;
    const msg = parsed.data;

    // Our own extension pages (popup, editor) drive captures (SECURITY_PRIVACY §4).
    if (isExtensionPageSender(sender, browser.runtime.id)) {
      if (msg.t !== 'capture/start') return false;
      void handleCaptureStart(msg.mode, {
        getActiveTab,
        saveSession: saveCaptureSession,
        handlers: captureHandlers,
        now: Date.now,
        newId,
        logError: logError('capture/start failed'),
      }).then(sendResponse);
      return true; // keep the channel open for the async reply
    }

    // Our content script answers a capture the worker started; it can never start one.
    const tabId = contentScriptTabId(sender, browser.runtime.id);
    if (tabId === undefined) return false;
    switch (msg.t) {
      case 'region/selected':
        void handleRegionSelected(msg, tabId, {
          ...regionSession,
          isTabActive,
          captureVisibleTab,
          dataUrlToBlob,
          cropPng,
          collectDevice,
          saveDraft,
          openEditor,
          newId,
          now: Date.now,
          logError: logError('region capture failed'),
        }).then(sendResponse);
        return true;
      case 'region/cancelled':
        void handleRegionCancelled(msg, tabId, {
          ...regionSession,
          logError: logError('region cancel failed'),
        });
        return false;
      default:
        return false;
    }
  });
});
