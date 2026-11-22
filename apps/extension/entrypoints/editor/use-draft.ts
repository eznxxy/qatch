import { useEffect, useState } from 'react';

import type { Draft } from '@/lib/draft';
import { getDraft } from '@/lib/draft-store';

export type DraftState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; draft: Draft; imageUrl: string };

/** Loads a draft from IndexedDB and owns the object URL for its image. */
export function useDraft(draftId: string | undefined): DraftState {
  const [state, setState] = useState<DraftState>(
    draftId ? { kind: 'loading' } : { kind: 'missing' },
  );

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    let imageUrl: string | undefined;

    getDraft(draftId)
      .then((draft) => {
        if (cancelled) return;
        if (!draft) {
          setState({ kind: 'missing' });
          return;
        }
        imageUrl = URL.createObjectURL(draft.image);
        setState({ kind: 'ready', draft, imageUrl });
      })
      .catch((error: unknown) => {
        console.error('[qatch] failed to load draft', error);
        if (!cancelled) setState({ kind: 'error' });
      });

    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [draftId]);

  return state;
}
