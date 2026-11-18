// Sender checks for runtime messages (SECURITY_PRIVACY §4). Pure, so they can be unit tested.

/** The fields of chrome.runtime.MessageSender these checks rely on. */
export interface SenderLike {
  id?: string | undefined;
  url?: string | undefined;
  tab?: { id?: number | undefined } | undefined;
  frameId?: number | undefined;
}

/**
 * The tab id when the sender is our own content script in a tab's top frame, else `undefined`. Web pages
 * cannot message us (no `externally_connectable`), so our id plus a tab means our content script. Its
 * messages still carry page-influenced data and are validated by the receiver.
 */
export function contentScriptTabId(sender: SenderLike, extensionId: string): number | undefined {
  if (!extensionId || sender.id !== extensionId) return undefined;
  if (sender.frameId !== 0 || sender.tab?.id === undefined) return undefined;
  if (isExtensionPageSender(sender, extensionId)) return undefined;
  return sender.tab.id;
}

/**
 * True only for our own extension pages (popup, editor, offscreen). Content scripts share our extension `id`
 * but report the web page's URL, so the origin check is what excludes them.
 */
export function isExtensionPageSender(sender: SenderLike, extensionId: string): boolean {
  if (!extensionId || sender.id !== extensionId || !sender.url) return false;
  try {
    // Compare scheme and host, not `.origin`: the WHATWG parser reports origin "null" for non-special schemes
    // like chrome-extension: outside Chrome, and `host` also rejects look-alikes and ports.
    const url = new URL(sender.url);
    return url.protocol === 'chrome-extension:' && url.host === extensionId;
  } catch {
    return false;
  }
}
