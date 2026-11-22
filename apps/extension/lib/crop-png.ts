// Crops a PNG with OffscreenCanvas. Works in the service worker (no DOM needed), so region capture does not
// need the offscreen document or its permission.

import type { RegionRect } from '@qatch/shared';

import { regionToPixels } from './region-geometry';

export async function cropPng(image: Blob, rect: RegionRect): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const crop = regionToPixels(rect, { w: bitmap.width, h: bitmap.height });
    if (!crop) throw new Error('Selected region is outside the screenshot');

    const canvas = new OffscreenCanvas(crop.sw, crop.sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
    return await canvas.convertToBlob({ type: 'image/png' });
  } finally {
    bitmap.close();
  }
}
