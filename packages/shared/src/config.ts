// Product limits shared by the extension and the backend.
// The extension enforces them for UX; the backend re-enforces them (never trust the client).

// --- Captured data (API_AND_DATA §3) ---

/** Max console entries per report. */
export const CONSOLE_MAX_ENTRIES = 1_000;

/** Max network entries per report. */
export const NETWORK_MAX_ENTRIES = 500;

/** Max size of each request/response body, in UTF-8 bytes. */
export const BODY_MAX_BYTES = 64 * 1024;

/** Max size of the serialized report JSON payload, in UTF-8 bytes. */
export const REPORT_PAYLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Max screenshot upload size. */
export const SCREENSHOT_MAX_BYTES = 20 * 1024 * 1024;

// Per-field caps. Not specified in the docs; chosen so a single entry can never dominate the payload while
// real-world values (long stack traces, signed URLs) still fit. Captured values are truncated to these
// before sending; schemas reject anything longer.

/** Max length of a serialized console message, in characters. */
export const CONSOLE_MESSAGE_MAX_CHARS = 10_000;

/** Max length of a stack trace, in characters. */
export const STACK_MAX_CHARS = 10_000;

/** Max length of a captured URL, in characters. */
export const URL_MAX_CHARS = 8_192;

/** Max headers kept per request or response. */
export const HEADERS_MAX_COUNT = 100;

/** Max length of a header name, in characters. */
export const HEADER_NAME_MAX_CHARS = 256;

/** Max length of a header value, in characters. */
export const HEADER_VALUE_MAX_CHARS = 8_192;

// --- Recording ---

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
