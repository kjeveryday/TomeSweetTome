// INDEPENDENT VERIFICATION SUITE — persistence & migration (adversarial).
// Written by a reviewer who did not author src/systems/persistence.js or src/state.js.
// Goal: try to REFUTE the invariants below; a passing test is evidence, not a badge.
//
// Invariants under test:
//  A. Save key is exactly `creatureCare.save.v1`, holding {state, lastSeen}, written
//     synchronously after every single event (not batched/deferred).
//  B. Corrupted or foreign saves load as null -> fresh start, no crash/throw, across
//     every corruption class: malformed JSON, wrong-shape valid JSON, missing required
//     fields, null, empty string, a save under a different/legacy key, extra fields.
//  C. App killed mid-action -> reopen matches the last persisted event EXACTLY
//     (round-trip fidelity), hammered across a long, varied event sequence.
//  D. Pre-generator saves (valid saves predating creature/creatureHistory) remain
//     valid and are NOT rejected as corrupt -- the key migration boundary, deliberately
//     tested back-to-back with genuinely-corrupt "missing required field" saves so the
//     two cannot be confused.
//  E. Applying CreatureGenerated preserves all care/growth/sticker/cap/clock state;
//     prior generated identities land in creatureHistory; same-isbn re-generation does
//     not duplicate history; malformed payloads are ignored, not thrown.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at, H, content } from './helpers.mjs';
import { createPersistence, SAVE_KEY } from '../src/systems/persistence.js';
import { initialState, applyEvent } from '../src/state.js';
import { hatched, careActionPerformed, creatureGenerated, tuckedIn as tuckedInEvent } from '../src/events.js';
import { generateCreature } from '../src/systems/generation.js';

// ---------------------------------------------------------------------------
// A. Synchronous save after EVERY event, exact key, exact shape
// ---------------------------------------------------------------------------

test('A: every individual event is persisted synchronously under SAVE_KEY (not batched)', () => {
  const storage = createFakeStorage();
  const persistence = createPersistence(storage);
  let state = initialState();

  function commitAndCheckOnDisk(event) {
    state = applyEvent(state, event);
    persistence.save(state, event.at);
    const onDisk = JSON.parse(storage.getItem(SAVE_KEY));
    assert.deepEqual(onDisk.state, state, `storage reflects state immediately after ${event.type}`);
  }

  assert.equal(SAVE_KEY, 'creatureCare.save.v1');
  commitAndCheckOnDisk(hatched(at(0)));
  commitAndCheckOnDisk(careActionPerformed('feed', 1, at(0)));
  commitAndCheckOnDisk(careActionPerformed('play', 1, at(0)));
  commitAndCheckOnDisk(careActionPerformed('tidy', 1, at(0)));
  commitAndCheckOnDisk(tuckedInEvent(at(0)));
});

// ---------------------------------------------------------------------------
// B. Corrupted / foreign saves -> null, no throw (every corruption class)
// ---------------------------------------------------------------------------

test('B1: no save present at all (fresh install) loads as null, no throw', () => {
  const storage = createFakeStorage();
  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.equal(result, null);
});

test('B2: malformed JSON (including empty string) loads as null, no throw', () => {
  const cases = ['{not json', '{"state":{}', '{"state": "abc}', "{'state':1}", 'undefined', 'function(){}', '{,}', ''];
  for (const raw of cases) {
    const storage = createFakeStorage();
    storage.setItem(SAVE_KEY, raw);
    const persistence = createPersistence(storage);
    let result;
    assert.doesNotThrow(() => { result = persistence.load(); }, `raw=${JSON.stringify(raw)} must not throw`);
    assert.equal(result, null, `malformed JSON ${JSON.stringify(raw)} must load as null`);
  }
});

test('B3: valid JSON whose top level is a primitive or array loads as null, no throw', () => {
  const cases = ['42', '"just a string"', 'true', 'false', '"null"', '[]', '[1,2,3]', 'null', '{}'];
  for (const raw of cases) {
    const storage = createFakeStorage();
    storage.setItem(SAVE_KEY, raw);
    const persistence = createPersistence(storage);
    let result;
    assert.doesNotThrow(() => { result = persistence.load(); }, `raw=${raw} must not throw`);
    assert.equal(result, null, `top-level payload ${raw} must load as null`);
  }
});

