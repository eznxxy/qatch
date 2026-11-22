import { REPORT_TAG_MAX_CHARS, REPORT_TAGS_MAX_COUNT } from '@qatch/shared/config';

/** "  Checkout Flow " -> "checkout-flow". Empty if nothing usable is left. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/,/g, '')
    .slice(0, REPORT_TAG_MAX_CHARS);
}

/** Adds a tag unless it is empty, a duplicate, or the list is full. Returns a new array. */
export function addTag(tags: readonly string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || tags.includes(tag) || tags.length >= REPORT_TAGS_MAX_COUNT) return [...tags];
  return [...tags, tag];
}

export function removeTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((t) => t !== tag);
}
