// Pure geometry for region select (FR-03): drag -> CSS rect -> device-pixel crop.

import type { RegionRect } from '@qatch/shared';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface CssRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Drags smaller than this (CSS px, either side) count as a click, not a selection. */
export const REGION_MIN_CSS_PX = 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Rectangle spanned by a drag in any direction, clipped to the viewport. */
export function dragToRect(start: Point, end: Point, viewport: Size): CssRect {
  const x1 = clamp(Math.min(start.x, end.x), 0, viewport.w);
  const y1 = clamp(Math.min(start.y, end.y), 0, viewport.h);
  const x2 = clamp(Math.max(start.x, end.x), 0, viewport.w);
  const y2 = clamp(Math.max(start.y, end.y), 0, viewport.h);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function isUsableSelection(rect: CssRect): boolean {
  return rect.w >= REGION_MIN_CSS_PX && rect.h >= REGION_MIN_CSS_PX;
}

export interface PixelRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Maps a CSS-pixel region to the screenshot's device pixels (× devicePixelRatio, which includes page zoom).
 * Edges are rounded independently so adjacent regions never overlap or leave gaps, then clipped to the image.
 * `undefined` if nothing of the region is inside the image.
 */
export function regionToPixels(rect: RegionRect, image: Size): PixelRect | undefined {
  const left = clamp(Math.round(rect.x * rect.dpr), 0, image.w);
  const top = clamp(Math.round(rect.y * rect.dpr), 0, image.h);
  const right = clamp(Math.round((rect.x + rect.w) * rect.dpr), 0, image.w);
  const bottom = clamp(Math.round((rect.y + rect.h) * rect.dpr), 0, image.h);
  if (right - left < 1 || bottom - top < 1) return undefined;
  return { sx: left, sy: top, sw: right - left, sh: bottom - top };
}
