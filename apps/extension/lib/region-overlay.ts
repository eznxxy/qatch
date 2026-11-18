// Region-select overlay (FR-03), shown by the isolated-world content script. Rendered in a closed shadow
// root with a constructable stylesheet: page CSS cannot restyle it, and it needs no inline <style> (which a
// strict page CSP could block). Everything is removed again before the screenshot is taken.

import { type CssRect, dragToRect, isUsableSelection, type Point } from './region-geometry';

const Z_TOP = '2147483647';

const OVERLAY_CSS = `
  .layer {
    position: fixed;
    inset: 0;
    cursor: crosshair;
    outline: none;
    font: 500 13px/1.4 system-ui, sans-serif;
    user-select: none;
    touch-action: none;
  }
  .shade {
    position: absolute;
    inset: 0;
    background: rgb(23 24 28 / 45%);
  }
  .box {
    position: absolute;
    display: none;
    border: 2px solid #f97316;
    outline: 1px solid rgb(255 255 255 / 85%);
    box-shadow: 0 0 0 100vmax rgb(23 24 28 / 45%);
  }
  .layer[data-dragging] .shade { display: none; }
  .layer[data-dragging] .box { display: block; }
  .hint {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100vw - 32px);
    padding: 8px 14px;
    border-radius: 999px;
    background: #17181c;
    color: #ffffff;
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
    pointer-events: none;
  }
  .hint kbd {
    padding: 0 5px;
    border: 1px solid rgb(255 255 255 / 35%);
    border-radius: 4px;
    font: inherit;
  }
  .size {
    position: absolute;
    display: none;
    padding: 2px 6px;
    border-radius: 4px;
    background: #17181c;
    color: #ffffff;
    font: 500 12px/1.4 ui-monospace, monospace;
    pointer-events: none;
  }
  .layer[data-dragging] .size { display: block; }
`;

const TOAST_CSS = `
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100vw - 32px);
    padding: 10px 16px;
    border-radius: 10px;
    background: #17181c;
    color: #ffffff;
    font: 500 13px/1.4 system-ui, sans-serif;
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
  }
`;

/** A host element pinned above the page with its own closed shadow root and stylesheet. */
function createHost(css: string): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('qatch-ui');
  // Inline !important beats page rules, even `!important` ones, for the host element itself.
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('inset', '0', 'important');
  host.style.setProperty('z-index', Z_TOP, 'important');
  host.style.setProperty('pointer-events', 'none', 'important');

  const root = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];
  return { host, root };
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: Node,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

function viewport() {
  return { w: document.documentElement.clientWidth || window.innerWidth, h: window.innerHeight };
}

/**
 * Lets the user drag out a region of the viewport. Resolves with the rect in CSS px (Enter: the whole visible
 * area), or `undefined` if cancelled (Esc, tab hidden, page left, or `signal` aborted). The overlay is
 * removed before the promise settles.
 */
export function selectRegion(signal?: AbortSignal): Promise<CssRect | undefined> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(undefined);
      return;
    }

    const { host, root } = createHost(OVERLAY_CSS);
    const layer = el('div', 'layer', root);
    layer.tabIndex = -1;
    layer.style.pointerEvents = 'auto';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', 'Qatch: select an area to capture');
    el('div', 'shade', layer);
    const box = el('div', 'box', layer);
    const size = el('div', 'size', layer);
    const hint = el('div', 'hint', layer);
    hint.setAttribute('role', 'status');
    // Built with text nodes only; no HTML strings.
    hint.append('Drag to select an area · ');
    el('kbd', '', hint).textContent = 'Enter';
    hint.append(' whole view · ');
    el('kbd', '', hint).textContent = 'Esc';
    hint.append(' cancel');

    let start: Point | undefined;
    let done = false;

    function draw(rect: CssRect) {
      box.style.left = `${rect.x}px`;
      box.style.top = `${rect.y}px`;
      box.style.width = `${rect.w}px`;
      box.style.height = `${rect.h}px`;
      size.textContent = `${Math.round(rect.w)} × ${Math.round(rect.h)}`;
      const vp = viewport();
      // Below the box when there is room, otherwise inside its bottom edge.
      const labelTop =
        rect.y + rect.h + 6 + 22 <= vp.h ? rect.y + rect.h + 6 : rect.y + rect.h - 28;
      size.style.left = `${Math.max(4, Math.min(rect.x, vp.w - 100))}px`;
      size.style.top = `${Math.max(4, labelTop)}px`;
    }

    function finish(result: CssRect | undefined) {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onCancel);
      signal?.removeEventListener('abort', onCancel);
      host.remove();
      resolve(result);
    }

    function onCancel() {
      finish(undefined);
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') finish(undefined);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' && event.key !== 'Enter') return;
      // Ours while the overlay is up: keep the page from reacting too.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') finish(undefined);
      else {
        const vp = viewport();
        finish({ x: 0, y: 0, w: vp.w, h: vp.h });
      }
    }

    layer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      layer.setPointerCapture(event.pointerId);
      start = { x: event.clientX, y: event.clientY };
    });

    layer.addEventListener('pointermove', (event) => {
      if (!start) return;
      const rect = dragToRect(start, { x: event.clientX, y: event.clientY }, viewport());
      if (isUsableSelection(rect)) layer.setAttribute('data-dragging', '');
      draw(rect);
    });

    layer.addEventListener('pointerup', (event) => {
      if (!start) return;
      const rect = dragToRect(start, { x: event.clientX, y: event.clientY }, viewport());
      start = undefined;
      if (isUsableSelection(rect)) finish(rect);
      else layer.removeAttribute('data-dragging'); // a click, not a drag: keep selecting
    });

    layer.addEventListener('pointercancel', () => {
      start = undefined;
      layer.removeAttribute('data-dragging');
    });

    // The selection is in viewport coordinates, so the page must not scroll under it.
    layer.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
      },
      { passive: false },
    );

    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onCancel);
    signal?.addEventListener('abort', onCancel);

    document.documentElement.appendChild(host);
    layer.focus({ preventScroll: true });
  });
}

/** Resolves after the browser has painted at least one frame without the overlay. */
export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

/** A short message at the bottom of the page, e.g. when a capture failed. */
export function showToast(text: string, durationMs = 5_000): void {
  const { host, root } = createHost(TOAST_CSS);
  const toast = el('div', 'toast', root);
  toast.setAttribute('role', 'alert');
  toast.textContent = text;
  document.documentElement.appendChild(host);
  setTimeout(() => {
    host.remove();
  }, durationMs);
}
