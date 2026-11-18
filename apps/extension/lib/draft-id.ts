import { z } from 'zod';

const draftIdSchema = z.uuid();

/** Reads `?draft=<uuid>` from a location search string; anything else is ignored. */
export function parseDraftId(search: string): string | undefined {
  const parsed = draftIdSchema.safeParse(new URLSearchParams(search).get('draft'));
  return parsed.success ? parsed.data : undefined;
}
