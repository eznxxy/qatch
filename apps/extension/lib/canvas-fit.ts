// Pure sizing for the editor canvas (FR-04). Screenshot pixels are device pixels, so "actual size" means one
// screenshot pixel per device pixel: native / devicePixelRatio in CSS px. Fit mode never goes above that,
// because stretching a screenshot past 1:1 only makes it softer.

/** 'fit' scales the screenshot down to the available space; 'actual' shows it 1:1 (the stage scrolls). */
export type CanvasView = 'fit' | 'actual';

export interface CanvasFit {
  /** Displayed size in CSS px (whole pixels). */
  width: number;
  height: number;
  /** Scene-to-CSS zoom, derived from the width so the image fills the canvas exactly. */
  zoom: number;
}

/**
 * Display size and zoom for an image of `native` size. `available` is the space in CSS px; pass
 * `height: Infinity` to fit the width only (e.g. a full-page screenshot, which then scrolls).
 */
export function fitCanvas(
  native: { width: number; height: number },
  available: { width: number; height: number },
  view: CanvasView,
  devicePixelRatio: number,
): CanvasFit | undefined {
  if (native.width <= 0 || native.height <= 0) return undefined;
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const actual = 1 / dpr;
  if (view === 'actual') return sized(native, actual, Math.round);

  if (available.width <= 0 || available.height <= 0) return undefined;
  const scale = Math.min(actual, available.width / native.width, available.height / native.height);
  // Round down so the canvas never overflows the space by a fraction of a pixel (which adds a scrollbar).
  return sized(native, scale, Math.floor);
}

function sized(
  native: { width: number; height: number },
  scale: number,
  round: (n: number) => number,
): CanvasFit {
  const width = Math.max(1, round(native.width * scale));
  const height = Math.max(1, round(native.height * scale));
  return { width, height, zoom: width / native.width };
}
