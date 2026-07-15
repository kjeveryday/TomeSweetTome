import test from 'node:test';
import assert from 'node:assert/strict';

import { applyEvent, initialState } from '../src/state.js';
import { bookAdded, bookMetadataResolved, bookWorkReconciled } from '../src/events.js';
import { createBookEdition, createBookWork } from '../src/contracts.js';
import { createIsbnBookRecords } from '../src/systems/book-records.js';
import { isCurrentState, migrateSave } from '../src/systems/migration.js';

function freshState() {
  return migrateSave(null).envelope.state;
}

test('BookAdded applies directly to the exported initial state', () => {
  const records = createIsbnBookRecords('9780064400558');
  const state = applyEvent(initialState(), bookAdded(records, 0, 'event:book:initial'));

  assert.equal(state.books.works[records.work.id].id, records.work.id);
  assert.equal(isCurrentState(state), true);
});

test('BookAdded stores a valid work, edition, and alias and replays idempotently', () => {
  const records = createIsbnBookRecords('9780064400558');
  const event = bookAdded(records, 0, 'event:book:1');
  const once = applyEvent(freshState(), event);
  const twice = applyEvent(once, event);

  assert.equal(once.books.works[records.work.id].id, records.work.id);
  assert.equal(once.books.editions[records.edition.id].isbn13, '9780064400558');
  assert.equal(once.books.aliases['isbn13:9780064400558'], records.work.id);
  assert.deepEqual(twice, once);
  assert.equal(isCurrentState(twice), true);
});

test('a repeated capture may improve metadata without duplicating its edition', () => {
  const fallback = createIsbnBookRecords('9780064400558');
  let state = applyEvent(freshState(), bookAdded(fallback, 0, 'event:book:fallback'));
  const resolvedWork = createBookWork({
    id: fallback.work.id,
    title: "Charlotte's Web",
    authors: ['E. B. White'],
    metadataStatus: 'resolved',
    editionIds: [fallback.edition.id]
  });
  const resolvedEdition = createBookEdition({
    ...fallback.edition,
    metadataSource: 'fixture:pinned-books'
  });
  state = applyEvent(state, bookMetadataResolved({
    ...fallback,
    work: resolvedWork,
    edition: resolvedEdition,
    provenance: {
      source: 'fixture', providerId: 'metadata:pinned-books',
      fetchedAt: '1970-01-01T00:00:00.001Z', fields: { title: 'fixture' }
    }
  }, 1, 'event:book:resolved'));

  assert.equal(state.books.works[fallback.work.id].title, "Charlotte's Web");
  assert.equal(state.books.editions[fallback.edition.id].metadataSource, 'fixture:pinned-books');
  assert.equal(state.books.provenance[fallback.work.id].source, 'fixture');
  assert.deepEqual(state.books.provenance[fallback.work.id].fields, { title: 'fixture' });
  assert.deepEqual(state.books.works[fallback.work.id].editionIds, [fallback.edition.id]);
  assert.equal(Object.keys(state.books.editions).length, 1);
  assert.equal(isCurrentState(state), true);
});

test('a conflicting alias route is rejected without partially changing book state', () => {
  const first = createIsbnBookRecords('9780064400558');
  const once = applyEvent(freshState(), bookAdded(first, 0, 'event:book:first'));
  const conflictingWork = createBookWork({ id: 'work:conflict', editionIds: ['edition:conflict'] });
  const conflictingEdition = createBookEdition({
    id: 'edition:conflict', workId: conflictingWork.id, isbn13: '9780399226908'
  });
  const event = bookAdded({
    work: conflictingWork,
    edition: conflictingEdition,
    aliases: [{ key: 'isbn13:9780064400558', workId: conflictingWork.id }]
  }, 1, 'event:book:conflict');
  assert.deepEqual(applyEvent(once, event), once);
});

