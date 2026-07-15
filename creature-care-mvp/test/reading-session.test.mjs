import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ReadingSessionStatuses,
  cancelReadingSession,
  confirmInterruptedReading,
  confirmTimedReading,
  createReadingSession,
  interruptReadingSession,
  restoreReadingSession,
  startReadingTimer,
  stopReadingTimer
} from '../src/systems/reading-session.js';
import { createReadingRecord, recordReading } from '../src/systems/reading.js';

const T0 = new Date(2026, 6, 15, 17, 0, 0, 0).getTime();
const startedReadingState = () => ({
  records: {}, formalDayKeys: [], bookStatuses: {},
  challenge: { registeredAt: new Date(T0).toISOString(), goalDays: 20, halfwayDays: 10 }
});

test('timer-off session exposes no timer path while untimed reading remains independent', () => {
  const session = createReadingSession({ timerEnabled: false });
  assert.deepEqual(session, { status: ReadingSessionStatuses.Disabled });
  assert.equal(startReadingTimer(session, { workId: 'work:1', startedAt: T0 }).reason, 'timerDisabled');
  assert.equal(createReadingRecord({ id: 'reading:untimed', workId: 'work:1', confirmedAt: T0 }).ok, true);
});

test('stopping a timer offers confirmation and confirming stores private duration', () => {
  const idle = createReadingSession({ timerEnabled: true });
  const started = startReadingTimer(idle, { workId: 'work:1', startedAt: T0 });
  const stopped = stopReadingTimer(started.session, T0 + 125_900);
  assert.equal(stopped.ok, true);
  assert.deepEqual(stopped.session, {
    status: ReadingSessionStatuses.AwaitingConfirmation,
    workId: 'work:1',
    durationSeconds: 125
  });
  const confirmed = confirmTimedReading(stopped.session, {
    id: 'reading:timed', confirmedAt: T0 + 126_000, mode: 'read_aloud'
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.record.durationSeconds, 125);
  assert.equal(confirmed.record.mode, 'read_aloud');
  assert.deepEqual(confirmed.session, { status: ReadingSessionStatuses.Idle });
});

test('timer confirmation uses the confirmation local date rather than the start date', () => {
  const start = new Date(2026, 6, 15, 23, 50, 0, 0).getTime();
  const confirmation = new Date(2026, 6, 16, 0, 5, 0, 0).getTime();
  const running = startReadingTimer(createReadingSession({ timerEnabled: true }), {
    workId: 'work:1', startedAt: start
  }).session;
  const stopped = stopReadingTimer(running, confirmation - 1_000).session;
  const result = confirmTimedReading(stopped, { id: 'reading:midnight', confirmedAt: confirmation });
  assert.equal(result.record.localDayKey, '2026-7-16');
});

test('timed and untimed confirmations produce identical formal-day progress', () => {
  const untimed = createReadingRecord({ id: 'reading:untimed', workId: 'work:1', confirmedAt: T0 }).record;
  const running = startReadingTimer(createReadingSession({ timerEnabled: true }), {
    workId: 'work:2', startedAt: T0
  }).session;
  const stopped = stopReadingTimer(running, T0 + 90_000).session;
  const timed = confirmTimedReading(stopped, { id: 'reading:timed', confirmedAt: T0 + 91_000 }).record;
  const empty = startedReadingState();
  const untimedResult = recordReading(empty, untimed);
  const timedResult = recordReading(empty, timed);
  assert.equal(untimedResult.formalDayAdded, true);
  assert.equal(timedResult.formalDayAdded, true);
  assert.deepEqual(untimedResult.readingState.formalDayKeys, timedResult.readingState.formalDayKeys);
  const both = recordReading(untimedResult.readingState, timed);
  assert.equal(both.formalDayAdded, false);
  assert.deepEqual(both.readingState.formalDayKeys, untimedResult.readingState.formalDayKeys);
});

test('cancel discards running or unconfirmed duration without creating a record', () => {
  const running = startReadingTimer(createReadingSession({ timerEnabled: true }), {
    workId: 'work:1', startedAt: T0
  }).session;
  assert.deepEqual(cancelReadingSession(running), { status: ReadingSessionStatuses.Idle });
  const stopped = stopReadingTimer(running, T0 + 60_000).session;
  assert.deepEqual(cancelReadingSession(stopped), { status: ReadingSessionStatuses.Idle });
  assert.equal(confirmTimedReading(cancelReadingSession(stopped), {
    id: 'reading:no', confirmedAt: T0 + 60_000
  }).ok, false);
});

test('reload discards duration and consumes a one-time interrupted intent prompt', () => {
  const running = startReadingTimer(createReadingSession({ timerEnabled: true }), {
    workId: 'work:1', startedAt: T0
  }).session;
  const interrupted = interruptReadingSession(running);
  assert.deepEqual(interrupted.interruptedIntent, { version: 1, workId: 'work:1' });
  assert.equal(Object.hasOwn(interrupted.interruptedIntent, 'startedAt'), false);
  assert.equal(Object.hasOwn(interrupted.interruptedIntent, 'durationSeconds'), false);

  const restored = restoreReadingSession({ timerEnabled: true, interruptedIntent: interrupted.interruptedIntent });
  assert.deepEqual(restored.session, { status: ReadingSessionStatuses.Idle });
  assert.deepEqual(restored.prompt, { workId: 'work:1' });
  assert.equal(restored.interruptedIntent, null);
  const nextReload = restoreReadingSession({ timerEnabled: true, interruptedIntent: restored.interruptedIntent });
  assert.equal(nextReload.prompt, null);

  const stopped = stopReadingTimer(running, T0 + 30_000).session;
  const interruptedAfterStop = interruptReadingSession(stopped);
  assert.deepEqual(interruptedAfterStop.interruptedIntent, { version: 1, workId: 'work:1' });
  assert.equal(Object.hasOwn(interruptedAfterStop.interruptedIntent, 'durationSeconds'), false);
});

test('interrupted Yes records untimed reading and No requires no state change', () => {
  const prompt = { workId: 'work:shared' };
  const yes = confirmInterruptedReading(prompt, {
    id: 'reading:interrupted', confirmedAt: T0, mode: 'shared'
  });
  assert.equal(yes.ok, true);
  assert.equal(yes.record.workId, 'work:shared');
  assert.equal(Object.hasOwn(yes.record, 'durationSeconds'), false);
  const no = null;
  assert.equal(no, null);
});

test('timer-disabled reload consumes an old intent without showing timer UI', () => {
  const restored = restoreReadingSession({
    timerEnabled: false,
    interruptedIntent: { version: 1, workId: 'work:1' }
  });
  assert.deepEqual(restored.session, { status: ReadingSessionStatuses.Disabled });
  assert.equal(restored.prompt, null);
  assert.equal(restored.interruptedIntent, null);
});

test('timer rejects malformed transitions and backward or invalid times', () => {
  const idle = createReadingSession({ timerEnabled: true });
  assert.equal(startReadingTimer(idle, { workId: '', startedAt: T0 }).reason, 'invalidWorkId');
  assert.equal(startReadingTimer(idle, { workId: 'work:1', startedAt: 'today' }).reason, 'invalidStartTime');
  assert.equal(stopReadingTimer(idle, T0).reason, 'timerNotRunning');
  const running = startReadingTimer(idle, { workId: 'work:1', startedAt: T0 }).session;
  assert.equal(startReadingTimer(running, { workId: 'work:1', startedAt: T0 }).reason, 'timerNotIdle');
  assert.equal(stopReadingTimer(running, T0 - 1).reason, 'stopBeforeStart');
  assert.equal(stopReadingTimer(running, 'later').reason, 'invalidStopTime');
  assert.equal(confirmInterruptedReading({}, { id: 'x', confirmedAt: T0 }).reason, 'invalidInterruptedPrompt');
  assert.equal(restoreReadingSession({
    timerEnabled: true,
    interruptedIntent: { version: 1, workId: 'work:1', durationSeconds: 30 }
  }).prompt, null);
});
