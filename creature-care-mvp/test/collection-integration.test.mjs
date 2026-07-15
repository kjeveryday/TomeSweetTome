// Package 4 integration: wires src/systems/collection.js's pure decisions through
// the real reducer (src/state.js) and the real storage boundary (LocalStorageAdapter),
// mirroring exactly how src/app.js orchestrates preview -> reveal -> active selection.
// collection.test.mjs already covers collection.js in isolation; this file exists
// because none of the existing suite drives a NATIVE (never-migrated-from-v1) game to
// a non-null collection.activeCreatureId, which is the scenario the active-care
// projection in storage.js must also handle (not just the legacy-migration fallback).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEvent, initialState } from '../src/state.js';
import {
  activeCreatureChanged,
  bookAdded,
  bookStatusChanged,
  careActionPerformed,
  creaturePreviewCreated,
  creatureRevealed,
  hatched,
  readingChallengeStarted,
  readingDayRecorded,
  readingRecorded
} from '../src/events.js';
import { createIsbnBookRecords } from '../src/systems/book-records.js';
import { createReadingRecord, recordReading, startStandaloneChallenge } from '../src/systems/reading.js';
import { previewForBook, revealForReading } from '../src/systems/collection.js';
import { LocalStorageAdapter } from '../src/systems/storage.js';
import { createFakeStorage, at, content } from './helpers.mjs';

// Mirrors app.js's onUseCreature: add the book, then preview its (not yet owned) creature.
function addBookAndPreview(state, isbn, now) {
  const records = createIsbnBookRecords(isbn);
  assert.equal(records.ok, true);
  state = applyEvent(state, bookAdded(records, now));
  const { identityVersion, identityKey } = records.identity;
  const workId = records.work.id;
  const preview = previewForBook(
    { workId, identityVersion, identityKey, baseTraits: { kind: 'book', isbn: identityKey } },
    state.collection.creatures
  );
  assert.equal(preview.ok, true);
  if (!preview.alreadyExists) {
    state = applyEvent(state, creaturePreviewCreated(
      { creatureId: preview.creatureId, workId, identityVersion, identityKey, baseTraits: { kind: 'book', isbn: identityKey } },
      now
    ));
  }
  return { state, workId, creatureId: preview.creatureId };
}

// Mirrors app.js's commitReadingRecord: record the reading, then reveal + (if it's the
// very first reveal ever) auto-activate.
function readAndReveal(state, workId, now) {
  const result = createReadingRecord({ id: `reading:${workId}:${now}`, workId, confirmedAt: now });
  assert.equal(result.ok, true);
  const reading = recordReading(state.reading, result.record);
  assert.equal(reading.ok, true);
  assert.equal(reading.replayed, false);
  state = applyEvent(state, readingRecorded(result.record, now));
  if (reading.formalDayAdded) state = applyEvent(state, readingDayRecorded(result.record, now));
  state = applyEvent(state, bookStatusChanged(workId, result.record.status, now));

  const reveal = revealForReading({ workId, readingRecordId: result.record.id }, state.collection.creatures);
  assert.equal(reveal.ok, true);
  for (const { creatureId, workId: revealWorkId, readingRecordId } of reveal.reveals) {
    state = applyEvent(state, creatureRevealed({ creatureId, workId: revealWorkId, readingRecordId }, now));
    if (!state.collection.activeCreatureId) {
      state = applyEvent(state, activeCreatureChanged({ creatureId }, now));
    }
  }
  return { state, record: result.record };
}

function startChallenge(state, now) {
  const started = startStandaloneChallenge(now);
  assert.equal(started.ok, true);
  return applyEvent(state, readingChallengeStarted(started.challenge, now));
}

test('adding a book persists an unrevealed, unplaced preview without throwing (the on-book-add save path)', () => {
  // The real app (app.js onUseCreature) commits CreaturePreviewCreated and immediately
  // persists — before any reading exists. The preview creature is therefore present in
  // collection.creatures but is NOT yet in visibleCreatureIds/archivedCreatureIds and has
  // no active creature. This must survive isCurrentState validation and round-trip, or
  // book-adding would throw on the very first save.
  const storage = createFakeStorage();
  const adapter = new LocalStorageAdapter(storage);
  let state = initialState();
  state = startChallenge(state, at(0));
  let creatureId;
  ({ state, creatureId } = addBookAndPreview(state, '9780064400558', at(0)));

  assert.equal(state.collection.activeCreatureId, null);
  assert.deepEqual(state.collection.visibleCreatureIds, []);
  assert.deepEqual(state.collection.archivedCreatureIds, []);
  assert.equal(state.collection.creatures[creatureId].revealed, false);

  let saved;
  assert.doesNotThrow(() => { saved = adapter.save(state, at(0)).state; });
  assert.equal(saved.collection.creatures[creatureId].revealed, false);

  const reopened = new LocalStorageAdapter(storage).load(at(0));
  assert.equal(reopened.state.collection.creatures[creatureId].revealed, false);
  assert.equal(reopened.state.collection.activeCreatureId, null);
});

