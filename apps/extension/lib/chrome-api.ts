// Thin wrappers over Chrome APIs (AGENTS.md: keep Chrome calls in lib/ so logic can be tested with fakes).

import type { Msg } from '@qatch/shared';
import { browser } from 'wxt/browser';

import type { CaptureSession } from './capture-session';
import { CAPTURE_SESSION_KEY, captureSessionSchema } from './capture-session';
import type { ActiveTab } from './capture-start';
import { readDeviceEnv } from './device-env';

/** The focused tab in the last focused window, if any. */
export async function getActiveTab(): Promise<ActiveTab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined) return undefined;
  return { id: tab.id, windowId: tab.windowId, url: tab.url, title: tab.title };
}

export async function saveCaptureSession(session: CaptureSession): Promise<void> {
  await browser.storage.session.set({ [CAPTURE_SESSION_KEY]: session });
}

/** The capture in progress, if any (and valid). */
export async function loadCaptureSession(): Promise<CaptureSession | undefined> {
  const stored = await browser.storage.session.get(CAPTURE_SESSION_KEY);
  const parsed = captureSessionSchema.safeParse(stored[CAPTURE_SESSION_KEY]);
  return parsed.success ? parsed.data : undefined;
}

export async function clearCaptureSession(): Promise<void> {
  await browser.storage.session.remove(CAPTURE_SESSION_KEY);
}

export async function isTabActive(tabId: number): Promise<boolean> {
  const tab = await browser.tabs.get(tabId).catch(() => undefined);
  return tab?.active === true;
}

/**
 * Injects our isolated-world content script (activeTab + scripting). Safe to repeat: the script guards
 * against running twice in the same page.
 */
export async function injectContentScript(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['/content-scripts/content.js'],
  });
}

/** Sends a message to our content script in the tab's top frame. The reply is untrusted until parsed. */
export async function sendToTab(tabId: number, msg: Msg): Promise<unknown> {
  const reply: unknown = await browser.tabs.sendMessage(tabId, msg, { frameId: 0 });
  return reply;
}

/** PNG of the visible area of the window's active tab. Needs the activeTab grant. */
export function captureVisibleTab(windowId: number): Promise<string> {
  return browser.tabs.captureVisibleTab(windowId, { format: 'png' });
}

/**
 * Runs `readDeviceEnv` in the tab's isolated world (activeTab + scripting). The result is untrusted until
 * validated by `toDeviceInfo`.
 */
export async function readDeviceEnvInTab(tabId: number): Promise<unknown> {
  const [injection] = await browser.scripting.executeScript({
    target: { tabId },
    func: readDeviceEnv,
  });
  const result: unknown = injection?.result;
  return result;
}

/** Works in the service worker (no DOM needed). */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/** Opens the editor for a draft in a new tab right after the captured page. */
export async function openEditor(draftId: string, session: CaptureSession): Promise<void> {
  const source = await browser.tabs.get(session.tabId).catch(() => undefined);
  await browser.tabs.create({
    url: browser.runtime.getURL(`/editor.html?draft=${encodeURIComponent(draftId)}`),
    windowId: session.windowId,
    ...(source ? { index: source.index + 1, openerTabId: source.id } : {}),
  });
}

/** Closes the extension tab this code runs in (e.g. the editor after discarding). */
export async function closeCurrentTab(): Promise<void> {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
  else window.close();
}

/** Sends a message to the service worker. The reply is untrusted until parsed. */
export async function sendToWorker(msg: Msg): Promise<unknown> {
  const reply: unknown = await browser.runtime.sendMessage(msg);
  return reply;
}
