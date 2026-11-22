import { describe, expect, it } from 'vitest';

import { contentScriptTabId, isExtensionPageSender } from './sender';

const ID = 'pcnamdhfehfcfcjlpgahbgkmhedblele';

describe('contentScriptTabId', () => {
  const page = { id: ID, url: 'https://example.com/', tab: { id: 7 }, frameId: 0 };

  it('returns the tab for our content script in the top frame', () => {
    expect(contentScriptTabId(page, ID)).toBe(7);
  });

  it.each([
    ['another extension', { ...page, id: 'otherextensionid' }],
    ['a subframe', { ...page, frameId: 3 }],
    ['no tab', { ...page, tab: undefined }],
    ['an extension page in a tab', { ...page, url: `chrome-extension://${ID}/editor.html` }],
  ])('rejects %s', (_name, sender) => {
    expect(contentScriptTabId(sender, ID)).toBeUndefined();
  });

  it('rejects everything when our own id is unknown', () => {
    expect(contentScriptTabId({ ...page, id: '' }, '')).toBeUndefined();
  });
});

describe('isExtensionPageSender', () => {
  it.each([`chrome-extension://${ID}/popup.html`, `chrome-extension://${ID}/editor.html#draft`])(
    'accepts our page %s',
    (url) => {
      expect(isExtensionPageSender({ id: ID, url }, ID)).toBe(true);
    },
  );

  it.each([
    ['another extension', { id: 'otherextensionid', url: 'chrome-extension://otherextensionid/x' }],
    ['our id but a web page URL (content script)', { id: ID, url: 'https://example.com/' }],
    ['our id but another extension origin', { id: ID, url: 'chrome-extension://otherid/x.html' }],
    ['look-alike origin', { id: ID, url: `chrome-extension://${ID}.evil.example/x` }],
    ['our id as a web host', { id: ID, url: `https://${ID}/x` }],
    ['our host with a port', { id: ID, url: `chrome-extension://${ID}:8080/x` }],
    ['missing id', { url: `chrome-extension://${ID}/popup.html` }],
    ['missing url', { id: ID }],
    ['unparsable url', { id: ID, url: 'not a url' }],
  ])('rejects %s', (_name, sender) => {
    expect(isExtensionPageSender(sender, ID)).toBe(false);
  });

  it('rejects everything when our own id is unknown', () => {
    expect(isExtensionPageSender({ id: '', url: 'chrome-extension:///x' }, '')).toBe(false);
  });
});
