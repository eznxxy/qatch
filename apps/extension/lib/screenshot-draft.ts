import { DEFAULT_REPORT_DETAILS, type DeviceInfo } from '@qatch/shared';
import { SCREENSHOT_MAX_BYTES } from '@qatch/shared/config';

import type { CaptureSession } from './capture-session';
import type { ScreenshotDraft } from './draft';

/** Throws unless the image is a non-empty PNG within the screenshot size limit. */
export function assertScreenshotImage(image: Blob): void {
  if (image.type !== 'image/png') throw new Error(`Unexpected screenshot type: ${image.type}`);
  if (image.size === 0) throw new Error('Empty screenshot');
  if (image.size > SCREENSHOT_MAX_BYTES) {
    throw new Error(`Screenshot is ${image.size} bytes, over ${SCREENSHOT_MAX_BYTES}`);
  }
}

export interface ScreenshotDraftInput {
  id: string;
  mode: ScreenshotDraft['mode'];
  createdAt: number;
  session: CaptureSession;
  image: Blob;
  device: DeviceInfo | undefined;
}

/** A new screenshot draft with default details. Validates the image first. */
export function buildScreenshotDraft(input: ScreenshotDraftInput): ScreenshotDraft {
  assertScreenshotImage(input.image);
  return {
    id: input.id,
    kind: 'screenshot',
    mode: input.mode,
    createdAt: input.createdAt,
    page: input.session.page,
    image: input.image,
    ...(input.device ? { device: input.device } : {}),
    details: DEFAULT_REPORT_DETAILS,
    annotations: [],
  };
}
