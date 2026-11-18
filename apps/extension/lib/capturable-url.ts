// Chrome blocks screenshots and script injection on its own pages and the Web Store, and activeTab does not
// cover file:// without an extra user toggle. Only ordinary web pages are capturable.

const WEB_STORE_HOSTS = new Set(['chromewebstore.google.com']);

/** True for http(s) pages Chrome lets an extension capture; false for anything else or an unknown URL. */
export function isCapturableUrl(url: string | undefined): boolean {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (WEB_STORE_HOSTS.has(parsed.hostname)) return false;
  if (parsed.hostname === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) {
    return false;
  }
  return true;
}
