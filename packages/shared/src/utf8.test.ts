import { describe, expect, it } from 'vitest';

import { utf8ByteLength } from './utf8';

describe('utf8ByteLength', () => {
  it.each([
    ['', 0],
    ['abc', 3], // 1 byte each
    ['é', 2], // U+00E9
    ['€', 3], // U+20AC
    ['日本', 6],
    ['😀', 4], // surrogate pair
    ['a😀é€', 1 + 4 + 2 + 3],
    ['\uD83D', 3], // lone high surrogate -> U+FFFD
    ['\uDE00', 3], // lone low surrogate -> U+FFFD
    ['\uD83Dx', 3 + 1], // high surrogate not followed by a low one
  ])('%j is %i bytes', (value, expected) => {
    expect(utf8ByteLength(value)).toBe(expected);
  });
});
