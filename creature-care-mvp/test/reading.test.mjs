import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ProgramStatuses,
  STANDALONE_GOAL_DAYS,
  STANDALONE_HALFWAY_DAYS,
  createReadingRecord,
  deriveFormalDayKeys,
  deriveProgramStatus,
  localDayKeyAt,
  readingProgress,
  readingsForWork,
  recordReading,
  startStandaloneChallenge,
  validateReadingState
} from '../src/systems/reading.js';

const at = (year, month, day, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute, 0, 0).getTime();

function record(overrides = {}) {
  const result = createReadingRecord({
    id: 'reading:1',
    workId: 'work:1',
    confirmedAt: at(2026, 7, 15),
    ...overrides
  });
  assert.equal(result.ok, true);
  return result.record;
}

const emptyState = () => ({
  records: {}, formalDayKeys: [], bookStatuses: {},
  challenge: {
    registeredAt: new Date(at(2026, 7, 15)).toISOString(), goalDays: 20, halfwayDays: 10
  }
});
const unstartedState = () => ({
  records: {}, formalDayKeys: [], bookStatuses: {},
  challenge: { registeredAt: null, goalDays: 20, halfwayDays: 10 }
});

test('reading confirmation creates a canonical private record from the device-local date', () => {
  const created = record({ durationSeconds: 125, mode: 'shared', status: 'paused' });
  assert.equal(created.occurredAt, new Date(at(2026, 7, 15)).toISOString());
  assert.equal(created.localDayKey, '2026-7-15');
  assert.equal(created.durationSeconds, 125);
  assert.equal(created.mode, 'shared');
  assert.equal(created.status, 'paused');
});

test('local day derivation follows local midnight and remains stable across a DST transition date', () => {
  const beforeMidnight = new Date(2026, 6, 15, 23, 59, 59, 999).getTime();
  const midnight = new Date(2026, 6, 16, 0, 0, 0, 0).getTime();
  assert.equal(localDayKeyAt(beforeMidnight), '2026-7-15');
  assert.equal(localDayKeyAt(midnight), '2026-7-16');
  assert.equal(localDayKeyAt(new Date(2026, 2, 8, 1, 30).getTime()), '2026-3-8');
  assert.equal(localDayKeyAt(new Date(2026, 2, 8, 3, 30).getTime()), '2026-3-8');
});

test('record construction rejects malformed identity, time, duration, mode, and status', () => {
  const base = { id: 'reading:1', workId: 'work:1', confirmedAt: at(2026, 7, 15) };
  assert.equal(createReadingRecord({ ...base, id: '' }).reason, 'invalidReadingId');
  assert.equal(createReadingRecord({ ...base, workId: '' }).reason, 'invalidWorkId');
  assert.equal(createReadingRecord({ ...base, confirmedAt: 'July 15, 2026' }).reason, 'invalidConfirmationTime');
  assert.equal(createReadingRecord({ ...base, durationSeconds: -1 }).reason, 'invalidDuration');
  assert.equal(createReadingRecord({ ...base, mode: 'reread' }).reason, 'invalidReadingMode');
  assert.equal(createReadingRecord({ ...base, status: 'abandoned' }).reason, 'invalidBookStatus');
  assert.equal(localDayKeyAt(Number.NaN), null);
});

test('all approved reading modes produce the same one-day formal progress', () => {
  for (const mode of ['independent', 'shared', 'read_aloud', 'listened']) {
    const added = recordReading(emptyState(), record({ id: `reading:${mode}`, mode }));
    assert.equal(added.ok, true);
    assert.equal(added.formalDayAdded, true);
    assert.deepEqual(added.readingState.formalDayKeys, ['2026-7-15']);
  }
});

test('several works on one date keep every reading but add one formal day', () => {
  let state = emptyState();
  const first = recordReading(state, record({ id: 'reading:a', workId: 'work:a' }));
  state = first.readingState;
  const second = recordReading(state, record({ id: 'reading:b', workId: 'work:b', mode: 'listened' }));
  state = second.readingState;
  assert.equal(first.formalDayAdded, true);
  assert.equal(second.formalDayAdded, false);
  assert.equal(Object.keys(state.records).length, 2);
  assert.deepEqual(state.formalDayKeys, ['2026-7-15']);
  assert.deepEqual(second.eventPayloads.map(({ type }) => type), ['ReadingRecorded', 'BookStatusChanged']);
  assert.deepEqual(second.eventPayloads[0].payload.record, state.records['reading:b']);
});

test('the integration-facing helper rejects reading before explicit challenge registration', () => {
  assert.equal(recordReading(unstartedState(), record()).reason, 'challengeNotStarted');
  const started = startStandaloneChallenge(at(2026, 7, 15)).challenge;
  const result = recordReading({ ...unstartedState(), challenge: started }, record());
  assert.equal(result.ok, true);
});

