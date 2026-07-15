import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at } from './helpers.mjs';
import { EventTypes } from '../src/events.js';
import { checkGrowthAfterEvent } from '../src/systems/growth.js';

const stageEvents = (log) => log.filter((e) => e.type === EventTypes.CreatureStateChanged);

function assertCpMonotonic(log, finalCp) {
  // Replay the event log: CP must never decrease, and must land on the state's CP.
  let previous = 0;
  let cp = 0;
  for (const e of log) {
    if (e.type === EventTypes.CareActionPerformed) cp += e.cpGranted;
    if (e.type === EventTypes.ResourceGranted) cp += Math.max(0, e.cp);
    assert.ok(cp >= previous, 'CP is monotonically increasing across the event log');
    previous = cp;
  }
  assert.equal(cp, finalCp, 'log replay matches state CP');
}

test('Stage 2 fires exactly at 12 CP, Stage 3 exactly at 30 CP', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.grant(11, at(0));
  assert.equal(s.state.cp, 11);
  assert.equal(s.state.stage, 1);
  s.grant(1, at(0));
  assert.equal(s.state.cp, 12);
  assert.equal(s.state.stage, 2);
  s.grant(17, at(0));
  assert.equal(s.state.cp, 29);
  assert.equal(s.state.stage, 2);
  s.grant(1, at(0));
  assert.equal(s.state.cp, 30);
  assert.equal(s.state.stage, 3);
  assert.deepEqual(stageEvents(s.log).map((e) => e.stage), [2, 3]);
  assertCpMonotonic(s.log, s.state.cp);
});

test('3 actions a day for 4 days -> Stage 2 on day 4 at 12 CP; CP monotonic in the log', () => {
  const storage = createFakeStorage();
  const fullLog = []; // ownership-long event log, across sessions
  let s = openSession(storage, at(0));
  s.hatch(at(0));
  s.visit(at(0));
  fullLog.push(...s.log);
  const days = [24, 48, 72];
  for (const h of days) {
    s = openSession(storage, at(h));
    s.visit(at(h));
    fullLog.push(...s.log);
  }
  assert.equal(s.state.cp, 12);
  assert.equal(s.state.stage, 2);
  const grown = stageEvents(fullLog);
  assert.deepEqual(grown.map((e) => e.stage), [2], 'stage 2 fires exactly once, on day 4');
  assert.equal(grown[0].at, at(72), 'and it fires on day 4');
  assertCpMonotonic(fullLog, s.state.cp);
});

test('a single big grant climbs one stage at a time (each threshold celebrated once)', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.grant(40, at(0));
  assert.equal(s.state.stage, 3);
  assert.deepEqual(stageEvents(s.log).map((e) => e.stage), [2, 3]);
});

test('no stage beyond 3: extra CP keeps counting, nothing else changes', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.grant(30, at(0));
  assert.equal(s.state.stage, 3);
  s.grant(50, at(0));
  assert.equal(s.state.cp, 80);
  assert.equal(s.state.stage, 3);
  assert.equal(stageEvents(s.log).length, 2);
});

test('ResourceGranted bypasses the daily cap and counts toward growth', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.visit(at(0)); // 3 CP: cap exhausted
  s.act('tidy', at(0)); // 0 CP
  assert.equal(s.state.cp, 3);
  s.grant(9, at(0)); // bonus CP ignores the cap...
  assert.equal(s.state.cp, 12);
  assert.equal(s.state.stage, 2, '...and pushes growth over the threshold');
  assertCpMonotonic(s.log, s.state.cp);
});

test('CP is monotonic: negative or zero grants are ignored', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.grant(5, at(0));
  s.grant(-3, at(0));
  s.grant(0, at(0));
  assert.equal(s.state.cp, 5);
});

test('reading and book events cannot trigger overdue growth', () => {
  const staleThresholdState = {
    hatched: true, stage: 1, cp: 12
  };
  for (const type of [
    EventTypes.ReadingChallengeStarted,
    EventTypes.ReadingRecorded,
    EventTypes.ReadingDayRecorded,
    EventTypes.BookStatusChanged
  ]) {
    assert.deepEqual(checkGrowthAfterEvent(staleThresholdState, { type }, at(0)), []);
  }
  assert.equal(
    checkGrowthAfterEvent(staleThresholdState, { type: EventTypes.ResourceGranted }, at(0))[0].stage,
    2
  );
});
