import type { CaptureMode, CaptureStartResult } from '@qatch/shared';
import { URL_MAX_CHARS } from '@qatch/shared/config';

import { isCapturableUrl } from './capturable-url';
import type { CaptureSession } from './capture-session';

export interface ActiveTab {
  id: number;
  windowId: number;
  /** Visible only with an activeTab grant (the user opened the popup on this tab). */
  url: string | undefined;
  title: string | undefined;
}

/**
 * Starts the capture for one mode. Resolves once the capture has *started* (not finished): modes that wait
 * on the user, such as region select, must not block the popup's reply.
 */
export type CaptureHandler = (session: CaptureSession) => Promise<void>;

export interface CaptureStartDeps {
  getActiveTab: () => Promise<ActiveTab | undefined>;
  saveSession: (session: CaptureSession) => Promise<void>;
  /** Modes without a handler answer `not-implemented`. */
  handlers: Partial<Record<CaptureMode, CaptureHandler>>;
  now: () => number;
  newId: () => string;
  logError: (error: unknown) => void;
}

/** Handles `capture/start` from the popup. Never throws; failures map to an error code. */
export async function handleCaptureStart(
  mode: CaptureMode,
  deps: CaptureStartDeps,
): Promise<CaptureStartResult> {
  const handler = deps.handlers[mode];
  if (!handler) return { ok: false, error: 'not-implemented' };

  try {
    const tab = await deps.getActiveTab();
    if (!tab) return { ok: false, error: 'no-active-tab' };
    const { url } = tab;
    if (url === undefined || !isCapturableUrl(url)) return { ok: false, error: 'unsupported-page' };

    const session: CaptureSession = {
      id: deps.newId(),
      tabId: tab.id,
      windowId: tab.windowId,
      mode,
      // Clamped so an extreme URL/title cannot make the session (and later the draft) invalid.
      page: { url: url.slice(0, URL_MAX_CHARS), title: (tab.title ?? '').slice(0, 1_024) },
      startedAt: deps.now(),
    };
    await deps.saveSession(session);
    await handler(session);
    return { ok: true, sessionId: session.id };
  } catch (error) {
    deps.logError(error);
    return { ok: false, error: 'internal' };
  }
}