test('native preview -> reveal -> auto-activate -> care action round-trips through LocalStorageAdapter', () => {
  const storage = createFakeStorage();
  const adapter = new LocalStorageAdapter(storage);
  let state = initialState();
  state = startChallenge(state, at(0));

  let creatureId;
  ({ state, creatureId } = addBookAndPreview(state, '9780064400558', at(0)));
  const preview = state.collection.creatures[creatureId];
  assert.equal(preview.revealed, false);
  assert.equal(preview.careState.status, 'uninitialized');
  assert.equal(state.collection.activeCreatureId, null);
  // Repeated scan of the same ISBN before it's ever revealed must not reroll or duplicate.
  ({ state } = addBookAndPreview(state, '9780064400558', at(1)));
  assert.equal(Object.keys(state.collection.creatures).length, 1);

  ({ state } = readAndReveal(state, preview.workId, at(2)));
  assert.equal(state.collection.creatures[creatureId].revealed, true);
  assert.equal(state.collection.activeCreatureId, creatureId, 'first-ever reveal becomes active');
  assert.deepEqual(state.collection.visibleCreatureIds, [creatureId]);
  assert.equal(state.collection.creatures[creatureId].careState.status, 'ready');
  assert.deepEqual(state.collection.creatures[creatureId].careState.stats, content.stats.initial);

  // This is the scenario nothing else in the suite exercises: a care action on a NATIVE
  // (never-migrated) active creature, saved through the real LocalStorageAdapter. Before
  // the storage-boundary projection fix this either throws or falls through to a legacy
  // migration path that assumes a root `state.creature` mirror this flow never sets.
  state = applyEvent(state, careActionPerformed('feed', 1, at(3)));
  assert.doesNotThrow(() => { state = adapter.save(state, at(3)).state; });
  assert.deepEqual(state.collection.creatures[creatureId].careState.stats, state.stats);
  assert.equal(state.collection.creatures[creatureId].careState.cp, state.cp);

  const reopened = new LocalStorageAdapter(storage).load(at(3));
  assert.deepEqual(reopened.state.stats, state.stats);
  assert.equal(reopened.state.collection.activeCreatureId, creatureId);
  assert.deepEqual(reopened.state.collection.creatures[creatureId].careState.stats, state.stats);
});

test('the first reveal in a hatched game inherits the starter care instead of discarding it (never punish)', () => {
  // A player can hatch and care for the starter creature for days before ever adding a
  // book. At that point activeCreatureId is null and the accumulated care lives only in
  // the root fields. The first book reveal auto-activates — and MUST carry that care
  // forward (v1 semantics: applying a book preserved the creature's ongoing care), never
  // reset it to a fresh baseline.
  const storage = createFakeStorage();
  const adapter = new LocalStorageAdapter(storage);
  let state = initialState();
  state = applyEvent(state, hatched(at(0)));
  state = applyEvent(state, careActionPerformed('feed', 1, at(0)));
  state = applyEvent(state, careActionPerformed('play', 1, at(0)));
  state = applyEvent(state, careActionPerformed('tidy', 1, at(0)));
  const earnedCp = state.cp;
  const earnedStats = structuredClone(state.stats);
  const earnedActions = state.actionsToday;
  assert.ok(earnedCp > 0, 'sanity: starter accumulated CP before any book');
  assert.equal(state.collection.activeCreatureId, null);

  state = startChallenge(state, at(0));
  let creatureId;
  ({ state, creatureId } = addBookAndPreview(state, '9780064400558', at(0)));
  ({ state } = readAndReveal(state, state.collection.creatures[creatureId].workId, at(0)));

  assert.equal(state.collection.activeCreatureId, creatureId, 'first reveal becomes active');
  assert.equal(state.cp, earnedCp, 'accumulated CP is preserved, not reset');
  assert.deepEqual(state.stats, earnedStats, 'accumulated stats are preserved');
  assert.equal(state.actionsToday, earnedActions, 'daily-cap progress is preserved (not reset mid-day)');
  assert.equal(state.collection.creatures[creatureId].careState.cp, earnedCp, 'the now-active creature owns the preserved care');
  assert.doesNotThrow(() => { adapter.save(state, at(0)); });
});

