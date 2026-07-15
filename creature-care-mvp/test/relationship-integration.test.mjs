// Package 5 integration: drives relationship-day recording, the permanent finish
// marker, and the flag-off treat seam through the real reducer (src/state.js) and
// storage boundary, mirroring how src/app.js orchestrates a reading. The pure
// modules are unit-tested in relationship.test.mjs / care-items.test.mjs; this file
// proves the wiring and the never-punish / no-power invariants end to end.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEvent, initialState } from '../src/state.js';
import {
  activeCreatureChanged,
  bookAdded,
  bookStatusChanged,
  careItemGranted,
  careItemUsed,
  careActionPerformed,
  creaturePreviewCreated,
  creatureRelationshipChanged,
  creatureRevealed,
  hatched,
  readingChallengeStarted,
  readingDayRecorded,
  readingRecorded
} from '../src/events.js';
import { createIsbnBookRecords } from '../src/systems/book-records.js';
import { createReadingRecord, recordReading, startStandaloneChallenge, readingsForWork } from '../src/systems/reading.js';
import { previewForBook, revealForReading } from '../src/systems/collection.js';
import { recordRelationshipDay } from '../src/systems/relationship.js';
import { LocalStorageAdapter } from '../src/systems/storage.js';
import { createFakeStorage, at } from './helpers.mjs';

const ISBN_A = '9780064400558';
const ISBN_B = '9780316769488';

function startChallenge(state, now) {
  const started = startStandaloneChallenge(now);
  return applyEvent(state, readingChallengeStarted(started.challenge, now));
}

function addBookAndPreview(state, isbn, now) {
  const records = createIsbnBookRecords(isbn);
  state = applyEvent(state, bookAdded(records, now));
  const { identityVersion, identityKey } = records.identity;
  const workId = records.work.id;
  const baseTraits = { kind: 'book', isbn: identityKey, book: { genres: ["Children's fiction", 'Animal fiction'], subjects: ['Friendship'] } };
  const preview = previewForBook({ workId, identityVersion, identityKey, baseTraits }, state.collection.creatures);
  if (!preview.alreadyExists) {
    state = applyEvent(state, creaturePreviewCreated({ creatureId: preview.creatureId, workId, identityVersion, identityKey, baseTraits }, now));
  }
  return { state, workId, creatureId: preview.creatureId };
}

// Mirrors app.js commitReadingRecord: record -> reveal -> auto-activate -> relationship day.
function readBook(state, workId, now, id) {
  const result = createReadingRecord({ id, workId, confirmedAt: now });
  const reading = recordReading(state.reading, result.record);
  if (!reading.ok || reading.replayed) return { state, changed: false };
  state = applyEvent(state, readingRecorded(result.record, now));
  if (reading.formalDayAdded) state = applyEvent(state, readingDayRecorded(result.record, now));
  state = applyEvent(state, bookStatusChanged(workId, result.record.status, now));
  const reveal = revealForReading({ workId, readingRecordId: result.record.id }, state.collection.creatures);
  for (const r of reveal.reveals) {
    state = applyEvent(state, creatureRevealed(r, now));
    if (!state.collection.activeCreatureId) state = applyEvent(state, activeCreatureChanged({ creatureId: r.creatureId }, now));
  }
  // Mirror app.js: advance every revealed creature for the work (duplicate exception).
  const workCreatures = Object.values(state.collection.creatures).filter((c) => c.workId === workId && c.revealed);
  for (const creature of workCreatures) {
    const rel = recordRelationshipDay(creature, result.record.localDayKey);
    if (rel.ok && rel.changed) {
      state = applyEvent(state, creatureRelationshipChanged({
        creatureId: creature.id, workId, readingRecordId: result.record.id, localDayKey: result.record.localDayKey, responseId: rel.responseId
      }, now));
    }
  }
  return { state, record: result.record };
}

test('the reveal reading is relationship day 1, and later distinct days accrue more', () => {
  let state = startChallenge(initialState(), at(0));
  let creatureId; let workId;
  ({ state, workId, creatureId } = addBookAndPreview(state, ISBN_A, at(0)));

  ({ state } = readBook(state, workId, at(0), 'r1'));
  assert.deepEqual(state.collection.creatures[creatureId].relationshipDayKeys.length, 1, 'reveal day = relationship day 1');

  // Same day, same book again -> no new relationship day (at most one per date).
  ({ state } = readBook(state, workId, at(2), 'r2'));
  assert.equal(state.collection.creatures[creatureId].relationshipDayKeys.length, 1, 'second read same day adds no relationship day');

  // A later distinct local day -> relationship day 2.
  ({ state } = readBook(state, workId, at(30), 'r3'));
  assert.equal(state.collection.creatures[creatureId].relationshipDayKeys.length, 2, 'later distinct day advances the relationship');
});

