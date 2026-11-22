import { describe, expect, it } from 'vitest';

import {
  REPORT_DESCRIPTION_MAX_CHARS,
  REPORT_TAG_MAX_CHARS,
  REPORT_TAGS_MAX_COUNT,
  REPORT_TITLE_MAX_CHARS,
} from './config';
import { DEFAULT_REPORT_DETAILS, reportDetailsSchema } from './report';

describe('reportDetailsSchema', () => {
  it('accepts the defaults (empty title while drafting)', () => {
    expect(reportDetailsSchema.parse(DEFAULT_REPORT_DETAILS)).toEqual(DEFAULT_REPORT_DETAILS);
  });

  it('uses the database defaults', () => {
    expect(DEFAULT_REPORT_DETAILS.severity).toBe('medium');
    expect(DEFAULT_REPORT_DETAILS.visibility).toBe('unlisted');
  });

  it.each([
    ['unknown severity', { severity: 'blocker' }],
    ['unknown visibility', { visibility: 'team' }],
    ['long title', { title: 'x'.repeat(REPORT_TITLE_MAX_CHARS + 1) }],
    ['long description', { description: 'x'.repeat(REPORT_DESCRIPTION_MAX_CHARS + 1) }],
    [
      'too many tags',
      { tags: Array.from({ length: REPORT_TAGS_MAX_COUNT + 1 }, (_, i) => `t${i}`) },
    ],
    ['long tag', { tags: ['x'.repeat(REPORT_TAG_MAX_CHARS + 1)] }],
    ['empty tag', { tags: [''] }],
  ])('rejects %s', (_name, patch) => {
    expect(reportDetailsSchema.safeParse({ ...DEFAULT_REPORT_DETAILS, ...patch }).success).toBe(
      false,
    );
  });
});
