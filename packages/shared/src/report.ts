// Report details the user fills in before sharing (API_AND_DATA §1 `reports`, §3 POST /api/reports).

import { z } from 'zod';

import {
  REPORT_DESCRIPTION_MAX_CHARS,
  REPORT_TAG_MAX_CHARS,
  REPORT_TAGS_MAX_COUNT,
  REPORT_TITLE_MAX_CHARS,
} from './config';

export const severitySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof severitySchema>;

export const visibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type Visibility = z.infer<typeof visibilitySchema>;

/**
 * Editable details. The title may be empty while drafting; it is required (non-blank) when the report is
 * submitted (P3-5).
 */
export const reportDetailsSchema = z.object({
  title: z.string().max(REPORT_TITLE_MAX_CHARS),
  description: z.string().max(REPORT_DESCRIPTION_MAX_CHARS),
  severity: severitySchema,
  tags: z.array(z.string().min(1).max(REPORT_TAG_MAX_CHARS)).max(REPORT_TAGS_MAX_COUNT),
  visibility: visibilitySchema,
});
export type ReportDetails = z.infer<typeof reportDetailsSchema>;

/** Matches the database defaults (severity `medium`, visibility `unlisted`). */
export const DEFAULT_REPORT_DETAILS: ReportDetails = {
  title: '',
  description: '',
  severity: 'medium',
  tags: [],
  visibility: 'unlisted',
};
