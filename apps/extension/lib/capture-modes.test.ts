import { describe, expect, it } from 'vitest';

import { ENABLED_CAPTURE_MODES, isCaptureModeEnabled } from './capture-modes';

describe('isCaptureModeEnabled', () => {
  it('enables only modes with a worker handler', () => {
    expect(ENABLED_CAPTURE_MODES).toEqual(['visible', 'region']);
    expect(isCaptureModeEnabled('visible')).toBe(true);
    expect(isCaptureModeEnabled('region')).toBe(true);
    expect(isCaptureModeEnabled('full')).toBe(false);
    expect(isCaptureModeEnabled('record')).toBe(false);
  });
});
