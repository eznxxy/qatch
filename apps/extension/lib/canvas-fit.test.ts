import { describe, expect, it } from 'vitest';

import { fitCanvas } from './canvas-fit';

const NATIVE = { width: 1920, height: 1080 };
const space = (width: number, height = Infinity) => ({ width, height });

describe('fitCanvas (fit)', () => {
  it('shows the image 1:1 when it fits', () => {
    expect(fitCanvas(NATIVE, space(2400), 'fit', 1)).toEqual({
      width: 1920,
      height: 1080,
      zoom: 1,
    });
    expect(fitCanvas(NATIVE, space(1920, 1080), 'fit', 1)).toEqual({
      width: 1920,
      height: 1080,
      zoom: 1,
    });
  });

  it('scales down to the available width, keeping the aspect ratio', () => {
    expect(fitCanvas(NATIVE, space(960), 'fit', 1)).toEqual({ width: 960, height: 540, zoom: 0.5 });
  });

  it('scales down to the available height when that is the tighter side', () => {
    expect(fitCanvas(NATIVE, space(1500, 540), 'fit', 1)).toEqual({
      width: 960,
      height: 540,
      zoom: 0.5,
    });
  });

  it('fits the width only when the height is unbounded (tall full-page captures)', () => {
    const tall = { width: 1366, height: 6000 };
    expect(fitCanvas(tall, space(683), 'fit', 1)).toEqual({ width: 683, height: 3000, zoom: 0.5 });
  });

  it('rounds down so the canvas never overflows the space', () => {
    expect(fitCanvas(NATIVE, space(1001.6), 'fit', 1)).toEqual({
      width: 1001,
      height: 563,
      zoom: 1001 / 1920,
    });
  });

  it('never goes above one screenshot pixel per device pixel', () => {
    // HiDPI: a 1920 px capture is 960 CSS px of page.
    expect(fitCanvas(NATIVE, space(1500), 'fit', 2)).toEqual({
      width: 960,
      height: 540,
      zoom: 0.5,
    });
    // Zoomed out to 80%: 1:1 is 2400 CSS px, so the available width wins.
    expect(fitCanvas(NATIVE, space(2000), 'fit', 0.8)).toEqual({
      width: 2000,
      height: 1125,
      zoom: 2000 / 1920,
    });
  });

  it('returns nothing when there is no room or no image', () => {
    expect(fitCanvas(NATIVE, space(0), 'fit', 1)).toBeUndefined();
    expect(fitCanvas(NATIVE, space(800, 0), 'fit', 1)).toBeUndefined();
    expect(fitCanvas({ width: 0, height: 0 }, space(800), 'fit', 1)).toBeUndefined();
  });
});

describe('fitCanvas (actual)', () => {
  it('shows the image 1:1 whatever the available space', () => {
    const expected = { width: 1920, height: 1080, zoom: 1 };
    expect(fitCanvas(NATIVE, space(800, 400), 'actual', 1)).toEqual(expected);
    expect(fitCanvas(NATIVE, space(0, 0), 'actual', 1)).toEqual(expected);
  });

  it('accounts for devicePixelRatio', () => {
    expect(fitCanvas(NATIVE, space(800), 'actual', 2)).toEqual({
      width: 960,
      height: 540,
      zoom: 0.5,
    });
  });

  it('treats an invalid devicePixelRatio as 1', () => {
    expect(fitCanvas(NATIVE, space(800), 'actual', 0)).toEqual({
      width: 1920,
      height: 1080,
      zoom: 1,
    });
  });
});