test('B4: a save under a different/legacy key is invisible to v1 load() -> null, foreign keys untouched', () => {
  const storage = createFakeStorage();
  const legacyState = { ...initialState(), hatched: true, name: 'LegacyPip' };
  storage.setItem('creatureCare.save.v0', JSON.stringify({ state: legacyState, lastSeen: 5 }));
  storage.setItem('someOtherApp.saveData', JSON.stringify({ whatever: true }));
  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.equal(result, null, 'nothing exists under the real v1 key, so load() must be null');
  assert.ok(storage.getItem('creatureCare.save.v0'), 'unrelated legacy key left untouched');
  assert.ok(storage.getItem('someOtherApp.saveData'), 'unrelated foreign key left untouched');
});

test('B5: extra unknown fields (forward-compatible schema growth) are tolerated, not rejected', () => {
  const storage = createFakeStorage();
  const state = { ...applyEvent(initialState(), hatched(at(0))), fromTheFutureField: 'ignored-gracefully' };
  storage.setItem(SAVE_KEY, JSON.stringify({
    state,
    lastSeen: at(0),
    unknownTopLevelField: 'also ignored'
  }));
  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.ok(result, 'extra fields must not cause rejection');
  assert.equal(result.state.hatched, true);
  assert.equal(result.state.fromTheFutureField, 'ignored-gracefully');
});

test('B6: a save missing top-level lastSeen defaults gracefully to 0, not rejected', () => {
  const storage = createFakeStorage();
  const validState = applyEvent(initialState(), hatched(at(0)));
  storage.setItem(SAVE_KEY, JSON.stringify({ state: validState })); // no lastSeen key at all
  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.ok(result);
  assert.equal(result.lastSeen, 0);
  assert.deepEqual(result.state, validState);
});

test('B6a: required nested stats must all be present and finite numbers', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));
  const cases = [
    ['missing fullness', { spirit: 50, energy: 50 }],
    ['missing spirit', { fullness: 50, energy: 50 }],
    ['missing energy', { fullness: 50, spirit: 50 }],
    ['string fullness', { fullness: '50', spirit: 50, energy: 50 }],
    ['null spirit', { fullness: 50, spirit: null, energy: 50 }],
    ['boolean energy', { fullness: 50, spirit: 50, energy: true }],
    ['object fullness', { fullness: {}, spirit: 50, energy: 50 }],
    ['array spirit', { fullness: 50, spirit: [], energy: 50 }]
  ];

  for (const [label, stats] of cases) {
    const storage = createFakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ state: { ...validState, stats }, lastSeen: at(0) }));
    const persistence = createPersistence(storage);
    let result;
    assert.doesNotThrow(() => { result = persistence.load(); }, label);
    assert.equal(result, null, `${label} must be rejected before it reaches clock or reducer math`);
  }
});

test('B6b: non-finite nested stats are rejected, while extra stat fields remain forward-compatible', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));
  const nonFiniteStats = [
    { fullness: NaN, spirit: 50, energy: 50 },
    { fullness: 50, spirit: Infinity, energy: 50 },
    { fullness: 50, spirit: 50, energy: -Infinity }
  ];

  for (const stats of nonFiniteStats) {
    const storage = createFakeStorage();
    // JSON serializes non-finite numbers as null, matching the corruption actually found on disk.
    storage.setItem(SAVE_KEY, JSON.stringify({ state: { ...validState, stats }, lastSeen: at(0) }));
    assert.equal(createPersistence(storage).load(), null);
  }

  const storage = createFakeStorage();
  const stateWithFutureStat = {
    ...validState,
    stats: { ...validState.stats, futureStat: 123 }
  };
  storage.setItem(SAVE_KEY, JSON.stringify({ state: stateWithFutureStat, lastSeen: at(0) }));
  assert.deepEqual(createPersistence(storage).load().state, stateWithFutureStat,
    'unknown nested stat fields remain intact for forward-compatible schema growth');
});

