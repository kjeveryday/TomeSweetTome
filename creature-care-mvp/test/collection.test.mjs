import test from 'node:test';
import assert from 'node:assert/strict';

import { creatureIdForIdentity, isCareState, isCreatureRecord } from '../src/contracts.js';
import {
  freshCareState,
  previewForBook,
  revealForReading,
  selectActiveCreature,
  validateCollectionState
} from '../src/systems/collection.js';
import { content } from './helpers.mjs';

function bookInput(overrides = {}) {
  return {
    workId: 'work:1',
    identityVersion: 'stacklings:v1',
    identityKey: '9780064400558',
    baseTraits: { palette: 'moss' },
    ...overrides
  };
}

function mapOf(...records) {
  return Object.fromEntries(records.map((record) => [record.id, record]));
}

function unrevealedCreature(overrides = {}) {
  const preview = previewForBook(bookInput(overrides), {});
  assert.equal(preview.ok, true);
  assert.equal(preview.alreadyExists, false);
  return preview.record;
}

// --- previewForBook ---------------------------------------------------

test('scan-only preview creates a valid unrevealed record on first sight, and reports alreadyExists on the next scan without changing it', () => {
  const first = previewForBook(bookInput(), {});
  assert.equal(first.ok, true);
  assert.equal(first.alreadyExists, false);
  assert.equal(first.creatureId, creatureIdForIdentity('stacklings:v1', '9780064400558'));
  assert.equal(isCreatureRecord(first.record), true);
  assert.equal(first.record.revealed, false);
  assert.deepEqual(first.record.baseTraits, { palette: 'moss' });
  assert.deepEqual(first.record.relationshipDayKeys, []);
  assert.equal(first.record.finished, false);
  assert.deepEqual(first.record.careState, { status: 'uninitialized' });

  const existing = mapOf(first.record);
  const second = previewForBook(bookInput(), existing);
  assert.deepEqual(second, { ok: true, alreadyExists: true, creatureId: first.creatureId });
});

test('previewForBook does not mutate baseTraits input and clones it into the record', () => {
  const traits = { palette: 'moss' };
  const result = previewForBook(bookInput({ baseTraits: traits }), {});
  result.record.baseTraits.palette = 'changed';
  assert.equal(traits.palette, 'moss');
});

test('repeated scans never change the creature id for the same identity, whether the record is unrevealed or already revealed', () => {
  const preview = previewForBook(bookInput(), {});
  const unrevealedMap = mapOf(preview.record);
  assert.equal(previewForBook(bookInput(), unrevealedMap).creatureId, preview.creatureId);

  const revealedMap = mapOf({ ...preview.record, revealed: true });
  assert.equal(previewForBook(bookInput(), revealedMap).creatureId, preview.creatureId);
});

test('an alias that resolves to the same canonical identity as a prior scan yields the same creature id, not a duplicate', () => {
  // Two different raw scans (e.g. a barcode retry, or a provider re-lookup) that the
  // caller has already resolved to the identical canonical identityVersion/identityKey.
  const firstAliasScan = previewForBook(bookInput({ workId: 'work:1' }), {});
  const existing = mapOf(firstAliasScan.record);
  const secondAliasScan = previewForBook(bookInput({ workId: 'work:1' }), existing);
  assert.equal(secondAliasScan.alreadyExists, true);
  assert.equal(secondAliasScan.creatureId, firstAliasScan.creatureId);
  assert.equal(Object.keys(existing).length, 1);
});

test('previewForBook rejects malformed input without throwing', () => {
  assert.equal(previewForBook(bookInput({ workId: '' }), {}).reason, 'invalidWorkId');
  assert.equal(previewForBook(bookInput({ workId: 42 }), {}).reason, 'invalidWorkId');
  assert.equal(previewForBook(bookInput({ identityVersion: '' }), {}).reason, 'invalidIdentityVersion');
  assert.equal(previewForBook(bookInput({ identityKey: '' }), {}).reason, 'invalidIdentityKey');
  assert.equal(previewForBook(bookInput({ baseTraits: null }), {}).reason, 'invalidBaseTraits');
  assert.equal(previewForBook(bookInput({ baseTraits: ['a'] }), {}).reason, 'invalidBaseTraits');
  assert.equal(previewForBook(bookInput(), null).reason, 'invalidExistingCreatures');
  assert.equal(previewForBook().reason, 'invalidWorkId');
});

// --- revealForReading ---------------------------------------------------

test('first-reading reveal returns exactly one reveal payload for the unrevealed creature of that work', () => {
  const creature = unrevealedCreature({ workId: 'work:1' });
  const result = revealForReading({ workId: 'work:1', readingRecordId: 'reading:1' }, mapOf(creature));
  assert.deepEqual(result, {
    ok: true,
    reveals: [{ creatureId: creature.id, workId: 'work:1', readingRecordId: 'reading:1' }]
  });
});

