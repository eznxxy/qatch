import { describe, expect, it } from 'vitest';

import { editorCommandFor, type KeyLike } from './editor-shortcuts';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('editorCommandFor', () => {
  it.each<[string, KeyLike, string | undefined]>([
    ['Ctrl+Z', key('z', { ctrlKey: true }), 'undo'],
    ['Cmd+Z', key('z', { metaKey: true }), 'undo'],
    ['Ctrl+Shift+Z', key('Z', { ctrlKey: true, shiftKey: true }), 'redo'],
    ['Ctrl+Y', key('y', { ctrlKey: true }), 'redo'],
    ['Delete', key('Delete'), 'delete'],
    ['Backspace', key('Backspace'), 'delete'],
    ['plain z', key('z'), undefined],
    ['Ctrl+Alt+Z', key('z', { ctrlKey: true, altKey: true }), undefined],
    ['Ctrl+Delete', key('Delete', { ctrlKey: true }), undefined],
  ])('%s', (_name, event, expected) => {
    expect(editorCommandFor(event, false)).toBe(expected);
  });

  it('leaves every key to a focused text field', () => {
    expect(editorCommandFor(key('z', { ctrlKey: true }), true)).toBeUndefined();
    expect(editorCommandFor(key('Backspace'), true)).toBeUndefined();
  });
});
