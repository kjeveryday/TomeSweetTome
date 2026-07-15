import test from 'node:test';
import assert from 'node:assert/strict';

import { applyEvent, initialState } from '../src/state.js';
import {
  bookAdded,
  bookStatusChanged,
  readingChallengeStarted,
  readingDayRecorded,
  readingRecorded
} from '../src/events.js';
import { createIsbnBookRecords } from '../src/systems/book-records.js';
import { createReadingRecord } from '../src/systems/reading.js';
import { isCurrentState, migrateSave } from '../src/systems/migration.js';

const challenge = {
  registeredAt: '2026-07-15T12:00:00.000Z', goalDays: 20, halfwayDays: 10
};

function stateWithBook() {
  const records = createIsbnBookRecords('9780064400558');
  const withBook = applyEvent(initialState(), bookAdded(records, 0, 'event:book:reading'));
  return { records, state: applyEvent(withBook, readingChallengeStarted(
    challenge, Date.parse(challenge.registeredAt), 'event:challenge:fixture'
  )) };
}

test('challenge registration is explicit, local, and idempotent', () => {
  const before = initialState();
  const event = readingChallengeStarted(challenge, Date.parse(challenge.registeredAt), 'event:challenge:start');
  const once = applyEvent(before, event);
  assert.deepEqual(once.reading.challenge, challenge);
  assert.deepEqual(applyEvent(once, event), once);
  assert.equal(isCurrentState(once), true);
});

test('reading records retain every book route while formal progress counts one local day', () => {
  const { records, state: bookState } = stateWithBook();
  const first = {
    id: 'reading:1', workId: records.work.id,
    occurredAt: '2026-07-15T12:00:00.000Z', localDayKey: '2026-7-15', mode: 'shared'
  };
  const second = {
    id: 'reading:2', workId: records.work.id,
    occurredAt: '2026-07-15T18:00:00.000Z', localDayKey: '2026-7-15', mode: 'listened', durationSeconds: 300
  };
  let state = applyEvent(bookState, readingRecorded(first, Date.parse(first.occurredAt), 'event:reading:1'));
  state = applyEvent(state, readingDayRecorded(first, Date.parse(first.occurredAt), 'event:day:1'));
  state = applyEvent(state, readingRecorded(second, Date.parse(second.occurredAt), 'event:reading:2'));

  assert.equal(Object.keys(state.reading.records).length, 2);
  assert.deepEqual(state.reading.formalDayKeys, ['2026-7-15']);
  assert.equal(state.cp, bookState.cp);
  assert.deepEqual(state.stats, bookState.stats);
  assert.equal(isCurrentState(state), true);
});

test('reading is not accepted before the standalone challenge is started', () => {
  const records = createIsbnBookRecords('9780064400558');
  const state = applyEvent(initialState(), bookAdded(records, 0, 'event:book:before-start'));
  const record = {
    id: 'reading:before-start', workId: records.work.id,
    occurredAt: '2026-07-15T12:00:00.000Z', localDayKey: '2026-7-15'
  };
  assert.deepEqual(
    applyEvent(state, readingRecorded(record, Date.parse(record.occurredAt), 'event:reading:before-start')),
    state
  );
});

test('book status changes preserve reading, care, and formal progress', () => {
  const { records, state } = stateWithBook();
  const event = bookStatusChanged(records.work.id, 'not_for_me', 1, 'event:book:status');
  const changed = applyEvent(state, event);
  assert.equal(changed.reading.bookStatuses[records.work.id], 'not_for_me');
  assert.deepEqual(changed.stats, state.stats);
  assert.deepEqual(changed.reading.records, state.reading.records);
  assert.equal(isCurrentState(changed), true);
});

test('twenty distinct reading days complete progress without changing care or creature power', () => {
  const { records, state: started } = stateWithBook();
  let state = {
    ...started,
    hatched: true,
    name: 'Pip',
    stats: { fullness: 61, spirit: 72, energy: 83 },
    cp: 17,
    stage: 2,
    actionsToday: 2,
    dayKey: '2026-7-15',
    stickers: ['star'],
    tuckedIn: true
  };
  const careBefore = structuredClone({
    stats: state.stats, cp: state.cp, stage: state.stage, actionsToday: state.actionsToday,
    dayKey: state.dayKey, stickers: state.stickers, tuckedIn: state.tuckedIn, collection: state.collection
  });
  for (let index = 0; index < 20; index += 1) {
    const confirmedAt = Date.UTC(2026, 6, 1 + index, 12);
    const record = createReadingRecord({
      id: `reading:day:${index + 1}`,
      workId: records.work.id,
      confirmedAt,
      mode: ['independent', 'shared', 'read_aloud', 'listened'][index % 4]
    }).record;
    state = applyEvent(state, readingRecorded(record, confirmedAt, `event:reading:day:${index + 1}`));
    state = applyEvent(state, readingDayRecorded(record, confirmedAt, `event:formal-day:${index + 1}`));
  }
  assert.equal(state.reading.formalDayKeys.length, 20);
  assert.deepEqual({
    stats: state.stats, cp: state.cp, stage: state.stage, actionsToday: state.actionsToday,
    dayKey: state.dayKey, stickers: state.stickers, tuckedIn: state.tuckedIn, collection: state.collection
  }, careBefore);
  assert.equal(isCurrentState(state), true);
});

test('schema-v2 saves from before Package 3 receive deterministic empty reading fields', () => {
  const envelope = migrateSave(null).envelope;
  delete envelope.state.reading.bookStatuses;
  delete envelope.state.reading.challenge;
  const migrated = migrateSave(envelope);
  assert.equal(migrated.status, 'current');
  assert.deepEqual(migrated.envelope.state.reading.bookStatuses, {});
  assert.deepEqual(migrated.envelope.state.reading.challenge, {
    registeredAt: null, goalDays: 20, halfwayDays: 10
  });
  assert.deepEqual(migrateSave(migrated.envelope).envelope, migrated.envelope);
});