test('B6c: saved stats accept the configured bounds and reject values outside them', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));
  const { min, max } = content.stats;

  for (const boundary of [min, max]) {
    const storage = createFakeStorage();
    const boundedState = {
      ...validState,
      stats: { fullness: boundary, spirit: boundary, energy: boundary }
    };
    storage.setItem(SAVE_KEY, JSON.stringify({ state: boundedState, lastSeen: at(0) }));
    assert.deepEqual(createPersistence(storage).load().state, boundedState,
      `configured stat boundary ${boundary} must remain loadable`);
  }

  const outOfRangeCases = [
    ['fullness below minimum', { fullness: min - 1, spirit: min, energy: min }],
    ['spirit above maximum', { fullness: max, spirit: max + 1, energy: max }],
    ['energy below minimum', { fullness: min, spirit: min, energy: min - 0.5 }],
    ['energy above maximum', { fullness: max, spirit: max, energy: max + 0.5 }]
  ];

  for (const [label, stats] of outOfRangeCases) {
    const storage = createFakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ state: { ...validState, stats }, lastSeen: at(0) }));
    assert.equal(createPersistence(storage).load(), null, `${label} must be rejected`);
  }
});

test('B6d: every configured stage is accepted and an unknown stage is rejected', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));
  const configuredStages = content.species.stages.map(({ stage }) => stage);

  for (const stage of configuredStages) {
    const storage = createFakeStorage();
    const state = { ...validState, stage };
    storage.setItem(SAVE_KEY, JSON.stringify({ state, lastSeen: at(0) }));
    assert.deepEqual(createPersistence(storage).load().state, state, `configured stage ${stage} must load`);
  }

  const storage = createFakeStorage();
  const unknownStage = Math.max(...configuredStages) + 1;
  storage.setItem(SAVE_KEY, JSON.stringify({ state: { ...validState, stage: unknownStage }, lastSeen: at(0) }));
  assert.equal(createPersistence(storage).load(), null, `unknown stage ${unknownStage} must be rejected`);
});

test('B6e: CP accepts zero and fractions but rejects negative values', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));

  for (const cp of [0, 3.5]) {
    const storage = createFakeStorage();
    const state = { ...validState, cp };
    storage.setItem(SAVE_KEY, JSON.stringify({ state, lastSeen: at(0) }));
    assert.deepEqual(createPersistence(storage).load().state, state, `CP ${cp} must load`);
  }

  const storage = createFakeStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ state: { ...validState, cp: -0.5 }, lastSeen: at(0) }));
  assert.equal(createPersistence(storage).load(), null, 'negative CP must be rejected');
});

test('B6f: actionsToday accepts zero and large integers but rejects negative and fractional values', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));

  for (const actionsToday of [0, 1_000_000]) {
    const storage = createFakeStorage();
    const state = { ...validState, actionsToday };
    storage.setItem(SAVE_KEY, JSON.stringify({ state, lastSeen: at(0) }));
    assert.deepEqual(createPersistence(storage).load().state, state, `actionsToday ${actionsToday} must load`);
  }

  for (const actionsToday of [-1, 1.5]) {
    const storage = createFakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ state: { ...validState, actionsToday }, lastSeen: at(0) }));
    assert.equal(createPersistence(storage).load(), null, `actionsToday ${actionsToday} must be rejected`);
  }
});

test('B6g: dayKey accepts null and strings but rejects other types', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));

  for (const dayKey of [null, '', '2026-07-15', 'future-format']) {
    const storage = createFakeStorage();
    const state = { ...validState, dayKey };
    storage.setItem(SAVE_KEY, JSON.stringify({ state, lastSeen: at(0) }));
    assert.deepEqual(createPersistence(storage).load().state, state, `dayKey ${JSON.stringify(dayKey)} must load`);
  }

  for (const dayKey of [0, false, {}, []]) {
    const storage = createFakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ state: { ...validState, dayKey }, lastSeen: at(0) }));
    assert.equal(createPersistence(storage).load(), null, `dayKey ${JSON.stringify(dayKey)} must be rejected`);
  }
});