test('several books revealed in one session each get their own record; returning a book keeps its creature', () => {
  const storage = createFakeStorage();
  const adapter = new LocalStorageAdapter(storage);
  let state = initialState();
  state = startChallenge(state, at(0));

  let firstId; let secondId;
  ({ state, creatureId: firstId } = addBookAndPreview(state, '9780064400558', at(0)));
  ({ state, creatureId: secondId } = addBookAndPreview(state, '9780316769488', at(0)));
  assert.notEqual(firstId, secondId);

  ({ state } = readAndReveal(state, state.collection.creatures[firstId].workId, at(1)));
  ({ state } = readAndReveal(state, state.collection.creatures[secondId].workId, at(1)));

  assert.equal(state.collection.creatures[firstId].revealed, true);
  assert.equal(state.collection.creatures[secondId].revealed, true);
  assert.equal(state.collection.activeCreatureId, firstId, 'later reveal never steals the active slot');
  assert.ok(state.collection.archivedCreatureIds.includes(secondId));

  // Formal reading progress is one distinct day regardless of how many books were read on it.
  assert.equal(state.reading.formalDayKeys.length, 1);

  state = applyEvent(state, bookStatusChanged(state.collection.creatures[secondId].workId, 'paused', at(2)));
  assert.ok(state.collection.creatures[secondId], 'a paused/returned book keeps its creature');
  assert.doesNotThrow(() => { adapter.save(state, at(2)); });
});

test('switching active creature snapshots the outgoing creature and projects the incoming one onto root fields', () => {
  let state = initialState();
  state = startChallenge(state, at(0));
  let firstId; let secondId;
  ({ state, creatureId: firstId } = addBookAndPreview(state, '9780064400558', at(0)));
  ({ state, creatureId: secondId } = addBookAndPreview(state, '9780316769488', at(0)));
  ({ state } = readAndReveal(state, state.collection.creatures[firstId].workId, at(1)));
  ({ state } = readAndReveal(state, state.collection.creatures[secondId].workId, at(1)));
  assert.equal(state.collection.activeCreatureId, firstId);

  state = applyEvent(state, careActionPerformed('feed', 1, at(2)));
  const firstCpAfterFeed = state.cp;
  assert.ok(firstCpAfterFeed > 0);

  state = applyEvent(state, activeCreatureChanged({ creatureId: secondId }, at(3)));
  assert.equal(state.collection.activeCreatureId, secondId);
  assert.equal(state.collection.creatures[firstId].careState.cp, firstCpAfterFeed, 'outgoing creature snapshot preserved');
  assert.equal(state.cp, 0, 'incoming (freshly initialized) creature starts from its own baseline');
  assert.deepEqual(state.stats, content.stats.initial);

  // Switch back: the first creature resumes exactly where it left off.
  state = applyEvent(state, activeCreatureChanged({ creatureId: firstId }, at(4)));
  assert.equal(state.cp, firstCpAfterFeed);
  assert.equal(state.collection.activeCreatureId, firstId);
});

test('the visible-creature limit evicts the oldest non-active creature into the archive', () => {
  let state = initialState();
  state = startChallenge(state, at(0));
  const isbns = ['9780064400558', '9780316769488', '9780439708180', '9780545010221'];
  const ids = [];
  for (const isbn of isbns) {
    const added = addBookAndPreview(state, isbn, at(0));
    state = added.state;
    ids.push(added.creatureId);
  }
  for (const id of ids) {
    const workId = state.collection.creatures[id].workId;
    state = readAndReveal(state, workId, at(1)).state;
  }
  // Explicitly activate each in turn (first one was auto-activated by the first reveal).
  for (const id of ids.slice(1)) {
    state = applyEvent(state, activeCreatureChanged({ creatureId: id }, at(2)));
  }
  assert.ok(state.collection.visibleCreatureIds.length <= content.collection.visibleCreatureLimit);
  assert.ok(state.collection.visibleCreatureIds.includes(ids.at(-1)));
  assert.equal(state.collection.activeCreatureId, ids.at(-1));
  assert.ok(state.collection.archivedCreatureIds.includes(ids[0]), 'the least-recently-active creature was evicted');
  // Every creature ever revealed is still in the (unbounded) collection.
  for (const id of ids) assert.ok(state.collection.creatures[id]);
});
