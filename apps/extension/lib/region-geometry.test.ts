import { describe, expect, it } from 'vitest';

import {
  dragToRect,
  isUsableSelection,
  REGION_MIN_CSS_PX,
  regionToPixels,
} from './region-geometry';

const VIEWPORT = { w: 1280, h: 720 };

describe('dragToRect', () => {
  it('works for a drag in any direction', () => {
    const expected = { x: 10, y: 20, w: 90, h: 80 };
    expect(dragToRect({ x: 10, y: 20 }, { x: 100, y: 100 }, VIEWPORT)).toEqual(expected);
    expect(dragToRect({ x: 100, y: 100 }, { x: 10, y: 20 }, VIEWPORT)).toEqual(expected);
    expect(dragToRect({ x: 100, y: 20 }, { x: 10, y: 100 }, VIEWPORT)).toEqual(expected);
  });

  it('clips to the viewport when the pointer leaves it', () => {
    expect(dragToRect({ x: 1200, y: 700 }, { x: 1500, y: 900 }, VIEWPORT)).toEqual({
      x: 1200,
      y: 700,
      w: 80,
      h: 20,
    });
    expect(dragToRect({ x: 50, y: 50 }, { x: -30, y: -10 }, VIEWPORT)).toEqual({
      x: 0,
      y: 0,
      w: 50,
      h: 50,
    });
  });
});

describe('isUsableSelection', () => {
  it('treats tiny drags as clicks', () => {
    expect(isUsableSelection({ x: 0, y: 0, w: REGION_MIN_CSS_PX - 1, h: 100 })).toBe(false);
    expect(isUsableSelection({ x: 0, y: 0, w: 100, h: REGION_MIN_CSS_PX - 1 })).toBe(false);
    expect(isUsableSelection({ x: 0, y: 0, w: REGION_MIN_CSS_PX, h: REGION_MIN_CSS_PX })).toBe(
      true,
    );
  });
});

describe('regionToPixels', () => {
  it('is identity at 1x', () => {
    expect(regionToPixels({ x: 10, y: 20, w: 30, h: 40, dpr: 1 }, { w: 1280, h: 720 })).toEqual({
      sx: 10,
      sy: 20,
      sw: 30,
      sh: 40,
    });
  });

  // FR-03 acceptance: a region on a 2x display exports at native resolution.
  it('scales to native resolution at 2x', () => {
    expect(regionToPixels({ x: 10, y: 20, w: 300, h: 150, dpr: 2 }, { w: 2560, h: 1440 })).toEqual({
      sx: 20,
      sy: 40,
      sw: 600,
      sh: 300,
    });
  });

  it('rounds edges, not sizes, at fractional ratios (no gaps between neighbours)', () => {
    const image = { w: 1920, h: 1080 };
    const a = regionToPixels({ x: 0, y: 0, w: 33.3, h: 10, dpr: 1.5 }, image);
    const b = regionToPixels({ x: 33.3, y: 0, w: 33.3, h: 10, dpr: 1.5 }, image);
    expect(a && b && a.sx + a.sw).toBe(b?.sx);
  });

  it('clips to the image (e.g. a rounding overshoot at the edge)', () => {
    expect(
      regionToPixels({ x: 1200, y: 700, w: 80.4, h: 20.4, dpr: 1 }, { w: 1280, h: 720 }),
    ).toEqual({ sx: 1200, sy: 700, sw: 80, sh: 20 });
  });

  it('returns undefined when the region is outside the image', () => {
    expect(
      regionToPixels({ x: 2000, y: 0, w: 10, h: 10, dpr: 1 }, { w: 1280, h: 720 }),
    ).toBeUndefined();
  });
});