test('revealForReading is a no-op, not an error, when there is no unrevealed creature for the work', () => {
  assert.deepEqual(revealForReading({ workId: 'work:none', readingRecordId: 'reading:1' }, {}), { ok: true, reveals: [] });

  const revealed = { ...unrevealedCreature({ workId: 'work:1' }), revealed: true };
  assert.deepEqual(
    revealForReading({ workId: 'work:1', readingRecordId: 'reading:1' }, mapOf(revealed)),
    { ok: true, reveals: [] }
  );
});

test('revealForReading handles more than one unrevealed creature for a work without throwing, revealing all of them', () => {
  const a = unrevealedCreature({ workId: 'work:dup', identityKey: '9780064400558' });
  const b = { ...unrevealedCreature({ workId: 'work:dup', identityKey: '9780399226908' }) };
  const result = revealForReading({ workId: 'work:dup', readingRecordId: 'reading:9' }, mapOf(a, b));
  assert.equal(result.ok, true);
  assert.equal(result.reveals.length, 2);
  assert.deepEqual(new Set(result.reveals.map((r) => r.creatureId)), new Set([a.id, b.id]));
  for (const reveal of result.reveals) {
    assert.equal(reveal.workId, 'work:dup');
    assert.equal(reveal.readingRecordId, 'reading:9');
  }
});

test('several same-day reveals for different works each produce their own single-item reveal without conflating creatures', () => {
  const creatureA = unrevealedCreature({ workId: 'work:a', identityKey: '9780064400558' });
  const creatureB = unrevealedCreature({ workId: 'work:b', identityKey: '9780399226908' });
  const existing = mapOf(creatureA, creatureB);

  const revealA = revealForReading({ workId: 'work:a', readingRecordId: 'reading:a' }, existing);
  const revealB = revealForReading({ workId: 'work:b', readingRecordId: 'reading:b' }, existing);

  assert.deepEqual(revealA.reveals, [{ creatureId: creatureA.id, workId: 'work:a', readingRecordId: 'reading:a' }]);
  assert.deepEqual(revealB.reveals, [{ creatureId: creatureB.id, workId: 'work:b', readingRecordId: 'reading:b' }]);
  assert.notEqual(revealA.reveals[0].creatureId, revealB.reveals[0].creatureId);
});

test('revealForReading rejects malformed input without throwing', () => {
  assert.equal(revealForReading({ workId: '', readingRecordId: 'reading:1' }, {}).reason, 'invalidWorkId');
  assert.equal(revealForReading({ workId: 'work:1', readingRecordId: '' }, {}).reason, 'invalidReadingRecordId');
  assert.equal(revealForReading({ workId: 'work:1', readingRecordId: 'reading:1' }, null).reason, 'invalidExistingCreatures');
  assert.equal(revealForReading().reason, 'invalidWorkId');
});

// --- selectActiveCreature ---------------------------------------------------

test('moving an archived creature into active removes it from archived and adds it to visible', () => {
  const result = selectActiveCreature({
    creatureId: 'creature:c3',
    activeCreatureId: 'creature:c1',
    visibleCreatureIds: ['creature:c1', 'creature:c2'],
    archivedCreatureIds: ['creature:c3']
  }, 5);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(result.archivedCreatureIds, []);
  assert.deepEqual(result.visibleCreatureIds, ['creature:c1', 'creature:c2', 'creature:c3']);
});

test('switching among already-visible creatures leaves archived untouched', () => {
  const result = selectActiveCreature({
    creatureId: 'creature:c2',
    activeCreatureId: 'creature:c1',
    visibleCreatureIds: ['creature:c1', 'creature:c2'],
    archivedCreatureIds: ['creature:c9']
  }, 5);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(result.archivedCreatureIds, ['creature:c9']);
  assert.deepEqual(new Set(result.visibleCreatureIds), new Set(['creature:c1', 'creature:c2']));
});

test('exceeding the visible limit evicts the oldest non-target visible entries into archived, never the creature becoming active', () => {
  const result = selectActiveCreature({
    creatureId: 'creature:new',
    activeCreatureId: 'creature:c1',
    visibleCreatureIds: ['creature:c1', 'creature:c2', 'creature:c3'],
    archivedCreatureIds: []
  }, 3);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(result.archivedCreatureIds, ['creature:c1']);
  assert.deepEqual(result.visibleCreatureIds, ['creature:c2', 'creature:c3', 'creature:new']);
  assert.equal(result.visibleCreatureIds.includes('creature:new'), true);
  assert.equal(result.archivedCreatureIds.includes('creature:new'), false);
});

test('eviction can remove more than one entry to satisfy the limit, still preserving the new active id', () => {
  const result = selectActiveCreature({
    creatureId: 'creature:new',
    activeCreatureId: null,
    visibleCreatureIds: ['creature:c1', 'creature:c2', 'creature:c3', 'creature:c4'],
    archivedCreatureIds: []
  }, 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.archivedCreatureIds, ['creature:c1', 'creature:c2', 'creature:c3']);
  assert.deepEqual(result.visibleCreatureIds, ['creature:c4', 'creature:new']);
});

