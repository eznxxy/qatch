import type { CaptureStartError } from '@qatch/shared';

export type ScreenshotMode = 'visible' | 'full' | 'region';

export interface ScreenshotOption {
  mode: ScreenshotMode;
  label: string;
  hint: string;
}

export const SCREENSHOT_OPTIONS: readonly ScreenshotOption[] = [
  { mode: 'visible', label: 'Visible area', hint: 'What you see right now' },
  { mode: 'full', label: 'Full page', hint: 'Scrolls and stitches the whole page' },
  { mode: 'region', label: 'Select region', hint: 'Drag to pick an area' },
];

export const RECORD_SOURCES = [
  { id: 'tab', label: 'This tab' },
  { id: 'window', label: 'Window' },
  { id: 'screen', label: 'Screen' },
] as const;

export const RECORD_HELP =
  'Start, reproduce the bug, then stop. Console, network and device info are captured the whole time. Max 30 min.';

export const ERROR_MESSAGES: Record<CaptureStartError, string> = {
  'unsupported-page':
    "Qatch can't capture this page. Browser pages and the Web Store are protected. Open a website and try again.",
  'no-active-tab': 'No active tab found. Click a tab, then try again.',
  'not-implemented': "This capture mode isn't available yet.",
  internal: 'Something went wrong. Please try again.',
};

/** Plain-language note on what is captured (SECURITY_PRIVACY §3). */
export const PRIVACY_NOTE =
  'Nothing is captured until you click. Tokens, cookies and passwords are redacted before data leaves the page.';
