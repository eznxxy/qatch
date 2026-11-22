import { DEFAULT_REPORT_DETAILS } from '@qatch/shared';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { type Draft, draftSchema } from './draft';
import { deleteDraft, getDraft, putDraft, updateDraft } from './draft-store';

const ID = '0b8a3f4e-8c1d-4a2b-9f3e-1c2d3e4f5a6b';

function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: ID,
    kind: 'screenshot',
    mode: 'visible',
    createdAt: 1_000,
    page: { url: 'https://example.com/', title: 'Example' },
    image: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
    details: DEFAULT_REPORT_DETAILS,
    annotations: [],
    ...overrides,
  };
}

describe('draft store', () => {
  it('round-trips a draft including its image blob', async () => {
    const factory = new IDBFactory();
    await putDraft(makeDraft(), factory);

    const loaded = await getDraft(ID, factory);
    expect(loaded).toMatchObject({ id: ID, kind: 'screenshot', page: { title: 'Example' } });
    expect(loaded?.image).toBeInstanceOf(Blob);
    expect(loaded?.image.type).toBe('image/png');
    expect(new Uint8Array(await (loaded?.image ?? new Blob()).arrayBuffer())).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );
  });

  it('replaces a draft with the same id', async () => {
    const factory = new IDBFactory();
    await putDraft(makeDraft(), factory);
    await putDraft(makeDraft({ page: { url: 'https://example.com/', title: 'Renamed' } }), factory);
    expect((await getDraft(ID, factory))?.page.title).toBe('Renamed');
  });

  it('returns undefined for a missing draft', async () => {
    await expect(getDraft(ID, new IDBFactory())).resolves.toBeUndefined();
  });

  it('gives drafts saved before details/annotations existed the defaults', () => {
    const { details: _details, annotations: _annotations, ...legacy } = makeDraft();
    const parsed = draftSchema.parse(legacy);
    expect(parsed.details).toEqual(DEFAULT_REPORT_DETAILS);
    expect(parsed.annotations).toEqual([]);
  });

  it('updates a draft in place and returns the saved version', async () => {
    const factory = new IDBFactory();
    await putDraft(makeDraft(), factory);

    const saved = await updateDraft(
      ID,
      (draft) => ({ ...draft, details: { ...draft.details, title: 'Total shows NaN' } }),
      factory,
    );
    expect(saved?.details.title).toBe('Total shows NaN');
    expect((await getDraft(ID, factory))?.details.title).toBe('Total shows NaN');
  });

  it.each(['low', 'high', 'critical'] as const)('stores severity %s', async (severity) => {
    const factory = new IDBFactory();
    await putDraft(makeDraft(), factory);
    await updateDraft(ID, (d) => ({ ...d, details: { ...d.details, severity } }), factory);
    expect((await getDraft(ID, factory))?.details.severity).toBe(severity);
  });

  it('applies concurrent updates one after another (no lost write)', async () => {
    const factory = new IDBFactory();
    await putDraft(makeDraft(), factory);

    await Promise.all([
      updateDraft(ID, (d) => ({ ...d, details: { ...d.details, title: 'A' } }), factory),
      updateDraft(ID, (d) => ({ ...d, details: { ...d.details, tags: ['b'] } }), factory),
    ]);
    const final = await getDraft(ID, factory);
    expect(final?.details.title).toBe('A');
    expect(final?.details.tags).toEqual(['b']);
  });

  it('writes nothing when updating a missing draft', async () => {
    const factory = new IDBFactory();
    await expect(updateDraft(ID, (d) => d, factory)).resolves.toBeUndefined();
    await expect(getDraft(ID, factory)).resolves.toBeUndefined();
  });

  it('rejects an update that produces an invalid draft and keeps the old one', async () => {
    const factory = new IDBFactory();
    await putDraft(makeDraft(), factory);
    const tooLong = 'x'.repeat(10_000);
    await expect(
      updateDraft(ID, (d) => ({ ...d, details: { ...d.details, title: tooLong } }), factory),
    ).rejects.toThrow();
    expect((await getDraft(ID, factory))?.details.title).toBe('');
  });

  it('deletes a draft', async () => {
    const factory = new IDBFactory();
    await putDraft(makeDraft(), factory);
    await deleteDraft(ID, factory);
    await expect(getDraft(ID, factory)).resolves.toBeUndefined();
  });

  it('refuses to store an invalid draft', async () => {
    const factory = new IDBFactory();
    const invalid = { ...makeDraft(), id: 'not-a-uuid' };
    await expect(putDraft(invalid, factory)).rejects.toThrow();
    await expect(getDraft('not-a-uuid', factory)).resolves.toBeUndefined();
  });
});