test('B6h: unknown string sticker IDs remain compatible but non-string entries are rejected', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));
  const storage = createFakeStorage();
  const stateWithFutureSticker = { ...validState, stickers: ['future-sticker-id'] };
  storage.setItem(SAVE_KEY, JSON.stringify({ state: stateWithFutureSticker, lastSeen: at(0) }));
  assert.deepEqual(createPersistence(storage).load().state, stateWithFutureSticker,
    'unknown string sticker IDs must remain forward-compatible');

  for (const invalidSticker of [null, 1, true, {}, []]) {
    const invalidStorage = createFakeStorage();
    invalidStorage.setItem(SAVE_KEY, JSON.stringify({
      state: { ...validState, stickers: ['known-string', invalidSticker] },
      lastSeen: at(0)
    }));
    assert.equal(createPersistence(invalidStorage).load(), null,
      `non-string sticker ${JSON.stringify(invalidSticker)} must be rejected`);
  }
});

test('B6i: a present lastSeen must be a finite, nonnegative number', () => {
  const validState = applyEvent(initialState(), hatched(at(0)));
  const rawValues = [
    ['null', 'null'],
    ['string', '"123"'],
    ['boolean', 'true'],
    ['negative', '-1'],
    ['positive infinity', '1e400'],
    ['object', '{}'],
    ['array', '[]']
  ];

  for (const [label, rawLastSeen] of rawValues) {
    const storage = createFakeStorage();
    storage.setItem(SAVE_KEY, `{"state":${JSON.stringify(validState)},"lastSeen":${rawLastSeen}}`);
    const persistence = createPersistence(storage);
    let result;
    assert.doesNotThrow(() => { result = persistence.load(); }, label);
    assert.equal(result, null, `${label} lastSeen must fail safe rather than enter clock math`);
    assert.equal(persistence.lastSeen(), 0, `${label} lastSeen must not poison the in-memory timestamp`);
  }
});

test('B6j: invalid save timestamps do not poison knownLastSeen or prevent the new state from being saved', () => {
  const storage = createFakeStorage();
  const persistence = createPersistence(storage);
  const firstState = applyEvent(initialState(), hatched(at(0)));
  persistence.save(firstState, 1234);

  const laterState = { ...firstState, cp: 7 };
  for (const invalidNow of [NaN, Infinity, -Infinity, -1, null, '5678', {}, []]) {
    assert.doesNotThrow(() => persistence.save(laterState, invalidNow));
    assert.equal(persistence.lastSeen(), 1234, `${String(invalidNow)} must not alter knownLastSeen`);
    assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEY)), { state: laterState, lastSeen: 1234 },
      'state still saves synchronously using the last valid timestamp');
  }
});

// --- The sharp edge: "valid JSON of the wrong shape" / "missing required fields" ---
// These are listed in the spec as their OWN corruption class, distinct from malformed
// JSON. Each case below is syntactically valid JSON with a truthy `state` value that is
// nonetheless not a usable GameState. Per the invariant, load() must return null for all
// of them. Documented as DEFECT-CHECK because source inspection shows persistence.js's
// shape guard is `if (!data || typeof data !== 'object' || !data.state) return null;` --
// which only requires `data.state` to be truthy, never validates its shape. See report.

test('B7 DEFECT-CHECK: a "state" that is a non-object primitive must load as null (wrong-shape save)', () => {
  const cases = [
    { state: 'corrupted-string-payload' },
    { state: 42 },
    { state: true }
  ];
  for (const payload of cases) {
    const storage = createFakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(payload));
    const persistence = createPersistence(storage);
    let result;
    assert.doesNotThrow(() => { result = persistence.load(); });
    assert.equal(result, null,
      `payload ${JSON.stringify(payload)}: state is not an object; spec requires load() -> null, got ${JSON.stringify(result)}`);
  }
});

