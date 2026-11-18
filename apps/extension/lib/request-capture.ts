import {
  type CaptureMode,
  type CaptureStartResult,
  captureStartResultSchema,
  type Msg,
} from '@qatch/shared';

/**
 * Asks the worker to start a capture and validates the reply. Never throws: a missing, malformed or failed
 * reply becomes `internal`.
 */
export async function requestCaptureStart(
  mode: CaptureMode,
  send: (msg: Msg) => Promise<unknown>,
): Promise<CaptureStartResult> {
  try {
    const reply = await send({ t: 'capture/start', mode });
    const parsed = captureStartResultSchema.safeParse(reply);
    return parsed.success ? parsed.data : { ok: false, error: 'internal' };
  } catch {
    return { ok: false, error: 'internal' };
  }
}
