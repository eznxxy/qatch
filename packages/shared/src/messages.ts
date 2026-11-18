// Message contracts between extension contexts (ARCHITECTURE §4).
// `page/*` messages originate in the page's MAIN world and are untrusted: receivers must parse them with
// `msgSchema` (never act on them). The per-session nonce envelope is added with the bridge in P2-4.

import { z } from 'zod';

import { consoleEntrySchema, networkEntrySchema } from './capture';

export const captureModeSchema = z.enum(['visible', 'full', 'region', 'record']);
export type CaptureMode = z.infer<typeof captureModeSchema>;

/** Region in CSS pixels plus the devicePixelRatio needed for the crop (FR-03). */
export const regionRectSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  w: z.number().positive(),
  h: z.number().positive(),
  dpr: z.number().positive().max(16),
});
export type RegionRect = z.infer<typeof regionRectSchema>;

export const msgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('capture/start'), mode: captureModeSchema }),
  z.object({ t: z.literal('capture/stop') }),
  z.object({ t: z.literal('page/console'), entry: consoleEntrySchema }),
  z.object({ t: z.literal('page/network'), entry: networkEntrySchema }),
  z.object({ t: z.literal('region/selected'), rect: regionRectSchema }),
  z.object({ t: z.literal('draft/ready'), draftId: z.uuid() }),
]);
export type Msg = z.infer<typeof msgSchema>;
export type MsgType = Msg['t'];
/** The message variant for a given `t`, e.g. `MsgOf<'capture/start'>`. */
export type MsgOf<T extends MsgType> = Extract<Msg, { t: T }>;
