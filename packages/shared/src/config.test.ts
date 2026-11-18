import { describe, expect, it } from 'vitest';

import {
  RECORDING_MAX_BYTES,
  RECORDING_MAX_DURATION_MS,
  RECORDING_MAX_MINUTES,
  RECORDING_VIDEO_BITS_PER_SECOND,
} from './config';

describe('recording limits', () => {
  it('derives the duration cap from the minute cap', () => {
    expect(RECORDING_MAX_DURATION_MS).toBe(RECORDING_MAX_MINUTES * 60_000);
  });

  it('derives the byte cap from duration and bitrate with 20% headroom', () => {
    const rawBytes = ((RECORDING_MAX_DURATION_MS / 1000) * RECORDING_VIDEO_BITS_PER_SECOND) / 8;
    expect(RECORDING_MAX_BYTES).toBe(Math.ceil(rawBytes * 1.2));
  });

  it('keeps a 30-minute recording at about 675 MB', () => {
    expect(RECORDING_MAX_MINUTES).toBe(30);
    expect(RECORDING_MAX_BYTES).toBe(675_000_000);
  });
});
