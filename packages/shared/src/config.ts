// Product limits shared by the extension and the backend.
// The extension enforces them for UX; the backend re-enforces them (never trust the client).

/** Maximum screen-recording length. Change this one value to adjust the cap everywhere. */
export const RECORDING_MAX_MINUTES = 30;

export const RECORDING_MAX_DURATION_MS = RECORDING_MAX_MINUTES * 60 * 1000;

/** Target video bitrate for MediaRecorder, so file size stays predictable. */
export const RECORDING_VIDEO_BITS_PER_SECOND = 2_500_000;

/** MediaRecorder timeslice; each chunk is written to IndexedDB as it arrives. */
export const RECORDING_TIMESLICE_MS = 1000;

/**
 * Upload size cap for a recording, derived from the duration cap so the two never drift apart.
 * Includes 20% headroom for audio and bitrate variance (about 675 MB at 30 minutes).
 */
export const RECORDING_MAX_BYTES = Math.ceil(
  ((RECORDING_MAX_DURATION_MS / 1000) * RECORDING_VIDEO_BITS_PER_SECOND * 1.2) / 8,
);
