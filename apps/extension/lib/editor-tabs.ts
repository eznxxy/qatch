// P1-6: a draft lives exactly as long as its editor tab. Reloading the editor (or a worker restart) keeps it;
// closing the tab deletes it, so nothing unshared stays on the device. Which tab shows which draft is kept in
// chrome.storage.session, because the worker can be killed between opening the editor and the tab closing.

import { z } from 'zod';

export const EDITOR_TABS_KEY = 'qatch:editorTabs';

/** Editor tab id (as a string key) -> draft id. */
export const editorTabsSchema = z.record(z.string(), z.uuid());
export type EditorTabs = z.infer<typeof editorTabsSchema>;

export interface EditorTabsStore {
  load: () => Promise<EditorTabs>;
  save: (tabs: EditorTabs) => Promise<void>;
}

/** Records that `tabId` shows `draftId`. */
export async function rememberEditorTab(
  store: EditorTabsStore,
  tabId: number,
  draftId: string,
): Promise<void> {
  const tabs = await store.load();
  await store.save({ ...tabs, [String(tabId)]: draftId });
}

/**
 * Called for every closed tab: if it was an editor, deletes its draft and forgets the tab. Returns the
 * deleted draft id, if any. Never throws.
 */
export async function discardClosedEditorDraft(
  tabId: number,
  deps: {
    store: EditorTabsStore;
    deleteDraft: (draftId: string) => Promise<void>;
    logError: (error: unknown) => void;
  },
): Promise<string | undefined> {
  try {
    const tabs = await deps.store.load();
    const key = String(tabId);
    const draftId = tabs[key];
    if (draftId === undefined) return undefined;
    await deps.deleteDraft(draftId);
    const { [key]: _closed, ...rest } = tabs;
    await deps.store.save(rest);
    return draftId;
  } catch (error) {
    deps.logError(error);
    return undefined;
  }
}
