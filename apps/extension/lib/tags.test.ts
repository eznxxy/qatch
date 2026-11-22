import { REPORT_TAG_MAX_CHARS, REPORT_TAGS_MAX_COUNT } from '@qatch/shared/config';
import { describe, expect, it } from 'vitest';

import { addTag, normalizeTag, removeTag } from './tags';

describe('tags', () => {
  it.each([
    ['  Checkout Flow ', 'checkout-flow'],
    ['payments,', 'payments'],
    ['   ', ''],
    ['x'.repeat(50), 'x'.repeat(REPORT_TAG_MAX_CHARS)],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(normalizeTag(raw)).toBe(expected);
  });

  it('adds, ignores blanks and duplicates, and stops at the limit', () => {
    expect(addTag([], 'Checkout')).toEqual(['checkout']);
    expect(addTag(['checkout'], 'CHECKOUT')).toEqual(['checkout']);
    expect(addTag(['checkout'], '  ')).toEqual(['checkout']);
    const full = Array.from({ length: REPORT_TAGS_MAX_COUNT }, (_, i) => `t${i}`);
    expect(addTag(full, 'one-more')).toEqual(full);
  });

  it('removes a tag without mutating the input', () => {
    const tags = ['a', 'b'];
    expect(removeTag(tags, 'a')).toEqual(['b']);
    expect(tags).toEqual(['a', 'b']);
  });
});