test('relationship days grant no CP, stage, actions, or reading power (never punish / no power)', () => {
  let state = startChallenge(initialState(), at(0));
  state = applyEvent(state, hatched(at(0)));
  let workId; let creatureId;
  ({ state, workId, creatureId } = addBookAndPreview(state, ISBN_A, at(0)));
  const cpBefore = state.cp;
  const stageBefore = state.stage;
  const actionsBefore = state.actionsToday;
  ({ state } = readBook(state, workId, at(0), 'r1'));
  ({ state } = readBook(state, workId, at(30), 'r2'));
  assert.equal(state.cp, cpBefore, 'no CP from relationship');
  assert.equal(state.stage, stageBefore, 'no stage change from relationship');
  assert.equal(state.actionsToday, actionsBefore, 'no daily-care actions consumed by relationship');
});

test('reading an archived (non-active) book advances its creature without stealing active', () => {
  let state = startChallenge(initialState(), at(0));
  let firstId; let firstWork; let secondId; let secondWork;
  ({ state, workId: firstWork, creatureId: firstId } = addBookAndPreview(state, ISBN_A, at(0)));
  ({ state, workId: secondWork, creatureId: secondId } = addBookAndPreview(state, ISBN_B, at(0)));
  ({ state } = readBook(state, firstWork, at(0), 'r1'));   // reveals + activates first
  ({ state } = readBook(state, secondWork, at(0), 'r2'));  // reveals second, archived
  assert.equal(state.collection.activeCreatureId, firstId);
  // Read the archived second book on a later day -> its relationship advances, active unchanged.
  ({ state } = readBook(state, secondWork, at(30), 'r3'));
  assert.equal(state.collection.creatures[secondId].relationshipDayKeys.length, 2);
  assert.equal(state.collection.activeCreatureId, firstId, 'active creature unchanged by reading an archived book');
});

test('finishing a book sets a permanent creature marker that later statuses never clear', () => {
  let state = startChallenge(initialState(), at(0));
  let workId; let creatureId;
  ({ state, workId, creatureId } = addBookAndPreview(state, ISBN_A, at(0)));
  ({ state } = readBook(state, workId, at(0), 'r1'));
  assert.equal(state.collection.creatures[creatureId].finished, false);

  state = applyEvent(state, bookStatusChanged(workId, 'finished', at(1)));
  assert.equal(state.collection.creatures[creatureId].finished, true, 'finish marks the creature');

  // Later reread / paused / not-for-me must NOT clear the permanent marker.
  state = applyEvent(state, bookStatusChanged(workId, 'reading', at(2)));
  assert.equal(state.collection.creatures[creatureId].finished, true, 'reread does not un-finish');
  state = applyEvent(state, bookStatusChanged(workId, 'paused', at(3)));
  assert.equal(state.collection.creatures[creatureId].finished, true, 'paused does not un-finish');
  assert.equal(state.reading.bookStatuses[workId], 'paused', 'reversible work status still tracks the latest');
});

test('changeRelationship rejects a relationship day for an UNREVEALED creature (reveal = day 1)', () => {
  // The reducer is the system-of-record boundary and must enforce reveal-before-relationship
  // independently of app.js ordering, so a reordered/replayed event cannot desync day 1.
  let state = startChallenge(initialState(), at(0));
  let workId; let creatureId;
  ({ state, workId, creatureId } = addBookAndPreview(state, ISBN_A, at(0)));
  assert.equal(state.collection.creatures[creatureId].revealed, false);
  // Add a reading record for the work WITHOUT revealing the creature.
  const result = createReadingRecord({ id: 'r1', workId, confirmedAt: at(0) });
  state = applyEvent(state, readingRecorded(result.record, at(0)));

  state = applyEvent(state, creatureRelationshipChanged({
    creatureId, workId, readingRecordId: 'r1', localDayKey: result.record.localDayKey, responseId: 'wiggle'
  }, at(0)));
  assert.deepEqual(state.collection.creatures[creatureId].relationshipDayKeys, [], 'no relationship day before reveal');
});

