import { useCallback, useEffect, useRef, useState } from 'react';

import type { Draft } from '@/lib/draft';
import { updateDraft } from '@/lib/draft-store';

export type SaveStatus = 'saved' | 'saving' | 'error';

const SAVE_DELAY_MS = 400;

/**
 * Saves one part of the draft (IndexedDB) shortly after each change, when the tab is hidden, and on unmount.
 * Only the latest value is written; saves are serialized by `updateDraft`'s transaction.
 */
export function useDraftSaver<T>(draftId: string, write: (draft: Draft, value: T) => Draft) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const pending = useRef<{ value: T } | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const writeRef = useRef(write);
  useEffect(() => {
    writeRef.current = write;
  }, [write]);

  const hasPending = useCallback(() => pending.current !== undefined, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = undefined;
    try {
      await updateDraft(draftId, (draft) => writeRef.current(draft, next.value));
      // A newer change may have arrived during the await; keep showing "Saving…" for it.
      if (!hasPending()) setStatus('saved');
    } catch (error) {
      console.error('[qatch] failed to save draft', error);
      setStatus('error');
    }
  }, [draftId, hasPending]);

  const save = useCallback(
    (value: T) => {
      pending.current = { value };
      setStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  return { save, status };
}

/** The most urgent of several statuses: an error, then a save in progress. */
export function combineSaveStatus(...statuses: SaveStatus[]): SaveStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('saving')) return 'saving';
  return 'saved';
}
