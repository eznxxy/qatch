// Isolated-world content script. Not declared in the manifest and has no `matches`, so it adds no host
// permissions: the worker injects it on demand with chrome.scripting.executeScript (activeTab).

import { msgSchema, regionResultSchema } from '@qatch/shared';
import { browser } from 'wxt/browser';

import { sendToWorker } from '@/lib/chrome-api';
import { afterNextPaint, selectRegion, showToast } from '@/lib/region-overlay';

/** Isolated-world globals persist across injections; this keeps a re-injection from adding listeners twice. */
const LOADED = Symbol.for('qatch.content.loaded');

const CAPTURE_FAILED =
  "Qatch couldn't capture this area. Open Qatch from the toolbar and try again.";

export default defineContentScript({
  registration: 'runtime',
  main() {
    if (Reflect.has(window, LOADED)) return;
    Reflect.defineProperty(window, LOADED, { value: true });

    /** The overlay on screen, if any. A new `region/start` replaces it. */
    let active: AbortController | undefined;

    async function runRegionSelect(sessionId: string) {
      active?.abort();
      const controller = new AbortController();
      active = controller;

      const rect = await selectRegion(controller.signal);
      if (active === controller) active = undefined;
      // Replaced by a newer start: that one owns the capture session now.
      if (controller.signal.aborted) return;

      if (!rect) {
        await sendToWorker({ t: 'region/cancelled', sessionId });
        return;
      }

      // The overlay must be gone from the screen before the worker takes the screenshot.
      await afterNextPaint();
      const reply = regionResultSchema.safeParse(
        await sendToWorker({
          t: 'region/selected',
          sessionId,
          rect: { ...rect, dpr: window.devicePixelRatio },
        }),
      );
      if (!reply.success || !reply.data.ok) showToast(CAPTURE_FAILED);
    }

    // Overlays and the page <-> worker relay for console/network arrive in P2-4.
    browser.runtime.onMessage.addListener((raw: unknown, sender) => {
      if (sender.id !== browser.runtime.id) return false;
      const parsed = msgSchema.safeParse(raw);
      if (!parsed.success) return false;

      if (parsed.data.t === 'region/start') {
        runRegionSelect(parsed.data.sessionId).catch((error: unknown) => {
          console.error('[qatch] region select failed', error);
          showToast(CAPTURE_FAILED);
        });
      }
      return false;
    });
  },
});
