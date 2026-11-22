import type { CaptureMode } from '@qatch/shared';

/**
 * Modes that have a worker handler. The popup enables only these; the worker's handler table is typed
 * against this list, so a mode cannot be enabled without a handler. Add a mode here when its task lands
 * (region: P1-4, full: P4-1, record: P5).
 */
export const ENABLED_CAPTURE_MODES = [
  'visible',
  'region',
] as const satisfies readonly CaptureMode[];
export type EnabledCaptureMode = (typeof ENABLED_CAPTURE_MODES)[number];

export function isCaptureModeEnabled(mode: CaptureMode): mode is EnabledCaptureMode {
  return (ENABLED_CAPTURE_MODES as readonly CaptureMode[]).includes(mode);
}
