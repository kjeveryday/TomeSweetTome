import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at } from './helpers.mjs';
import { moodOf } from '../src/state.js';
import { EventTypes } from '../src/events.js';
import * as care from '../src/systems/care.js';
import { initialState } from '../src/state.js';

test('hatching sets the initial creature: F80 S80 E100, named, beaming, day recorded', () => {
  const s = openSession(createFakeStorage(), at(0));
  assert.equal(s.state.hatched, false);
  s.hatch(at(0));
  assert.equal(s.state.hatched, true);
  assert.equal(s.state.name, 'Pip');
  assert.deepEqual(s.state.stats, { fullness: 80, spirit: 80, energy: 100 });
  assert.equal(s.state.cp, 0);
  assert.equal(s.state.stage, 1);
  assert.equal(moodOf(s.state), 'beaming');
  assert.ok(s.state.dayKey);
});

test('feed adds +45 Fullness, clamped to 100, energy untouched', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  const result = s.act('feed', at(0));
  assert.equal(result.ok, true);
  assert.deepEqual(s.state.stats, { fullness: 100, spirit: 80, energy: 100 });
});

test('play adds +25 Spirit and costs 10 Energy; tidy adds +20 Spirit', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.act('play', at(0));
  assert.deepEqual(s.state.stats, { fullness: 80, spirit: 100, energy: 90 });
  s.act('tidy', at(0));
  assert.deepEqual(s.state.stats, { fullness: 80, spirit: 100, energy: 90 });
});

test('daily cap: first 3 actions grant 1 CP each; extras grant 0 CP but still change stats', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.act('play', at(0)); // E 90
  s.act('play', at(0)); // E 80
  s.act('play', at(0)); // E 70
  assert.equal(s.state.cp, 3);
  assert.equal(s.state.actionsToday, 3);
  const before = s.state.stats.energy;
  const result = s.act('play', at(0)); // 4th action: 0 CP, still works
  assert.equal(result.ok, true);
  assert.equal(s.state.cp, 3);
  assert.equal(s.state.actionsToday, 4);
  assert.equal(s.state.stats.energy, before - 10);
  const grants = s.log
    .filter((e) => e.type === EventTypes.CareActionPerformed)
    .map((e) => e.cpGranted);
  assert.deepEqual(grants, [1, 1, 1, 0]);
});

test('energy gate: Play needs Energy >= 10; feed/tidy stay available', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0)); // E 100
  for (let i = 0; i < 10; i += 1) {
    const r = s.act('play', at(0));
    assert.equal(r.ok, true, `play ${i} should be allowed`);
  }
  assert.equal(s.state.stats.energy, 0);
  const blocked = s.act('play', at(0));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'lowEnergy');
  assert.equal(s.state.actionsToday, 10); // rejected play adds no event
  assert.equal(s.act('feed', at(0)).ok, true);
  assert.equal(s.act('tidy', at(0)).ok, true);
});

test('canPerform reports the gate at exactly the threshold', () => {
  const base = initialState();
  const withEnergy = (energy) => ({
    ...base, hatched: true, stats: { ...base.stats, energy }
  });
  assert.equal(care.canPerform(withEnergy(10), 'play').ok, true);
  assert.equal(care.canPerform(withEnergy(9), 'play').ok, false);
  assert.equal(care.canPerform(withEnergy(0), 'feed').ok, true);
});

test('actions are rejected before hatch and for unknown ids', () => {
  const s = openSession(createFakeStorage(), at(0));
  assert.equal(s.act('feed', at(0)).ok, false);
  assert.equal(s.act('feed', at(0)).reason, 'notHatched');
  s.hatch(at(0));
  const r = s.act('nap', at(0));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknownAction');
  assert.equal(s.state.actionsToday, 0);
});
