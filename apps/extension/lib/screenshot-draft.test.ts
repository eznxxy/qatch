import { DEFAULT_REPORT_DETAILS } from '@qatch/shared';
import { describe, expect, it } from 'vitest';

import type { CaptureSession } from './capture-session';
import { buildScreenshotDraft } from './screenshot-draft';

const session: CaptureSession = {
  id: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b',
  tabId: 7,
  windowId: 3,
  mode: 'region',
  page: { url: 'https://example.com/', title: 'Example' },
  startedAt: 500,
};
const PNG = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

describe('buildScreenshotDraft', () => {
  it('builds a draft with default details and no device key when unknown', () => {
    const draft = buildScreenshotDraft({
      id: 'id',
      mode: 'region',
      createdAt: 1,
      session,
      image: PNG,
      device: undefined,
    });
    expect(draft).toEqual({
      id: 'id',
      kind: 'screenshot',
      mode: 'region',
      createdAt: 1,
      page: session.page,
      image: PNG,
      details: DEFAULT_REPORT_DETAILS,
      annotations: [],
    });
    expect(draft).not.toHaveProperty('device');
  });
});
