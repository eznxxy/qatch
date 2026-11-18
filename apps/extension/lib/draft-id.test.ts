import { describe, expect, it } from 'vitest';

import { parseDraftId } from './draft-id';

const ID = '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b';

describe('parseDraftId', () => {
  it('reads a uuid from ?draft=', () => {
    expect(parseDraftId(`?draft=${ID}`)).toBe(ID);
    expect(parseDraftId(`?x=1&draft=${ID}`)).toBe(ID);
  });

  it.each(['', '?', '?draft=', '?draft=123', `?id=${ID}`, '?draft=../../etc'])(
    'ignores %j',
    (search) => {
      expect(parseDraftId(search)).toBeUndefined();
    },
  );
});