test('later-day rereading develops the same work without creating a new work identity', () => {
  let state = recordReading(emptyState(), record({ id: 'reading:first' })).readingState;
  state = recordReading(state, record({ id: 'reading:same-day', confirmedAt: at(2026, 7, 15, 20) })).readingState;
  const later = recordReading(state, record({ id: 'reading:later', confirmedAt: at(2026, 7, 18) }));
  assert.equal(later.formalDayAdded, true);
  assert.deepEqual(later.readingState.formalDayKeys, ['2026-7-15', '2026-7-18']);
  assert.equal(readingsForWork(later.readingState.records, 'work:1').length, 3);
  assert.equal(new Set(Object.values(later.readingState.records).map(({ workId }) => workId)).size, 1);
});

test('paused, not-for-me, and finished readings preserve records and count equally', () => {
  let state = emptyState();
  for (const [index, status] of ['paused', 'not_for_me', 'finished'].entries()) {
    state = recordReading(state, record({
      id: `reading:${status}`,
      confirmedAt: at(2026, 7, 15 + index),
      status
    })).readingState;
  }
  assert.equal(Object.keys(state.records).length, 3);
  assert.deepEqual(state.formalDayKeys, ['2026-7-15', '2026-7-16', '2026-7-17']);
  assert.deepEqual(Object.values(state.records).map(({ status }) => status), ['paused', 'not_for_me', 'finished']);
});

test('replay is idempotent and a conflicting reused reading ID is rejected', () => {
  const original = record();
  const once = recordReading(emptyState(), original);
  const replay = recordReading(once.readingState, original);
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.readingState, once.readingState);
  assert.deepEqual(replay.eventPayloads, []);
  assert.equal(recordReading(once.readingState, { ...original, workId: 'work:other' }).reason, 'readingIdConflict');
});

test('formal day derivation is unique, chronological, and rejects malformed records or state', () => {
  const records = {
    later: record({ id: 'later', confirmedAt: at(2026, 11, 2) }),
    earlier: record({ id: 'earlier', confirmedAt: at(2026, 2, 10) }),
    same: record({ id: 'same', confirmedAt: at(2026, 2, 10, 18) })
  };
  assert.deepEqual(deriveFormalDayKeys(records), { ok: true, dayKeys: ['2026-2-10', '2026-11-2'] });
  assert.equal(deriveFormalDayKeys([{ bad: true }]).ok, false);
  assert.equal(validateReadingState({ ...emptyState(), records, formalDayKeys: ['2026-2-10', '2026-11-2'] }), true);
  assert.equal(validateReadingState({ ...emptyState(), records, formalDayKeys: ['2026-2-10'] }), false);
  assert.equal(recordReading({ ...emptyState(), formalDayKeys: ['2026-7-15'] }, record()).reason, 'invalidReadingState');
});

test('standalone challenge requires an explicit start and derives 0, 10, and 20-day statuses', () => {
  assert.equal(deriveProgramStatus(), ProgramStatuses.NotStarted);
  const started = startStandaloneChallenge(at(2026, 7, 15));
  assert.equal(started.ok, true);
  const days = Array.from({ length: 21 }, (_, index) => `2026-7-${index + 1}`);
  assert.equal(deriveProgramStatus({ challenge: started.challenge, formalDayKeys: [] }), ProgramStatuses.Registered);
  assert.equal(deriveProgramStatus({ challenge: started.challenge, formalDayKeys: days.slice(0, 1) }), ProgramStatuses.Active);
  assert.equal(deriveProgramStatus({ challenge: started.challenge, formalDayKeys: days.slice(0, 9) }), ProgramStatuses.Active);
  assert.equal(deriveProgramStatus({ challenge: started.challenge, formalDayKeys: days.slice(0, 10) }), ProgramStatuses.Halfway);
  assert.equal(deriveProgramStatus({ challenge: started.challenge, formalDayKeys: days.slice(0, 19) }), ProgramStatuses.Halfway);
  assert.equal(deriveProgramStatus({ challenge: started.challenge, formalDayKeys: days.slice(0, 20) }), ProgramStatuses.Completed);
  assert.equal(deriveProgramStatus({ challenge: started.challenge, formalDayKeys: days }), ProgramStatuses.Completed);
  assert.deepEqual(readingProgress({ challenge: started.challenge, formalDayKeys: days.slice(0, 10) }), {
    status: 'halfway', readingDayCount: 10,
    halfwayDayCount: STANDALONE_HALFWAY_DAYS, goalDayCount: STANDALONE_GOAL_DAYS
  });
  assert.deepEqual(started.challenge, {
    registeredAt: new Date(at(2026, 7, 15)).toISOString(), goalDays: 20, halfwayDays: 10
  });
  assert.equal(Object.hasOwn(started.challenge, 'deadline'), false);
});

test('challenge and formal-day status inputs fail safely when malformed', () => {
  assert.equal(startStandaloneChallenge('today').ok, false);
  assert.throws(() => deriveProgramStatus({ challenge: {}, formalDayKeys: [] }), /Invalid standalone challenge/);
  assert.throws(() => deriveProgramStatus({
    challenge: startStandaloneChallenge(at(2026, 7, 15)).challenge,
    formalDayKeys: ['2026-07-15']
  }), /Invalid formal reading days/);
});