test('B8 DEFECT-CHECK: a "state" that is an array (not a GameState object) must load as null', () => {
  const storage = createFakeStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ state: [1, 2, 3], lastSeen: 5 }));
  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.equal(result, null, `array-shaped state must load as null, got ${JSON.stringify(result)}`);
});

test('B9 DEFECT-CHECK: a "state" object missing ALL required GameState fields must load as null', () => {
  const storage = createFakeStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ state: {}, lastSeen: 5 }));
  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.equal(result, null, `empty-object state (missing hatched/stats/stage/...) must load as null, got ${JSON.stringify(result)}`);
});

test('B10 DEFECT-CHECK: a "state" object from a foreign schema (unrelated fields) must load as null', () => {
  const storage = createFakeStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ state: { totallyUnrelatedApp: true, count: 7 }, lastSeen: 5 }));
  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.equal(result, null, `foreign-schema state must load as null, got ${JSON.stringify(result)}`);
});

test('B11 DEFECT-CHECK / CONTRAST: missing a REQUIRED core field (stats) must be treated as corrupt, ' +
     'distinctly from merely missing the OPTIONAL generator fields (see D-series migration tests)', () => {
  const storage = createFakeStorage();
  // Has hatched/name/stage/cp/actionsToday/dayKey/stickers -- but no `stats`, which every
  // downstream system (mood, care, clock drift) treats as required. Also no creature/
  // creatureHistory, exactly like a legitimate pre-generator save -- the point is that a
  // shape check strict enough to reject THIS should still be loose enough to accept a
  // real pre-generator save (see D1), and right now nothing distinguishes the two cases.
  const brokenCore = { hatched: true, name: 'Pip', stage: 1, cp: 3, actionsToday: 1, dayKey: 'x', stickers: [] };
  storage.setItem(SAVE_KEY, JSON.stringify({ state: brokenCore, lastSeen: at(0) }));
  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.equal(result, null, `state missing required field "stats" should be corrupt, got ${JSON.stringify(result)}`);
});

// ---------------------------------------------------------------------------
// C. Round-trip fidelity: long sequences, kill-mid-action hammering
// ---------------------------------------------------------------------------

test('C1: kill-and-reopen after EVERY event across a 10-day sequence always matches exactly', () => {
  const storage = createFakeStorage();
  let now = at(0);
  let s = openSession(storage, now);
  s.hatch(now);

  for (let day = 0; day < 10; day++) {
    now = at(0) + day * 24 * H;
    s = openSession(storage, now); // simulate a fresh process opening the app that day
    for (const action of content.care.actions) {
      s.act(action.id, now);
      const snapshot = structuredClone(s.state);
      const reopened = openSession(storage, now); // "kill" right here, reopen at same instant
      assert.deepEqual(reopened.state, snapshot, `day ${day}, after ${action.id}: reopen must match exactly`);
      s = reopened;
    }
    s.tuck(now);
    const snapshotAfterTuck = structuredClone(s.state);
    const reopenedAfterTuck = openSession(storage, now);
    assert.deepEqual(reopenedAfterTuck.state, snapshotAfterTuck, `day ${day}: reopen after tuck-in must match exactly`);
    s = reopenedAfterTuck;
  }
  // Sanity: this trajectory should have crossed both growth thresholds along the way.
  assert.equal(s.state.stage, 3, 'sanity: 10 days of full visits should reach stage 3 (30 CP)');
});

