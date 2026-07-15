// Reproduces the brief's machine-generated worked example EXACTLY.
// Install Tuesday 5pm; full visit (Feed, Play, Tidy) daily at 5pm; skip the weekend.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at, H } from './helpers.mjs';
import { moodOf, applyEvent } from '../src/state.js';
import { EventTypes } from '../src/events.js';
import { onOpen } from '../src/systems/clock.js';
import { createPersistence } from '../src/systems/persistence.js';

const snap = (state) => ({
  f: state.stats.fullness,
  s: state.stats.spirit,
  e: state.stats.energy,
  cp: state.cp,
  stage: state.stage,
  mood: moodOf(state)
});

// Tue 5pm hatch + Wed/Thu/Fri full visits -> the "typical close" F45 S91 E90, 12 CP.
function playThroughFriday(storage, collect = []) {
  let s = openSession(storage, at(0));
  s.hatch(at(0));
  s.visit(at(0));
  collect.push(...s.log);
  for (const h of [24, 48, 72]) {
    s = openSession(storage, at(h));
    s.visit(at(h));
    collect.push(...s.log);
  }
  return s;
}

test('worked example: the four daily rows, cell by cell', () => {
  const storage = createFakeStorage();
  const fullLog = [];

  // Tue 5pm hatch
  let s = openSession(storage, at(0));
  s.hatch(at(0));
  assert.deepEqual(snap(s.state), { f: 80, s: 80, e: 100, cp: 0, stage: 1, mood: 'beaming' });
  s.visit(at(0));
  assert.deepEqual(snap(s.state), { f: 100, s: 100, e: 90, cp: 3, stage: 1, mood: 'beaming' });
  fullLog.push(...s.log);

  // Wed 5pm
  s = openSession(storage, at(24));
  assert.deepEqual(snap(s.state), { f: 4, s: 52, e: 100, cp: 3, stage: 1, mood: 'peckish' });
  s.visit(at(24));
  assert.deepEqual(snap(s.state), { f: 49, s: 97, e: 90, cp: 6, stage: 1, mood: 'content' });
  fullLog.push(...s.log);

  // Thu 5pm
  s = openSession(storage, at(48));
  assert.deepEqual(snap(s.state), { f: 0, s: 49, e: 100, cp: 6, stage: 1, mood: 'peckish' });
  s.visit(at(48));
  assert.deepEqual(snap(s.state), { f: 45, s: 94, e: 90, cp: 9, stage: 1, mood: 'content' });
  fullLog.push(...s.log);

  // Fri 5pm — Stage 2 fires with the visit's third CP
  s = openSession(storage, at(72));
  assert.deepEqual(snap(s.state), { f: 0, s: 46, e: 100, cp: 9, stage: 1, mood: 'peckish' });
  s.visit(at(72));
  assert.deepEqual(snap(s.state), { f: 45, s: 91, e: 90, cp: 12, stage: 2, mood: 'content' });
  fullLog.push(...s.log);
  const grown = fullLog.filter((e) => e.type === EventTypes.CreatureStateChanged);
  assert.deepEqual(grown.map((e) => e.stage), [2], 'Stage 2 exactly once, on day 4');

  // CP monotonically increasing across the whole event log
  let cp = 0;
  for (const e of fullLog) {
    const next =
      cp +
      (e.type === EventTypes.CareActionPerformed ? e.cpGranted : 0) +
      (e.type === EventTypes.ResourceGranted ? Math.max(0, e.cp) : 0);
    assert.ok(next >= cp);
    cp = next;
  }
  assert.equal(cp, 12);
});

test('worked example: Mon 5pm after the weekend (72h away) — decay, then wake-up', () => {
  const storage = createFakeStorage();
  playThroughFriday(storage);

  // Intermediate cell: "decays to F0 S0 E100" (drift applied, before the gift).
  const peek = createPersistence(storage).load();
  const openEvents = onOpen(peek.state, peek.lastSeen, at(144));
  assert.deepEqual(
    openEvents.map((e) => e.type),
    [EventTypes.TimeElapsed, EventTypes.DayRolledOver, EventTypes.GiftGranted]
  );
  assert.equal(openEvents[0].elapsedMs, 72 * H);
  const drifted = applyEvent(peek.state, openEvents[0]);
  assert.deepEqual(snap(drifted), { f: 0, s: 0, e: 100, cp: 12, stage: 2, mood: 'sleepy' });

  // Full open: wake-up, exactly 1 sticker, F60 S60 E100, 12 CP -> Content.
  const monday = openSession(storage, at(144));
  assert.equal(
    monday.openEvents.filter((e) => e.type === EventTypes.GiftGranted).length,
    1
  );
  assert.equal(monday.state.stickers.length, 1);
  assert.deepEqual(snap(monday.state), { f: 60, s: 60, e: 100, cp: 12, stage: 2, mood: 'content' });
});

test('worked example: from the typical close, +26h is a normal visit with no gift', () => {
  const storage = createFakeStorage();
  playThroughFriday(storage); // typical close: F45 S91 E90
  const s = openSession(storage, at(72 + 26));
  assert.equal(s.openEvents.some((e) => e.type === EventTypes.GiftGranted), false);
  assert.equal(s.state.stickers.length, 0);
  assert.deepEqual(snap(s.state), { f: 0, s: 39, e: 100, cp: 12, stage: 2, mood: 'peckish' });
});

test('worked example: from the typical close, +40h is an absence — 1 gift, F60 S60 E100 -> Content', () => {
  const storage = createFakeStorage();
  playThroughFriday(storage);
  const s = openSession(storage, at(72 + 40));
  assert.equal(
    s.openEvents.filter((e) => e.type === EventTypes.GiftGranted).length,
    1
  );
  assert.deepEqual(snap(s.state), { f: 60, s: 60, e: 100, cp: 12, stage: 2, mood: 'content' });
});

test('worked example: Stage 3 lands after 6 more full-visit days (day ~10 of ownership)', () => {
  const storage = createFakeStorage();
  const fullLog = [];
  playThroughFriday(storage, fullLog); // day 4: 12 CP, Stage 2
  const moreDays = [96, 120, 144, 168, 192, 216];
  let s;
  for (const h of moreDays) {
    s = openSession(storage, at(h));
    assert.equal(
      s.openEvents.some((e) => e.type === EventTypes.GiftGranted),
      false,
      'daily visits never trigger the absence flow'
    );
    s.visit(at(h));
    fullLog.push(...s.log);
  }
  assert.equal(s.state.cp, 30);
  assert.equal(s.state.stage, 3);
  const grown = fullLog.filter((e) => e.type === EventTypes.CreatureStateChanged);
  assert.deepEqual(grown.map((e) => e.stage), [2, 3]);
  assert.equal(grown[1].at, at(216), 'Stage 3 fires on the 6th extra visit day');
});
