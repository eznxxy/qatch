import { describe, expect, it, vi } from 'vitest';

import {
  discardClosedEditorDraft,
  type EditorTabs,
  editorTabsSchema,
  type EditorTabsStore,
  rememberEditorTab,
} from './editor-tabs';

const DRAFT_A = '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b';
const DRAFT_B = '1c9b4f5e-9d2e-4b3c-8f4e-2d3e4f5a6b7c';

function memoryStore(initial: EditorTabs = {}): EditorTabsStore & { tabs: EditorTabs } {
  const store = {
    tabs: initial,
    load: () => Promise.resolve({ ...store.tabs }),
    save: (tabs: EditorTabs) => {
      store.tabs = tabs;
      return Promise.resolve();
    },
  };
  return store;
}

describe('rememberEditorTab', () => {
  it('adds the tab without dropping others', async () => {
    const store = memoryStore({ '1': DRAFT_A });
    await rememberEditorTab(store, 2, DRAFT_B);
    expect(store.tabs).toEqual({ '1': DRAFT_A, '2': DRAFT_B });
  });
});

describe('discardClosedEditorDraft', () => {
  it('deletes the draft of a closed editor tab and forgets the tab', async () => {
    const store = memoryStore({ '1': DRAFT_A, '2': DRAFT_B });
    const deleteDraft = vi.fn(() => Promise.resolve());

    const deleted = await discardClosedEditorDraft(1, { store, deleteDraft, logError: vi.fn() });

    expect(deleted).toBe(DRAFT_A);
    expect(deleteDraft).toHaveBeenCalledWith(DRAFT_A);
    expect(store.tabs).toEqual({ '2': DRAFT_B });
  });

  it('ignores tabs that are not editors', async () => {
    const store = memoryStore({ '1': DRAFT_A });
    const deleteDraft = vi.fn(() => Promise.resolve());

    await expect(
      discardClosedEditorDraft(9, { store, deleteDraft, logError: vi.fn() }),
    ).resolves.toBeUndefined();
    expect(deleteDraft).not.toHaveBeenCalled();
    expect(store.tabs).toEqual({ '1': DRAFT_A });
  });

  it('keeps the mapping when the delete fails, so a later close can retry, and never throws', async () => {
    const store = memoryStore({ '1': DRAFT_A });
    const logError = vi.fn();

    const deleted = await discardClosedEditorDraft(1, {
      store,
      deleteDraft: () => Promise.reject(new Error('IndexedDB down')),
      logError,
    });

    expect(deleted).toBeUndefined();
    expect(logError).toHaveBeenCalledOnce();
    expect(store.tabs).toEqual({ '1': DRAFT_A });
  });
});

describe('editorTabsSchema', () => {
  it('accepts tab id -> draft uuid and rejects anything else', () => {
    expect(editorTabsSchema.safeParse({ '3': DRAFT_A }).success).toBe(true);
    expect(editorTabsSchema.safeParse({ '3': 'not-a-uuid' }).success).toBe(false);
    expect(editorTabsSchema.safeParse([DRAFT_A]).success).toBe(false);
  });
});