test('C2: round-trip fidelity across a long, varied sequence (growth, absence gift, resource grant, generator)', async () => {
  const storage = createFakeStorage();
  const generated1 = (await generateCreature('9780064400558')).creature;
  const generated2 = (await generateCreature('9780590353403')).creature;

  let s = openSession(storage, at(0));
  s.hatch(at(0));
  s.commit(creatureGenerated(generated1, at(0)));
  s.visit(at(0)); // Tue: 3 CP

  s = openSession(storage, at(24));
  s.visit(at(24)); // Wed: 6 CP (crosses a day rollover on open)

  s = openSession(storage, at(48));
  s.visit(at(48)); // Thu: 9 CP

  s = openSession(storage, at(72));
  s.visit(at(72)); // Fri: 12 CP -> stage 2 fires mid-cascade
  s.commit(creatureGenerated(generated2, at(72))); // second identity -> generated1 moves to history
  s.grant(50, at(72)); // ResourceGranted bypasses the cap -> pushes past 30 CP -> stage 3
  s.tuck(at(72));

  const farFuture = at(72) + 40 * H; // >= 36h absence threshold
  s = openSession(storage, farFuture); // TimeElapsed + DayRolledOver + GiftGranted on open

  const snapshot = structuredClone(s.state);
  const reopened = openSession(storage, farFuture); // "kill" then reopen at the SAME instant
  assert.deepEqual(reopened.state, snapshot, 'reopen at the same instant reproduces the exact last-persisted state');

  // Spot checks so a vacuous deepEqual (e.g. both sides accidentally empty) can't hide a defect.
  assert.equal(reopened.state.stage, 3);
  assert.equal(reopened.state.creatureHistory.length, 1);
  assert.equal(reopened.state.creatureHistory[0].isbn, generated1.isbn);
  assert.equal(reopened.state.creature.isbn, generated2.isbn);
  assert.ok(reopened.state.stickers.length >= 1, 'absence gift granted at least one sticker');
  assert.equal(reopened.state.tuckedIn, false, 'a new visit (even the absence wake-up) always wakes the creature');
});

// ---------------------------------------------------------------------------
// D. Migration: pre-generator saves must NOT be rejected as corrupt
// ---------------------------------------------------------------------------

test('D1: a valid pre-generator save (no creature/creatureHistory keys at all) loads successfully, not as corrupt', () => {
  const storage = createFakeStorage();

  // Build the state EXACTLY as v1 would have persisted it before the generator
  // extension existed: run real events through the CURRENT reducer, but strip the
  // two fields the generator extension introduced, since a save written by the old
  // code would never have had them on disk in the first place.
  let legacy = initialState();
  delete legacy.creature;
  delete legacy.creatureHistory;
  legacy = applyEvent(legacy, hatched(at(0)));
  delete legacy.creature; // Hatched doesn't (re)introduce these keys; confirmed defensively
  delete legacy.creatureHistory;
  legacy = applyEvent(legacy, careActionPerformed('feed', 1, at(0)));
  legacy = applyEvent(legacy, careActionPerformed('play', 1, at(0)));

  assert.equal(Object.hasOwn(legacy, 'creature'), false, 'sanity: legacy fixture truly lacks `creature`');
  assert.equal(Object.hasOwn(legacy, 'creatureHistory'), false, 'sanity: legacy fixture truly lacks `creatureHistory`');

  // This JSON blob already existed on disk, written by a pre-generator build.
  storage.setItem(SAVE_KEY, JSON.stringify({ state: legacy, lastSeen: at(0) }));

  const persistence = createPersistence(storage);
  let result;
  assert.doesNotThrow(() => { result = persistence.load(); });
  assert.ok(result, 'a pre-generator save must NOT be rejected as corrupt');
  assert.deepEqual(result.state, legacy, 'pre-generator fields round-trip exactly, untouched');
  assert.equal(result.state.name, content.species.name, 'renders the original Pip (default species name)');
  assert.equal(result.state.hatched, true);
  assert.equal(result.state.cp, 2);
});

test('D2: a loaded pre-generator save keeps working normally (care actions, no throw) with creature/creatureHistory absent', () => {
  const storage = createFakeStorage();
  let legacy = initialState();
  delete legacy.creature;
  delete legacy.creatureHistory;
  legacy = applyEvent(legacy, hatched(at(0)));
  delete legacy.creature;
  delete legacy.creatureHistory;
  storage.setItem(SAVE_KEY, JSON.stringify({ state: legacy, lastSeen: at(0) }));

  const loaded = createPersistence(storage).load();
  let state = loaded.state;
  assert.doesNotThrow(() => {
    state = applyEvent(state, careActionPerformed('feed', 1, at(1)));
    state = applyEvent(state, careActionPerformed('tidy', 1, at(1)));
  }, 'ordinary care actions on a migrated save must not throw even though creature/creatureHistory are absent');
  assert.equal(state.stats.fullness, 100, 'clamped decay-free feed math unaffected by absent generator fields');
  assert.equal(state.cp, 2);
  assert.equal(Object.hasOwn(state, 'creature'), false, 'still no creature key -- nothing spuriously injects one');
});

