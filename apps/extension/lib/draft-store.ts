// Drafts in IndexedDB (ADR 7). Plain IndexedDB, no wrapper library. The factory is injectable so tests can
// use fake-indexeddb; extension pages and the service worker share the same database (same origin).

import { type Draft, draftSchema } from './draft';

const DB_NAME = 'qatch';
const DB_VERSION = 1;
const DRAFTS = 'drafts';

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    };
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS, { keyPath: 'id' });
  };
  return promisify(request);
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error('IndexedDB transaction failed'));
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    };
  });
}

async function withStore<T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb(factory);
  try {
    const tx = db.transaction(DRAFTS, mode);
    const result = promisify(run(tx.objectStore(DRAFTS)));
    await transactionDone(tx);
    return await result;
  } finally {
    db.close();
  }
}

/** Saves (or replaces) a draft. Resolves once the write is committed. */
export async function putDraft(draft: Draft, factory: IDBFactory = indexedDB): Promise<void> {
  await withStore(factory, 'readwrite', (store) => store.put(draftSchema.parse(draft)));
}

/**
 * Reads, changes and writes a draft in ONE transaction, so two quick saves cannot overwrite each other.
 * Returns the saved draft, or `undefined` if it no longer exists (nothing is written then).
 */
export async function updateDraft(
  id: string,
  change: (draft: Draft) => Draft,
  factory: IDBFactory = indexedDB,
): Promise<Draft | undefined> {
  const db = await openDb(factory);
  try {
    const tx = db.transaction(DRAFTS, 'readwrite');
    const store = tx.objectStore(DRAFTS);
    const done = transactionDone(tx);

    const current = draftSchema.safeParse(await promisify<unknown>(store.get(id)));
    if (!current.success) {
      await done;
      return undefined;
    }
    const next = draftSchema.parse(change(current.data));
    if (next.id !== id) throw new Error('A draft update must not change its id');
    store.put(next);
    await done;
    return next;
  } finally {
    db.close();
  }
}

export async function deleteDraft(id: string, factory: IDBFactory = indexedDB): Promise<void> {
  await withStore(factory, 'readwrite', (store) => store.delete(id));
}

/** Loads a draft; `undefined` if missing or not a valid draft (e.g. written by an older version). */
export async function getDraft(
  id: string,
  factory: IDBFactory = indexedDB,
): Promise<Draft | undefined> {
  const raw: unknown = await withStore(factory, 'readonly', (store) => store.get(id));
  const parsed = draftSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}
