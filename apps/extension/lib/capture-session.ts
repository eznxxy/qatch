import { captureModeSchema } from '@qatch/shared';
import { z } from 'zod';

import { draftPageSchema } from './draft';

/**
 * The capture in progress. Persisted to chrome.storage.session because the service worker can be killed
 * between events (AGENTS.md); later steps (crop, recording stop) read it back.
 */
export const captureSessionSchema = z.object({
  id: z.uuid(),
  tabId: z.number().int().nonnegative(),
  windowId: z.number().int(),
  mode: captureModeSchema,
  page: draftPageSchema,
  /** Epoch ms. */
  startedAt: z.number().nonnegative(),
});
export type CaptureSession = z.infer<typeof captureSessionSchema>;

export const CAPTURE_SESSION_KEY = 'qatch:captureSession';