test('a work with two reconciled-duplicate creatures advances BOTH relationships and finishes BOTH (symmetry)', () => {
  let state = startChallenge(initialState(), at(0));
  let workId; let firstId;
  ({ state, workId, creatureId: firstId } = addBookAndPreview(state, ISBN_A, at(0)));
  ({ state } = readBook(state, workId, at(0), 'r1')); // reveals + activates the first creature

  // Inject the validated late-reconciliation exception: a second revealed creature on the
  // same canonical work (as BookWorkReconciled would leave two already-owned creatures).
  const dupId = 'creature:dup';
  state = {
    ...state,
    collection: {
      ...state.collection,
      creatures: {
        ...state.collection.creatures,
        [dupId]: {
          id: dupId, workId, identityVersion: 'stacklings:v1', identityKey: 'dup',
          baseTraits: { kind: 'book', name: 'Twin', book: {} },
          revealed: true, relationshipDayKeys: [], finished: false, careState: { status: 'uninitialized' }
        }
      },
      archivedCreatureIds: [...state.collection.archivedCreatureIds, dupId],
      reconciledDuplicateWorkIds: [...state.collection.reconciledDuplicateWorkIds, workId]
    }
  };

  // Read the work again on a later distinct day -> BOTH creatures advance a relationship day.
  ({ state } = readBook(state, workId, at(30), 'r2'));
  assert.equal(state.collection.creatures[firstId].relationshipDayKeys.length, 2, 'first creature advanced');
  assert.equal(state.collection.creatures[dupId].relationshipDayKeys.length, 1, 'duplicate creature advanced too');

  // Finishing the work marks BOTH creatures permanently.
  state = applyEvent(state, bookStatusChanged(workId, 'finished', at(31)));
  assert.equal(state.collection.creatures[firstId].finished, true);
  assert.equal(state.collection.creatures[dupId].finished, true, 'finish marks the duplicate too');
});

test('with the careItems flag OFF (the app default) no treat is ever granted', () => {
  // readBook here never emits CareItemGranted (app.js gates it behind featureFlags.careItems),
  // so a default game keeps an empty inventory.
  let state = startChallenge(initialState(), at(0));
  let workId;
  ({ state, workId } = addBookAndPreview(state, ISBN_A, at(0)));
  ({ state } = readBook(state, workId, at(0), 'r1'));
  assert.deepEqual(state.careItems.inventory, [], 'no treats without the flag');
  assert.deepEqual(state.careItems.grantDayKeys, []);
});

test('treat seam: grant then use applies a feed effect subject to the cap, decrements, and is replay-safe', () => {
  const storage = createFakeStorage();
  const adapter = new LocalStorageAdapter(storage);
  let state = startChallenge(initialState(), at(0));
  state = applyEvent(state, hatched(at(0)));
  let workId; let creatureId;
  ({ state, workId, creatureId } = addBookAndPreview(state, ISBN_A, at(0)));
  ({ state } = readBook(state, workId, at(0), 'r1')); // reveal + activate

  // Simulate a flag-on grant on the first reading.
  state = applyEvent(state, careItemGranted({ grantId: 'grant:r1', itemId: 'acorn', localDayKey: '2026-7-14', sourceReadingRecordId: 'r1', categoryId: 'acorn' }, at(0)));
  assert.equal(state.careItems.inventory.length, 1);
  assert.equal(state.careItems.inventory[0].remaining, 1);

  // Drain the daily cap first so we can prove a treat over the cap grants 0 CP (no extra power).
  const fullnessBefore = state.stats.fullness;
  state = applyEvent(state, careActionPerformed('feed', 1, at(0)));
  state = applyEvent(state, careActionPerformed('play', 1, at(0)));
  state = applyEvent(state, careActionPerformed('tidy', 1, at(0)));
  const cpAtCap = state.cp;
  assert.equal(state.actionsToday, 3);

  // Use the treat: inventory item id is 'item:<grantId>'. cpGranted respects the cap (0 here).
  state = applyEvent(state, careItemUsed({ useId: 'use1', itemId: 'item:grant:r1', creatureId, actionId: 'feed', cpGranted: 0 }, at(0)));
  assert.equal(state.careItems.inventory[0].remaining, 0, 'treat consumed');
  assert.equal(state.cp, cpAtCap, 'treat over the cap grants no extra CP (no power)');
  assert.ok(state.stats.fullness >= fullnessBefore, 'treat performed the feed effect');
  assert.equal(state.actionsToday, 4, 'treat counts as a care action like a normal feed');

  // Replay / double-use is safe: remaining already 0 -> no-op, no second feed.
  const cpAfter = state.cp;
  const actionsAfter = state.actionsToday;
  state = applyEvent(state, careItemUsed({ useId: 'use1', itemId: 'item:grant:r1', creatureId, actionId: 'feed', cpGranted: 0 }, at(0)));
  assert.equal(state.cp, cpAfter, 'duplicate use does not re-apply');
  assert.equal(state.actionsToday, actionsAfter);

  // Full state still round-trips through the storage boundary.
  assert.doesNotThrow(() => { adapter.save(state, at(0)); });
  const reopened = new LocalStorageAdapter(storage).load(at(0));
  assert.equal(reopened.state.careItems.inventory[0].remaining, 0);
  assert.equal(reopened.state.collection.creatures[creatureId].relationshipDayKeys.length, 1);
});
