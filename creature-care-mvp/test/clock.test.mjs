import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at, H, content } from './helpers.mjs';
import { computeElapsedMs, onOpen, checkDayRollover } from '../src/systems/clock.js';
import { initialState, dayKeyOf } from '../src/state.js';
import { EventTypes } from '../src/events.js';
import { SAVE_KEY } from '../src/systems/persistence.js';

function freshHatchedSave(storage) {
  const s = openSession(storage, at(0));
  s.hatch(at(0));
  return s;
}

test('drift on open: Fullness -4/h, Spirit -2/h, Energy +5/h (closed only), clamped', () => {
  const storage = createFakeStorage();
  const s0 = freshHatchedSave(storage);
  s0.act('play', at(0)); // F80 S100 E90 at close
  const s1 = openSession(storage, at(5));
  assert.deepEqual(s1.state.stats, { fullness: 60, spirit: 90, energy: 100 });
  const drift = s1.openEvents.find((e) => e.type === EventTypes.TimeElapsed);
  assert.equal(drift.elapsedMs, 5 * H);
});

test('backward clock: elapsed clamps to 0 and nothing changes at all', () => {
  const storage = createFakeStorage();
  freshHatchedSave(storage);
  const savedRaw = storage.getItem(SAVE_KEY);
  const s = openSession(storage, at(-5)); // 5pm -> noon, same local date
  assert.deepEqual(s.openEvents, []);
  assert.deepEqual(s.state.stats, { fullness: 80, spirit: 80, energy: 100 });
  assert.equal(storage.getItem(SAVE_KEY), savedRaw, 'save untouched');
});

test('no double-drift after a backward clock: lastSeen keeps its max', () => {
  const storage = createFakeStorage();
  const s0 = freshHatchedSave(storage);
  s0.act('feed', at(0)); // F100
  const back = openSession(storage, at(-5));
  back.act('feed', at(-5)); // acting while the clock is behind saves with an earlier now
  const later = openSession(storage, at(1)); // clock returns: only 1h has truly passed
  const drift = later.openEvents.find((e) => e.type === EventTypes.TimeElapsed);
  assert.equal(drift.elapsedMs, 1 * H, 'drift measured from the max lastSeen');
  assert.equal(later.state.stats.fullness, 96); // 100 - 4*1
});

test('forward jump beyond 72h is treated as exactly 72h', () => {
  assert.equal(computeElapsedMs(at(0), at(100)), 72 * H);
  assert.equal(computeElapsedMs(at(0), at(72)), 72 * H);
  assert.equal(computeElapsedMs(at(0), at(26)), 26 * H);
  assert.equal(computeElapsedMs(at(0), at(-3)), 0);
});

test('day rollover on open resets the daily cap', () => {
  const storage = createFakeStorage();
  const s0 = freshHatchedSave(storage);
  s0.visit(at(0));
  assert.equal(s0.state.cp, 3);
  assert.equal(s0.state.actionsToday, 3);

  const sameDay = openSession(storage, at(3)); // 8pm, same date: no rollover
  assert.equal(sameDay.openEvents.some((e) => e.type === EventTypes.DayRolledOver), false);
  assert.equal(sameDay.state.actionsToday, 3);

  const nextDay = openSession(storage, at(24));
  assert.equal(nextDay.openEvents.some((e) => e.type === EventTypes.DayRolledOver), true);
  assert.equal(nextDay.state.actionsToday, 0);
  assert.equal(nextDay.state.dayKey, dayKeyOf(at(24)));
  nextDay.act('feed', at(24));
  assert.equal(nextDay.state.cp, 4, 'cap re-grants CP after the date change');
});

test('day rollover is lazy: an action after midnight resets the cap mid-session', () => {
  const storage = createFakeStorage();
  const s = freshHatchedSave(storage);
  s.visit(at(0));
  s.act('tidy', at(0)); // 4th action today: 0 CP
  assert.equal(s.state.cp, 3);
  // Same session, played past midnight (5pm + 7h = midnight sharp).
  const result = s.act('tidy', at(7));
  assert.equal(result.ok, true);
  const kinds = s.log.slice(-2).map((e) => e.type);
  assert.deepEqual(kinds, [EventTypes.DayRolledOver, EventTypes.CareActionPerformed]);
  assert.equal(s.state.cp, 4, 'first action of the new date grants CP again');
  assert.equal(s.state.actionsToday, 1);
});

test('the egg ignores the clock: no events before hatch', () => {
  assert.deepEqual(onOpen(initialState(), at(0), at(50)), []);
  assert.equal(checkDayRollover(initialState(), at(50)), null);
});

test('tuck-in is theatrical: any action wakes, and reopening wakes too', () => {
  const storage = createFakeStorage();
  const s = freshHatchedSave(storage);
  s.tuck(at(0));
  assert.equal(s.state.tuckedIn, true);
  s.act('feed', at(0));
  assert.equal(s.state.tuckedIn, false, 'an action wakes the creature');

  s.tuck(at(0));
  const tomorrow = openSession(storage, at(24));
  assert.equal(tomorrow.state.tuckedIn, false, 'a new visit wakes the creature');
});

test('tuck-in locks nothing: stats and CP march on normally afterwards', () => {
  const storage = createFakeStorage();
  const s = freshHatchedSave(storage);
  s.tuck(at(0));
  s.act('play', at(0));
  assert.deepEqual(s.state.stats, { fullness: 80, spirit: 100, energy: 90 });
  assert.equal(s.state.cp, 1);
});
