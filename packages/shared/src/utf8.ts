// Dependency-free so it can be bundled into the MAIN-world script (injected.ts).

/**
 * UTF-8 byte length of a string (what a body cap in bytes actually measures), computed without allocating
 * an encoded copy. Matches `TextEncoder`: lone surrogates count as U+FFFD (3 bytes).
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4; // valid surrogate pair: one astral code point
        i++;
      } else {
        bytes += 3; // lone high surrogate
      }
    } else {
      bytes += 3; // BMP (incl. lone surrogates)
    }
  }
  return bytes;
}
