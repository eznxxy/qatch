// Message contracts between extension contexts (ARCHITECTURE §4).
// `page/*` messages originate in the page's MAIN world and are untrusted: receivers must parse them with
// `msgSchema` (never act on them). The per-session nonce envelope is added with the bridge in P2-4.

import { z } from 'zod';

import { consoleEntrySchema, networkEntrySchema } from './capture';

export const captureModeSchema = z.enum(['visible', 'full', 'region', 'record']);
export type CaptureMode = z.infer<typeof captureModeSchema>;

/** Largest coordinate accepted, in CSS px: far beyond any real viewport, small enough to stay sane. */
const REGION_MAX_CSS_PX = 100_000;

/** Region in viewport CSS pixels plus the devicePixelRatio needed for the crop (FR-03). */
export const regionRectSchema = z.object({
  x: z.number().nonnegative().max(REGION_MAX_CSS_PX),
  y: z.number().nonnegative().max(REGION_MAX_CSS_PX),
  w: z.number().positive().max(REGION_MAX_CSS_PX),
  h: z.number().positive().max(REGION_MAX_CSS_PX),
  dpr: z.number().positive().max(16),
});
export type RegionRect = z.infer<typeof regionRectSchema>;

export const msgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('capture/start'), mode: captureModeSchema }),
  z.object({ t: z.literal('capture/stop') }),
  z.object({ t: z.literal('page/console'), entry: consoleEntrySchema }),
  z.object({ t: z.literal('page/network'), entry: networkEntrySchema }),
  // Region select (FR-03). The session id ties the content script's answer to the capture the worker
  // started; the worker ignores anything for another (or a finished) session.
  z.object({ t: z.literal('region/start'), sessionId: z.uuid() }),
  z.object({ t: z.literal('region/selected'), sessionId: z.uuid(), rect: regionRectSchema }),
  z.object({ t: z.literal('region/cancelled'), sessionId: z.uuid() }),
  z.object({ t: z.literal('draft/ready'), draftId: z.uuid() }),
]);
export type Msg = z.infer<typeof msgSchema>;
export type MsgType = Msg['t'];
/** The message variant for a given `t`, e.g. `MsgOf<'capture/start'>`. */
export type MsgOf<T extends MsgType> = Extract<Msg, { t: T }>;

// --- Responses ---

/**
 * Why a capture could not start:
 * - `unsupported-page`: browser/extension/Web Store pages, or any non-http(s) URL (Chrome blocks capture there)
 * - `no-active-tab`: no focused tab to capture
 * - `not-implemented`: the mode is not built yet
 * - `internal`: unexpected failure (details are logged by the worker, never sent to the page)
 */
export const captureStartErrorSchema = z.enum([
  'unsupported-page',
  'no-active-tab',
  'not-implemented',
  'internal',
]);
export type CaptureStartError = z.infer<typeof captureStartErrorSchema>;

/** Worker reply to `capture/start`. */
export const captureStartResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), sessionId: z.uuid() }),
  z.object({ ok: z.literal(false), error: captureStartErrorSchema }),
]);
export type CaptureStartResult = z.infer<typeof captureStartResultSchema>;

/** Worker reply to `region/selected`, so the content script can tell the user when the capture failed. */
export const regionResultSchema = z.object({ ok: z.boolean() });
export type RegionResult = z.infer<typeof regionResultSchema>;