test('switching to the already-active id is a no-op', () => {
  const result = selectActiveCreature({
    creatureId: 'creature:c1',
    activeCreatureId: 'creature:c1',
    visibleCreatureIds: ['creature:c1', 'creature:c2'],
    archivedCreatureIds: ['creature:c3']
  }, 5);
  assert.deepEqual(result, { ok: true, changed: false });
});

test('selectActiveCreature does not mutate its input arrays', () => {
  const visibleCreatureIds = ['creature:c1', 'creature:c2'];
  const archivedCreatureIds = ['creature:c3'];
  selectActiveCreature({
    creatureId: 'creature:c3', activeCreatureId: 'creature:c1', visibleCreatureIds, archivedCreatureIds
  }, 2);
  assert.deepEqual(visibleCreatureIds, ['creature:c1', 'creature:c2']);
  assert.deepEqual(archivedCreatureIds, ['creature:c3']);
});

test('selectActiveCreature rejects malformed input without throwing', () => {
  const valid = { creatureId: 'creature:c1', activeCreatureId: null, visibleCreatureIds: [], archivedCreatureIds: [] };
  assert.equal(selectActiveCreature({ ...valid, creatureId: '' }, 3).reason, 'invalidCreatureId');
  assert.equal(selectActiveCreature({ ...valid, creatureId: 7 }, 3).reason, 'invalidCreatureId');
  assert.equal(selectActiveCreature({ ...valid, visibleCreatureIds: ['a', 'a'] }, 3).reason, 'invalidVisibleCreatureIds');
  assert.equal(selectActiveCreature({ ...valid, archivedCreatureIds: ['a', 'a'] }, 3).reason, 'invalidArchivedCreatureIds');
  assert.equal(selectActiveCreature(valid, 0).reason, 'invalidVisibleLimit');
  assert.equal(selectActiveCreature(valid, -1).reason, 'invalidVisibleLimit');
  assert.equal(selectActiveCreature(valid, 1.5).reason, 'invalidVisibleLimit');
  assert.equal(selectActiveCreature(valid, '3').reason, 'invalidVisibleLimit');
  assert.equal(selectActiveCreature().reason, 'invalidCreatureId');
});

// --- freshCareState ---------------------------------------------------

test('freshCareState is a valid, nonpunitive baseline matching content stats and stage 1', () => {
  const state = freshCareState();
  assert.equal(isCareState(state), true);
  assert.deepEqual(state, {
    status: 'ready',
    stats: { ...content.stats.initial },
    stage: content.species.stages[0].stage,
    cp: 0,
    actionsToday: 0,
    dayKey: null,
    stickers: [],
    tuckedIn: false
  });
});

// --- validateCollectionState ---------------------------------------------------

function wellFormedCollectionState() {
  const visible = unrevealedCreature({ workId: 'work:visible', identityKey: '9780064400558' });
  const archived = unrevealedCreature({ workId: 'work:archived', identityKey: '9780399226908' });
  return {
    creatures: mapOf(visible, archived),
    activeCreatureId: visible.id,
    visibleCreatureIds: [visible.id],
    archivedCreatureIds: [archived.id],
    reconciledDuplicateWorkIds: []
  };
}

test('validateCollectionState accepts a well-formed collection state', () => {
  assert.equal(validateCollectionState(wellFormedCollectionState()), true);
});

test('validateCollectionState rejects an activeCreatureId that is not present in visibleCreatureIds', () => {
  const state = wellFormedCollectionState();
  const archivedId = state.archivedCreatureIds[0];
  assert.equal(validateCollectionState({ ...state, activeCreatureId: archivedId }), false);
  assert.equal(validateCollectionState({ ...state, activeCreatureId: 'creature:unknown' }), false);
});

test('validateCollectionState rejects overlapping visible and archived sets', () => {
  const state = wellFormedCollectionState();
  const overlapId = state.archivedCreatureIds[0];
  assert.equal(validateCollectionState({
    ...state, visibleCreatureIds: [...state.visibleCreatureIds, overlapId]
  }), false);
});

test('validateCollectionState rejects a creature record that fails isCreatureRecord', () => {
  const state = wellFormedCollectionState();
  const [id, creature] = Object.entries(state.creatures)[0];
  assert.equal(validateCollectionState({
    ...state, creatures: { ...state.creatures, [id]: { ...creature, revealed: 'yes' } }
  }), false);
});

test('validateCollectionState rejects duplicate ids in visibleCreatureIds', () => {
  const state = wellFormedCollectionState();
  assert.equal(validateCollectionState({
    ...state, visibleCreatureIds: [state.visibleCreatureIds[0], state.visibleCreatureIds[0]]
  }), false);
});

test('validateCollectionState rejects malformed shapes without throwing', () => {
  assert.equal(validateCollectionState(null), false);
  assert.equal(validateCollectionState({}), false);
  assert.equal(validateCollectionState(wellFormedCollectionState().creatures), false);
  const state = wellFormedCollectionState();
  assert.equal(validateCollectionState({ ...state, reconciledDuplicateWorkIds: ['a', 'a'] }), false);
  assert.equal(validateCollectionState({ ...state, reconciledDuplicateWorkIds: undefined }), false);
});
