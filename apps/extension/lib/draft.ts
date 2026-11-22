import { DEFAULT_REPORT_DETAILS, deviceInfoSchema, reportDetailsSchema } from '@qatch/shared';
import { URL_MAX_CHARS } from '@qatch/shared/config';
import { z } from 'zod';

import { annotationsSchema } from './annotations';

/** Page the capture was taken from. Local only for now; redacted before upload (see PLAN P2-1). */
export const draftPageSchema = z.object({
  url: z.string().max(URL_MAX_CHARS),
  title: z.string().max(1_024),
});
export type DraftPage = z.infer<typeof draftPageSchema>;

/**
 * A capture waiting in the editor. Stored in IndexedDB (ADR 7) so it survives worker restarts, editor
 * reloads and failed uploads. Console/network/device data join it in later tasks.
 */
export const screenshotDraftSchema = z.object({
  id: z.uuid(),
  kind: z.literal('screenshot'),
  mode: z.enum(['visible', 'full', 'region']),
  /** Epoch ms. */
  createdAt: z.number().nonnegative(),
  page: draftPageSchema,
  image: z.instanceof(Blob),
  /** FR-09. Best effort: missing if the page refused script injection. */
  device: deviceInfoSchema.optional(),
  /** Form fields from the editor, auto-saved. Drafts saved before this field existed get the defaults. */
  details: reportDetailsSchema.default(DEFAULT_REPORT_DETAILS),
  /** FR-04 annotations over `image` (which stays the unmodified capture), auto-saved by the editor. */
  annotations: annotationsSchema.default([]),
});
export type ScreenshotDraft = z.infer<typeof screenshotDraftSchema>;

export const draftSchema = screenshotDraftSchema;
export type Draft = z.infer<typeof draftSchema>;
