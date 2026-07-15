import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at } from './helpers.mjs';
import { createPersistence, SAVE_KEY } from '../src/systems/persistence.js';
import { initialState } from '../src/state.js';

test('round-trip: save after every event, reload restores the exact state', () => {
  const storage = createFakeStorage();
  const s = openSession(storage, at(0));
  s.hatch(at(0));
  s.act('feed', at(0));
  const snapshot = structuredClone(s.state);

  const reloaded = openSession(storage, at(0)); // reopen immediately
  assert.deepEqual(reloaded.state, snapshot);
});

test('save is written under the exact key creatureCare.save.v1 with {state, lastSeen}', () => {
  const storage = createFakeStorage();
  const s = openSession(storage, at(0));
  s.hatch(at(0));
  const raw = storage.getItem(SAVE_KEY);
  assert.equal(SAVE_KEY, 'creatureCare.save.v1');
  assert.ok(raw, 'save exists under the spec key');
  const data = JSON.parse(raw);
  assert.deepEqual(Object.keys(data).sort(), ['lastSeen', 'state']);
  assert.equal(data.lastSeen, at(0));
});

test('kill mid-visit: reopen matches the last persisted event exactly', () => {
  const storage = createFakeStorage();
  const s = openSession(storage, at(0));
  s.hatch(at(0));
  s.act('feed', at(0));
  s.act('play', at(0));
  const afterPlay = structuredClone(s.state);
  // App "killed" here — the third action never happens.
  const reopened = openSession(storage, at(0));
  assert.deepEqual(reopened.state, afterPlay);
  assert.equal(reopened.state.actionsToday, 2);
  assert.equal(reopened.state.cp, 2);
});

test('lastSeen never moves backward: save with an earlier now keeps the max', () => {
  const storage = createFakeStorage();
  const p = createPersistence(storage);
  const state = initialState();
  p.save(state, at(10));
  p.save(state, at(5)); // device clock moved back
  const data = JSON.parse(storage.getItem(SAVE_KEY));
  assert.equal(data.lastSeen, at(10));
  p.save(state, at(11));
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).lastSeen, at(11));
});

test('corrupted or foreign saves load as null (fresh start, no crash)', () => {
  const storage = createFakeStorage();
  storage.setItem(SAVE_KEY, '{not json');
  assert.equal(createPersistence(storage).load(), null);
  storage.setItem(SAVE_KEY, JSON.stringify({ nope: true }));
  assert.equal(createPersistence(storage).load(), null);
  storage.removeItem(SAVE_KEY);
  assert.equal(createPersistence(storage).load(), null);
});