test('BookAdded cannot introduce a dangling edition ID', () => {
  const records = createIsbnBookRecords('9780064400558');
  const event = bookAdded({
    ...records,
    work: createBookWork({ ...records.work, editionIds: [records.edition.id, 'edition:missing'] })
  }, 0, 'event:book:dangling');
  const state = freshState();
  assert.deepEqual(applyEvent(state, event), state);
});

test('late work reconciliation preserves both already-owned identities as an explicit exception', () => {
  const first = createIsbnBookRecords('9780064400558');
  const second = createIsbnBookRecords('9780399226908');
  let state = applyEvent(freshState(), bookAdded(first, 0, 'event:book:a'));
  state = applyEvent(state, bookAdded(second, 1, 'event:book:b'));
  state.collection.creatures = {
    'creature:a': {
      id: 'creature:a', workId: first.work.id, identityVersion: 'stacklings:v1',
      identityKey: first.identity.identityKey, baseTraits: { name: 'A' }, revealed: true,
      relationshipDayKeys: [], finished: false, careState: { status: 'uninitialized' }
    },
    'creature:b': {
      id: 'creature:b', workId: second.work.id, identityVersion: 'stacklings:v1',
      identityKey: second.identity.identityKey, baseTraits: { name: 'B' }, revealed: true,
      relationshipDayKeys: [], finished: false, careState: { status: 'uninitialized' }
    }
  };
  state.reading.records = {
    'reading:a': {
      id: 'reading:a', workId: first.work.id,
      occurredAt: '2026-07-15T12:00:00.000Z', localDayKey: '2026-7-15'
    },
    'reading:b': {
      id: 'reading:b', workId: second.work.id,
      occurredAt: '2026-07-15T18:00:00.000Z', localDayKey: '2026-7-15', mode: 'shared'
    },
    'reading:c': {
      id: 'reading:c', workId: second.work.id,
      occurredAt: '2026-07-16T12:00:00.000Z', localDayKey: '2026-7-16', mode: 'listened'
    }
  };
  state.reading.challenge.registeredAt = '2026-07-15T11:00:00.000Z';
  state.reading.formalDayKeys = ['2026-7-15', '2026-7-16'];
  const beforeReadingRecords = structuredClone(state.reading.records);
  const beforeFormalDayKeys = [...state.reading.formalDayKeys];
  assert.equal(isCurrentState(state), true);
  const beforeIdentities = Object.values(state.collection.creatures)
    .map(({ identityVersion, identityKey }) => [identityVersion, identityKey]);
  const event = bookWorkReconciled({
    canonicalWorkId: first.work.id,
    aliasedWorkIds: [second.work.id],
    editionIds: [second.edition.id]
  }, 2, 'event:book:reconcile');
  const once = applyEvent(state, event);
  const twice = applyEvent(once, event);

  assert.deepEqual(Object.values(once.collection.creatures).map(({ identityVersion, identityKey }) => [
    identityVersion, identityKey
  ]), beforeIdentities);
  assert.equal(Object.values(once.collection.creatures).every((creature) => creature.workId === first.work.id), true);
  assert.deepEqual(once.collection.reconciledDuplicateWorkIds, [first.work.id]);
  assert.equal(once.books.aliases['isbn13:9780399226908'], first.work.id);
  assert.equal(Object.hasOwn(once.books.works, second.work.id), false);
  assert.deepEqual(Object.keys(once.reading.records), Object.keys(beforeReadingRecords));
  assert.equal(Object.values(once.reading.records).every((record) => record.workId === first.work.id), true);
  assert.deepEqual(once.reading.formalDayKeys, beforeFormalDayKeys);
  assert.deepEqual(
    Object.values(once.reading.records).map(({ workId, ...record }) => record),
    Object.values(beforeReadingRecords).map(({ workId, ...record }) => record)
  );
  assert.equal(isCurrentState(once), true);
  assert.deepEqual(twice, once);
});