test('D3: applying CreatureGenerated to a loaded pre-generator save preserves all care/growth/sticker/cap/clock ' +
     'state and starts creatureHistory empty (no prior identity to record)', async () => {
  const storage = createFakeStorage();
  let legacy = initialState();
  delete legacy.creature;
  delete legacy.creatureHistory;
  legacy = applyEvent(legacy, hatched(at(0)));
  legacy = {
    ...legacy,
    stats: { fullness: 33, spirit: 71, energy: 40 },
    cp: 9,
    actionsToday: 2,
    stickers: ['star', 'rainbow'],
    tuckedIn: true,
    dayKey: 'legacy-day-key-sentinel'
  };
  delete legacy.creature;
  delete legacy.creatureHistory;

  storage.setItem(SAVE_KEY, JSON.stringify({ state: legacy, lastSeen: at(0) }));
  const persistence = createPersistence(storage);
  const loaded = persistence.load();
  assert.ok(loaded, 'pre-generator save must load');

  const generated = (await generateCreature('9780399226908')).creature;
  let after;
  assert.doesNotThrow(() => {
    after = applyEvent(loaded.state, creatureGenerated(generated, at(1)));
  }, 'CreatureGenerated must not throw on a state that never had creature/creatureHistory keys');

  for (const key of ['hatched', 'stage', 'stats', 'cp', 'actionsToday', 'dayKey', 'stickers', 'tuckedIn']) {
    assert.deepEqual(after[key], loaded.state[key], `${key} is preserved across CreatureGenerated on a migrated save`);
  }
  assert.equal(after.name, generated.name);
  assert.deepEqual(after.creature, generated);
  assert.deepEqual(after.creatureHistory, [], 'no prior identity existed, so history starts empty (not undefined, not throwing)');

  // ...and it now round-trips normally going forward, generator fields included.
  persistence.save(after, at(1));
  const reloaded = createPersistence(storage).load();
  assert.deepEqual(reloaded.state, after);
});

// ---------------------------------------------------------------------------
// E. CreatureGenerated reducer edge cases (dedupe, malformed payload)
// ---------------------------------------------------------------------------

test('E1: re-applying CreatureGenerated with the SAME isbn does not duplicate history', async () => {
  const generated = (await generateCreature('9780064400558')).creature;
  let state = applyEvent(initialState(), creatureGenerated(generated, at(0)));
  state = applyEvent(state, hatched(at(0)));
  const again = { ...generated }; // e.g. re-scanning the same physical book
  state = applyEvent(state, creatureGenerated(again, at(1)));
  assert.deepEqual(state.creatureHistory, [], 'same isbn must not create a history entry');
  assert.equal(state.creature.isbn, generated.isbn);
});

test('E2: CreatureGenerated with a missing or wrong-kind creature payload is ignored, not thrown', () => {
  const before = applyEvent(initialState(), hatched(at(0)));

  let afterNull;
  assert.doesNotThrow(() => {
    afterNull = applyEvent(before, { type: 'CreatureGenerated', creature: null, at: at(1) });
  });
  assert.deepEqual(afterNull, before, 'null creature payload leaves state unchanged');

  let afterWrongKind;
  assert.doesNotThrow(() => {
    afterWrongKind = applyEvent(before, { type: 'CreatureGenerated', creature: { kind: 'not-book', isbn: 'x' }, at: at(1) });
  });
  assert.deepEqual(afterWrongKind, before, 'wrong-kind creature payload leaves state unchanged');
});
