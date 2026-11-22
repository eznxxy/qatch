import { DEFAULT_REPORT_DETAILS } from '@qatch/shared';
import { describe, expect, it } from 'vitest';

import type { Annotation } from './annotations';
import { hasWorkToLose } from './work-to-lose';

const RECT: Annotation = {
  id: '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b',
  type: 'rect',
  x: 1,
  y: 2,
  w: 30,
  h: 40,
  color: '#E5484D',
  stroke: 4,
};

describe('hasWorkToLose', () => {
  it('is false for a bare screenshot', () => {
    expect(hasWorkToLose([], DEFAULT_REPORT_DETAILS)).toBe(false);
  });

  it('ignores whitespace-only text and changed severity/visibility', () => {
    const details = {
      ...DEFAULT_REPORT_DETAILS,
      title: '   ',
      description: '\n',
      severity: 'critical' as const,
      visibility: 'private' as const,
    };
    expect(hasWorkToLose([], details)).toBe(false);
  });

  it.each([
    ['an annotation', [RECT], DEFAULT_REPORT_DETAILS],
    ['a title', [], { ...DEFAULT_REPORT_DETAILS, title: 'Total shows NaN' }],
    ['a description', [], { ...DEFAULT_REPORT_DETAILS, description: 'Steps…' }],
    ['a tag', [], { ...DEFAULT_REPORT_DETAILS, tags: ['checkout'] }],
  ])('is true with %s', (_name, annotations, details) => {
    expect(hasWorkToLose(annotations, details)).toBe(true);
  });
});
