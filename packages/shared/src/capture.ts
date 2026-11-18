// Captured-data contracts (API_AND_DATA §2). Schemas are the source of truth; types are inferred from them.
// Every string and collection is bounded, because this data comes from untrusted pages.
// Objects strip unknown keys, so extra fields smuggled in by a page are dropped, not stored.

import { z } from 'zod';

import {
  BODY_MAX_BYTES,
  CONSOLE_MAX_ENTRIES,
  CONSOLE_MESSAGE_MAX_CHARS,
  HEADER_NAME_MAX_CHARS,
  HEADER_VALUE_MAX_CHARS,
  HEADERS_MAX_COUNT,
  NETWORK_MAX_ENTRIES,
  STACK_MAX_CHARS,
  URL_MAX_CHARS,
} from './config';
import { utf8ByteLength } from './utf8';

/** Milliseconds since capture start (or a duration): non-negative (Zod 4 numbers already reject Infinity). */
const msSchema = z.number().nonnegative();

const capturedUrlSchema = z.string().min(1).max(URL_MAX_CHARS);

const bodySchema = z.string().refine((body) => utf8ByteLength(body) <= BODY_MAX_BYTES, {
  error: `Body exceeds ${BODY_MAX_BYTES} bytes`,
});

export const headersSchema = z
  .record(z.string().min(1).max(HEADER_NAME_MAX_CHARS), z.string().max(HEADER_VALUE_MAX_CHARS))
  .refine((headers) => Object.keys(headers).length <= HEADERS_MAX_COUNT, {
    error: `More than ${HEADERS_MAX_COUNT} headers`,
  });

// --- Console ---

export const consoleLevelSchema = z.enum(['log', 'info', 'warn', 'error', 'debug']);
export type ConsoleLevel = z.infer<typeof consoleLevelSchema>;

export const consoleSourceSchema = z.enum(['console', 'onerror', 'unhandledrejection']);
export type ConsoleSource = z.infer<typeof consoleSourceSchema>;

export const consoleEntrySchema = z.object({
  ts: msSchema,
  level: consoleLevelSchema,
  message: z.string().max(CONSOLE_MESSAGE_MAX_CHARS),
  stack: z.string().max(STACK_MAX_CHARS).optional(),
  source: consoleSourceSchema.optional(),
});
export type ConsoleEntry = z.infer<typeof consoleEntrySchema>;

export const consoleEntriesSchema = z.array(consoleEntrySchema).max(CONSOLE_MAX_ENTRIES);

// --- Network ---

export const networkInitiatorSchema = z.enum(['fetch', 'xhr']);
export type NetworkInitiator = z.infer<typeof networkInitiatorSchema>;

export const networkEntrySchema = z.object({
  id: z.string().min(1).max(64),
  ts: msSchema,
  durationMs: msSchema,
  method: z.string().min(1).max(32),
  /** Query-string secrets already redacted at the source. */
  url: capturedUrlSchema,
  /** HTTP status; 0 = failed or aborted. */
  status: z.number().int().min(0).max(999),
  statusText: z.string().max(256).optional(),
  initiator: networkInitiatorSchema,
  requestHeaders: headersSchema,
  responseHeaders: headersSchema,
  /** Text/JSON only, capped at BODY_MAX_BYTES. */
  requestBody: bodySchema.optional(),
  responseBody: bodySchema.optional(),
  bodyTruncated: z.boolean().optional(),
  error: z.string().max(CONSOLE_MESSAGE_MAX_CHARS).optional(),
});
export type NetworkEntry = z.infer<typeof networkEntrySchema>;

export const networkEntriesSchema = z.array(networkEntrySchema).max(NETWORK_MAX_ENTRIES);

// --- Device ---

const shortText = z.string().max(256);
const pixels = z.number().int().nonnegative().max(100_000);

export const deviceInfoSchema = z.object({
  userAgent: z.string().max(1_024),
  browser: z.object({ name: shortText, version: shortText }),
  os: z.object({ name: shortText, version: shortText.optional() }),
  viewport: z.object({ w: pixels, h: pixels }),
  screen: z.object({ w: pixels, h: pixels }),
  dpr: z.number().positive().max(16),
  language: z.string().max(64),
  timeZone: z.string().max(64),
  url: capturedUrlSchema,
  connection: z
    .object({
      effectiveType: z.string().max(16).optional(),
      downlink: z.number().nonnegative().optional(),
      rtt: z.number().nonnegative().optional(),
    })
    .optional(),
  /** ISO 8601 timestamp. */
  capturedAt: z.iso.datetime({ offset: true }),
});
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;
