import { describe, expect, it } from 'vitest';

import { isCapturableUrl } from './capturable-url';

describe('isCapturableUrl', () => {
  it.each([
    'https://example.com/',
    'http://localhost:3000/app?x=1',
    'https://chrome.google.com/search', // only /webstore is blocked
  ])('allows %s', (url) => {
    expect(isCapturableUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'not a url',
    'chrome://settings',
    'chrome-extension://abc/popup.html',
    'edge://newtab',
    'about:blank',
    'view-source:https://example.com',
    'devtools://devtools/bundled/inspector.html',
    'file:///C:/page.html',
    'data:text/html,<p>x</p>',
    'https://chromewebstore.google.com/detail/x',
    'https://chrome.google.com/webstore/detail/x',
  ])('blocks %s', (url) => {
    expect(isCapturableUrl(url)).toBe(false);
  });
});
